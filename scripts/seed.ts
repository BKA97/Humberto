// One-time setup: tag taxonomy, default alert thresholds, and the Research
// Day 1 marker (spec §24 — never backfilled, set once and left alone).
// Safe to re-run: everything here is idempotent.
import "dotenv/config";
import { db } from "../src/lib/db";
import { tags, alertThresholds, systemConfig } from "../src/lib/db/schema";
import { INITIAL_TAGS } from "../src/lib/tags";
import { eq } from "drizzle-orm";

async function main() {
  for (const name of INITIAL_TAGS) {
    const existing = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
    if (existing.length === 0) {
      await db.insert(tags).values({ name, isCustom: false });
      console.log(`+ tag: ${name}`);
    }
  }

  const existingThresholds = await db.select().from(alertThresholds).limit(1);
  if (existingThresholds.length === 0) {
    await db.insert(alertThresholds).values({});
    console.log("+ default alert thresholds");
  }

  const existingDayOne = await db.select().from(systemConfig).where(eq(systemConfig.key, "research_day_one")).limit(1);
  if (existingDayOne.length === 0) {
    const now = new Date().toISOString();
    await db.insert(systemConfig).values({ key: "research_day_one", value: now });
    console.log(`+ Research Day 1: ${now}`);
  } else {
    console.log(`Research Day 1 already set: ${existingDayOne[0].value}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
