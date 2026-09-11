import { db } from "../db";
import { positions, companies } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Discovery is news-first (spec §4): the app scans broad news and finds out
 * which tickers are affected from the articles themselves — see
 * ingestDiscoveryCycle() in ./news.ts. This list is NOT what drives
 * discovery; it's just tickers you want monitored (price + attention)
 * every cycle even on a day with zero news about them. Empty by default —
 * add your own if there's something you want tracked unconditionally.
 */
export const SUPPLEMENTAL_TICKERS: string[] = [];

/** Tickers that must be monitored every cycle regardless of today's news: anything with an open position, plus the supplemental list above. */
export async function getMustMonitorTickers(): Promise<string[]> {
  const active = await db
    .select({ ticker: companies.ticker })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .where(eq(positions.status, "ACTIVE"));

  const set = new Set<string>(SUPPLEMENTAL_TICKERS);
  for (const row of active) set.add(row.ticker);
  return Array.from(set);
}
