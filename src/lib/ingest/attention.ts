import { db } from "../db";
import { attentionSnapshots, attentionBaselines, ingestionLogs } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { AttentionPlatform } from "../providers/types";
import { getSocialProviders } from "../providers/social";

const MIN_SAMPLES_FOR_BASELINE = 3;
const BASELINE_WINDOW_DAYS = 30;

/**
 * Updates (or creates) a company/platform's rolling baseline and returns the
 * comparison to use for *this* observation — computed against the baseline
 * as it stood *before* this observation, so a single spike doesn't get
 * compared against itself. Baselines only ever build forward from Day 1
 * (spec §23/24) — nothing here is backfilled from history predating this
 * app's own observations.
 */
async function updateBaselineAndCompare(companyId: string, platform: AttentionPlatform, value: number) {
  const existing = await db
    .select()
    .from(attentionBaselines)
    .where(and(eq(attentionBaselines.companyId, companyId), eq(attentionBaselines.platform, platform)))
    .limit(1);

  const prior = existing[0];
  let percentVsBaseline: number | null = null;
  let baselineValue: number | null = null;

  if (prior && prior.sampleCount >= MIN_SAMPLES_FOR_BASELINE) {
    baselineValue = prior.averageValue;
    percentVsBaseline = baselineValue > 0 ? ((value - baselineValue) / baselineValue) * 100 : null;
  }

  if (prior) {
    const newSampleCount = Math.min(prior.sampleCount + 1, BASELINE_WINDOW_DAYS);
    const newAverage = prior.averageValue + (value - prior.averageValue) / newSampleCount;
    await db
      .update(attentionBaselines)
      .set({ averageValue: newAverage, sampleCount: prior.sampleCount + 1, updatedAt: new Date() })
      .where(eq(attentionBaselines.id, prior.id));
  } else {
    await db.insert(attentionBaselines).values({
      companyId,
      platform,
      averageValue: value,
      sampleCount: 1,
      windowDays: BASELINE_WINDOW_DAYS,
    });
  }

  return { percentVsBaseline, baselineValue };
}

export async function captureNewsAttentionSnapshot(opts: {
  companyId: string;
  newsEventId?: string | null;
  financialArticleCount: number;
  generalArticleCount: number;
  uniqueOutletCount: number;
}) {
  const rows = [];
  for (const [platform, value] of [
    ["NEWS_FINANCIAL", opts.financialArticleCount],
    ["NEWS_GENERAL", opts.generalArticleCount],
  ] as [AttentionPlatform, number][]) {
    const { percentVsBaseline, baselineValue } = await updateBaselineAndCompare(opts.companyId, platform, value);
    const [row] = await db
      .insert(attentionSnapshots)
      .values({
        companyId: opts.companyId,
        newsEventId: opts.newsEventId ?? null,
        platform,
        ecosystem: platform === "NEWS_FINANCIAL" ? "FINANCIAL" : "GENERAL_PUBLIC",
        metricLabel: "articles",
        value,
        isAvailable: true,
        isEstimate: false,
        baselineValue,
        percentVsBaseline,
        source: "internal-count",
      })
      .returning();
    rows.push(row);
  }
  return rows;
}

export async function captureSocialAttentionSnapshots(opts: {
  companyId: string;
  ticker: string;
  companyName: string;
  newsEventId?: string | null;
  /** See getSocialProviders — pass false during frequent intraday polling to skip rate-limit-sensitive providers like GDELT. */
  includeLowFrequencyProviders?: boolean;
}) {
  const providers = getSocialProviders({ includeLowFrequencyProviders: opts.includeLowFrequencyProviders });
  const rows = [];
  for (const provider of providers) {
    const result = await provider.getAttention({ ticker: opts.ticker, companyName: opts.companyName });
    if (!result.available) {
      await db.insert(ingestionLogs).values({
        source: provider.name,
        operation: "getAttention",
        status: "stale",
        detail: `${opts.ticker} [${provider.platform}]: ${result.reason}`,
      });
      continue;
    }
    for (const metric of result.value) {
      const { percentVsBaseline, baselineValue } = await updateBaselineAndCompare(
        opts.companyId,
        provider.platform,
        metric.value
      );
      const [row] = await db
        .insert(attentionSnapshots)
        .values({
          companyId: opts.companyId,
          newsEventId: opts.newsEventId ?? null,
          platform: provider.platform,
          ecosystem: metric.ecosystem,
          metricLabel: metric.metricLabel,
          value: metric.value,
          isAvailable: true,
          isEstimate: result.provenance.isEstimate,
          baselineValue,
          percentVsBaseline,
          source: result.provenance.source,
          method: result.provenance.method,
        })
        .returning();
      rows.push(row);
    }
  }
  return rows;
}
