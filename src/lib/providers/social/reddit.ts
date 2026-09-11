import { SocialAttentionProvider, AttentionMetric, observed, unavailable } from "../types";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string, userAgent: string) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed (HTTP ${res.status})`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export class RedditAttentionProvider implements SocialAttentionProvider {
  name = "reddit";
  platform = "REDDIT" as const;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private userAgent: string
  ) {}

  async getAttention(query: { ticker: string; companyName: string }) {
    try {
      const token = await getAccessToken(this.clientId, this.clientSecret, this.userAgent);
      const q = encodeURIComponent(`"${query.ticker}" OR "${query.companyName}"`);
      const res = await fetch(
        `https://oauth.reddit.com/search?q=${q}&sort=new&t=day&limit=100&type=link`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": this.userAgent }, cache: "no-store" }
      );
      if (!res.ok) return unavailable(`Reddit search failed (HTTP ${res.status})`);
      const data: { data?: { children?: { data?: { num_comments?: number } }[] } } = await res.json();
      const posts = data.data?.children ?? [];
      const discussionCount = posts.length;
      const totalComments = posts.reduce((sum, p) => sum + (p.data?.num_comments ?? 0), 0);

      const metrics: AttentionMetric[] = [
        { metricLabel: "relevant discussions (past 24h)", value: discussionCount, ecosystem: "GENERAL_PUBLIC" },
        { metricLabel: "comments on relevant discussions", value: totalComments, ecosystem: "GENERAL_PUBLIC" },
      ];
      // Reddit's search API caps a single page at 100 results, so a count at
      // or near that cap almost certainly understates true volume.
      const isEstimate = discussionCount >= 100;
      return observed(metrics, {
        source: "reddit",
        isEstimate,
        method: isEstimate ? "capped at 100 results/page — true count may be higher" : undefined,
      });
    } catch (err) {
      return unavailable(`Reddit request error: ${(err as Error).message}`);
    }
  }
}
