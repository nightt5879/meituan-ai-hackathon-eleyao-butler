import { NextResponse } from "next/server";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult,
  submitOpenClawDataFeed,
  type OpenClawDataFeedResult
} from "@/lib/server/openclawDataFeed";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { ensureUserProfile } from "@/lib/server/userProfileStore";
import { createWeekendPlan } from "@/lib/server/weekendPlanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createWeekendAiStatus(openclawContext: OpenClawDataFeedResult) {
  const submitted = openclawContext.status === "submitted";
  const skipped = openclawContext.status === "skipped";

  return {
    resultGeneratedBy: "rules",
    resultIsAiGenerated: false,
    openclawStatus: openclawContext.status,
    openclawSubmitted: submitted,
    traceId: openclawContext.traceId,
    durationMs: openclawContext.durationMs,
    label: submitted
      ? "规则规划完成，OpenClaw 已接收上下文"
      : skipped
        ? "规则规划完成，OpenClaw 未启用"
        : "规则规划完成，OpenClaw 提交失败",
    detail: submitted
      ? "本次路线由后端规则规划器生成；OpenClaw 接收了用户画像、天气和候选路线上下文，不是 OpenClaw 直接生成路线。"
      : skipped
        ? "本次路线由后端规则规划器生成；部署配置或请求参数跳过了 OpenClaw 上下文投喂。"
        : `本次路线由后端规则规划器生成；OpenClaw 上下文投喂失败，结果不是 OpenClaw 直接返回。${openclawContext.detail ? ` ${openclawContext.detail}` : ""}`
  };
}

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
      openclawContext: openclawContextResult,
      aiStatus: createWeekendAiStatus(openclawContextResult)
    },
    { status: 201 }
  );
}
