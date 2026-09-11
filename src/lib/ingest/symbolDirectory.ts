import { db } from "../db";
import { symbolDirectory } from "../db/schema";
import { sql } from "drizzle-orm";
import { buildMatchIndex, CompanyMatchIndex } from "../companyMatch";

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly is plenty — company lists don't move fast
const BATCH_SIZE = 1000;

interface FinnhubSymbol {
  symbol: string;
  description: string;
  type: string;
}

/**
 * Refreshes the cached ticker/name directory used for matching untagged
 * general news to companies (spec §4 — discovery starts from the news, not
 * a fixed ticker list). Requires FINNHUB_API_KEY; silently does nothing
 * without one, since there's no other free source of a full symbol list —
 * matching against Finnhub- or Marketaux-tagged articles still works fine
 * without this, just with less coverage for *untagged* sources.
 */
export async function refreshSymbolDirectoryIfStale(): Promise<void> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return;

  const [{ mostRecent } = { mostRecent: null }] = await db
    .select({ mostRecent: sql<Date | null>`max(${symbolDirectory.updatedAt})` })
    .from(symbolDirectory);

  if (mostRecent && Date.now() - new Date(mostRecent).getTime() < REFRESH_INTERVAL_MS) {
    return;
  }

  const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${apiKey}`, {
    cache: "no-store",
  });
  if (!res.ok) return; // best-effort — keep whatever directory we already have

  const data: FinnhubSymbol[] = await res.json();
  const rows = data
    .filter((s) => s.type === "Common Stock" && s.symbol && !s.symbol.includes("."))
    .map((s) => ({ ticker: s.symbol.toUpperCase(), name: s.description, updatedAt: new Date() }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(symbolDirectory)
      .values(batch)
      .onConflictDoUpdate({
        target: symbolDirectory.ticker,
        set: { name: sql`excluded.name`, updatedAt: sql`excluded.updated_at` },
      });
  }
}

let cachedIndex: { index: CompanyMatchIndex; loadedAt: number } | null = null;
const IN_MEMORY_CACHE_MS = 5 * 60 * 1000;

/** Loaded once per warm serverless instance and reused for a few minutes — avoids re-reading thousands of rows on every request. */
export async function getMatchIndex(): Promise<CompanyMatchIndex> {
  if (cachedIndex && Date.now() - cachedIndex.loadedAt < IN_MEMORY_CACHE_MS) {
    return cachedIndex.index;
  }
  const rows = await db.select().from(symbolDirectory);
  const index = buildMatchIndex(rows);
  cachedIndex = { index, loadedAt: Date.now() };
  return index;
}
