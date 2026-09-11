"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TrackContext {
  companyId: string;
  ticker: string;
  companyName: string;
  entryPrice: number;
  entryTimestamp: string;
  entrySession: string;
  entryBenchmarkLevel: number | null;
  newsEventId: string | null;
  originalReactionSnapshotIds: string[];
  originalAttentionSnapshotIds: string[];
}

export function TrackForm({ context, availableTags }: { context: TrackContext; availableTags: string[] }) {
  const [thesis, setThesis] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function submit() {
    if (!thesis.trim()) {
      setError("Write your thesis before tracking — even a sentence or two.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: context.companyId,
          newsEventId: context.newsEventId,
          entryPrice: context.entryPrice,
          entryTimestamp: context.entryTimestamp,
          entrySession: context.entrySession,
          entryBenchmarkLevel: context.entryBenchmarkLevel,
          originalReactionSnapshotIds: context.originalReactionSnapshotIds,
          originalAttentionSnapshotIds: context.originalAttentionSnapshotIds,
          thesis,
          reasonNote: context.newsEventId ? undefined : reasonNote || undefined,
          tags: selectedTags,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.formErrors?.[0] ?? "Could not create the position.");
      }
      const { position } = await res.json();
      router.push(`/position/${position.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-4">
      {!context.newsEventId && (
        <div>
          <label className="mb-1 block text-xs font-medium text-(--color-foreground-muted)">
            Reason / event (optional)
          </label>
          <input
            className="input"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Why are you tracking this? (optional — no news event required)"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-(--color-foreground-muted)">
          What is your thesis for {context.ticker}?
        </label>
        <textarea
          className="input min-h-32 resize-y"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="Write your own reasoning, in your own words. This is preserved exactly as written — nothing here is generated or critiqued for you."
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-(--color-foreground-muted)">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="badge border transition-colors"
              style={{
                borderColor: selectedTags.includes(tag) ? "var(--accent)" : "var(--border)",
                background: selectedTags.includes(tag) ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: "var(--negative)" }}>{error}</p>}

      <button className="btn-primary w-full" disabled={submitting} onClick={submit}>
        {submitting ? "Tracking…" : `Confirm Track — $${context.entryPrice.toFixed(2)}`}
      </button>
    </div>
  );
}
