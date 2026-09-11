import Link from "next/link";

export function TrackButton({ ticker, newsEventId, label }: { ticker: string; newsEventId?: string; label?: string }) {
  const href = newsEventId ? `/track/${ticker}?event=${newsEventId}` : `/track/${ticker}`;
  return (
    <Link href={href} className="btn-primary whitespace-nowrap">
      {label ?? `Track ${ticker}`}
    </Link>
  );
}
