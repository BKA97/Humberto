# Market Reaction Lab

A personal research laboratory for studying how markets react to news. See
`SPEC-NOTES.md` for how this build maps to the original product spec and
what's simplified in V1.

**The app never tells you whether a stock is a good investment, whether the
market overreacted, or whether a story matters. It shows what happened, how
much attention it got, and how the stock moved — you write the thesis.**

This guide assumes no prior experience deploying a web app. It walks through
getting this running live on the internet, for free, in about 30–45 minutes.
You'll create a handful of free accounts along the way — take it one section
at a time.

---

## 0. What you'll end up with

- A private, password-protected website only you can access, live at a URL
  like `https://your-app-name.vercel.app`
- A free Postgres database storing your research history forever
- A daily 7:00 AM Mountain Time "Morning Brief" that runs automatically
- Live stock prices and news (once you add API keys — see step 3)

Total cost: **$0/month** on free tiers, unless you later choose to add X
(Twitter) search, which requires a paid API plan.

---

## 1. Install the tools you need

**Node.js** (lets you run the project on your own computer first, to test it):
Go to [nodejs.org](https://nodejs.org), download the **LTS** version, and
install it with the default options. To check it worked, open a terminal
(on Windows: search for "PowerShell" in the Start menu) and run:

```
node -v
```

You should see something like `v20.x.x` or higher.

**Git** (lets you send this code to GitHub, which is how Vercel deploys it):
Go to [git-scm.com/downloads](https://git-scm.com/downloads) and install it
with the default options.

**A GitHub account**: sign up free at [github.com](https://github.com) if
you don't have one.

**A Vercel account**: go to [vercel.com](https://vercel.com) and sign up —
choose **"Continue with GitHub"** so the two are connected automatically.

---

## 2. Get the code onto your computer and running locally

1. Unzip the project folder you were given somewhere easy to find, e.g.
   `Documents\market-reaction-lab`.
2. Open a terminal in that folder (on Windows: open the folder in File
   Explorer, click the address bar, type `powershell`, press Enter).
3. Install dependencies:
   ```
   npm install
   ```
4. Copy `.env.example` to a new file named `.env` in the same folder.
5. For now, leave the API key values in `.env` blank — the app runs on
   realistic placeholder ("mock") data until you add real ones. Just set:
   ```
   APP_ACCESS_PASSWORD="pick-something-only-you-know"
   SESSION_SECRET="any-long-random-string"
   ```
6. You'll need a Postgres database even to test locally. The easiest way if
   you don't already have Postgres installed: create a free one at
   [neon.tech](https://neon.tech) (sign up, "Create a project", copy the
   connection string it gives you) and paste it into `.env` as
   `DATABASE_URL`.
7. Push the database schema and run:
   ```
   npm run db:push
   npm run dev
   ```
8. Open [http://localhost:3000](http://localhost:3000), log in with the
   password you set, and click around. Try tracking a stock — everything
   works end-to-end on mock data.

If that all works, you're ready to deploy.

---

## 3. Get your API keys (all free, ~15 minutes)

Skip any of these and the app will simply show "Not available" for that
data source instead of guessing — nothing breaks.

### Finnhub — stock prices and ticker discovery (not news)
1. Go to [finnhub.io/register](https://finnhub.io/register), sign up, verify
   your email.
2. Your API key is shown on your dashboard homepage after logging in.
3. Copy it → this is `FINNHUB_API_KEY`.

This key powers live stock prices, plus the reference directory of company
names/tickers used to match news articles to the companies they're about
(see `src/lib/ingest/symbolDirectory.ts`). It is **not** used as a news
source — see TheNewsAPI below for that. Skipping it means no live prices
and much weaker discovery, since the app would have no reference list to
match untagged article text against.

### TheNewsAPI — general/mainstream news (what actually drives discovery)
1. Go to [thenewsapi.com/register](https://www.thenewsapi.com/register),
   sign up (no card required).
2. Your API token is shown on your account dashboard.
3. Copy it → this is `THENEWSAPI_KEY`.

This is the app's primary news source — deliberately general/mainstream
rather than financial-press, so a story shows up here because it's actually
in the news people read, not because a financial outlet wrote it up. The
free tier is thin (historically ~100 requests/day, 3 articles per request),
so the app is careful with it: each intraday poll costs exactly one
request, and the more thorough per-ticker pass for open positions only
runs once a day with the Morning Brief. See "Known V1 limitations" below.

### Marketaux — financial news, already tagged by company (optional, off by default)
Discovery runs on general/mainstream news now, not financial-press
aggregators — see TheNewsAPI above. Marketaux's provider code
(`src/lib/providers/news/marketaux.ts`) is still there and easy to re-enable
in `src/lib/providers/news/index.ts` if you ever want financial-press
coverage back alongside or instead of general news, but there's nothing to
set up here for the default configuration — leave `MARKETAUX_API_KEY` blank.

### Reddit — social attention
1. Log into Reddit, go to
   [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).
2. Click **"create another app..."** at the bottom.
3. Give it any name, choose the **"script"** type, and put
   `http://localhost` in the redirect URI field. Click **Create app**.
4. You'll see a string under the app's name (that's the **client ID**) and
   a **secret** field. Copy both → `REDDIT_CLIENT_ID` and
   `REDDIT_CLIENT_SECRET`.

### YouTube — video attention
1. Go to [console.cloud.google.com](https://console.cloud.google.com),
   sign in, create a new project (any name).
2. In the search bar at the top, type **"YouTube Data API v3"**, click it,
   click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → API key**.
4. Copy it → this is `YOUTUBE_API_KEY`.

### Claude (Anthropic) API — optional, paid usage, powers "mainstream reach" scoring
This is what lets the app catch a story about an executive or public figure
even when their company isn't named in the article text, and gives each
new story a descriptive 0–100 "how likely is a non-financial-news reader
to have heard about this" read (never a judgment about whether the stock's
reaction makes sense — see `src/lib/llm/storyAnalysis.ts` and
`SPEC-NOTES.md`).
1. Go to [console.anthropic.com](https://console.anthropic.com) and sign
   up. **This is a separate account from claude.ai** — your claude.ai
   login doesn't carry over, and this one requires billing info (a card on
   file), since usage is metered pay-as-you-go rather than a flat
   subscription.
2. Go to **API Keys**, click **Create Key**, copy it → this is
   `ANTHROPIC_API_KEY`.
3. Leave `ANTHROPIC_MODEL` blank to use the current default (a cheap/fast
   model — see `DEFAULT_MODEL` in `src/lib/llm/storyAnalysis.ts`).

Cost is small for personal use — each new story is one short request with
no live web search involved (it reads off the headline/summary text
already collected), so a realistic estimate is roughly **$1–10/month**
depending on how many new stories the app discovers, and you can check
actual usage any time on the Anthropic console's usage page. Leave this
key blank to skip the feature entirely — discovery still works via
keyword/name matching alone, just without the reach score or the
executive/public-figure name resolution.

### GDELT — optional, free, off by default
[GDELT](https://www.gdeltproject.org) is a free, keyless, publicly-funded
global news-coverage database. The app can use it as an extra signal for
"how much the wider world is covering this," counting global mentions and
distinct outlets — nothing else. There's nothing to sign up for; just set
`ENABLE_GDELT="true"` to turn it on.

It's off by default because it's a research/academic resource, not a
commercial SLA'd API, and is more prone to rate limiting or the occasional
malformed response than everything else this app talks to (handled
defensively either way — see `src/lib/providers/social/gdelt.ts`). It also
only runs once a day with the Morning Brief's more thorough pass, never
during intraday polling, to keep well clear of that risk. **Note:** GDELT
does publish a "tone" (sentiment) field alongside its coverage counts —
this app deliberately never requests or uses it, in keeping with this
project's core rule that nothing here characterizes a reaction as
justified or not (see "What this app will never do" in `SPEC-NOTES.md`).

### X (Twitter) — optional, paid
X's API now requires a paid developer plan (Basic tier, ~$200/month) to
search posts. This app has a slot ready for it (`X_BEARER_TOKEN`), but it's
left as "Not available" unless you decide that's worth it to you.

### TikTok / Instagram
Neither offers a practical self-serve public-search API for a personal
project like this today. These stay "Not available" — the app is built so
they can be added later if that changes, without any redesign.

---

## 4. Put the code on GitHub

1. On [github.com](https://github.com), click **New repository**. Name it
   `market-reaction-lab`, keep it **Private**, and click **Create**.
2. Back in your terminal, in the project folder, run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/market-reaction-lab.git
   git push -u origin main
   ```
   (Replace `YOUR-USERNAME` with your actual GitHub username — GitHub shows
   you this exact command on the new repo's page too.)

If you'd rather not use the command line for this part, install
[GitHub Desktop](https://desktop.github.com) instead — it lets you do the
same thing by clicking "Publish repository."

---

## 5. Deploy on Vercel

1. On [vercel.com](https://vercel.com), click **Add New → Project**.
2. Select your `market-reaction-lab` GitHub repo and click **Import**.
   Vercel will detect it's a Next.js app automatically.
3. Before clicking Deploy, open **Environment Variables** and add these
   (values from steps 2–3 above):

   | Name | Value |
   |---|---|
   | `APP_ACCESS_PASSWORD` | the password you want to log in with |
   | `SESSION_SECRET` | any long random string |
   | `CRON_SECRET` | any long random string (protects your cron endpoints) |
   | `FINNHUB_API_KEY` | (optional — prices + discovery directory) |
   | `THENEWSAPI_KEY` | (optional — general news; discovery is much weaker without it) |
   | `MARKETAUX_API_KEY` | (optional, off by default — see step 3) |
   | `REDDIT_CLIENT_ID` | (optional) |
   | `REDDIT_CLIENT_SECRET` | (optional) |
   | `REDDIT_USER_AGENT` | `market-reaction-lab/0.1 by yourredditusername` |
   | `YOUTUBE_API_KEY` | (optional) |
   | `ANTHROPIC_API_KEY` | (optional — powers "mainstream reach" scoring; separate account from claude.ai) |
   | `ANTHROPIC_MODEL` | (optional — leave unset for the default model) |
   | `ENABLE_GDELT` | (optional — set to `true` to turn on the free GDELT signal) |

   Leave `DATABASE_URL` out for now — the next step adds it automatically.
4. Click **Deploy**. It'll fail on the first try because there's no database
   yet — that's expected, continue to step 6.

## 6. Add a free database (one click)

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database**, choose **Neon** (Postgres, free tier), and
   follow the prompts to connect it to your project. Vercel automatically
   adds `DATABASE_URL` to your environment variables — you don't need to
   copy anything yourself.
3. Go to the **Deployments** tab and click **Redeploy** on the latest one.
   It should succeed this time.
4. Open the URL Vercel gives you (something like
   `market-reaction-lab.vercel.app`) and log in with your password.

The database *tables* aren't created automatically — run this one command
once, from your own computer, to set them up in your new production
database:

```
# temporarily point your local .env's DATABASE_URL at the same value
# Vercel is using (copy it from Vercel's Storage tab → .env.local tab),
# then run:
npm run db:push
```

Tag defaults and other setup happen automatically the first time you use
each feature — there's no separate "seed" step required.

---

## 7. Turn on intraday monitoring

Vercel's free plan only runs scheduled jobs once a day, which is used for
the 7:00 AM Morning Brief (already configured in `vercel.json`). For
monitoring throughout the trading day — price checks, alerts, fresh
attention numbers — use a free external scheduler to "ping" the app every
few minutes:

1. Go to [cron-job.org](https://cron-job.org) and create a free account.
2. Create a new cron job:
   - URL: `https://your-app-name.vercel.app/api/cron/poll?secret=YOUR_CRON_SECRET`
     (use the same value you set for `CRON_SECRET` in Vercel)
   - Schedule: every 10–15 minutes
3. Save it. The endpoint itself checks whether it's a trading day and does
   nothing on weekends/holidays, so it's safe to leave running all the time.

**On TheNewsAPI's free-tier quota:** every 10–15 minutes across a 6.5-hour
trading day is roughly 26–39 pings, and each intraday ping costs exactly
one TheNewsAPI request (the app deliberately skips the more expensive
per-ticker pass during intraday polling — see the comment on
`ingestDiscoveryCycle` in `src/lib/ingest/news.ts`), plus a handful more
from the once-daily Morning Brief. That comfortably fits inside a
~100/day free-tier budget. If you ever see "TheNewsAPI daily request quota
reached" in your ingestion logs, either widen the polling interval (e.g.
every 20 minutes) or upgrade that account's plan.

---

## 8. Using it day to day

- Open your Vercel URL and log in with your password any time.
- **Morning Brief** shows what's been collected; **Active** is your open
  positions; **History** is your permanent research journal; **Research**
  summarizes the whole dataset once you have enough closed positions.
- To get future code updates onto your live site: replace the changed files
  in your local project folder, then run `git add . && git commit -m "update" && git push`
  — Vercel redeploys automatically within a minute or two.

---

## Known V1 limitations

Documented honestly rather than hidden:

- **Discovery is news-first, not a fixed ticker list**: every cycle scans
  broad, general/mainstream news (TheNewsAPI, not a financial-press
  aggregator — see step 3 above) and figures out which companies it
  mentions, rather than starting from a pre-chosen set of tickers. That
  source doesn't tag companies itself, so every article gets matched
  against a cached ticker/name directory (`src/lib/companyMatch.ts`,
  `src/lib/ingest/symbolDirectory.ts`) built from Finnhub's symbol list —
  which means that directory, and therefore discovery coverage overall,
  needs `FINNHUB_API_KEY` set even though Finnhub isn't a news source here.
  Anything with an open position (or added to `SUPPLEMENTAL_TICKERS` in
  `src/lib/ingest/watchlist.ts`) is guaranteed a price/attention snapshot
  every cycle even on a day with zero news about it — that list is a
  monitoring floor, not what drives discovery. The name-matching heuristic
  trades some precision for recall (see `src/lib/companyMatch.ts` for the
  cashtag/exchange/name-matching rules and its small stoplist of
  generic-word company names); it will occasionally miss an obscure company
  or, rarely, mis-tag one. Without `ANTHROPIC_API_KEY` set, it also only
  catches a person or brand when their associated public company is
  actually named in the text — a story about a CEO or celebrity that never
  mentions their company by name won't surface a ticker. With that key
  set, see the next bullet.
- **"Mainstream reach" scoring (`ANTHROPIC_API_KEY`)** runs once per
  newly-discovered story, off the headline/summary text only — it does
  **not** use live web search, so its 0–100 read reflects how the article
  itself reads, not a verified check of what's actually trending right
  now. It's also only as good as whatever people/company names it
  extracts; those names are always re-checked against the real Finnhub
  symbol directory before becoming a ticker (never trusted directly, to
  avoid the model guessing a wrong or made-up ticker), so a name that
  doesn't match anything in that directory closely enough simply won't
  surface a ticker, same as today. And to repeat the project's core
  design rule: this score is a descriptive "how likely is a
  non-financial-news reader to have heard about this" estimate — it is
  never a judgment about whether a stock's reaction is an overreaction or
  makes sense. Only your own thesis field, and the purely descriptive
  historical stats on the Research page, speak to that.
- **GDELT (`ENABLE_GDELT`)** is a free academic resource, not a commercial
  API — no uptime guarantee, and more prone to rate limiting or an
  occasional malformed response than everything else here (handled
  defensively). It only runs once a day with the Morning Brief, and its
  counts are a rough proxy for global coverage volume, not a precise
  measurement — treat them the same way as the app's other "estimate"
  labeled figures.
- **TheNewsAPI's free tier is thin** (historically ~100 requests/day, 3
  articles per request), so any single cycle's view of "what's in the
  news" is a shallow sample, not a firehose. Coverage builds up over the
  day through repeated polling (see "Turn on intraday monitoring" above)
  rather than any one call being comprehensive. If you outgrow this,
  swapping in a higher-volume provider is a matter of adding one file
  implementing the `NewsProvider` interface (see
  `src/lib/providers/news/thenewsapi.ts` as a template) and wiring it into
  `src/lib/providers/news/index.ts` — no other code needs to change.
- **Event clustering** groups near-identical headlines across tickers as
  one story using text similarity, not true NLP entity resolution — see
  `src/lib/ingest/news.ts` and `src/lib/dedupe.ts`.
- **Volume data** isn't available from Finnhub's free quote endpoint, so
  volume/relative-volume show "Not available" until a candle-data
  integration is added.
- **X, TikTok, Instagram** have no configured real provider yet (see
  `src/lib/providers/social/unavailable.ts`) — they'll show "Not available"
  until you wire one in.
- **Morning Brief cron time** is fixed at 13:00 UTC (7:00 AM Mountain
  during daylight time, 6:00 AM during standard time in winter) because
  Vercel Cron doesn't adjust for daylight saving automatically. Edit the
  schedule in `vercel.json` around early November / mid-March if you want
  it exact year-round.
- **Reddit/Marketaux free tiers** are rate-limited; if you track a lot of
  tickers, some cycles may show fewer results than actually exist —
  the app labels these as estimates where it knows to.
