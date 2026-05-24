import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { getWeekendPlan } from "@/lib/server/weekendPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

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

  if (plan.ownerUserId !== auth.user.userId) {
    return NextResponse.json(
      {
        error: {
          code: "WEEKEND_PLAN_FORBIDDEN",
          message: "Weekend plan belongs to another user."
        }
      },
      { status: 403 }
    );
  }

  return NextResponse.json(plan);
}
