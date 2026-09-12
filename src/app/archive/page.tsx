import Link from "next/link";
import { getArchiveCards } from "@/lib/briefData";
import { NewsEventCard } from "@/components/NewsEventCard";

export const dynamic = "force-dynamic";

const DAY_FILTERS = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: undefined },
] as const;

function dayKey(iso: string) {
  // America/New_York, to match the rest of the app's timestamps — a date
  // grouping heading is only useful if it lines up with how you'd remember
  // "that Tuesday," not the server's UTC day boundary.
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; days?: string }>;
}) {
  const { page: pageParam, days: daysParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const activeFilter = DAY_FILTERS.find((f) => f.key === daysParam) ?? DAY_FILTERS[3];

  const { cards, hasNextPage } = await getArchiveCards({ page, days: activeFilter.days });

  const groups: { label: string; cards: typeof cards }[] = [];
  for (const card of cards) {
    const label = dayKey(card.event.discoveredAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) lastGroup.cards.push(card);
    else groups.push({ label, cards: [card] });
  }

  const hrefFor = (nextPage: number) => `/archive?days=${activeFilter.key}&page=${nextPage}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Archive</h1>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          Everything discovered, tracked or not. Home and the Morning Brief only show the last 20 hours — this is
          where a story goes instead of just disappearing.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {DAY_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/archive?days=${f.key}&page=1`}
            className={`nav-link ${activeFilter.key === f.key ? "nav-link-active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <p className="font-medium">Nothing discovered in this window.</p>
          <p className="mt-1 text-sm text-(--color-foreground-muted)">
            Try a wider date range, or check back after the next ingestion cycle.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">
                {group.label}
              </h2>
              <div className="space-y-4">
                {group.cards.map((c) => (
                  <NewsEventCard key={`${c.event.id}-${c.company.id}`} card={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(page > 1 || hasNextPage) && (
        <div className="flex items-center justify-between pt-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className="nav-link">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-(--color-foreground-muted)">Page {page}</span>
          {hasNextPage ? (
            <Link href={hrefFor(page + 1)} className="nav-link">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
