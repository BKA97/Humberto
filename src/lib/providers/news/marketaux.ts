import { NewsProvider, RawArticle, observed, unavailable } from "../types";
import { isMajorOutlet } from "../../outletClassification";

const BASE = "https://api.marketaux.com/v1/news/all";

export class MarketauxNewsProvider implements NewsProvider {
  name = "marketaux";
  constructor(private apiKey: string) {}

  async getRecentArticles({ tickers, since }: { tickers?: string[]; since: Date }) {
    try {
      const params = new URLSearchParams({
        api_token: this.apiKey,
        language: "en",
        filter_entities: "true",
        published_after: since.toISOString(),
        limit: "50",
      });
      if (tickers && tickers.length) params.set("symbols", tickers.join(","));
      else params.set("must_have_entities", "true");

      const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        return unavailable(`Marketaux request failed (HTTP ${res.status})`);
      }
      interface MarketauxItem {
        source?: string;
        title: string;
        url: string;
        published_at?: string;
        description?: string;
        entities?: { symbol?: string }[];
      }
      const data: { error?: { message?: string }; data?: MarketauxItem[] } = await res.json();
      if (data.error) return unavailable(`Marketaux error: ${data.error.message ?? "unknown"}`);

      const articles: RawArticle[] = (data.data ?? []).map((item) => ({
        source: item.source ?? "Unknown",
        headline: item.title,
        url: item.url,
        publishedAt: item.published_at ?? null,
        // Marketaux is itself a financial-news aggregator, so everything it returns counts as financial-ecosystem coverage.
        isFinancialOutlet: true,
        isMajorOutlet: isMajorOutlet(item.source ?? ""),
        tickers: (item.entities ?? []).map((e) => e.symbol).filter((s): s is string => Boolean(s)),
        summary: item.description,
      }));
      return observed(articles, { source: "marketaux", isEstimate: false });
    } catch (err) {
      return unavailable(`Marketaux request error: ${(err as Error).message}`);
    }
  }
}
