import { NextResponse } from "next/server";
import { refreshLiveData } from "@/lib/app-data/refreshLiveData";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "CRON_SECRET is required." }, { status: 503 });
  }

  if (expectedSecret && request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await refreshLiveData();
  return NextResponse.json({
    capturedAt: state.capturedAt,
    matches: state.matches.length,
    stale: state.sources.matches.stale,
    message: state.sources.matches.message,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
