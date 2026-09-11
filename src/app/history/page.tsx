import { getHistoryRows } from "@/lib/historyData";
import { HistoryTable } from "@/components/HistoryTable";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const rows = await getHistoryRows();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">History</h1>
      {rows.length === 0 ? (
        <div className="card">
          <p className="font-medium">No closed positions yet.</p>
          <p className="mt-1 text-sm text-(--color-foreground-muted)">
            When you close a tracked position, it becomes a permanent row in your research journal — entry, exit,
            return, benchmark comparison, and your original thesis, all preserved.
          </p>
        </div>
      ) : (
        <HistoryTable rows={rows} />
      )}
    </div>
  );
}
