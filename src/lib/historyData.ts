import { db } from "./db";
import { positions, companies, newsEvents, tags as tagsTable, positionTags, marketSnapshots, attentionSnapshots } from "./db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { computeReturns, holdingPeriodDays } from "./returns";
import { attentionLevel } from "./attention";
import type { AttentionPlatform } from "./providers/types";

export interface HistoryRow {
  id: string;
  ticker: string;
  companyName: string;
  entryPrice: number;
  entryTimestamp: string;
  exitPrice: number;
  exitTimestamp: string;
  holdingPeriodDays: number;
  stockReturnPercent: number;
  benchmarkReturnPercent: number | null;
  relativeReturnPercent: number | null;
  eventHeadline: string | null;
  tags: string[];
  initialReactionPercent: number | null;
  financialAttentionLevel: string | null;
  publicAttentionLevel: string | null;
  thesis: string;
}

export async function getHistoryRows(): Promise<HistoryRow[]> {
  const rows = await db
    .select({ position: positions, company: companies, newsEvent: newsEvents })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .leftJoin(newsEvents, eq(positions.newsEventId, newsEvents.id))
    .where(eq(positions.status, "CLOSED"))
    .orderBy(desc(positions.exitTimestamp));

  const result: HistoryRow[] = [];

  for (const { position, company, newsEvent } of rows) {
    const tagRows = await db
      .select({ name: tagsTable.name })
      .from(positionTags)
      .innerJoin(tagsTable, eq(positionTags.tagId, tagsTable.id))
      .where(eq(positionTags.positionId, position.id));

    const returns = computeReturns({
      entryPrice: position.entryPrice,
      exitPrice: position.exitPrice!,
      entryBenchmarkLevel: position.entryBenchmarkLevel,
      exitBenchmarkLevel: position.exitBenchmarkLevel,
    });

    let initialReactionPercent: number | null = null;
    const reactionIds = (position.originalReactionSnapshotIds as string[] | null) ?? [];
    if (reactionIds.length > 0) {
      const snaps = await db.select().from(marketSnapshots).where(inArray(marketSnapshots.id, reactionIds));
      initialReactionPercent = snaps[0]?.percentChange ?? null;
    }

    let financialAttentionLevel: string | null = null;
    let publicAttentionLevel: string | null = null;
    const attentionIds = (position.originalAttentionSnapshotIds as string[] | null) ?? [];
    if (attentionIds.length > 0) {
      const snaps = await db.select().from(attentionSnapshots).where(inArray(attentionSnapshots.id, attentionIds));
      const order = ["Very Low", "Low", "Medium", "High", "Very High"];
      const strongest = (platforms: AttentionPlatform[]) => {
        let max: string | null = null;
        for (const s of snaps.filter((s) => platforms.includes(s.platform))) {
          const lvl = attentionLevel({ percentVsBaseline: s.percentVsBaseline, rawValue: s.value });
          if (lvl && (!max || order.indexOf(lvl) > order.indexOf(max))) max = lvl;
        }
        return max;
      };
      financialAttentionLevel = strongest(["NEWS_FINANCIAL"]);
      publicAttentionLevel = strongest(["NEWS_GENERAL", "X", "REDDIT", "TIKTOK", "INSTAGRAM", "YOUTUBE"]);
    }

    result.push({
      id: position.id,
      ticker: company.ticker,
      companyName: company.name,
      entryPrice: position.entryPrice,
      entryTimestamp: position.entryTimestamp.toISOString(),
      exitPrice: position.exitPrice!,
      exitTimestamp: position.exitTimestamp!.toISOString(),
      holdingPeriodDays: holdingPeriodDays(position.entryTimestamp, position.exitTimestamp!),
      stockReturnPercent: returns.stockReturnPercent,
      benchmarkReturnPercent: returns.benchmarkReturnPercent,
      relativeReturnPercent: returns.relativeReturnPercent,
      eventHeadline: newsEvent?.headline ?? null,
      tags: tagRows.map((t) => t.name),
      initialReactionPercent,
      financialAttentionLevel,
      publicAttentionLevel,
      thesis: position.thesis,
    });
  }

  return result;
}
