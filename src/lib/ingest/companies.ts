import { db } from "../db";
import { companies } from "../db/schema";
import { eq } from "drizzle-orm";
import { getMarketDataProvider } from "../providers/market";

export async function getOrCreateCompany(ticker: string, knownName?: string) {
  const t = ticker.trim().toUpperCase();
  const existing = await db.select().from(companies).where(eq(companies.ticker, t)).limit(1);
  if (existing[0]) return existing[0];

  let name = knownName ?? t;
  if (!knownName) {
    const provider = getMarketDataProvider();
    const result = await provider.searchTicker(t);
    if (result.available) {
      const exact = result.value.find((m) => m.ticker.toUpperCase() === t);
      if (exact) name = exact.name;
    }
  }

  const [row] = await db.insert(companies).values({ ticker: t, name }).returning();
  return row;
}
