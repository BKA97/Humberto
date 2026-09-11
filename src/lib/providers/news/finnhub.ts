import { NewsProvider, RawArticle, observed, unavailable } from "../types";
import { isFinancialOutlet, isMajorOutlet } from "../../outletClassification";

const BASE = "https://finnhub.io/api/v1";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

type FinnhubNewsItem = { source?: string; headline: string; url: string; datetime?: number; summary?: string };

function toRawArticle(item: FinnhubNewsItem, tickers: string[]): RawArticle {
  return {
    source: item.source ?? "Unknown",
    headline: item.headline,
    url: item.url,
    publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
    isFinancialOutlet: isFinancialOutlet(item.source ?? ""),
    isMajorOutlet: isMajorOutlet(item.source ?? ""),
    tickers,
    summary: item.summary,
  };
}

export class FinnhubNewsProvider implements NewsProvider {
  name = "finnhub";
  constructor(private apiKey: string) {}

  async getRecentArticles({ tickers, since }: { tickers?: string[]; since: Date }) {
    try {
      if (!tickers || tickers.length === 0) {
        return await this.getGeneralNews(since);
      }
      const from = ymd(since);
      const to = ymd(new Date());
      const results = await Promise.all(
        tickers.map(async (ticker) => {
          const res = await fetch(
            `${BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${this.apiKey}`,
            { cache: "no-store" }
          );
          if (!res.ok) return [];
          const data: unknown = await res.json();
          return (Array.isArray(data) ? (data as FinnhubNewsItem[]) : []).map((item) => toRawArticle(item, [ticker]));
        })
      );
      return observed(results.flat(), { source: "finnhub", isEstimate: false });
    } catch (err) {
      return unavailable(`Finnhub news error: ${(err as Error).message}`);
    }
  }

  /**
   * Broad, ticker-less market news (spec §4 — discovery starts from the
   * news). Finnhub's general-news feed doesn't tag companies itself, unlike
   * Marketaux, so articles come back with `tickers: []` — the ingestion
   * layer fills those in via src/lib/companyMatch.ts.
   */
  private async getGeneralNews(since: Date) {
    const res = await fetch(`${BASE}/news?category=general&token=${this.apiKey}`, { cache: "no-store" });
    if (!res.ok) return unavailable(`Finnhub general news failed (HTTP ${res.status})`);
    const data: unknown = await res.json();
    const items = Array.isArray(data) ? (data as FinnhubNewsItem[]) : [];
    const articles = items
      .filter((item) => !item.datetime || new Date(item.datetime * 1000) >= since)
      .map((item) => toRawArticle(item, []));
    return observed(articles, { source: "finnhub", isEstimate: false });
  }
}
