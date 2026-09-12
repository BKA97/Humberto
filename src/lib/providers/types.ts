// Shared provider contracts.
//
// The rule that shapes every interface here (spec §6, §32): never invent a
// number. A provider either returns a value with its provenance (source,
// retrieval time, whether it's exact or estimated), or it returns
// `available: false`. Callers must render "Not available" rather than
// guessing, and must never silently substitute a mock value for a missing
// real one outside of MOCK_MODE.

export type MarketSession =
  | "PREVIOUS_CLOSE"
  | "PRE_MARKET"
  | "OPEN"
  | "INTRADAY"
  | "CLOSE"
  | "AFTER_HOURS";

export type AttentionEcosystem = "FINANCIAL" | "GENERAL_PUBLIC";

export type AttentionPlatform =
  | "NEWS_FINANCIAL"
  | "NEWS_GENERAL"
  | "X"
  | "REDDIT"
  | "TIKTOK"
  | "INSTAGRAM"
  | "YOUTUBE"
  | "GDELT";

export interface Provenance {
  source: string;
  retrievedAt: string; // ISO timestamp of the API call, not the underlying event
  isEstimate: boolean;
  method?: string;
}

export type Observation<T> =
  | { available: true; value: T; provenance: Provenance }
  | { available: false; reason: string; provenance?: Provenance };

export function unavailable(reason: string): Observation<never> {
  return { available: false, reason };
}

export function observed<T>(value: T, provenance: Omit<Provenance, "retrievedAt">): Observation<T> {
  return {
    available: true,
    value,
    provenance: { ...provenance, retrievedAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface Quote {
  price: number;
  previousClose: number | null;
  dollarChange: number | null;
  percentChange: number | null;
  volume: number | null;
  averageVolume: number | null;
  relativeVolume: number | null;
  session: MarketSession;
  observedAt: string; // ISO
}

export interface TickerMatch {
  ticker: string;
  name: string;
  exchange?: string;
}

export interface MarketDataProvider {
  name: string;
  getQuote(ticker: string): Promise<Observation<Quote>>;
  searchTicker(query: string): Promise<Observation<TickerMatch[]>>;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface RawArticle {
  source: string;
  headline: string;
  url: string;
  publishedAt: string | null;
  isFinancialOutlet: boolean;
  isMajorOutlet: boolean;
  tickers: string[];
  summary?: string;
  /** Which NewsProvider fetched this (set by the aggregator, not individual providers). */
  providerName?: string;
}

export interface NewsProvider {
  name: string;
  /** Articles mentioning any of `tickers` (or, if omitted, broad market-moving news) since `since`. */
  getRecentArticles(opts: { tickers?: string[]; since: Date }): Promise<Observation<RawArticle[]>>;
}

// ---------------------------------------------------------------------------
// Social / public attention
// ---------------------------------------------------------------------------

export interface AttentionMetric {
  metricLabel: string; // "relevant posts", "relevant discussions", "relevant videos", ...
  value: number;
  ecosystem: AttentionEcosystem;
}

export interface SocialAttentionProvider {
  name: string;
  platform: AttentionPlatform;
  getAttention(query: { ticker: string; companyName: string }): Promise<Observation<AttentionMetric[]>>;
}

// ---------------------------------------------------------------------------
// Benchmark (S&P 500 and friends)
// ---------------------------------------------------------------------------

export interface BenchmarkProvider {
  name: string;
  getLevel(symbol: string): Promise<Observation<{ level: number; observedAt: string }>>;
}
