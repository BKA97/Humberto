import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts, positions, companies } from "@/lib/db/schema";
import { eq, isNull, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({ alert: alerts, company: companies })
    .from(alerts)
    .innerJoin(positions, eq(alerts.positionId, positions.id))
    .innerJoin(companies, eq(positions.companyId, companies.id))
    .where(isNull(alerts.readAt))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
  return NextResponse.json({ alerts: rows });
}

export async function PATCH(request: NextRequest) {
  const { id } = await request.json();
  await db.update(alerts).set({ readAt: new Date() }).where(eq(alerts.id, id));
  return NextResponse.json({ ok: true });
}
