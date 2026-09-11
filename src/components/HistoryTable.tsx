"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HistoryRow } from "@/lib/historyData";

type SortKey = "date" | "ticker" | "return" | "holdingPeriod" | "initialReaction";

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [tickerFilter, setTickerFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const allTags = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.tags))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tickerFilter && !r.ticker.toLowerCase().includes(tickerFilter.toLowerCase())) return false;
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [rows, tickerFilter, tagFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "ticker":
          diff = a.ticker.localeCompare(b.ticker);
          break;
        case "return":
          diff = a.stockReturnPercent - b.stockReturnPercent;
          break;
        case "holdingPeriod":
          diff = a.holdingPeriodDays - b.holdingPeriodDays;
          break;
        case "initialReaction":
          diff = (a.initialReactionPercent ?? 0) - (b.initialReactionPercent ?? 0);
          break;
        default:
          diff = new Date(a.exitTimestamp).getTime() - new Date(b.exitTimestamp).getTime();
      }
      return diff * sortDir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function headerClick(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-[10rem]"
          placeholder="Filter by ticker…"
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
        />
        <select className="input max-w-[12rem]" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-(--color-foreground-muted)" style={{ borderColor: "var(--border)" }}>
              <Th onClick={() => headerClick("ticker")}>Ticker</Th>
              <Th onClick={() => headerClick("date")}>Closed</Th>
              <Th onClick={() => headerClick("initialReaction")}>Initial reaction</Th>
              <Th onClick={() => headerClick("return")}>Return</Th>
              <th className="px-3 py-2 font-medium">Vs. benchmark</th>
              <Th onClick={() => headerClick("holdingPeriod")}>Holding period</Th>
              <th className="px-3 py-2 font-medium">Attention (financial / public)</th>
              <th className="px-3 py-2 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-(--color-surface-muted)" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2">
                  <Link href={`/position/${r.id}`} className="font-medium underline">
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 text-(--color-foreground-muted)">{new Date(r.exitTimestamp).toLocaleDateString()}</td>
                <td className="num px-3 py-2">
                  {r.initialReactionPercent != null ? `${r.initialReactionPercent >= 0 ? "+" : ""}${r.initialReactionPercent.toFixed(1)}%` : "—"}
                </td>
                <td className="num px-3 py-2" style={{ color: r.stockReturnPercent >= 0 ? "var(--positive)" : "var(--negative)" }}>
                  {r.stockReturnPercent >= 0 ? "+" : ""}
                  {r.stockReturnPercent.toFixed(2)}%
                </td>
                <td className="num px-3 py-2">
                  {r.relativeReturnPercent != null ? (
                    <span style={{ color: r.relativeReturnPercent >= 0 ? "var(--positive)" : "var(--negative)" }}>
                      {r.relativeReturnPercent >= 0 ? "+" : ""}
                      {r.relativeReturnPercent.toFixed(2)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num px-3 py-2">{r.holdingPeriodDays.toFixed(1)}d</td>
                <td className="px-3 py-2 text-xs text-(--color-foreground-muted)">
                  {r.financialAttentionLevel ?? "—"} / {r.publicAttentionLevel ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="badge bg-(--color-surface-muted) text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th className="cursor-pointer select-none px-3 py-2 font-medium hover:text-(--color-foreground)" onClick={onClick}>
      {children}
    </th>
  );
}
