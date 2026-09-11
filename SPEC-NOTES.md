# Spec coverage notes

This build follows the Version 1 priority order given in the original spec
(§42): Morning Brief → market reaction data → news/event association →
Track → Thesis → Active → Close → History → news attention → social
attention → Alerts → Research dashboard → advanced visualizations. All of
these are implemented and working end-to-end against both mock and real
data providers.

## Fully implemented

- Provider-abstraction data layer (`src/lib/providers/`) — market, news,
  and per-platform social attention providers, each returning either a
  value with source/timestamp/estimate provenance or an explicit
  "not available," never a fabricated number.
- Append-only snapshot model (`src/lib/db/schema.ts`) — market and
  attention observations are new rows, never overwritten; positions freeze
  their entry-time context permanently.
- Financial vs. general-public attention distinction, with rolling
  baselines built from Day 1 onward (never backfilled).
- Track → Thesis → Tags → Active → Close → History → Research loop,
  including S&P 500 (via SPY) benchmarking and relative-return math.
- Objective threshold alerts (price move, volume spike, news/social
  attention spike, new development on a tracked event).
- Morning Brief (daily cron) + intraday polling (external-pinger cron) +
  NYSE trading-calendar awareness.
- Research dashboard: descriptive stats by tag / reaction size / attention
  level / holding period, plus an attention-vs-reaction scatter — no
  generated conclusions.
- Password-gated private deployment; no social/sharing features.

## Simplified for V1 (see README "Known V1 limitations" for the practical impact)

- **Event/entity resolution** (spec §9, §30): true NLP-based story
  clustering is out of scope for a first version. Instead, near-duplicate
  headlines detected across the whole ingestion batch are treated as one
  story, which does correctly group one industry-wide event across several
  tickers, but won't catch two independently-written articles about the
  same event with very different wording.
- **Discovery universe** (spec §4's "focus on individual companies"):
  discovery is news-first — every cycle scans broad, ticker-less news and
  figures out which companies each article is about, rather than starting
  from a fixed list of tickers (`ingestDiscoveryCycle` in
  `src/lib/ingest/news.ts`). Marketaux tags companies itself; Finnhub's
  general feed doesn't, so untagged articles are matched against a cached
  ticker/name directory refreshed weekly from Finnhub's symbol list
  (`src/lib/ingest/symbolDirectory.ts`) using cashtags, "(NASDAQ: X)"
  parentheticals, and normalized company-name substring matching
  (`src/lib/companyMatch.ts`). This is a heuristic, not NLP entity
  resolution: it has a small stoplist for company names that are also
  common English words (e.g. "Gap", "Target") to cut false positives, and
  it can still miss a company mentioned only by an unusual nickname, or
  occasionally mis-tag one. Without a paid news-firehose API there's still
  no way to scan literally every public company on every source — but
  unlike a hand-picked watchlist, coverage now grows automatically with
  whatever the news actually reports on. `getMustMonitorTickers()` in
  `src/lib/ingest/watchlist.ts` (open positions, plus an optional
  `SUPPLEMENTAL_TICKERS` list) is a monitoring floor layered on top, not
  the discovery mechanism — it guarantees a price/attention snapshot every
  cycle for tickers you care about even on a day with no news about them.
- **Volume/relative volume**: Finnhub's free `/quote` endpoint doesn't
  return volume. The field exists throughout the schema and UI and will
  populate automatically once a candle-data source is wired into
  `src/lib/providers/market/`.
- **X, TikTok, Instagram**: no free, practical public-search API exists for
  any of the three today (details in
  `src/lib/providers/social/unavailable.ts`). The provider interface and
  UI slots are fully wired — adding a real one later is a drop-in, not a
  redesign.
- **Sentiment**: deliberately not implemented anywhere, per spec §8 — only
  volume/rate/acceleration of attention, never a positive/negative score.

## Extensibility hooks left in place (spec §41)

Swapping or adding a provider means writing one class that implements the
relevant interface in `src/lib/providers/types.ts` and registering it in
that category's `index.ts` — nothing else in the app needs to change.
Custom tags, additional benchmarks, and CSV/JSON export are all natural
next additions on top of the existing data model without a schema
migration for the first two.
