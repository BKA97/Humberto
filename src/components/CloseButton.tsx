"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloseButton({ positionId }: { positionId: string }) {
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function close() {
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/positions/${positionId}`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not close the position.");
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClosing(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={() => setConfirming(false)} disabled={closing}>
          Cancel
        </button>
        <button className="btn-primary" onClick={close} disabled={closing}>
          {closing ? "Closing…" : "Confirm close"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn-secondary" onClick={() => setConfirming(true)}>
        Close Position
      </button>
      {error && <p className="mt-1 text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
