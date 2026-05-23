import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { createWeekendPlan } from "@/lib/server/weekendPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  let input: unknown = {};

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const plan = await createWeekendPlan(input, auth.user.userId);

  return NextResponse.json(plan, { status: 201 });
}
