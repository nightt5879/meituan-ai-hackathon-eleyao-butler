import { NextResponse } from "next/server";
import { getWeekendPlan } from "@/lib/server/weekendPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { planId } = await params;
  const plan = await getWeekendPlan(planId);

  if (!plan) {
    return NextResponse.json(
      {
        error: {
          code: "WEEKEND_PLAN_NOT_FOUND",
          message: "Weekend plan not found."
        }
      },
      { status: 404 }
    );
  }

  return NextResponse.json(plan);
}
