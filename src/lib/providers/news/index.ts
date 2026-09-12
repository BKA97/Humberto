import { NewsProvider, Observation, RawArticle } from "../types";
import { TheNewsApiProvider } from "./thenewsapi";
import { MockNewsProvider } from "./mock";

// News discovery deliberately runs on general/mainstream sources, not
// financial-press aggregators — see SPEC-NOTES.md "Discovery universe".
// FinnhubNewsProvider and MarketauxNewsProvider still exist as files (kept
// in case you ever want financial-press coverage back — see git history /
// their imports here for how they used to be wired in) but are not used by
// default. FINNHUB_API_KEY is still very much in use elsewhere: stock
// prices (src/lib/providers/market/finnhub.ts) and the company/ticker
// symbol directory (src/lib/ingest/symbolDirectory.ts) both depend on it,
// independent of news.

/** All configured real news providers, queried together and merged by the caller (which also dedupes syndication — see lib/dedupe.ts). */
export function getNewsProviders(): NewsProvider[] {
  const providers: NewsProvider[] = [];
  if (process.env.THENEWSAPI_KEY) providers.push(new TheNewsApiProvider(process.env.THENEWSAPI_KEY));
  if (providers.length === 0) providers.push(new MockNewsProvider());
  return providers;
}

export function isUsingMockNews(): boolean {
  return !process.env.THENEWSAPI_KEY;
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
