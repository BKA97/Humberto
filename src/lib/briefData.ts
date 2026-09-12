import { db } from "./db";
import {
  newsEvents,
  newsEventCompanies,
  companies,
  marketSnapshots,
  attentionSnapshots,
  articles,
} from "./db/schema";
import { desc, eq, gte, type InferSelectModel } from "drizzle-orm";
import { summarizeCoverage } from "./dedupe";
import { attentionLevel } from "./attention";
import type { AttentionPlatform } from "./providers/types";

type NewsEventRow = InferSelectModel<typeof newsEvents>;

export interface BriefCard {
  event: {
    id: string;
    headline: string;
    summary: string;
    firstReportedAt: string | null;
    discoveredAt: string;
    mainstreamReachScore: number | null;
    mainstreamReachRationale: string | null;
  };
  company: { id: string; ticker: string; name: string };
  market: {
    price: number;
    previousClose: number | null;
    dollarChange: number | null;
    percentChange: number | null;
    session: string;
    volume: number | null;
    averageVolume: number | null;
    relativeVolume: number | null;
    observedAt: string;
    isEstimate: boolean;
  } | null;
  coverage: { totalArticles: number; uniqueArticles: number; uniqueOutlets: number; majorOutlets: number; firstReportedAt: string | null };
  attention: Partial<
    Record<
      AttentionPlatform,
      { value: number; metricLabel: string; percentVsBaseline: number | null; level: ReturnType<typeof attentionLevel>; isEstimate: boolean }
    >
  >;
  financialAttentionLevel: ReturnType<typeof attentionLevel>;
  publicAttentionLevel: ReturnType<typeof attentionLevel>;
}

export async function getBriefCards(sinceHours = 20): Promise<BriefCard[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const eventRows = await db.select().from(newsEvents).where(gte(newsEvents.discoveredAt, since)).orderBy(desc(newsEvents.discoveredAt));
  const cards = await buildCardsForEvents(eventRows);

  return cards.sort((a, b) => Math.abs(b.market?.percentChange ?? 0) - Math.abs(a.market?.percentChange ?? 0));
}

const ARCHIVE_PAGE_SIZE = 25;

/**
 * Every discovered event, tracked or not, paginated newest-first by when
 * your app found it (`discoveredAt`) — the shelf-life gap getBriefCards
 * leaves: Home/Morning Brief only ever show the last 20 hours, so anything
 * you didn't track effectively vanished from the UI after that (the row
 * itself was never deleted — see the append-only note on the schema — there
 * was just nowhere left to browse it). This is that browse view. `days`
 * narrows to events discovered in the last N days; omit it to page back
 * through everything.
 */
export async function getArchiveCards(opts?: { page?: number; days?: number }): Promise<{ cards: BriefCard[]; hasNextPage: boolean }> {
  const page = Math.max(1, opts?.page ?? 1);
  const offset = (page - 1) * ARCHIVE_PAGE_SIZE;

  const whereClause = opts?.days ? gte(newsEvents.discoveredAt, new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)) : undefined;

  const eventRows = await db
    .select()
    .from(newsEvents)
    .where(whereClause)
    .orderBy(desc(newsEvents.discoveredAt))
    .limit(ARCHIVE_PAGE_SIZE + 1) // one extra to know whether a next page exists, without a separate count query
    .offset(offset);

  const hasNextPage = eventRows.length > ARCHIVE_PAGE_SIZE;
  const pageRows = eventRows.slice(0, ARCHIVE_PAGE_SIZE);
  const cards = await buildCardsForEvents(pageRows);

  // Chronological, not ranked by move size — this is a browse/archive view,
  // not a "what matters most" view (see getBriefCards for that one).
  return { cards, hasNextPage };
}

