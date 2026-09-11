import { MarketDataProvider, Quote, observed, TickerMatch } from "../types";

// Deterministic-ish pseudo-random mock data for local development only.
// Never used in production unless no real market data key is configured —
// and even then, every value returned here is clearly marked `isEstimate`.

const SAMPLE_COMPANIES: TickerMatch[] = [
  { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
  { ticker: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ" },
  { ticker: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ" },
  { ticker: "BA", name: "The Boeing Company", exchange: "NYSE" },
  { ticker: "TGT", name: "Target Corporation", exchange: "NYSE" },
  { ticker: "DIS", name: "The Walt Disney Company", exchange: "NYSE" },
  { ticker: "PYPL", name: "PayPal Holdings, Inc.", exchange: "NASDAQ" },
  { ticker: "CVS", name: "CVS Health Corporation", exchange: "NYSE" },
];

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

export class MockMarketDataProvider implements MarketDataProvider {
  name = "mock";

  async getQuote(ticker: string) {
    // Vary slightly by the hour so repeated dev calls show gentle movement.
    const rand = seededRandom(ticker + new Date().toISOString().slice(0, 13));
    const basePrice = 40 + (ticker.charCodeAt(0) % 26) * 12;
    const previousClose = Math.round(basePrice * (0.98 + rand() * 0.04) * 100) / 100;
    const move = (rand() - 0.5) * 0.16; // +/-8%
    const price = Math.round(previousClose * (1 + move) * 100) / 100;
    const dollarChange = Math.round((price - previousClose) * 100) / 100;
    const percentChange = Math.round((dollarChange / previousClose) * 10000) / 100;
    const averageVolume = Math.round(2_000_000 + rand() * 8_000_000);
    const volume = Math.round(averageVolume * (0.5 + rand() * 2.5));

    const quote: Quote = {
      price,
      previousClose,
      dollarChange,
      percentChange,
      volume,
      averageVolume,
      relativeVolume: Math.round((volume / averageVolume) * 100) / 100,
      session: "INTRADAY",
      observedAt: new Date().toISOString(),
    };
    return observed(quote, { source: "mock", isEstimate: true, method: "synthetic dev data" });
  }

  async searchTicker(query: string) {
    const q = query.trim().toUpperCase();
    const matches = SAMPLE_COMPANIES.filter(
      (c) => c.ticker.includes(q) || c.name.toUpperCase().includes(q)
    );
    return observed(matches, { source: "mock", isEstimate: false });
  }
}
