import { GroupStats } from "@/lib/researchStats";

export function GroupStatsTable({ title, rows }: { title: string; rows: GroupStats[] }) {
  const populated = rows.filter((r) => r.count > 0);
  return (
    <div className="card">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {populated.length === 0 ? (
        <p className="text-sm text-(--color-foreground-muted)">Not enough observations yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-(--color-foreground-muted)" style={{ borderColor: "var(--border)" }}>
              <th className="py-1.5 font-medium">Group</th>
              <th className="py-1.5 font-medium">N</th>
              <th className="py-1.5 font-medium">Avg return</th>
              <th className="py-1.5 font-medium">Median return</th>
              <th className="py-1.5 font-medium">Win rate</th>
              <th className="py-1.5 font-medium">Avg rel. return</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="py-1.5">{r.label}</td>
                <td className="num py-1.5">{r.count}</td>
                <td className="num py-1.5">{r.avgReturn != null ? `${r.avgReturn >= 0 ? "+" : ""}${r.avgReturn.toFixed(2)}%` : "—"}</td>
                <td className="num py-1.5">{r.medianReturn != null ? `${r.medianReturn >= 0 ? "+" : ""}${r.medianReturn.toFixed(2)}%` : "—"}</td>
                <td className="num py-1.5">{r.winRate != null ? `${r.winRate.toFixed(0)}%` : "—"}</td>
                <td className="num py-1.5">{r.avgRelativeReturn != null ? `${r.avgRelativeReturn >= 0 ? "+" : ""}${r.avgRelativeReturn.toFixed(2)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
