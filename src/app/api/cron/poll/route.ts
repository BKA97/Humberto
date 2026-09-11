import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { ingestDiscoveryCycle } from "@/lib/ingest/news";
import { checkAndCreateAlerts } from "@/lib/alerts";
import { db } from "@/lib/db";
import { ingestionLogs } from "@/lib/db/schema";
import { isTradingDay } from "@/lib/marketCalendar";

export const maxDuration = 120;

/**
 * Intraday monitoring (spec §25-26, §39). Vercel Hobby's native cron is
 * daily-only, so this is meant to be hit every few minutes by an external
 * scheduler (see README — cron-job.org's free tier works well) rather than
 * Vercel Cron itself. Skips work entirely outside trading days.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTradingDay(new Date())) {
    return NextResponse.json({ ok: true, skipped: "not a trading day" });
  }

  try {
    const result = await ingestDiscoveryCycle({ sinceHours: 6 });
    const alerts = await checkAndCreateAlerts();
    await db.insert(ingestionLogs).values({
      source: "cron",
      operation: "poll",
      status: "success",
      detail: JSON.stringify({ ...result, alertsCreated: alerts.length }),
    });
    return NextResponse.json({ ok: true, result, alertsCreated: alerts.length });
  } catch (err) {
    await db.insert(ingestionLogs).values({
      source: "cron",
      operation: "poll",
      status: "failure",
      detail: (err as Error).message,
    });
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
