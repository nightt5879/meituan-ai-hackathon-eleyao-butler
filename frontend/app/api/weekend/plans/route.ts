import { NextResponse } from "next/server";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult,
  submitOpenClawDataFeed
} from "@/lib/server/openclawDataFeed";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { ensureUserProfile } from "@/lib/server/userProfileStore";
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
  const inputRecord = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const shouldFeedOpenClaw = inputRecord.openclawFeed !== false && process.env.OPENCLAW_WEEKEND_FEED_ENABLED !== "0";
  const profile = await ensureUserProfile(auth.user.userId);
  const openclawContext = createOpenClawDataContext("weekend_plan", {
    userId: auth.user.userId,
    profile,
    contextBlocks: ["user_profile", "weekend_request", "weather_context", "route_candidates", "planner_source"],
    payload: {
      request: plan.request,
      weather: plan.weather,
      routes: plan.routes,
      source: plan.source
    }
  });
  const openclawContextResult = shouldFeedOpenClaw
    ? await submitOpenClawDataFeed(openclawContext)
    : createOpenClawDataFeedResult(openclawContext, "skipped", {
        detail: "OpenClaw weekend context feed skipped by request or deployment config."
      });

  if (!shouldFeedOpenClaw) {
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
  }

  return NextResponse.json(
    {
      ...plan,
      openclawContext: openclawContextResult
    },
    { status: 201 }
  );
}
