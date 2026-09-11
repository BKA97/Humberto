import { db } from "./db";
import { positions, companies, marketSnapshots, attentionSnapshots, articles, alerts, alertThresholds, alertTypeEnum } from "./db/schema";
import { eq, and, desc, gte } from "drizzle-orm";

type AlertType = (typeof alertTypeEnum.enumValues)[number];

const DEDUPE_WINDOW_MS = 3 * 60 * 60 * 1000; // don't re-fire the same alert type within 3 hours

async function alreadyAlertedRecently(positionId: string, type: AlertType) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const recent = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.positionId, positionId), eq(alerts.type, type), gte(alerts.createdAt, since)))
    .limit(1);
  return recent.length > 0;
}

/**
 * Objective, threshold-based alerts for Active positions (spec §25-26).
 * Deliberately says only what changed, never what it means for the stock —
 * "Social activity increased 620%", not "this looks bullish."
 */
export async function checkAndCreateAlerts() {
  const [thresholds] = await db.select().from(alertThresholds).limit(1);
  const t = thresholds ?? {
    priceMovePercent: 5,
    volumeRelativeMultiple: 3,
    newsAttentionPercentIncrease: 100,
    socialAttentionPercentIncrease: 200,
  };

  const active = await db
    .select({ position: positions, company: companies })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .where(eq(positions.status, "ACTIVE"));

  const created = [];

  for (const { position, company } of active) {
    const [latestSnapshot] = await db
      .select()
      .from(marketSnapshots)
      .where(eq(marketSnapshots.companyId, company.id))
      .orderBy(desc(marketSnapshots.observedAt))
      .limit(1);

    if (latestSnapshot) {
      const percentSinceEntry = ((latestSnapshot.price - position.entryPrice) / position.entryPrice) * 100;
      if (Math.abs(percentSinceEntry) >= t.priceMovePercent && !(await alreadyAlertedRecently(position.id, "PRICE_MOVE"))) {
        const [alert] = await db
          .insert(alerts)
          .values({
            positionId: position.id,
            type: "PRICE_MOVE",
            message: `${company.ticker} has moved ${percentSinceEntry >= 0 ? "+" : ""}${percentSinceEntry.toFixed(1)}% since you tracked it at $${position.entryPrice.toFixed(2)}.`,
            data: { percentSinceEntry, currentPrice: latestSnapshot.price },
          })
          .returning();
        created.push(alert);
      }

      if (
        latestSnapshot.relativeVolume != null &&
        latestSnapshot.relativeVolume >= t.volumeRelativeMultiple &&
        !(await alreadyAlertedRecently(position.id, "VOLUME_SPIKE"))
      ) {
        const [alert] = await db
          .insert(alerts)
          .values({
            positionId: position.id,
            type: "VOLUME_SPIKE",
            message: `${company.ticker} volume is running ${latestSnapshot.relativeVolume.toFixed(1)}x its average.`,
            data: { relativeVolume: latestSnapshot.relativeVolume },
          })
          .returning();
        created.push(alert);
      }
    }

    const recentAttention = await db
      .select()
      .from(attentionSnapshots)
      .where(eq(attentionSnapshots.companyId, company.id))
      .orderBy(desc(attentionSnapshots.observedAt))
      .limit(10);

    for (const snap of recentAttention) {
      if (snap.percentVsBaseline == null) continue;
      const isNews = snap.platform === "NEWS_FINANCIAL" || snap.platform === "NEWS_GENERAL";
      const threshold = isNews ? t.newsAttentionPercentIncrease : t.socialAttentionPercentIncrease;
      const alertType = isNews ? "NEWS_ATTENTION_SPIKE" : "SOCIAL_ATTENTION_SPIKE";
      if (snap.percentVsBaseline >= threshold && !(await alreadyAlertedRecently(position.id, alertType))) {
        const [alert] = await db
          .insert(alerts)
          .values({
            positionId: position.id,
            type: alertType,
            message: `${company.ticker} — ${snap.platform.toLowerCase().replace("_", " ")} activity increased ${snap.percentVsBaseline.toFixed(0)}% vs. normal.`,
            data: { platform: snap.platform, percentVsBaseline: snap.percentVsBaseline },
          })
          .returning();
        created.push(alert);
      }
    }

    if (position.newsEventId) {
      const since = new Date(Date.now() - 30 * 60 * 1000);
      const newArticles = await db
        .select()
        .from(articles)
        .where(and(eq(articles.newsEventId, position.newsEventId), gte(articles.discoveredAt, since)));
      const genuinelyNew = newArticles.filter((a) => !a.isSyndicatedCopyOf);
      if (genuinelyNew.length > 0 && !(await alreadyAlertedRecently(position.id, "NEW_DEVELOPMENT"))) {
        const [alert] = await db
          .insert(alerts)
          .values({
            positionId: position.id,
            type: "NEW_DEVELOPMENT",
            message: `${company.ticker} — new reporting on the event you tracked (${genuinelyNew[0].source}).`,
            data: { articleIds: genuinelyNew.map((a) => a.id) },
          })
          .returning();
        created.push(alert);
      }
    }
  }

  return created;
}
