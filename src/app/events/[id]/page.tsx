import { db } from "@/lib/db";
import { newsEvents, newsEventCompanies, companies, articles, marketSnapshots, attentionSnapshots } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TrackButton } from "@/components/TrackButton";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event] = await db.select().from(newsEvents).where(eq(newsEvents.id, id)).limit(1);
  if (!event) notFound();

  const links = await db
    .select({ company: companies })
    .from(newsEventCompanies)
    .innerJoin(companies, eq(newsEventCompanies.companyId, companies.id))
    .where(eq(newsEventCompanies.newsEventId, id));

  const eventArticles = await db.select().from(articles).where(eq(articles.newsEventId, id)).orderBy(asc(articles.publishedAt));

  const timelines = await Promise.all(
    links.map(async ({ company }) => ({
      company,
      market: await db
        .select()
        .from(marketSnapshots)
        .where(eq(marketSnapshots.companyId, company.id))
        .orderBy(asc(marketSnapshots.observedAt)),
      attention: await db
        .select()
        .from(attentionSnapshots)
        .where(eq(attentionSnapshots.newsEventId, id))
        .orderBy(asc(attentionSnapshots.observedAt)),
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{event.headline}</h1>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">{event.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map(({ company }) => (
            <TrackButton key={company.id} ticker={company.ticker} newsEventId={event.id} />
          ))}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-foreground-muted)">
          Market timeline
        </h2>
        <div className="space-y-4">
          {timelines.map(({ company, market }) => (
            <div key={company.id} className="card">
              <div className="mb-2 font-medium">{company.ticker}</div>
              {market.length === 0 ? (
                <p className="text-sm text-(--color-foreground-muted)">No market observations yet.</p>
              ) : (
                <ul className="space-y-1 text-sm num">
                  {market.map((m) => (
                    <li key={m.id} className="flex justify-between border-b py-1 last:border-0" style={{ borderColor: "var(--border)" }}>
                      <span className="text-(--color-foreground-muted)">
                        {new Date(m.observedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET · {m.session.toLowerCase()}
                      </span>
                      <span>
                        ${m.price.toFixed(2)}
                        {m.percentChange != null && (
                          <span style={{ color: m.percentChange >= 0 ? "var(--positive)" : "var(--negative)" }}>
                            {" "}
                            ({m.percentChange >= 0 ? "+" : ""}
                            {m.percentChange.toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-foreground-muted)">
          Coverage ({eventArticles.filter((a) => !a.isSyndicatedCopyOf).length} unique · {eventArticles.length} total)
        </h2>
        <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
          {eventArticles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline decoration-(--color-border) hover:decoration-current">
                  {a.headline}
                </a>
                <div className="text-xs text-(--color-foreground-muted)">
                  {a.source}
                  {a.isSyndicatedCopyOf && " · syndicated"}
                  {a.isFinancialOutlet && " · financial outlet"}
                </div>
              </div>
              <span className="whitespace-nowrap text-xs text-(--color-foreground-muted) num">
                {a.publishedAt ? new Date(a.publishedAt).toLocaleString("en-US", { timeZone: "America/New_York" }) : "Unknown time"}
              </span>
            </div>
          ))}
          {eventArticles.length === 0 && <p className="text-sm text-(--color-foreground-muted)">No articles recorded.</p>}
        </div>
      </section>
    </div>
  );
}
