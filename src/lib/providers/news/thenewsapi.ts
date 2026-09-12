import { NewsProvider, RawArticle, observed, unavailable } from "../types";
import { isFinancialOutlet, isMajorOutlet } from "../../outletClassification";

// General/mainstream news (spec §7 — this is the "regular people news" side
// of the financial-vs-general-public split, deliberately NOT a
// financial-press aggregator like Finnhub/Marketaux). See
// https://www.thenewsapi.com/documentation
//
// The free tier is thin — historically 100 requests/day and only 3 articles
// per request — so this provider is deliberately conservative: one call per
// invocation, no attempt to paginate for more coverage. Frequent polling
// throughout the day is what accumulates real coverage over time, not a
// single deep call. See SPEC-NOTES.md "Discovery universe" for the request
// budget this implies and how ingestDiscoveryCycle economizes on it.

const BASE = "https://api.thenewsapi.com/v1/news/all";
const ARTICLES_PER_CALL = 3; // the free-tier cap; requesting more just wastes the parameter

// The broad (ticker-less) discovery call only gets 3 articles back per
// request (see above), pulled from literally all news everywhere — so
// without any steering, most of those 3 slots go to things that can never
// match a public company (sports scores, entertainment listicles, movie
// piracy listings, etc.), wasting the sample. TheNewsAPI supports
// `exclude_categories` (docs: thenewsapi.com/documentation) to cut the
// categories least likely to ever mention a company by name, while staying
// well within the "mainstream, not financial-press" design (spec §4) —
// business/tech/entertainment/politics/general/health/science all stay in,
// since a mainstream story about a company or executive can land in any of
// those. Only applied to the broad call: a per-ticker search (see below)
// already narrows on the company name/ticker itself, so there's no similar
// waste to cut there, and no reason to risk excluding a legitimately
// relevant hit for something you're actively tracking.
const BROAD_QUERY_EXCLUDED_CATEGORIES = "sports,food,travel";

// TheNewsAPI reports sources as bare domains ("foxnews.com"), not display
// names, so the isFinancialOutlet/isMajorOutlet lists (which expect names
// like "Fox News") wouldn't match anything without this translation. Not
// exhaustive — anything unmapped falls back to a best-effort title-cased
// version of the domain, which just won't match the financial/major lists
// (a safe default per outletClassification.ts's own convention).
const DOMAIN_TO_NAME: Record<string, string> = {
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
  "cnbc.com": "CNBC",
  "wsj.com": "The Wall Street Journal",
  "marketwatch.com": "MarketWatch",
  "ft.com": "Financial Times",
  "barrons.com": "Barron's",
  "forbes.com": "Forbes",
  "fortune.com": "Fortune",
  "axios.com": "Axios",
  "businessinsider.com": "Business Insider",
  "apnews.com": "Associated Press",
  "nytimes.com": "The New York Times",
  "washingtonpost.com": "The Washington Post",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "cnn.com": "CNN",
  "nbcnews.com": "NBC News",
  "abcnews.go.com": "ABC News",
  "cbsnews.com": "CBS News",
  "usatoday.com": "USA Today",
  "politico.com": "Politico",
  "theguardian.com": "The Guardian",
  "techcrunch.com": "TechCrunch",
  "theverge.com": "The Verge",
  "people.com": "People",
  "variety.com": "Variety",
  "tmz.com": "TMZ",
  "espn.com": "ESPN",
};

function domainToName(domain: string): string {
  const clean = domain.trim().toLowerCase();
  if (DOMAIN_TO_NAME[clean]) return DOMAIN_TO_NAME[clean];
  const withoutTld = clean.replace(/\.(com|net|org|co\.uk|io|news)$/i, "");
  return withoutTld
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// TheNewsAPI requires published_after/published_before in exactly
// `Y-m-d\TH:i:s` — no milliseconds, no trailing timezone letter. Date's own
// toISOString() produces "2026-09-11T18:00:00.000Z", and that trailing
// ".000Z" makes their validation reject the WHOLE request with an HTTP 400
// (their generic "malformed_parameters" error) — silently returning zero
// articles from this provider's point of view, with no other symptom.
// Confirmed directly against the live API while debugging this. Since
// toISOString() is always UTC, slicing off the fractional-seconds+"Z" tail
// is a lossless conversion to their expected format, still meaning UTC.
function formatForTheNewsApi(date: Date): string {
  return date.toISOString().slice(0, 19);
}

interface TheNewsApiItem {
  uuid: string;
  title: string;
  description?: string;
  url: string;
  source?: string;
  published_at?: string;
}

export class TheNewsApiProvider implements NewsProvider {
  name = "thenewsapi";
  constructor(private apiKey: string) {}

  async getRecentArticles({ tickers, since }: { tickers?: string[]; since: Date }) {
    try {
      const params = new URLSearchParams({
        api_token: this.apiKey,
        language: "en",
        published_after: formatForTheNewsApi(since),
        limit: String(ARTICLES_PER_CALL),
      });
      // No native ticker/entity tagging on this API — searching by the bare
      // ticker string is a heuristic (same tradeoff as the name-matching in
      // companyMatch.ts), used only for the must-monitor per-ticker lookups
      // (see ingestDiscoveryCycle's `thorough` flag).
      if (tickers && tickers.length === 1) params.set("search", tickers[0]);
      else if (tickers && tickers.length > 1) params.set("search", tickers.join(" OR "));
      else params.set("exclude_categories", BROAD_QUERY_EXCLUDED_CATEGORIES);

      const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 429) return unavailable("TheNewsAPI daily request quota reached");
        return unavailable(`TheNewsAPI request failed (HTTP ${res.status})`);
      }
      const data: { data?: TheNewsApiItem[]; error?: { message?: string } } = await res.json();
      if (data.error) return unavailable(`TheNewsAPI error: ${data.error.message ?? "unknown"}`);

      const articles: RawArticle[] = (data.data ?? []).map((item) => {
        const sourceName = domainToName(item.source ?? "unknown");
        return {
          source: sourceName,
          headline: item.title,
          url: item.url,
          publishedAt: item.published_at ?? null,
          isFinancialOutlet: isFinancialOutlet(sourceName),
          isMajorOutlet: isMajorOutlet(sourceName),
          // Untagged — same as Finnhub's general feed, resolved later via
          // companyMatch.ts against the cached symbol directory.
          tickers: tickers && tickers.length ? tickers : [],
          summary: item.description,
        };
      });
      return observed(articles, { source: "thenewsapi", isEstimate: false });
    } catch (err) {
      return unavailable(`TheNewsAPI request error: ${(err as Error).message}`);
    }
  }
}
