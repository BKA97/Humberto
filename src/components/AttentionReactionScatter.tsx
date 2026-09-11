"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";

const LEVEL_LABEL: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Medium", 4: "High", 5: "Very High" };

export function AttentionReactionScatter({ points }: { points: { x: number; y: number; ticker: string; id: string }[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-(--color-foreground-muted)">Not enough observations yet.</p>;
  }
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v) => LEVEL_LABEL[v] ?? ""}
            tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
            name="Public attention"
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Initial reaction (abs %)"
            tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
            label={{ value: "Initial reaction (|%|)", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--foreground-muted)" }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            formatter={(value, name) =>
              name === "x" ? LEVEL_LABEL[Number(value)] : `${Number(value).toFixed(1)}%`
            }
            labelFormatter={() => ""}
          />
          <Scatter data={points} fill="var(--accent)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
