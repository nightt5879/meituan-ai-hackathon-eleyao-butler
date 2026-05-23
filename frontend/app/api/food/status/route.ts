import { NextResponse } from "next/server";
import { checkFoodOpenClawStatus } from "@/lib/server/openclawFoodStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkFoodOpenClawStatus();
  return NextResponse.json(status);
}
