import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "meituan-mini-program-api",
    build: {
      openclawFeedMode: "lightweight-context-v2",
      commit: process.env.MEITUAN_BUILD_SHA || process.env.GIT_COMMIT_SHA || ""
    },
    checkedAt: new Date().toISOString()
  });
}
