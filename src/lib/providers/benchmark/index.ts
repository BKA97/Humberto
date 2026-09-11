import { BenchmarkProvider, observed, unavailable } from "../types";

const BASE = "https://finnhub.io/api/v1";

// Finnhub's free tier serves quotes for the SPY ETF (a liquid S&P 500
// proxy) rather than the raw ^GSPC index, which is more restricted. SPY
// tracks the index closely enough for a relative-return comparison; the UI
// labels it "S&P 500 (via SPY)" rather than implying it's the raw index.
class FinnhubBenchmarkProvider implements BenchmarkProvider {
  name = "finnhub";
  constructor(private apiKey: string) {}

  async getLevel(symbol: string) {
    try {
      const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`, {
        cache: "no-store",
      });
      if (!res.ok) return unavailable(`Benchmark quote failed (HTTP ${res.status})`);
      const data = await res.json();
      if (!data.c) return unavailable(`No benchmark data for ${symbol}`);
      return observed(
        { level: data.c as number, observedAt: new Date().toISOString() },
        { source: "finnhub", isEstimate: false }
      );
    } catch (err) {
      return unavailable(`Benchmark request error: ${(err as Error).message}`);
    }
  }
}

class MockBenchmarkProvider implements BenchmarkProvider {
  name = "mock";
  async getLevel() {
    const level = Math.round((560 + (Math.random() - 0.5) * 20) * 100) / 100;
    return observed({ level, observedAt: new Date().toISOString() }, { source: "mock", isEstimate: true });
  }
}

export function getBenchmarkProvider(): BenchmarkProvider {
  const key = process.env.FINNHUB_API_KEY;
  return key ? new FinnhubBenchmarkProvider(key) : new MockBenchmarkProvider();
}

export const DEFAULT_BENCHMARK_SYMBOL = "SPY";
export const DEFAULT_BENCHMARK_LABEL = "S&P 500 (via SPY)";
