import { ingestSingleTicker } from "@/lib/ingest/single";
import { getBenchmarkProvider, DEFAULT_BENCHMARK_SYMBOL } from "@/lib/providers/benchmark";
import { db } from "@/lib/db";
import { attentionSnapshots, newsEvents, tags as tagsTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { TrackForm } from "@/components/TrackForm";
import { INITIAL_TAGS } from "@/lib/tags";

export const dynamic = "force-dynamic";

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const { event: newsEventId } = await searchParams;
  const ticker = rawTicker.toUpperCase();

  const { company, snapshot } = await ingestSingleTicker(ticker);
  if (!snapshot) {
    return (
      <div className="card">
        <p className="font-medium">Couldn&apos;t fetch a current price for {ticker}.</p>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          The market data provider didn&apos;t return a quote — the ticker may be invalid, or the provider may be
          temporarily unavailable. Try again shortly.
        </p>
      </div>
    );
  }

  const [benchmark, latestAttention, event, tagRows] = await Promise.all([
    getBenchmarkProvider().getLevel(DEFAULT_BENCHMARK_SYMBOL),
    db.select().from(attentionSnapshots).where(eq(attentionSnapshots.companyId, company.id)).orderBy(desc(attentionSnapshots.observedAt)),
    newsEventId ? db.select().from(newsEvents).where(eq(newsEvents.id, newsEventId)).limit(1) : Promise.resolve([]),
    db.select().from(tagsTable),
  ]);
  const availableTags = tagRows.length > 0 ? tagRows.map((t) => t.name) : INITIAL_TAGS;

  // Keep only the most recent snapshot per platform as "original context."
  const seenPlatforms = new Set<string>();
  const originalAttentionSnapshotIds: string[] = [];
  for (const row of latestAttention) {
    if (seenPlatforms.has(row.platform)) continue;
    seenPlatforms.add(row.platform);
    originalAttentionSnapshotIds.push(row.id);
  }

  const context = {
    companyId: company.id,
    ticker: company.ticker,
    companyName: company.name,
    entryPrice: snapshot.price,
    entryTimestamp: snapshot.observedAt.toISOString(),
    entrySession: snapshot.session,
    entryBenchmarkLevel: benchmark.available ? benchmark.value.level : null,
    newsEventId: newsEventId ?? null,
    originalReactionSnapshotIds: [snapshot.id],
    originalAttentionSnapshotIds,
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          Track {company.ticker} <span className="font-normal text-(--color-foreground-muted)">— {company.name}</span>
        </h1>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          Entry price captured just now: <span className="num font-medium text-(--color-foreground)">${snapshot.price.toFixed(2)}</span>{" "}
          ({snapshot.session.replace("_", " ").toLowerCase()}, {new Date(snapshot.observedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York" })} ET)
        </p>
        {event[0] && <p className="mt-2 text-sm italic text-(--color-foreground-muted)">Re: {event[0].headline}</p>}
      </div>
      <TrackForm context={context} availableTags={availableTags} />
    </div>
  );
}
