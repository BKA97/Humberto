import { HistoryRow } from "./historyData";
import { reactionBucket, holdingPeriodBucket, ATTENTION_LEVEL_BUCKETS, REACTION_BUCKETS, HOLDING_PERIOD_BUCKETS } from "./attention";

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface GroupStats {
  label: string;
  count: number;
  avgReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  avgRelativeReturn: number | null;
}

function summarize(label: string, rows: HistoryRow[]): GroupStats {
  const returns = rows.map((r) => r.stockReturnPercent);
  const relativeReturns = rows.map((r) => r.relativeReturnPercent).filter((x): x is number => x != null);
  return {
    label,
    count: rows.length,
    avgReturn: mean(returns),
    medianReturn: median(returns),
    winRate: rows.length ? (rows.filter((r) => r.stockReturnPercent > 0).length / rows.length) * 100 : null,
    avgRelativeReturn: mean(relativeReturns),
  };
}

export interface ResearchStats {
  overall: {
    activeCount: number;
    closedCount: number;
    totalObservations: number;
    avgReturn: number | null;
    medianReturn: number | null;
    winRate: number | null;
    avgHoldingPeriod: number | null;
    medianHoldingPeriod: number | null;
    avgRelativeReturn: number | null;
    percentBeatingBenchmark: number | null;
  };
  byTag: GroupStats[];
  byReaction: GroupStats[];
  byAttention: GroupStats[];
  byHoldingPeriod: GroupStats[];
  scatter: { x: number; y: number; ticker: string; id: string }[];
}

const ATTENTION_RANK: Record<string, number> = { "Very Low": 1, Low: 2, Medium: 3, High: 4, "Very High": 5 };

export function computeResearchStats(closed: HistoryRow[], activeCount: number): ResearchStats {
  const returns = closed.map((r) => r.stockReturnPercent);
  const relativeReturns = closed.map((r) => r.relativeReturnPercent).filter((x): x is number => x != null);
  const holdingPeriods = closed.map((r) => r.holdingPeriodDays);
  const beatingBenchmark = closed.filter((r) => r.relativeReturnPercent != null && r.relativeReturnPercent > 0);

  const byTag = Array.from(new Set(closed.flatMap((r) => r.tags)))
    .map((tag) => summarize(tag, closed.filter((r) => r.tags.includes(tag))))
    .sort((a, b) => b.count - a.count);

  const byReaction = REACTION_BUCKETS.map((bucket) =>
    summarize(
      bucket,
      closed.filter((r) => r.initialReactionPercent != null && reactionBucket(r.initialReactionPercent) === bucket)
    )
  );

  const byAttention = ATTENTION_LEVEL_BUCKETS.map((level) =>
    summarize(level, closed.filter((r) => r.publicAttentionLevel === level))
  );

  const byHoldingPeriod = HOLDING_PERIOD_BUCKETS.map((bucket) =>
    summarize(bucket, closed.filter((r) => holdingPeriodBucket(r.holdingPeriodDays) === bucket))
  );

  const scatter = closed
    .filter((r) => r.publicAttentionLevel && r.initialReactionPercent != null)
    .map((r) => ({
      x: ATTENTION_RANK[r.publicAttentionLevel!] ?? 0,
      y: Math.abs(r.initialReactionPercent!),
      ticker: r.ticker,
      id: r.id,
    }));

  return {
    overall: {
      activeCount,
      closedCount: closed.length,
      totalObservations: activeCount + closed.length,
      avgReturn: mean(returns),
      medianReturn: median(returns),
      winRate: closed.length ? (closed.filter((r) => r.stockReturnPercent > 0).length / closed.length) * 100 : null,
      avgHoldingPeriod: mean(holdingPeriods),
      medianHoldingPeriod: median(holdingPeriods),
      avgRelativeReturn: mean(relativeReturns),
      percentBeatingBenchmark: relativeReturns.length ? (beatingBenchmark.length / relativeReturns.length) * 100 : null,
    },
    byTag,
    byReaction,
    byAttention,
    byHoldingPeriod,
    scatter,
  };
}
