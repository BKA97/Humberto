// Attention-level labeling and research bucketing helpers.
//
// These produce *descriptive* magnitude labels ("High", "Very High") from
// measured numbers — never a judgment about whether that attention was
// warranted (spec §7, §28). A missing baseline means we say so rather than
// guessing a label.

export type AttentionLevel = "Very Low" | "Low" | "Medium" | "High" | "Very High";

/**
 * Labels attention magnitude from % change vs. a company's own baseline when
 * available (preferred — spec §23), falling back to a raw-count heuristic
 * for tickers with no baseline yet. Returns null when neither is available,
 * meaning the UI should show "Not enough data" rather than a label.
 */
export function attentionLevel(opts: {
  percentVsBaseline?: number | null;
  rawValue?: number | null;
}): AttentionLevel | null {
  const { percentVsBaseline, rawValue } = opts;
  if (percentVsBaseline != null) {
    if (percentVsBaseline < -25) return "Very Low";
    if (percentVsBaseline < 50) return "Low";
    if (percentVsBaseline < 150) return "Medium";
    if (percentVsBaseline < 400) return "High";
    return "Very High";
  }
  if (rawValue != null) {
    // Coarse, provider-agnostic fallback for a ticker with no history yet.
    if (rawValue < 5) return "Very Low";
    if (rawValue < 20) return "Low";
    if (rawValue < 75) return "Medium";
    if (rawValue < 250) return "High";
    return "Very High";
  }
  return null;
}

export const REACTION_BUCKETS = ["0–2%", "2–5%", "5–10%", "10–20%", "20%+"] as const;
export type ReactionBucket = (typeof REACTION_BUCKETS)[number];

export function reactionBucket(percentChangeAbs: number): ReactionBucket {
  const v = Math.abs(percentChangeAbs);
  if (v < 2) return "0–2%";
  if (v < 5) return "2–5%";
  if (v < 10) return "5–10%";
  if (v < 20) return "10–20%";
  return "20%+";
}

export const HOLDING_PERIOD_BUCKETS = ["1 day", "3 days", "1 week", "2 weeks", "30 days", "90 days", "90+ days"] as const;
export type HoldingPeriodBucket = (typeof HOLDING_PERIOD_BUCKETS)[number];

export function holdingPeriodBucket(days: number): HoldingPeriodBucket {
  if (days <= 1) return "1 day";
  if (days <= 3) return "3 days";
  if (days <= 7) return "1 week";
  if (days <= 14) return "2 weeks";
  if (days <= 30) return "30 days";
  if (days <= 90) return "90 days";
  return "90+ days";
}

export const ATTENTION_LEVEL_BUCKETS: AttentionLevel[] = ["Very Low", "Low", "Medium", "High", "Very High"];
