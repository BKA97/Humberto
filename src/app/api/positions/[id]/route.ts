import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { positions, companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMarketDataProvider } from "@/lib/providers/market";
import { getBenchmarkProvider, DEFAULT_BENCHMARK_SYMBOL } from "@/lib/providers/benchmark";
import { currentMarketSession } from "@/lib/marketCalendar";
import { captureMarketSnapshot } from "@/lib/ingest/market";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const rows = await db
    .select({ position: positions, company: companies })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .where(eq(positions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Position not found." }, { status: 404 });
  if (row.position.status === "CLOSED") {
    return NextResponse.json({ error: "Position is already closed." }, { status: 409 });
  }

  const provider = getMarketDataProvider();
  const quote = await provider.getQuote(row.company.ticker);
  if (!quote.available) {
    return NextResponse.json({ error: `Could not fetch a closing price: ${quote.reason}` }, { status: 502 });
  }

  // Also record this as an official snapshot, same as the ingestion cycle would.
  await captureMarketSnapshot({ companyId: row.company.id, ticker: row.company.ticker });

  const benchmark = await getBenchmarkProvider().getLevel(DEFAULT_BENCHMARK_SYMBOL);

  const [updated] = await db
    .update(positions)
    .set({
      status: "CLOSED",
      exitPrice: quote.value.price,
      exitTimestamp: new Date(quote.value.observedAt),
      exitSession: currentMarketSession(),
      exitBenchmarkLevel: benchmark.available ? benchmark.value.level : null,
      updatedAt: new Date(),
    })
    .where(eq(positions.id, id))
    .returning();

  return NextResponse.json({ position: updated });
}
