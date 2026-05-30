import { NextResponse } from "next/server";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult,
  submitOpenClawDataFeed,
  type OpenClawDataFeedResult
} from "@/lib/server/openclawDataFeed";
import {
  advanceAiProgress,
  completeAiProgress,
  normalizeAiProgressTraceId,
  startAiProgress
} from "@/lib/server/aiProgress";
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

  const inputRecord = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const aiProgress = await startAiProgress("weekend_plan", {
    traceId: normalizeAiProgressTraceId(inputRecord.aiProgressTraceId),
    userId: auth.user.userId,
    message: "正在理解出行时间、预算、体力和兴趣。"
  });
  await advanceAiProgress(aiProgress.traceId, "retrieve", {
    message: "正在准备天气、地点候选和路线素材。"
  });
  const plan = await createWeekendPlan(input, auth.user.userId);
  const shouldFeedOpenClaw = inputRecord.openclawFeed !== false && process.env.OPENCLAW_WEEKEND_FEED_ENABLED !== "0";
  await advanceAiProgress(aiProgress.traceId, "filter", {
    message: "正在检查天气、步行、预算和返程风险。"
  });
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
  await advanceAiProgress(aiProgress.traceId, "rank", {
    message: "正在对路线候选做优先级排序。"
  });
  await advanceAiProgress(aiProgress.traceId, "compose", {
    message: shouldFeedOpenClaw ? "正在把周边规划上下文同步给 OpenClaw。" : "正在整理周边规划结果。",
    note: shouldFeedOpenClaw ? "OpenClaw 用于接收本次轻量上下文，页面结果由服务端规划器返回。" : undefined
  });
  const openclawContextResult = shouldFeedOpenClaw
    ? await submitOpenClawDataFeed(openclawContext)
    : createOpenClawDataFeedResult(openclawContext, "skipped", {
        detail: "OpenClaw weekend context feed skipped by request or deployment config."
      });

  if (!shouldFeedOpenClaw) {
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
  }
  const finalProgress = await completeAiProgress(
    aiProgress.traceId,
    openclawContextResult.status === "failed" ? "fallback" : "done",
    {
      message: openclawContextResult.status === "failed"
        ? "周边规划已用本地规划器完成，OpenClaw 上下文同步失败。"
        : "周边规划已生成，AI 上下文同步流程已结束。",
      note: openclawContextResult.detail
    }
  );

  return NextResponse.json(
    {
      ...plan,
      openclawContext: openclawContextResult,
      aiStatus: createWeekendAiStatus(openclawContextResult),
      aiProgress: finalProgress || aiProgress
    },
    { status: 201 }
  );
}
