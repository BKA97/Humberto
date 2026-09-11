import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { ingestDiscoveryCycle } from "@/lib/ingest/news";
import { db } from "@/lib/db";
import { systemConfig, ingestionLogs } from "@/lib/db/schema";

export const maxDuration = 120;

/**
 * The 7:00 AM Mountain / 9:00 AM Eastern brief (spec §4). Data collection is
 * continuous (this same cycle also runs from /api/cron/poll) — this run's
 * only special role is guaranteeing one full pass has completed right at
 * brief time, and recording when that happened for the UI to display.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestDiscoveryCycle({ sinceHours: 20 });
    const now = new Date().toISOString();
    await db
      .insert(systemConfig)
      .values({ key: "last_morning_brief_at", value: now })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: now } });
    await db.insert(ingestionLogs).values({
      source: "cron",
      operation: "morning-brief",
      status: "success",
      detail: JSON.stringify(result),
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    await db.insert(ingestionLogs).values({
      source: "cron",
      operation: "morning-brief",
      status: "failure",
      detail: (err as Error).message,
    });
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
