import { db } from "../db";
import { marketSnapshots, ingestionLogs } from "../db/schema";
import { getMarketDataProvider } from "../providers/market";

/**
 * Always inserts a NEW snapshot row rather than updating a prior one (spec
 * §31: preserve every observation). Returns the observation so callers can
 * react to it (e.g. attach it to a position or event) without a re-query.
 */
export async function captureMarketSnapshot(opts: {
  companyId: string;
  ticker: string;
  newsEventId?: string | null;
}) {
  const provider = getMarketDataProvider();
  const result = await provider.getQuote(opts.ticker);

  if (!result.available) {
    await db.insert(ingestionLogs).values({
      source: provider.name,
      operation: "getQuote",
      status: "failure",
      detail: `${opts.ticker}: ${result.reason}`,
    });
    return null;
  }

  const q = result.value;
  const [row] = await db
    .insert(marketSnapshots)
    .values({
      companyId: opts.companyId,
      newsEventId: opts.newsEventId ?? null,
      session: q.session,
      price: q.price,
      previousClose: q.previousClose,
      dollarChange: q.dollarChange,
      percentChange: q.percentChange,
      volume: q.volume,
      averageVolume: q.averageVolume,
      relativeVolume: q.relativeVolume,
      observedAt: new Date(q.observedAt),
      source: result.provenance.source,
      isEstimate: result.provenance.isEstimate,
    })
    .returning();
  return row;
}
