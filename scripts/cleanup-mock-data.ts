// Temporary cleanup — removes leftover synthetic data that was ingested
// while THENEWSAPI_KEY was missing in production and the app was silently
// running on MockNewsProvider (see src/lib/providers/news/mock.ts). Mock
// articles are identifiable with certainty because MockNewsProvider always
// generates URLs of the form https://example.com/mock/<ticker>-<i>-<j> —
// no real provider ever produces that URL shape.
//
// Also removes one specific confirmed bad ticker match: a real (non-mock)
// Dubai Financial Market disclosure story got tagged as POST (Post
// Holdings) purely because "Post Holdings" strips down to the generic word
// "post" during company-name matching (see companyMatch.ts — "post" has
// since been added to GENERIC_NAME_STOPLIST so this can't recur). The
// article/event itself is real, so this only removes the incorrect
// company tag, not the event or article.
//
// SAFE BY DEFAULT: prints exactly what it found and would change, but
// writes nothing unless you pass --confirm. Run with:
//   npx tsx scripts/cleanup-mock-data.ts            (dry run)
//   npx tsx scripts/cleanup-mock-data.ts --confirm   (actually deletes)
// Delete this file afterward — not part of the app.
import "dotenv/config";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  newsEvents,
  articles as articlesTable,
  newsEventCompanies,
  positions,
  marketSnapshots,
  attentionSnapshots,
  companies,
} from "../src/lib/db/schema";

const CONFIRM = process.argv.includes("--confirm");
const MOCK_URL_PREFIX = "https://example.com/mock/";
const KNOWN_BAD_POST_URL = "https://www.dfm.ae/the-exchange/news-disclosures/disclosures/dc998910-b61d-48b3-bea2-fcbafc6c4f57";

async function main() {
  console.log(CONFIRM ? "Running with --confirm: changes WILL be written.\n" : "DRY RUN — no changes will be written. Re-run with --confirm to apply.\n");

  // --- Part 1: mock-only events (every article under the event is a mock URL) ---
  const allArticles = await db.select().from(articlesTable);
  const articlesByEvent = new Map<string, typeof allArticles>();
  for (const a of allArticles) {
    if (!articlesByEvent.has(a.newsEventId)) articlesByEvent.set(a.newsEventId, []);
    articlesByEvent.get(a.newsEventId)!.push(a);
  }

  const mockOnlyEventIds: string[] = [];
  for (const [eventId, arts] of articlesByEvent) {
    if (arts.length > 0 && arts.every((a) => a.url.startsWith(MOCK_URL_PREFIX))) {
      mockOnlyEventIds.push(eventId);
    }
  }

  console.log(`Found ${mockOnlyEventIds.length} mock-only news event(s) (all their articles are synthetic example.com/mock/... URLs).`);
  if (mockOnlyEventIds.length > 0) {
    const sample = await db.select().from(newsEvents).where(inArray(newsEvents.id, mockOnlyEventIds.slice(0, 10)));
    for (const e of sample) console.log(`  - [${e.id}] "${e.headline}"`);
    if (mockOnlyEventIds.length > 10) console.log(`  ...and ${mockOnlyEventIds.length - 10} more`);
  }

  const affectedPositions = mockOnlyEventIds.length
    ? await db.select().from(positions).where(inArray(positions.newsEventId, mockOnlyEventIds))
    : [];
  if (affectedPositions.length > 0) {
    console.log(`\n${affectedPositions.length} tracked position(s) reference a mock event — these will be KEPT, just detached (newsEventId set to null), not deleted:`);
    for (const p of affectedPositions) console.log(`  - position ${p.id} (company ${p.companyId})`);
  }

  // --- Part 2: the known bad POST tag on a real (non-mock) event ---
  const badArticle = await db.select().from(articlesTable).where(eq(articlesTable.url, KNOWN_BAD_POST_URL));
  let badLink: { newsEventId: string; companyId: string } | null = null;
  if (badArticle.length > 0) {
    const [postCompany] = await db.select().from(companies).where(eq(companies.ticker, "POST"));
    if (postCompany) {
      const [link] = await db
        .select()
        .from(newsEventCompanies)
        .where(and(eq(newsEventCompanies.newsEventId, badArticle[0].newsEventId), eq(newsEventCompanies.companyId, postCompany.id)));
      if (link) {
        badLink = { newsEventId: badArticle[0].newsEventId, companyId: postCompany.id };
        console.log(`\nFound the known bad POST tag on event [${badArticle[0].newsEventId}] (article: ${KNOWN_BAD_POST_URL}).`);
        console.log("  Will remove only the POST company tag — the article/event itself is real and stays.");
      }
    }
  } else {
    console.log("\n(Known bad POST/dfm.ae article not found — may already be cleaned up, or this is a different database.)");
  }

  if (!CONFIRM) {
    console.log("\nNo changes written (dry run). Re-run with --confirm to apply the above.");
    process.exit(0);
  }

  if (mockOnlyEventIds.length > 0) {
    await db.update(positions).set({ newsEventId: null }).where(inArray(positions.newsEventId, mockOnlyEventIds));
    await db.update(marketSnapshots).set({ newsEventId: null }).where(inArray(marketSnapshots.newsEventId, mockOnlyEventIds));
    await db.update(attentionSnapshots).set({ newsEventId: null }).where(inArray(attentionSnapshots.newsEventId, mockOnlyEventIds));
    await db.delete(newsEventCompanies).where(inArray(newsEventCompanies.newsEventId, mockOnlyEventIds));
    await db.delete(articlesTable).where(inArray(articlesTable.newsEventId, mockOnlyEventIds));
    await db.delete(newsEvents).where(inArray(newsEvents.id, mockOnlyEventIds));
    console.log(`\nDeleted ${mockOnlyEventIds.length} mock-only event(s) and their articles/company tags.`);
  }

  if (badLink) {
    await db
      .delete(newsEventCompanies)
      .where(and(eq(newsEventCompanies.newsEventId, badLink.newsEventId), eq(newsEventCompanies.companyId, badLink.companyId)));
    console.log("Removed the incorrect POST tag from the real dfm.ae event.");
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
