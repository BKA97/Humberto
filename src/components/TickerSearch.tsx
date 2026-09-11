"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Match {
  ticker: string;
  name: string;
}

export function TickerSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // An empty query hides the dropdown entirely (see the `open && query...`
    // check below), so stale results left in state simply never render —
    // no need to reset them here.
    if (query.trim().length < 1) return;
    // Debounced-search pattern: this effect owns the "a search is pending"
    // state for its own setTimeout below, which is an external timer, not
    // React state — intentional, despite the lint rule's general caution.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.matches ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        className="input"
        placeholder={compact ? "Search stocks…" : "Search stocks (ticker or company)…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (query.trim().length > 0 || loading) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-(--color-surface) shadow-lg" style={{ borderColor: "var(--border)" }}>
          {loading && <div className="px-3 py-2 text-sm text-(--color-foreground-muted)">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-(--color-foreground-muted)">No matches.</div>
          )}
          {!loading &&
            results.map((m) => (
              <button
                key={m.ticker}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-(--color-surface-muted)"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  router.push(`/track/${m.ticker}`);
                }}
              >
                <span className="font-medium">{m.ticker}</span>
                <span className="truncate pl-3 text-(--color-foreground-muted)">{m.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
