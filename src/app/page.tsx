import Link from "next/link";
import { getBriefCards } from "@/lib/briefData";
import { listPositionsWithDetail } from "@/lib/positions";
import { NewsEventCard } from "@/components/NewsEventCard";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getResearchDayOne() {
  const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, "research_day_one")).limit(1);
  if (row) return row.value;
  const now = new Date().toISOString();
  await db.insert(systemConfig).values({ key: "research_day_one", value: now }).onConflictDoNothing();
  return now;
}

export default async function HomePage() {
  const [cards, activePositions, dayOne] = await Promise.all([
    getBriefCards(20),
    listPositionsWithDetail("ACTIVE"),
    getResearchDayOne(),
  ]);

  const bigMovers = cards.filter((c) => Math.abs(c.market?.percentChange ?? 0) >= 5);
  const highAttention = cards.filter((c) => c.publicAttentionLevel === "High" || c.publicAttentionLevel === "Very High");
  const top = cards.slice(0, 3);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-lg font-semibold">Today</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="News events" value={cards.length} />
          <StatTile label="Stocks with >5% moves" value={bigMovers.length} />
          <StatTile label="High public-attention events" value={highAttention.length} />
          <StatTile label="Active positions" value={activePositions.length} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Today&apos;s biggest stories</h2>
          <Link href="/morning-brief" className="text-sm font-medium text-(--color-accent) underline">
            View full Morning Brief →
          </Link>
        </div>
        {top.length === 0 ? (
          <EmptyState
            title="Your research starts today."
            body="As events are ingested, they'll show up here — with market reaction, news coverage, and public attention side by side."
            dayOne={dayOne}
          />
        ) : (
          <div className="space-y-4">
            {top.map((c) => (
              <NewsEventCard key={`${c.event.id}-${c.company.id}`} card={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Currently Tracking</h2>
        {activePositions.length === 0 ? (
          <p className="text-sm text-(--color-foreground-muted)">
            Nothing tracked yet. Track a stock from the Morning Brief or search above.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePositions.map((p) => {
              const current = p.liveQuote?.price ?? null;
              const returnPct = current != null ? ((current - p.position.entryPrice) / p.position.entryPrice) * 100 : null;
              // Server Component, re-rendered fresh per request (force-dynamic) — safe.
              // eslint-disable-next-line react-hooks/purity
              const days = Math.max(0, Math.round((Date.now() - p.position.entryTimestamp.getTime()) / 86400000));
              return (
                <Link
                  key={p.position.id}
                  href={`/position/${p.position.id}`}
                  className="card block transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.company.ticker}</span>
                    {returnPct != null && (
                      <span className="num text-sm" style={{ color: returnPct >= 0 ? "var(--positive)" : "var(--negative)" }}>
                        {returnPct >= 0 ? "+" : ""}
                        {returnPct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-(--color-foreground-muted) num">
                    Entry ${p.position.entryPrice.toFixed(2)}
                    {current != null && ` · Now $${current.toFixed(2)}`} · {days} day{days === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="num text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-(--color-foreground-muted)">{label}</div>
    </div>
  );
}

function EmptyState({ title, body, dayOne }: { title: string; body: string; dayOne: string }) {
  return (
    <div className="card text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-(--color-foreground-muted)">{body}</p>
      <p className="mt-3 text-xs text-(--color-foreground-muted)">
        Research Day 1: {new Date(dayOne).toLocaleDateString()}
      </p>
    </div>
  );
}
