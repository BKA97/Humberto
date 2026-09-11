"use client";

import { useMemo, useState } from "react";
import { BriefCard } from "@/lib/briefData";
import { NewsEventCard } from "./NewsEventCard";

const SORTS = [
  { key: "movers", label: "Largest movers" },
  { key: "news", label: "Highest news activity" },
  { key: "attention", label: "Highest public attention" },
  { key: "volume", label: "Most unusual volume" },
] as const;

const LEVEL_RANK: Record<string, number> = { "Very Low": 1, Low: 2, Medium: 3, High: 4, "Very High": 5 };

export function BriefList({ cards }: { cards: BriefCard[] }) {
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("movers");

  const sorted = useMemo(() => {
    const copy = [...cards];
    switch (sort) {
      case "news":
        return copy.sort((a, b) => b.coverage.totalArticles - a.coverage.totalArticles);
      case "attention":
        return copy.sort(
          (a, b) => (LEVEL_RANK[b.publicAttentionLevel ?? ""] ?? 0) - (LEVEL_RANK[a.publicAttentionLevel ?? ""] ?? 0)
        );
      case "volume":
        return copy.sort((a, b) => (b.market?.relativeVolume ?? 0) - (a.market?.relativeVolume ?? 0));
      default:
        return copy.sort((a, b) => Math.abs(b.market?.percentChange ?? 0) - Math.abs(a.market?.percentChange ?? 0));
    }
  }, [cards, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`nav-link ${sort === s.key ? "nav-link-active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-(--color-foreground-muted)">
        Ranking reflects magnitude, not importance — the app doesn&apos;t judge which stories matter.
      </p>
      <div className="space-y-4">
        {sorted.map((c) => (
          <NewsEventCard key={`${c.event.id}-${c.company.id}`} card={c} />
        ))}
      </div>
    </div>
  );
}
