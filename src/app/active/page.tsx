import Link from "next/link";
import { listPositionsWithDetail } from "@/lib/positions";
import { CloseButton } from "@/components/CloseButton";

export const dynamic = "force-dynamic";

export default async function ActivePage() {
  const positions = await listPositionsWithDetail("ACTIVE");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Active</h1>
      {positions.length === 0 ? (
        <div className="card">
          <p className="font-medium">Nothing tracked yet.</p>
          <p className="mt-1 text-sm text-(--color-foreground-muted)">
            Track a position from the Morning Brief, or search for any ticker above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map(({ position, company, newsEvent, tags, liveQuote }) => {
            const current = liveQuote?.price ?? null;
            const returnPct = current != null ? ((current - position.entryPrice) / position.entryPrice) * 100 : null;
            const dollarReturn = current != null ? current - position.entryPrice : null;
            // This is a Server Component re-evaluated fresh on every request
            // (dynamic = "force-dynamic"), so a wall-clock read here is safe —
            // it is not memoized or cached across renders.
            // eslint-disable-next-line react-hooks/purity
            const days = Math.max(0, Math.round((Date.now() - position.entryTimestamp.getTime()) / 86400000));

            return (
              <div key={position.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/position/${position.id}`} className="text-base font-semibold hover:underline">
                      {company.ticker} <span className="font-normal text-(--color-foreground-muted)">— {company.name}</span>
                    </Link>
                    <div className="mt-1 num text-sm text-(--color-foreground-muted)">
                      Entry: ${position.entryPrice.toFixed(2)}
                      {current != null && ` · Current: $${current.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    {returnPct != null && (
                      <div className="num text-lg font-semibold" style={{ color: returnPct >= 0 ? "var(--positive)" : "var(--negative)" }}>
                        {returnPct >= 0 ? "+" : ""}
                        {returnPct.toFixed(2)}%
                      </div>
                    )}
                    {dollarReturn != null && (
                      <div className="num text-xs text-(--color-foreground-muted)">
                        {dollarReturn >= 0 ? "+" : ""}${dollarReturn.toFixed(2)}/share
                      </div>
                    )}
                    <div className="text-xs text-(--color-foreground-muted)">
                      Tracked: {days} day{days === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {newsEvent && (
                  <div className="text-sm text-(--color-foreground-muted)">
                    Original event: <span className="text-(--color-foreground)">{newsEvent.headline}</span>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="badge bg-(--color-surface-muted)">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <div className="mb-0.5 text-xs font-medium text-(--color-foreground-muted)">Your thesis</div>
                  <p className="line-clamp-2 text-sm">{position.thesis}</p>
                </div>

                <div className="flex justify-end">
                  <CloseButton positionId={position.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
