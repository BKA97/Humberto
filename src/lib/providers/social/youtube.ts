import { SocialAttentionProvider, AttentionMetric, observed, unavailable } from "../types";

export class YouTubeAttentionProvider implements SocialAttentionProvider {
  name = "youtube";
  platform = "YOUTUBE" as const;

  constructor(private apiKey: string) {}

  async getAttention(query: { ticker: string; companyName: string }) {
    try {
      const publishedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const params = new URLSearchParams({
        part: "snippet",
        q: `${query.ticker} ${query.companyName}`,
        type: "video",
        order: "date",
        publishedAfter,
        maxResults: "50",
        key: this.apiKey,
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return unavailable(`YouTube search failed (HTTP ${res.status})${body?.error?.message ? `: ${body.error.message}` : ""}`);
      }
      const data = await res.json();
      const total = data.pageInfo?.totalResults ?? data.items?.length ?? 0;
      const metrics: AttentionMetric[] = [
        { metricLabel: "relevant videos (past 24h)", value: total, ecosystem: "GENERAL_PUBLIC" },
      ];
      // YouTube's `totalResults` is itself a platform-side approximation, not
      // an exact count.
      return observed(metrics, { source: "youtube", isEstimate: true, method: "YouTube API totalResults estimate" });
    } catch (err) {
      return unavailable(`YouTube request error: ${(err as Error).message}`);
    }
  }
}
