import { MarketDataProvider, Quote, TickerMatch, observed, unavailable } from "../types";
import { currentMarketSession } from "../../marketCalendar";

const BASE = "https://finnhub.io/api/v1";

export class FinnhubMarketProvider implements MarketDataProvider {
  name = "finnhub";
  constructor(private apiKey: string) {}

  async getQuote(ticker: string) {
    try {
      const res = await fetch(
        `${BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${this.apiKey}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        return unavailable(`Finnhub quote request failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      // Finnhub returns all-zero fields for an unrecognized symbol.
      if (data.c === 0 && data.pc === 0) {
        return unavailable(`No quote data returned for ${ticker}`);
      }
      const price = data.c as number;
      const previousClose = data.pc as number;
      const dollarChange = data.d ?? price - previousClose;
      const percentChange = data.dp ?? (previousClose ? (dollarChange / previousClose) * 100 : null);

      const quote: Quote = {
        price,
        previousClose,
        dollarChange,
        percentChange,
        // Finnhub's free /quote endpoint does not include volume; we do not
        // fabricate it. A future candle-endpoint integration can fill this in.
        volume: null,
        averageVolume: null,
        relativeVolume: null,
        session: currentMarketSession(),
        observedAt: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
      };
      return observed(quote, { source: "finnhub", isEstimate: false });
    } catch (err) {
      return unavailable(`Finnhub request error: ${(err as Error).message}`);
    }
  }

  async searchTicker(query: string) {
    try {
      const res = await fetch(
        `${BASE}/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`,
        { cache: "no-store" }
      );
      if (!res.ok) return unavailable(`Finnhub search failed (HTTP ${res.status})`);
      const data: { result?: { symbol: string; description: string; type: string }[] } = await res.json();
      const matches: TickerMatch[] = (data.result ?? [])
        .filter((r) => r.type === "Common Stock" && !r.symbol.includes("."))
        .slice(0, 10)
        .map((r) => ({ ticker: r.symbol, name: r.description, exchange: undefined }));
      return observed(matches, { source: "finnhub", isEstimate: false });
    } catch (err) {
      return unavailable(`Finnhub search error: ${(err as Error).message}`);
    }
  }
}
