import Link from "next/link";
import { BriefCard } from "@/lib/briefData";
import { AttentionLevelBadge, PriceChangeBadge } from "./AttentionBadge";
import { TrackButton } from "./TrackButton";

const PLATFORM_LABEL: Record<string, string> = {
  NEWS_FINANCIAL: "Financial news",
  NEWS_GENERAL: "General news",
  X: "X",
  REDDIT: "Reddit",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  GDELT: "Global news coverage",
};

function fmtTime(iso: string | null) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";
}

export function NewsEventCard({ card }: { card: BriefCard }) {
  const m = card.market;
  const socialEntries = Object.entries(card.attention).filter(([p]) => p !== "NEWS_FINANCIAL" && p !== "NEWS_GENERAL");
  const newsFinancial = card.attention.NEWS_FINANCIAL;
  const newsGeneral = card.attention.NEWS_GENERAL;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold">
            {card.company.ticker} <span className="font-normal text-(--color-foreground-muted)">— {card.company.name}</span>
          </div>
          {m && (
            <div className="mt-1 flex items-center gap-2 num text-sm">
              <span className="font-medium">${m.price.toFixed(2)}</span>
              <PriceChangeBadge percentChange={m.percentChange} />
              {m.dollarChange != null && (
                <span className="text-(--color-foreground-muted)">
                  {m.dollarChange >= 0 ? "+" : ""}${m.dollarChange.toFixed(2)}
                </span>
              )}
              {m.isEstimate && <span className="text-xs text-(--color-foreground-muted)">(estimate)</span>}
            </div>
          )}
        </div>
        <TrackButton ticker={card.company.ticker} newsEventId={card.event.id} label={`Track ${card.company.ticker}`} />
      </div>

      <div>
        <div className="mb-1 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">What happened</div>
        <p className="text-sm">{card.event.summary}</p>
      </div>

      {card.event.mainstreamReachScore != null && (
        <div className="rounded-md bg-(--color-surface-muted) p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">
            Mainstream reach
            <span className="rounded-full bg-(--color-accent) px-2 py-0.5 text-[10px] font-semibold text-white normal-case tracking-normal">
              {card.event.mainstreamReachScore}/100
            </span>
          </div>
          {card.event.mainstreamReachRationale && (
            <p className="text-xs text-(--color-foreground-muted)">{card.event.mainstreamReachRationale}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">News attention</div>
          <ul className="space-y-1 text-sm">
            <li>{card.coverage.totalArticles} article{card.coverage.totalArticles === 1 ? "" : "s"} ({card.coverage.uniqueArticles} unique)</li>
            <li>{card.coverage.uniqueOutlets} unique outlet{card.coverage.uniqueOutlets === 1 ? "" : "s"}</li>
            <li>{card.coverage.majorOutlets} major outlet{card.coverage.majorOutlets === 1 ? "" : "s"}</li>
            <li>First reported: {fmtTime(card.coverage.firstReportedAt)}</li>
          </ul>
          <div className="mt-2">
            <AttentionLevelBadge label="Financial attention" level={card.financialAttentionLevel} />
          </div>
          {newsFinancial && newsFinancial.percentVsBaseline != null && (
            <p className="mt-1 text-xs text-(--color-foreground-muted)">
              Financial coverage {newsFinancial.percentVsBaseline >= 0 ? "+" : ""}
              {newsFinancial.percentVsBaseline.toFixed(0)}% vs. normal
            </p>
          )}
          <Link href={`/events/${card.event.id}`} className="mt-2 inline-block text-xs font-medium text-(--color-accent) underline">
            View news
          </Link>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">Public / social attention</div>
          {socialEntries.length === 0 && !newsGeneral && (
            <p className="text-sm text-(--color-foreground-muted)">Not available.</p>
          )}
          <ul className="space-y-1 text-sm">
            {newsGeneral && (
              <li>
                General news: {newsGeneral.value} {newsGeneral.metricLabel}
              </li>
            )}
            {socialEntries.map(([platform, data]) => (
              <li key={platform}>
                {PLATFORM_LABEL[platform] ?? platform}: {data!.value.toLocaleString()} {data!.metricLabel}
                {data!.isEstimate ? " (est.)" : ""}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <AttentionLevelBadge label="General public attention" level={card.publicAttentionLevel} />
          </div>
        </div>
      </div>

      {m && (
        <div>
          <div className="mb-1.5 text-xs font-medium tracking-wide text-(--color-foreground-muted) uppercase">Market reaction</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm num sm:grid-cols-4">
            <div>
              <div className="text-(--color-foreground-muted)">Prev. close</div>
              <div>{m.previousClose != null ? `$${m.previousClose.toFixed(2)}` : "Not available"}</div>
            </div>
            <div>
              <div className="text-(--color-foreground-muted)">Session</div>
              <div>{m.session.replace("_", " ").toLowerCase()}</div>
            </div>
            <div>
              <div className="text-(--color-foreground-muted)">Volume</div>
              <div>{m.volume != null ? m.volume.toLocaleString() : "Not available"}</div>
            </div>
            <div>
              <div className="text-(--color-foreground-muted)">Rel. volume</div>
              <div>{m.relativeVolume != null ? `${m.relativeVolume.toFixed(2)}x` : "Not available"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
