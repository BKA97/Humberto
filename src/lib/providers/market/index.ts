import { MarketDataProvider } from "../types";
import { FinnhubMarketProvider } from "./finnhub";
import { MockMarketDataProvider } from "./mock";

let instance: MarketDataProvider | null = null;

export function getMarketDataProvider(): MarketDataProvider {
  if (instance) return instance;
  const key = process.env.FINNHUB_API_KEY;
  instance = key ? new FinnhubMarketProvider(key) : new MockMarketDataProvider();
  return instance;
}

export function isUsingMockMarketData(): boolean {
  return !process.env.FINNHUB_API_KEY;
}
