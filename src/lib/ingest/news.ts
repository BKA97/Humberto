import { db } from "../db";
import { newsEvents, newsEventCompanies, articles as articlesTable } from "../db/schema";
import { and, eq, gte, inArray, type InferSelectModel } from "drizzle-orm";
import { getNewsProviders } from "../providers/news";
import { RawArticle } from "../providers/types";
import { detectSyndication } from "../dedupe";
import { matchTickersInText } from "../companyMatch";
import { getMatchIndex, refreshSymbolDirectoryIfStale } from "./symbolDirectory";
import { getOrCreateCompany } from "./companies";
import { getMustMonitorTickers } from "./watchlist";
import { captureMarketSnapshot } from "./market";
import { captureNewsAttentionSnapshot, captureSocialAttentionSnapshots } from "./attention";

type ArticleRow = InferSelectModel<typeof articlesTable>;

/**
 * News-first discovery (spec §4): tickers are discovered FROM the news, not
 * the other way around. Each cycle:
 *   1. Pull broad, ticker-less news from every configured provider that
 *      supports it (Marketaux tags companies itself; Finnhub's general feed
 *      doesn't, so untagged articles get matched against a cached ticker/
 *      name directory — see companyMatch.ts).
 *   2. Also pull ticker-specific news for anything you're actively tracking
 *      (getMustMonitorTickers), so an open position keeps getting detailed
 *      coverage even on a day the broad feed misses it.
 *   3. Near-duplicate headlines across the whole batch — regardless of
 *      which query surfaced them — are treated as one story, which is what
 *      lets one event correctly fan out to several affected companies
 *      (spec §30). This is a heuristic, not true entity resolution (see
 *      SPEC-NOTES.md).
 *   4. Market + attention snapshots are captured for every company that
 *      surfaced this cycle, plus everything in the must-monitor list.
 */
