import { NextRequest, NextResponse } from "next/server";
import { getMarketDataProvider } from "@/lib/providers/market";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ matches: [] });

  const provider = getMarketDataProvider();
  const result = await provider.searchTicker(q);
  if (!result.available) {
    return NextResponse.json({ matches: [], notice: result.reason });
  }
  return NextResponse.json({ matches: result.value });
}
