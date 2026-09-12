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
import { analyzeStoryMainstreamReach } from "../llm/storyAnalysis";

type ArticleRow = InferSelectModel<typeof articlesTable>;

/**
 * News-first discovery (spec §4): tickers are discovered FROM the news, not
 * the other way around. Each cycle:
 *   1. Pull broad, ticker-less news from every configured provider that
 *      supports it (TheNewsAPI's general/mainstream feed doesn't tag
 *      companies itself, so untagged articles get matched against a cached
 *      ticker/name directory — see companyMatch.ts).
 *   2. Also pull ticker-specific news for anything you're actively tracking
 *      (getMustMonitorTickers), so an open position keeps getting detailed
 *      coverage even on a day the broad feed misses it.
 *   3. Near-duplicate headlines across the whole batch — regardless of
 *      which query surfaced them — are treated as one story, which is what
 *      lets one event correctly fan out to several affected companies
 *      (spec §30). This is a heuristic, not true entity resolution (see
 *      SPEC-NOTES.md).
 *   4. Each newly-created event gets a one-time LLM "mainstream reach" read
 *      (see ../llm/storyAnalysis.ts) — a descriptive classification, never
 *      a judgment about whether the reaction is justified. Any people/
 *      companies it names get resolved against the real symbol directory
 *      (never trusted from the LLM directly) and merged into this event's
 *      tickers — this is what lets a story about an executive surface a
 *      ticker even when the company itself isn't named in the text.
 *   5. Market + attention snapshots are captured for every company that
 *      surfaced this cycle, plus everything in the must-monitor list.
 *
 * `thorough` (default true) controls both step 2 and whether rate-limit-
 * sensitive attention providers (GDELT) run this cycle. It exists because
 * the default general-news provider (TheNewsAPI) has a thin free-tier
 * request budget — historically ~100/day — and GDELT's free tier is prone
 * to rate limiting under frequent polling. Intraday polling (see
 * /api/cron/poll) passes false so each tick stays cheap regardless of how
 * many open positions or companies you're tracking; the once-daily morning
 * brief (see /api/cron/morning-brief) passes true (or omits it) to get the
 * fuller, more expensive pass once a day. Must-monitor tickers still get a
 * price/attention snapshot every cycle either way (see the bottom of this
 * function) — this flag only affects the extra, costlier lookups.
 */
export async function ingestDiscoveryCycle(opts?: { sinceHours?: number; thorough?: boolean }) {
  const since = new Date(Date.now() - (opts?.sinceHours ?? 20) * 60 * 60 * 1000);
  const thorough = opts?.thorough ?? true;

  await refreshSymbolDirectoryIfStale();
  const mustMonitor = await getMustMonitorTickers();
  const matchIndex = await getMatchIndex(); // cheap — cached in-memory for a few minutes, see symbolDirectory.ts

  const providers = getNewsProviders();
  const [broadResults, perTickerResults] = await Promise.all([
    Promise.all(providers.map((p) => p.getRecentArticles({ since }))),
    thorough
      ? Promise.all(
          mustMonitor.map(async (ticker) => ({
            ticker,
            results: await Promise.all(providers.map((p) => p.getRecentArticles({ tickers: [ticker], since }))),
          }))
        )
      : Promise.resolve([]),
  ]);

  const flat: RawArticle[] = [];
  for (const r of broadResults) if (r.available) flat.push(...r.value);
  for (const { ticker, results } of perTickerResults) {
    for (const r of results) {
      if (r.available) flat.push(...r.value.map((a) => ({ ...a, tickers: Array.from(new Set([...(a.tickers ?? []), ticker])) })));
    }
  }

  // Backfill tickers for articles no provider tagged via name/cashtag matching.
  const untagged = flat.filter((a) => !a.tickers || a.tickers.length === 0);
  for (const a of untagged) {
    a.tickers = matchTickersInText(`${a.headline} ${a.summary ?? ""}`, matchIndex);
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

      // Ticker(s) the LLM's name-extraction surfaces for THIS event, on top
      // of whatever companyMatch.ts already found from the raw article
      // text. Only populated for newly-created events — see below.
      const llmExtraTickers: string[] = [];

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

        // One-time LLM read per new event (spec: see storyAnalysis.ts doc
        // comment on why this is a descriptive classification, not a
        // verdict). Silently unavailable without ANTHROPIC_API_KEY.
        const analysis = await analyzeStoryMainstreamReach({
          headline: original.headline,
          summary: original.summary,
        });
        if (analysis.available) {
          const { mainstreamReachScore, rationale, companies: llmCompanies, people } = analysis.value;
          await db
            .update(newsEvents)
            .set({
              mainstreamReachScore,
              mainstreamReachRationale: rationale,
              llmExtractedPeople: people,
              llmAnalyzedAt: new Date(),
            })
            .where(eq(newsEvents.id, newsEventId));

          // Resolve every name the LLM surfaced against the REAL symbol
          // directory — never trust a ticker the LLM might itself have
          // guessed, since that's a real hallucination risk.
          const namesToResolve = [
            ...llmCompanies.map((c) => c.name),
            ...people.map((p) => p.likelyCompany).filter((n): n is string => Boolean(n)),
          ];
          for (const name of namesToResolve) {
            llmExtraTickers.push(...matchTickersInText(name, matchIndex));
          }
        }
      }

      const allTickers = Array.from(new Set([...members.flatMap((m) => m.tickers), ...llmExtraTickers]));
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

    await captureSocialAttentionSnapshots({
      companyId: company.id,
      ticker,
      companyName: company.name,
      includeLowFrequencyProviders: thorough,
    });
  }

  return {
    ...summary,
    companiesTouched: summary.companiesTouched.size,
    tickersDiscoveredFromNews: new Set(withCompanies.flatMap((a) => a.tickers)).size,
    tickersMonitored: allTickersToSnapshot.size,
  };
}
