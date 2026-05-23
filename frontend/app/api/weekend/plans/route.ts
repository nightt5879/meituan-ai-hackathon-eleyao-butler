import { NextResponse } from "next/server";
import { createWeekendPlan } from "@/lib/server/weekendPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: unknown = {};

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const plan = await createWeekendPlan(input);

  return NextResponse.json(plan, { status: 201 });
}
