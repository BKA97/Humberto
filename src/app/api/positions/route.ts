import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { positions, tags as tagsTable, positionTags } from "@/lib/db/schema";
import { listPositionsWithDetail } from "@/lib/positions";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") === "CLOSED" ? "CLOSED" : "ACTIVE";
  const data = await listPositionsWithDetail(status);
  return NextResponse.json({ positions: data });
}

const CreatePositionSchema = z.object({
  companyId: z.string(),
  newsEventId: z.string().nullable().optional(),
  entryPrice: z.number(),
  entryTimestamp: z.string(),
  entrySession: z.enum(["PREVIOUS_CLOSE", "PRE_MARKET", "OPEN", "INTRADAY", "CLOSE", "AFTER_HOURS"]),
  entryBenchmarkLevel: z.number().nullable().optional(),
  originalReactionSnapshotIds: z.array(z.string()).optional(),
  originalAttentionSnapshotIds: z.array(z.string()).optional(),
  thesis: z.string().min(1, "Thesis is required."),
  reasonNote: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreatePositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const [position] = await db
    .insert(positions)
    .values({
      companyId: data.companyId,
      newsEventId: data.newsEventId ?? null,
      entryPrice: data.entryPrice,
      entryTimestamp: new Date(data.entryTimestamp),
      entrySession: data.entrySession,
      entryBenchmarkLevel: data.entryBenchmarkLevel ?? null,
      originalReactionSnapshotIds: data.originalReactionSnapshotIds ?? [],
      originalAttentionSnapshotIds: data.originalAttentionSnapshotIds ?? [],
      thesis: data.thesis,
      reasonNote: data.reasonNote ?? null,
    })
    .returning();

  for (const tagName of data.tags) {
    let [tagRow] = await db.select().from(tagsTable).where(eq(tagsTable.name, tagName));
    if (!tagRow) {
      [tagRow] = await db.insert(tagsTable).values({ name: tagName, isCustom: true }).returning();
    }
    await db.insert(positionTags).values({ positionId: position.id, tagId: tagRow.id }).onConflictDoNothing();
  }

  return NextResponse.json({ position }, { status: 201 });
}
