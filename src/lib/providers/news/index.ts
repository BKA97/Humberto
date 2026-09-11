import { NewsProvider, Observation, RawArticle } from "../types";
import { FinnhubNewsProvider } from "./finnhub";
import { MarketauxNewsProvider } from "./marketaux";
import { MockNewsProvider } from "./mock";

/** All configured real news providers, queried together and merged by the caller (which also dedupes syndication — see lib/dedupe.ts). */
export function getNewsProviders(): NewsProvider[] {
  const providers: NewsProvider[] = [];
  if (process.env.FINNHUB_API_KEY) providers.push(new FinnhubNewsProvider(process.env.FINNHUB_API_KEY));
  if (process.env.MARKETAUX_API_KEY) providers.push(new MarketauxNewsProvider(process.env.MARKETAUX_API_KEY));
  if (providers.length === 0) providers.push(new MockNewsProvider());
  return providers;
}

export function isUsingMockNews(): boolean {
  return !process.env.FINNHUB_API_KEY && !process.env.MARKETAUX_API_KEY;
}

/** Fetch from every configured provider and flatten. Individual provider failures don't take down the others. */
export async function getRecentArticlesFromAllProviders(opts: {
  tickers?: string[];
  since: Date;
}): Promise<{ articles: RawArticle[]; providerResults: { provider: string; result: Observation<RawArticle[]> }[] }> {
  const providers = getNewsProviders();
  const results = await Promise.all(
    providers.map(async (p) => ({ provider: p.name, result: await p.getRecentArticles(opts) }))
  );
  const articles = results.flatMap((r) =>
    r.result.available ? r.result.value.map((a) => ({ ...a, providerName: r.provider })) : []
  );
  return { articles, providerResults: results };
}
