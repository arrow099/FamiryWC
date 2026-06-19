import { NextResponse } from "next/server";
import { readLatestAppState } from "@/lib/app-data/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readLatestAppState();
  return NextResponse.json(state, {
    headers: {
      "cache-control": "s-maxage=30, stale-while-revalidate=60",
    },
  });
}
