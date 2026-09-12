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
- Optional LLM-assisted story analysis (`ANTHROPIC_API_KEY`,
  `src/lib/llm/storyAnalysis.ts`): one Claude read per newly-discovered
  story, strictly scoped to (a) a descriptive 0–100 "mainstream reach"
  estimate — how likely someone who doesn't follow markets or business
  news is to have heard about this — and (b) extracting the people and
  companies the story is actually about. It is never asked to, and never
  does, judge whether the resulting stock move is justified; that
  boundary is enforced in the prompt/schema (see the doc comment at the
  top of `storyAnalysis.ts`) and echoed in the schema comment on the
  `newsEvents.mainstreamReachScore`/`mainstreamReachRationale` columns.
  Any name it extracts is re-resolved through the same deterministic
  `matchTickersInText`/symbol-directory matching everything else in the
  pipeline uses — an LLM-suggested ticker is never trusted directly, to
  guard against hallucinated symbols. This is what closes the "executive
  or public figure mentioned without their company being named" gap noted
  below. Fully optional: with no key configured, discovery keeps working
  exactly as before, just without the reach score or that name-resolution
  assist.
- Optional GDELT attention signal (`ENABLE_GDELT`,
  `src/lib/providers/social/gdelt.ts`): a free, keyless, global
  news-coverage volume count (mentions + distinct outlets, 24h) from the
  GDELT DOC 2.0 API, layered in alongside Reddit/YouTube as another
  general-public attention source. Deliberately volume-only — see
  "Sentiment" below for why its tone/sentiment field is never requested or
  used. Off by default and only run during the once-daily thorough pass
  (see the `thorough` flag below), since it's a research/academic
  resource rather than an SLA'd commercial API and is more prone to rate
  limiting under frequent polling.

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
  `src/lib/ingest/news.ts`). The default news source is TheNewsAPI
  (`src/lib/providers/news/thenewsapi.ts`) — deliberately general/mainstream
  rather than financial-press, so a story surfaces because it's actually in
  the news, not because a financial outlet covered it (this was a
  deliberate switch away from an earlier financial-press-only setup;
  Finnhub's/Marketaux's news provider code still exists and can be swapped
  back in via `src/lib/providers/news/index.ts` if you ever want both). It
  doesn't tag companies itself, so every article is matched against a
  cached ticker/name directory refreshed weekly from Finnhub's symbol list
  (`src/lib/ingest/symbolDirectory.ts`) using cashtags, "(NASDAQ: X)"
  parentheticals, and normalized company-name substring matching
  (`src/lib/companyMatch.ts`). This is a heuristic, not NLP entity
  resolution: it has a small stoplist for company names that are also
  common English words (e.g. "Gap", "Target") to cut false positives, it
  can still miss a company mentioned only by an unusual nickname or
  occasionally mis-tag one, and — because matching is name/ticker-based,
  not person-based — a story about an executive or public figure only
  surfaces a ticker if their company is actually named in the text, unless
  `ANTHROPIC_API_KEY` is configured (see "Optional LLM-assisted story
  analysis" above), which extracts the person's name and resolves their
  associated company through the same deterministic matching.
  TheNewsAPI's free tier is also thin (historically ~100 requests/day, 3
  articles/request), which is why `ingestDiscoveryCycle` takes a
  `thorough` flag (renamed from `includePerTickerNews` — it now gates two
  things, not one): intraday polling passes `false` to keep each poll to
  exactly one TheNewsAPI request and to skip rate-limit-sensitive social
  providers (currently GDELT), while the fuller per-ticker news pass and
  those extra social providers only run once a day via the Morning Brief
  cron. Without a paid
  news-firehose API there's still no way to scan literally every public
  company on every source — but unlike a hand-picked watchlist, coverage
  now grows automatically with whatever the news actually reports on.
  `getMustMonitorTickers()` in `src/lib/ingest/watchlist.ts` (open
  positions, plus an optional `SUPPLEMENTAL_TICKERS` list) is a monitoring
  floor layered on top, not the discovery mechanism — it guarantees a
  price/attention snapshot every cycle for tickers you care about even on a
  day with no news about them.
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
  This is why GDELT is integrated volume-only: GDELT's API does expose a
  "tone" field alongside its coverage counts, but this app never requests
  or parses it (see `src/lib/providers/social/gdelt.ts`) — adding that
  field back in would reintroduce exactly the sentiment score this project
  is designed to avoid. The Claude-based "mainstream reach" score
  (above) is the one LLM-derived number in the app, and it's a reach/
  awareness estimate, not a sentiment score — it says nothing about
  positive or negative, only "how widely known."

## Extensibility hooks left in place (spec §41)

Swapping or adding a provider means writing one class that implements the
relevant interface in `src/lib/providers/types.ts` and registering it in
that category's `index.ts` — nothing else in the app needs to change.
Custom tags, additional benchmarks, and CSV/JSON export are all natural
next additions on top of the existing data model without a schema
migration for the first two.
