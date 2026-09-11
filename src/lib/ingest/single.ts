import { getOrCreateCompany } from "./companies";
import { captureMarketSnapshot } from "./market";
import { captureNewsAttentionSnapshot, captureSocialAttentionSnapshots } from "./attention";
import { getRecentArticlesFromAllProviders } from "../providers/news";

/**
 * On-demand refresh for a single ticker — used when the user manually
 * searches/tracks a stock that isn't already in the watchlist cycle (spec
 * §16: manual tracking must not require a news event or a prior cron run).
 */
export async function ingestSingleTicker(ticker: string) {
  const company = await getOrCreateCompany(ticker);
  const snapshot = await captureMarketSnapshot({ companyId: company.id, ticker });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { articles } = await getRecentArticlesFromAllProviders({ tickers: [ticker], since });
  await captureNewsAttentionSnapshot({
    companyId: company.id,
    financialArticleCount: articles.filter((a) => a.isFinancialOutlet).length,
    generalArticleCount: articles.filter((a) => !a.isFinancialOutlet).length,
    uniqueOutletCount: new Set(articles.map((a) => a.source)).size,
  });
  await captureSocialAttentionSnapshots({ companyId: company.id, ticker, companyName: company.name });

  return { company, snapshot };
}
