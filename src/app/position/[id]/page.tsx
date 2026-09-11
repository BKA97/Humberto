import { db } from "@/lib/db";
import { positions, companies, newsEvents, tags as tagsTable, positionTags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getMarketDataProvider } from "@/lib/providers/market";
import { computeReturns, holdingPeriodDays } from "@/lib/returns";
import { CloseButton } from "@/components/CloseButton";
import { DEFAULT_BENCHMARK_LABEL } from "@/lib/providers/benchmark";

export const dynamic = "force-dynamic";

export default async function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select({ position: positions, company: companies, newsEvent: newsEvents })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .leftJoin(newsEvents, eq(positions.newsEventId, newsEvents.id))
    .where(eq(positions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const { position, company, newsEvent } = row;

  const tagRows = await db
    .select({ name: tagsTable.name })
    .from(positionTags)
    .innerJoin(tagsTable, eq(positionTags.tagId, tagsTable.id))
    .where(eq(positionTags.positionId, position.id));

  let currentPrice: number | null = null;
  if (position.status === "ACTIVE") {
    const q = await getMarketDataProvider().getQuote(company.ticker);
    if (q.available) currentPrice = q.value.price;
  }

  const effectivePrice = position.status === "CLOSED" ? position.exitPrice! : currentPrice;
  const returns =
    effectivePrice != null
      ? computeReturns({
          entryPrice: position.entryPrice,
          exitPrice: effectivePrice,
          entryBenchmarkLevel: position.entryBenchmarkLevel,
          exitBenchmarkLevel: position.status === "CLOSED" ? position.exitBenchmarkLevel : position.entryBenchmarkLevel,
        })
      : null;
  const days = holdingPeriodDays(position.entryTimestamp, position.status === "CLOSED" ? position.exitTimestamp! : new Date());

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {company.ticker} <span className="font-normal text-(--color-foreground-muted)">— {company.name}</span>
          </h1>
          <span className="badge mt-1 bg-(--color-surface-muted)">{position.status === "ACTIVE" ? "Active" : "Closed"}</span>
        </div>
        {position.status === "ACTIVE" && <CloseButton positionId={position.id} />}
      </div>

      <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Entry" value={`$${position.entryPrice.toFixed(2)}`} />
        <Field
          label={position.status === "CLOSED" ? "Exit" : "Current"}
          value={effectivePrice != null ? `$${effectivePrice.toFixed(2)}` : "Not available"}
        />
        <Field
          label="Return"
          value={returns ? `${returns.stockReturnPercent >= 0 ? "+" : ""}${returns.stockReturnPercent.toFixed(2)}%` : "—"}
          color={returns ? (returns.stockReturnPercent >= 0 ? "var(--positive)" : "var(--negative)") : undefined}
        />
        <Field label="Holding period" value={`${days.toFixed(1)} day${days === 1 ? "" : "s"}`} />
      </div>

      {returns?.relativeReturnPercent != null && (
        <div className="card">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-foreground-muted)">
            Vs. benchmark ({DEFAULT_BENCHMARK_LABEL})
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Stock return" value={`${returns.stockReturnPercent >= 0 ? "+" : ""}${returns.stockReturnPercent.toFixed(2)}%`} />
            <Field label="Benchmark return" value={`${returns.benchmarkReturnPercent! >= 0 ? "+" : ""}${returns.benchmarkReturnPercent!.toFixed(2)}%`} />
            <Field
              label="Relative return"
              value={`${returns.relativeReturnPercent >= 0 ? "+" : ""}${returns.relativeReturnPercent.toFixed(2)}%`}
              color={returns.relativeReturnPercent >= 0 ? "var(--positive)" : "var(--negative)"}
            />
          </div>
        </div>
      )}

      {newsEvent && (
        <div className="card">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-foreground-muted)">Original event</div>
          <a href={`/events/${newsEvent.id}`} className="text-sm font-medium underline">
            {newsEvent.headline}
          </a>
        </div>
      )}
      {position.reasonNote && (
        <div className="card">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-foreground-muted)">Reason</div>
          <p className="text-sm">{position.reasonNote}</p>
        </div>
      )}

      {tagRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagRows.map((t) => (
            <span key={t.name} className="badge bg-(--color-surface-muted)">
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="card">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-foreground-muted)">
          Your thesis, at entry ({new Date(position.entryTimestamp).toLocaleString("en-US", { timeZone: "America/New_York" })} ET)
        </div>
        <p className="whitespace-pre-wrap text-sm">{position.thesis}</p>
      </div>
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-(--color-foreground-muted)">{label}</div>
      <div className="num font-medium" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
