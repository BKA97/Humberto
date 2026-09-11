import { getBriefCards } from "@/lib/briefData";
import { BriefList } from "@/components/BriefList";
import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function MorningBriefPage() {
  const [cards, [lastBrief]] = await Promise.all([
    getBriefCards(20),
    db.select().from(systemConfig).where(eq(systemConfig.key, "last_morning_brief_at")).limit(1),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Morning Brief</h1>
        <p className="text-sm text-(--color-foreground-muted)">
          {lastBrief
            ? `Generated ${new Date(lastBrief.value).toLocaleString("en-US", { timeZone: "America/Denver" })} MT. Monitoring continues throughout the day.`
            : "The 7:00 AM MT brief hasn't run yet in this deployment — showing everything collected so far."}
        </p>
      </div>
      {cards.length === 0 ? (
        <div className="card">
          <p className="font-medium">Your research starts today.</p>
          <p className="mt-1 text-sm text-(--color-foreground-muted)">
            As events are ingested, they&apos;ll appear here with market reaction, news coverage, and public attention
            shown side by side — nothing more.
          </p>
        </div>
      ) : (
        <BriefList cards={cards} />
      )}
    </div>
  );
}
