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

### Finnhub — stock prices, general market news, and ticker discovery
1. Go to [finnhub.io/register](https://finnhub.io/register), sign up, verify
   your email.
2. Your API key is shown on your dashboard homepage after logging in.
3. Copy it → this is `FINNHUB_API_KEY`.

This one key does three things: stock prices, a general (untagged) news
feed, and — because the app discovers tickers from the news rather than
starting from a fixed list — the reference directory of company names it
matches those untagged articles against. Skipping it means no live prices
and much narrower discovery (only whatever Marketaux tags natively).

### Marketaux — financial news, already tagged by company
1. Go to [marketaux.com](https://www.marketaux.com), sign up.
2. Find your API token on your account/dashboard page.
3. Copy it → this is `MARKETAUX_API_KEY`.

Marketaux identifies which companies an article is about itself, so it's
the more reliable of the two discovery sources — worth having even if you
also set up Finnhub.

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
   | `FINNHUB_API_KEY` | (optional) |
   | `MARKETAUX_API_KEY` | (optional) |
   | `REDDIT_CLIENT_ID` | (optional) |
   | `REDDIT_CLIENT_SECRET` | (optional) |
   | `REDDIT_USER_AGENT` | `market-reaction-lab/0.1 by yourredditusername` |
   | `YOUTUBE_API_KEY` | (optional) |

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
  broad, general market news and figures out which companies it mentions —
  it doesn't start from a pre-chosen set of tickers. Marketaux tags
  companies itself; Finnhub's general feed doesn't, so untagged articles are
  matched against a cached ticker/name directory
  (`src/lib/companyMatch.ts`, `src/lib/ingest/symbolDirectory.ts`) built
  from Finnhub's symbol list — which means that directory, and therefore
  full discovery coverage, needs `FINNHUB_API_KEY` set. Without it, you
  still get whatever Marketaux natively tags (if `MARKETAUX_API_KEY` is
  set) plus continuous coverage of anything you're actively tracking, just
  with less reach into untagged general-news mentions. Anything with an
  open position (or added to `SUPPLEMENTAL_TICKERS` in
  `src/lib/ingest/watchlist.ts`) is guaranteed a price/attention snapshot
  every cycle even on a day with zero news about it — that list is a
  monitoring floor, not what drives discovery. The name-matching heuristic
  trades some precision for recall (see `src/lib/companyMatch.ts` for the
  cashtag/exchange/name-matching rules and its small stoplist of
  generic-word company names); it will occasionally miss an obscure company
  or, rarely, mis-tag one.
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
