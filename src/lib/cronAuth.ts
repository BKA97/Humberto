import { NextRequest } from "next/server";

/**
 * Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when
 * invoking a scheduled function, if a `CRON_SECRET` env var is set. An
 * external pinger (e.g. cron-job.org, used for intraday polling since
 * Vercel Hobby cron only supports daily schedules) can be configured to
 * send the same header, or pass ?secret=... instead.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // dev convenience only
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const queryToken = request.nextUrl.searchParams.get("secret");
  return queryToken === secret;
}
