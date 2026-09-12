// Temporary diagnostic script — not part of the app itself. Run with:
//   npx tsx scripts/diagnose.ts
// It checks the two things that silently fail without any visible error if
// something's wrong: whether the Finnhub-sourced ticker/name directory
// actually populated, and whether the text-matching heuristic correctly
// finds a ticker in a known-good sample headline. Safe to delete afterward.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { symbolDirectory } from "../src/lib/db/schema";
import { getMatchIndex, refreshSymbolDirectoryIfStale } from "../src/lib/ingest/symbolDirectory";
import { matchTickersInText } from "../src/lib/companyMatch";
import { TheNewsApiProvider } from "../src/lib/providers/news/thenewsapi";

async function main() {
  console.log("--- Environment ---");
  console.log("FINNHUB_API_KEY set:", Boolean(process.env.FINNHUB_API_KEY));
  console.log("THENEWSAPI_KEY set:", Boolean(process.env.THENEWSAPI_KEY));

  console.log("\n--- Symbol directory (before) ---");
  const [{ count: before }] = await db.select({ count: sql<number>`count(*)::int` }).from(symbolDirectory);
  console.log("Row count:", before);

  console.log("\n--- Testing Finnhub directly ---");
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.log("No FINNHUB_API_KEY set — skipping direct test.");
  } else {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${apiKey}`, {
        cache: "no-store",
      });
      console.log("HTTP status:", res.status, res.statusText);
      const text = await res.text();
      if (res.ok) {
        const parsed = JSON.parse(text);
        console.log("Response is a JSON array with", Array.isArray(parsed) ? parsed.length : "?", "entries.");
        const apple = Array.isArray(parsed) ? parsed.find((s: { symbol?: string }) => s.symbol === "AAPL") : null;
        console.log("AAPL entry found in response:", apple ?? "NOT FOUND");
      } else {
        console.log("Response body (first 500 chars):", text.slice(0, 500));
      }
    } catch (err) {
      console.log("Request threw an error:", (err as Error).message);
    }
  }

  console.log("\n--- Running refreshSymbolDirectoryIfStale() ---");
  await refreshSymbolDirectoryIfStale();

  const [{ count: after }] = await db.select({ count: sql<number>`count(*)::int` }).from(symbolDirectory);
  console.log("Row count after refresh attempt:", after);

  console.log("\n--- Match index ---");
  const index = await getMatchIndex();
  console.log("Distinct matchable names:", index.byNormalizedName.size);
  console.log("Total known tickers:", index.tickers.size);
  console.log("'apple' maps to:", index.byNormalizedName.get("apple") ?? "NOT IN INDEX");

  console.log("\n--- Match test ---");
  const testHeadline = "Weekend Apple deals: AirPods 5, Apple Watch Series 12, more";
  console.log("Headline:", testHeadline);
  console.log("Tickers matched:", matchTickersInText(testHeadline, index));

  console.log("\n--- Live TheNewsAPI call, exactly as ingestDiscoveryCycle makes it ---");
  const newsApiKey = process.env.THENEWSAPI_KEY;
  if (!newsApiKey) {
    console.log("No THENEWSAPI_KEY set — skipping.");
  } else {
    const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const provider = new TheNewsApiProvider(newsApiKey);
    const result = await provider.getRecentArticles({ since });
    if (!result.available) {
      console.log("UNAVAILABLE — reason:", result.reason);
    } else {
      console.log(`Got ${result.value.length} articles:`);
      for (const a of result.value) {
        const matched = matchTickersInText(`${a.headline} ${a.summary ?? ""}`, index);
        console.log(`  - "${a.headline}" (${a.source}) -> tickers matched: [${matched.join(", ")}]`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
