const LEVEL_STEP: Record<string, number> = {
  "Very Low": 1,
  Low: 2,
  Medium: 3,
  High: 4,
  "Very High": 5,
};

export function AttentionLevelBadge({ label, level }: { label: string; level: string | null }) {
  const step = level ? LEVEL_STEP[level] : 0;
  return (
    <span className="badge" style={{ background: step ? `var(--attn-${step})` : "var(--surface-muted)", color: "var(--foreground)" }}>
      {label}: {level ?? "Not enough data"}
    </span>
  );
}

export function PriceChangeBadge({ percentChange }: { percentChange: number | null }) {
  if (percentChange == null) {
    return <span className="badge bg-(--color-surface-muted) text-(--color-foreground-muted)">No data</span>;
  }
  const positive = percentChange >= 0;
  return (
    <span
      className="badge num"
      style={{
        color: positive ? "var(--positive)" : "var(--negative)",
        background: positive ? "color-mix(in srgb, var(--positive) 12%, transparent)" : "color-mix(in srgb, var(--negative) 12%, transparent)",
      }}
    >
      {positive ? "+" : ""}
      {percentChange.toFixed(2)}%
    </span>
  );
}