export async function ingestDiscoveryCycle(opts?: { sinceHours?: number }) {
  const since = new Date(Date.now() - (opts?.sinceHours ?? 20) * 60 * 60 * 1000);

  await refreshSymbolDirectoryIfStale();
  const mustMonitor = await getMustMonitorTickers();

  const providers = getNewsProviders();
  const [broadResults, perTickerResults] = await Promise.all([
    Promise.all(providers.map((p) => p.getRecentArticles({ since }))),
    Promise.all(
      mustMonitor.map(async (ticker) => ({
        ticker,
        results: await Promise.all(providers.map((p) => p.getRecentArticles({ tickers: [ticker], since }))),
      }))
    ),
  ]);

  const flat: RawArticle[] = [];
  for (const r of broadResults) if (r.available) flat.push(...r.value);
  for (const { ticker, results } of perTickerResults) {
    for (const r of results) {
      if (r.available) flat.push(...r.value.map((a) => ({ ...a, tickers: Array.from(new Set([...(a.tickers ?? []), ticker])) })));
    }
  }

  // Backfill tickers for articles no provider tagged (Finnhub's general feed) via name/cashtag matching.
  const untagged = flat.filter((a) => !a.tickers || a.tickers.length === 0);
  if (untagged.length > 0) {
    const matchIndex = await getMatchIndex();
    for (const a of untagged) {
      a.tickers = matchTickersInText(`${a.headline} ${a.summary ?? ""}`, matchIndex);
    }
  }

  const withCompanies = flat.filter((a) => a.tickers && a.tickers.length > 0);

  const summary = { eventsCreated: 0, articlesInserted: 0, companiesTouched: new Set<string>() };

  if (withCompanies.length > 0) {
    const dedupeInputs = withCompanies.map((a) => ({ headline: a.headline, url: a.url, publishedAt: a.publishedAt }));
    const dedupeResults = detectSyndication(dedupeInputs);

    const clusters = new Map<number, number[]>();
    dedupeResults.forEach((r, i) => {
      const key = r.isDuplicate ? r.originalIndex! : i;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(i);
    });

    for (const memberIdxs of clusters.values()) {
      const members = memberIdxs
        .map((i) => withCompanies[i])
        .sort((a, b) => (a.publishedAt ? Date.parse(a.publishedAt) : Infinity) - (b.publishedAt ? Date.parse(b.publishedAt) : Infinity));

      const urls = members.map((m) => m.url);
      const existing = await db.select().from(articlesTable).where(inArray(articlesTable.url, urls));
      const existingByUrl = new Map(existing.map((e) => [e.url, e]));

      let newsEventId: string | null = existing[0]?.newsEventId ?? null;
      let anchorArticleId: string | null = existing.find((e) => !e.isSyndicatedCopyOf)?.id ?? existing[0]?.id ?? null;

      if (!newsEventId) {
        const original = members[0];
        const allTickers = Array.from(new Set(members.flatMap((m) => m.tickers)));
        const [event] = await db
          .insert(newsEvents)
          .values({
            headline: original.headline,
            summary: original.summary ?? `News coverage detected for ${allTickers.join(", ")}.`,
            firstReportedAt: original.publishedAt ? new Date(original.publishedAt) : null,
          })
          .returning();
        newsEventId = event.id;
        summary.eventsCreated++;
      }

      const allTickers = Array.from(new Set(members.flatMap((m) => m.tickers)));
      for (const ticker of allTickers) {
        const company = await getOrCreateCompany(ticker);
        summary.companiesTouched.add(company.id);
        await db
          .insert(newsEventCompanies)
          .values({ newsEventId, companyId: company.id })
          .onConflictDoNothing();
      }

      for (const m of members) {
        if (existingByUrl.has(m.url)) continue; // already ingested in a prior cycle
        const insertedRows: ArticleRow[] = await db
          .insert(articlesTable)
          .values({
            newsEventId,
            source: m.source,
            headline: m.headline,
            url: m.url,
            publishedAt: m.publishedAt ? new Date(m.publishedAt) : null,
            isFinancialOutlet: m.isFinancialOutlet,
            isMajorOutlet: m.isMajorOutlet,
            isSyndicatedCopyOf: anchorArticleId,
            provenanceSource: m.providerName ?? "unknown",
          })
          .returning();
        const row: ArticleRow = insertedRows[0];
        summary.articlesInserted++;
        if (!anchorArticleId) anchorArticleId = row.id; // first inserted becomes the anchor for the rest of this cluster
      }
    }
  }

  // Refresh market + attention data for every company discovered this cycle,
  // plus everything on the must-monitor list (spec §15: an active
  // position's price must keep updating even with no fresh news).
  const allTickersToSnapshot = new Set<string>(mustMonitor);
  for (const a of withCompanies) for (const t of a.tickers) allTickersToSnapshot.add(t);

  for (const ticker of allTickersToSnapshot) {
    const company = await getOrCreateCompany(ticker);
    await captureMarketSnapshot({ companyId: company.id, ticker });

    const recentArticles = await db
      .select({ a: articlesTable })
      .from(articlesTable)
      .innerJoin(newsEventCompanies, eq(articlesTable.newsEventId, newsEventCompanies.newsEventId))
      .where(and(eq(newsEventCompanies.companyId, company.id), gte(articlesTable.publishedAt, since)));

    const uniqueArticles = recentArticles.map((r) => r.a).filter((a) => !a.isSyndicatedCopyOf);
    await captureNewsAttentionSnapshot({
      companyId: company.id,
      financialArticleCount: uniqueArticles.filter((a) => a.isFinancialOutlet).length,
      generalArticleCount: uniqueArticles.filter((a) => !a.isFinancialOutlet).length,
      uniqueOutletCount: new Set(uniqueArticles.map((a) => a.source)).size,
    });

    await captureSocialAttentionSnapshots({ companyId: company.id, ticker, companyName: company.name });
  }

  return {
    ...summary,
    companiesTouched: summary.companiesTouched.size,
    tickersDiscoveredFromNews: new Set(withCompanies.flatMap((a) => a.tickers)).size,
    tickersMonitored: allTickersToSnapshot.size,
  };
}
