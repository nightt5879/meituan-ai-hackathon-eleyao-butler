import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "meituan-mini-program-api",
    checkedAt: new Date().toISOString()
  });
}
