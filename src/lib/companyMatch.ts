// Ticker discovery from free-text (spec §4, §9): news comes first, tickers
// come from the news — not the other way around. This module answers "which
// public companies does this article mention?" using three signals, most to
// least reliable:
//
//   1. Cashtags ($AAPL) and exchange parentheticals ("(NASDAQ: AAPL)") —
//      near-zero false-positive rate, used whenever present.
//   2. Exact company-name matching against a cached directory of US
//      common-stock names (see src/lib/ingest/symbolDirectory.ts) — good
//      recall, some false-positive risk from short/generic names, which is
//      why very short names are excluded below.
//
// This is a heuristic, not NLP entity resolution (see SPEC-NOTES.md) — it's
// what lets an *untagged* general-news feed (e.g. Finnhub's) still surface
// new tickers. A provider that already tags entities (e.g. Marketaux) is
// more reliable and is preferred when configured.

export interface DirectoryEntry {
  ticker: string;
  name: string;
}

const SUFFIXES = [
  "incorporated", "inc", "corporation", "corp", "co", "company", "ltd",
  "limited", "plc", "llc", "lp", "holdings", "holding", "group", "sa", "ag",
  "nv", "se", "class a", "class b", "class c",
];

function normalize(name: string): string {
  let n = name.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  for (const suffix of SUFFIXES) {
    const re = new RegExp(`\\b${suffix}\\b`, "g");
    n = n.replace(re, " ");
  }
  return n.replace(/\s+/g, " ").trim();
}

export interface CompanyMatchIndex {
  /** ticker -> normalized name, filtered to names specific enough to match safely */
  byNormalizedName: Map<string, string>;
  /** every valid ticker symbol, for cashtag/parenthetical validation */
  tickers: Set<string>;
}

// Deliberately short: 4, not 6. A 6-char floor silently dropped "Apple" and
// "Tesla" (5 chars after suffix-stripping) from name-based matching entirely
// — a real false-negative bug for two of the most heavily-covered tickers in
// the market, since ordinary headlines often say "Apple" with no cashtag or
// "(NASDAQ: AAPL)" to fall back on. 4 chars still excludes true noise like
// "IT" or "Co".
const MIN_NAME_LENGTH = 4;

// A handful of real company names that, even post-normalization, are common
// enough English words to generate obvious false positives if matched by
// name alone (a story using the word "target" in the ordinary sense would
// otherwise get tagged as Target Corporation). Not exhaustive — extend this
// list if you notice a specific ticker over-triggering; see SPEC-NOTES.md.
const GENERIC_NAME_STOPLIST = new Set([
  "gap", "target", "match", "block", "root", "chime", "core", "first",
  "old", "new", "sound", "east", "west", "here", "definity",
]);

export function buildMatchIndex(directory: DirectoryEntry[]): CompanyMatchIndex {
  const byNormalizedName = new Map<string, string>();
  const tickers = new Set<string>();
  for (const entry of directory) {
    tickers.add(entry.ticker.toUpperCase());
    const normalized = normalize(entry.name);
    if (normalized.length >= MIN_NAME_LENGTH && !GENERIC_NAME_STOPLIST.has(normalized)) {
      byNormalizedName.set(normalized, entry.ticker.toUpperCase());
    }
  }
  return { byNormalizedName, tickers };
}

const CASHTAG_RE = /\$([A-Z]{1,5})\b/g;
const EXCHANGE_RE = /\((?:NYSE|NASDAQ|NYSE\s?AMERICAN|OTC)[:\s]+([A-Z.]{1,6})\)/gi;

/** Returns the set of tickers this text plausibly mentions. */
export function matchTickersInText(text: string, index: CompanyMatchIndex): string[] {
  const found = new Set<string>();

  for (const m of text.matchAll(CASHTAG_RE)) {
    if (index.tickers.has(m[1])) found.add(m[1]);
  }
  for (const m of text.matchAll(EXCHANGE_RE)) {
    const t = m[1].toUpperCase();
    if (index.tickers.has(t)) found.add(t);
  }

  const normalizedText = normalize(text);
  if (normalizedText.length > 0) {
    for (const [name, ticker] of index.byNormalizedName) {
      if (normalizedText.includes(name)) found.add(ticker);
    }
  }

  return Array.from(found);
}
