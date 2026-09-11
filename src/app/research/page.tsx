import { getHistoryRows } from "@/lib/historyData";
import { listPositionsWithDetail } from "@/lib/positions";
import { computeResearchStats } from "@/lib/researchStats";
import { GroupStatsTable } from "@/components/GroupStatsTable";
import { AttentionReactionScatter } from "@/components/AttentionReactionScatter";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const [closed, active] = await Promise.all([getHistoryRows(), listPositionsWithDetail("ACTIVE")]);
  const stats = computeResearchStats(closed, active.length);

  if (stats.overall.totalObservations === 0) {
    return (
      <div className="card">
        <p className="font-medium">Not enough observations yet.</p>
        <p className="mt-1 text-sm text-(--color-foreground-muted)">
          Keep tracking events and closing positions. Research insights will become more useful as the dataset grows.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Research</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active positions" value={stats.overall.activeCount} />
        <Stat label="Closed positions" value={stats.overall.closedCount} />
        <Stat label="Total observations" value={stats.overall.totalObservations} />
        <Stat
          label="Win rate"
          value={stats.overall.winRate != null ? `${stats.overall.winRate.toFixed(0)}%` : "—"}
        />
        <Stat
          label="Avg. return"
          value={stats.overall.avgReturn != null ? `${stats.overall.avgReturn >= 0 ? "+" : ""}${stats.overall.avgReturn.toFixed(2)}%` : "—"}
        />
        <Stat
          label="Median return"
          value={stats.overall.medianReturn != null ? `${stats.overall.medianReturn >= 0 ? "+" : ""}${stats.overall.medianReturn.toFixed(2)}%` : "—"}
        />
        <Stat
          label="Avg. holding period"
          value={stats.overall.avgHoldingPeriod != null ? `${stats.overall.avgHoldingPeriod.toFixed(1)}d` : "—"}
        />
        <Stat
          label="Beating benchmark"
          value={stats.overall.percentBeatingBenchmark != null ? `${stats.overall.percentBeatingBenchmark.toFixed(0)}%` : "—"}
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-foreground-muted)">
          Public attention vs. initial reaction
        </h2>
        <div className="card">
          <AttentionReactionScatter points={stats.scatter} />
          <p className="mt-2 text-xs text-(--color-foreground-muted)">
            Each point is one closed position. This shows whether attention and reaction size tend to move together —
            it draws no conclusion for you.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupStatsTable title="By thesis tag" rows={stats.byTag} />
        <GroupStatsTable title="By initial reaction size" rows={stats.byReaction} />
        <GroupStatsTable title="By public attention at entry" rows={stats.byAttention} />
        <GroupStatsTable title="By holding period" rows={stats.byHoldingPeriod} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="num text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-(--color-foreground-muted)">{label}</div>
    </div>
  );
}
