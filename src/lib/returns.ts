// Shared return-calculation helpers (spec §18) — used by both the close
// workflow and the History/Research pages so the math is defined once.

export interface ReturnBreakdown {
  stockReturnPercent: number;
  benchmarkReturnPercent: number | null;
  relativeReturnPercent: number | null;
  absoluteReturn: number;
}

export function computeReturns(opts: {
  entryPrice: number;
  exitPrice: number;
  entryBenchmarkLevel: number | null;
  exitBenchmarkLevel: number | null;
}): ReturnBreakdown {
  const stockReturnPercent = ((opts.exitPrice - opts.entryPrice) / opts.entryPrice) * 100;
  const absoluteReturn = opts.exitPrice - opts.entryPrice;

  let benchmarkReturnPercent: number | null = null;
  if (opts.entryBenchmarkLevel != null && opts.exitBenchmarkLevel != null && opts.entryBenchmarkLevel > 0) {
    benchmarkReturnPercent = ((opts.exitBenchmarkLevel - opts.entryBenchmarkLevel) / opts.entryBenchmarkLevel) * 100;
  }

  const relativeReturnPercent = benchmarkReturnPercent != null ? stockReturnPercent - benchmarkReturnPercent : null;

  return { stockReturnPercent, benchmarkReturnPercent, relativeReturnPercent, absoluteReturn };
}

export function holdingPeriodDays(entryTimestamp: Date, exitTimestamp: Date): number {
  return Math.max(0, (exitTimestamp.getTime() - entryTimestamp.getTime()) / (1000 * 60 * 60 * 24));
}
