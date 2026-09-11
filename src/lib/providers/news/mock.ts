import { NewsProvider, RawArticle, observed } from "../types";

const TEMPLATES = [
  (t: string) => `${t} discloses executive departure amid restructuring`,
  (t: string) => `${t} issues voluntary recall after quality complaints`,
  (t: string) => `${t} shares move after social-media post draws wide attention`,
  (t: string) => `${t} faces new regulatory inquiry`,
  (t: string) => `${t} updates guidance ahead of next earnings report`,
];

const SOURCES: [string, boolean, boolean][] = [
  ["Reuters", true, true],
  ["Bloomberg", true, true],
  ["CNBC", true, true],
  ["Associated Press", false, true],
  ["TechCrunch", false, false],
  ["The Verge", false, false],
];

export class MockNewsProvider implements NewsProvider {
  name = "mock";

  async getRecentArticles({ tickers, since }: { tickers?: string[]; since: Date }) {
    const list = tickers && tickers.length ? tickers : ["AAPL", "TSLA"];
    const articles: RawArticle[] = [];
    list.forEach((ticker, i) => {
      const template = TEMPLATES[i % TEMPLATES.length];
      SOURCES.slice(0, 2 + (i % 3)).forEach(([source, isFinancial, isMajor], j) => {
        articles.push({
          source,
          headline: template(ticker),
          url: `https://example.com/mock/${ticker.toLowerCase()}-${i}-${j}`,
          publishedAt: new Date(Date.now() - j * 45 * 60 * 1000).toISOString(),
          isFinancialOutlet: isFinancial,
          isMajorOutlet: isMajor,
          tickers: [ticker],
          summary: `${ticker} is the subject of a developing news story (mock development data).`,
        });
      });
    });
    return observed(
      articles.filter((a) => (a.publishedAt ? new Date(a.publishedAt) >= since : true)),
      { source: "mock", isEstimate: true, method: "synthetic dev data" }
    );
  }
}
