import { db } from "./db";
import { positions, companies, tags as tagsTable, positionTags, newsEvents } from "./db/schema";
import { eq, desc } from "drizzle-orm";
import { getMarketDataProvider } from "./providers/market";

export async function listPositionsWithDetail(status: "ACTIVE" | "CLOSED") {
  const rows = await db
    .select({ position: positions, company: companies, newsEvent: newsEvents })
    .from(positions)
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .leftJoin(newsEvents, eq(positions.newsEventId, newsEvents.id))
    .where(eq(positions.status, status))
    .orderBy(desc(positions.createdAt));

  const results = [];
  for (const row of rows) {
    const tagRows = await db
      .select({ name: tagsTable.name })
      .from(positionTags)
      .innerJoin(tagsTable, eq(positionTags.tagId, tagsTable.id))
      .where(eq(positionTags.positionId, row.position.id));

    let liveQuote = null;
    if (status === "ACTIVE") {
      const provider = getMarketDataProvider();
      const result = await provider.getQuote(row.company.ticker);
      if (result.available) liveQuote = result.value;
    }

    results.push({ ...row, tags: tagRows.map((t) => t.name), liveQuote });
  }
  return results;
}