async function buildCardsForEvents(eventRows: NewsEventRow[]): Promise<BriefCard[]> {
  if (eventRows.length === 0) return [];

  const cards: BriefCard[] = [];

  for (const event of eventRows) {
    const links = await db
      .select({ company: companies })
      .from(newsEventCompanies)
      .innerJoin(companies, eq(newsEventCompanies.companyId, companies.id))
      .where(eq(newsEventCompanies.newsEventId, event.id));

    const eventArticles = await db.select().from(articles).where(eq(articles.newsEventId, event.id));
    const coverageBase = summarizeCoverage(
      eventArticles.map((a) => ({ source: a.source, isSyndicatedCopyOf: a.isSyndicatedCopyOf }))
    );
    const majorOutlets = new Set(eventArticles.filter((a) => a.isMajorOutlet && !a.isSyndicatedCopyOf).map((a) => a.source)).size;
    const firstReported = eventArticles.reduce<string | null>((min, a) => {
      if (!a.publishedAt) return min;
      const iso = a.publishedAt.toISOString();
      return !min || iso < min ? iso : min;
    }, null);

    for (const { company } of links) {
      const [latestMarket] = await db
        .select()
        .from(marketSnapshots)
        .where(eq(marketSnapshots.companyId, company.id))
        .orderBy(desc(marketSnapshots.observedAt))
        .limit(1);

      const attentionRows = await db
        .select()
        .from(attentionSnapshots)
        .where(eq(attentionSnapshots.companyId, company.id))
        .orderBy(desc(attentionSnapshots.observedAt));

      const latestByPlatform: BriefCard["attention"] = {};
      for (const row of attentionRows) {
        if (latestByPlatform[row.platform]) continue; // already have the most recent for this platform
        if (row.value == null) continue;
        latestByPlatform[row.platform] = {
          value: row.value,
          metricLabel: row.metricLabel,
          percentVsBaseline: row.percentVsBaseline,
          level: attentionLevel({ percentVsBaseline: row.percentVsBaseline, rawValue: row.value }),
          isEstimate: row.isEstimate,
        };
      }

      const financialValues = [latestByPlatform.NEWS_FINANCIAL].filter(Boolean) as NonNullable<
        (typeof latestByPlatform)[AttentionPlatform]
      >[];
      const publicPlatforms: AttentionPlatform[] = ["NEWS_GENERAL", "X", "REDDIT", "TIKTOK", "INSTAGRAM", "YOUTUBE", "GDELT"];
      const publicValues = publicPlatforms.map((p) => latestByPlatform[p]).filter(Boolean) as NonNullable<
        (typeof latestByPlatform)[AttentionPlatform]
      >[];

      const strongestLevel = (vals: { level: ReturnType<typeof attentionLevel> }[]) => {
        const order = ["Very Low", "Low", "Medium", "High", "Very High"];
        return vals.reduce<ReturnType<typeof attentionLevel>>((max, v) => {
          if (!v.level) return max;
          if (!max) return v.level;
          return order.indexOf(v.level) > order.indexOf(max) ? v.level : max;
        }, null);
      };

      cards.push({
        event: {
          id: event.id,
          headline: event.headline,
          summary: event.summary,
          firstReportedAt: firstReported,
          discoveredAt: event.discoveredAt.toISOString(),
          mainstreamReachScore: event.mainstreamReachScore,
          mainstreamReachRationale: event.mainstreamReachRationale,
        },
        company,
        market: latestMarket
          ? {
              price: latestMarket.price,
              previousClose: latestMarket.previousClose,
              dollarChange: latestMarket.dollarChange,
              percentChange: latestMarket.percentChange,
              session: latestMarket.session,
              volume: latestMarket.volume,
              averageVolume: latestMarket.averageVolume,
              relativeVolume: latestMarket.relativeVolume,
              observedAt: latestMarket.observedAt.toISOString(),
              isEstimate: latestMarket.isEstimate,
            }
          : null,
        coverage: { ...coverageBase, majorOutlets, firstReportedAt: firstReported },
        attention: latestByPlatform,
        financialAttentionLevel: strongestLevel(financialValues),
        publicAttentionLevel: strongestLevel(publicValues),
      });
    }
  }

  return cards;
}
