import { SocialAttentionProvider, AttentionMetric, AttentionPlatform, observed } from "../types";

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 1 | h) + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 7), 61 | h);
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 4294967296;
  };
}

const LABELS: Record<AttentionPlatform, { label: string; ecosystem: "FINANCIAL" | "GENERAL_PUBLIC"; base: number }> = {
  NEWS_FINANCIAL: { label: "articles", ecosystem: "FINANCIAL", base: 12 },
  NEWS_GENERAL: { label: "articles", ecosystem: "GENERAL_PUBLIC", base: 6 },
  X: { label: "relevant posts", ecosystem: "GENERAL_PUBLIC", base: 1500 },
  REDDIT: { label: "relevant discussions", ecosystem: "GENERAL_PUBLIC", base: 60 },
  TIKTOK: { label: "relevant videos", ecosystem: "GENERAL_PUBLIC", base: 200 },
  INSTAGRAM: { label: "relevant posts", ecosystem: "GENERAL_PUBLIC", base: 150 },
  YOUTUBE: { label: "relevant videos", ecosystem: "GENERAL_PUBLIC", base: 30 },
};

export class MockSocialAttentionProvider implements SocialAttentionProvider {
  name = "mock";
  constructor(public platform: AttentionPlatform) {}

  async getAttention(query: { ticker: string; companyName: string }) {
    const rand = seededRandom(this.platform + query.ticker + new Date().toISOString().slice(0, 13));
    const conf = LABELS[this.platform];
    const value = Math.round(conf.base * (0.3 + rand() * 3));
    const metric: AttentionMetric = { metricLabel: conf.label, value, ecosystem: conf.ecosystem };
    return observed([metric], { source: "mock", isEstimate: true, method: "synthetic dev data" });
  }
}
