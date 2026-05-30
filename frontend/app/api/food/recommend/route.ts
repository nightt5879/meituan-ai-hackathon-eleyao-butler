import { NextResponse } from "next/server";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult,
  submitOpenClawDataFeed
} from "@/lib/server/openclawDataFeed";
import {
  advanceAiProgress,
  completeAiProgress,
  normalizeAiProgressTraceId,
  startAiProgress
} from "@/lib/server/aiProgress";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import {
  generateFoodRecommendationsWithOpenClaw,
  sanitizeFoodRecommendRequest
} from "@/lib/server/openclawFoodRecommendation";
import { ensureUserProfile } from "@/lib/server/userProfileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const sanitizedRequest = sanitizeFoodRecommendRequest(body);
  const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const aiProgress = await startAiProgress("food_recommendation", {
    traceId: normalizeAiProgressTraceId(bodyRecord.aiProgressTraceId),
    userId: auth.user.userId,
    message: "正在理解你的场景、预算、距离和忌口。"
  });
  await advanceAiProgress(aiProgress.traceId, "retrieve", {
    message: "正在准备候选店铺、账号画像和本次偏好上下文。"
  });
  const profile = await ensureUserProfile(auth.user.userId);
  const openclawContext = createOpenClawDataContext("food_recommendation", {
    userId: auth.user.userId,
    profile,
    contextBlocks: ["user_profile", "food_preferences", "food_decision_sheet", "current_food_request"],
    payload: {
      request: sanitizedRequest
    }
  });
  await advanceAiProgress(aiProgress.traceId, "filter", {
    message: "正在按预算、距离、忌口和临时偏好筛选。"
  });

  if (bodyRecord.openclawFeedOnly === true) {
    await advanceAiProgress(aiProgress.traceId, "compose", {
      message: "正在把本次偏好上下文提交给 OpenClaw。",
      note: "这次只验证上下文传递，不生成最终推荐。"
    });
    const openclawContextResult = await submitOpenClawDataFeed(openclawContext);
    const finalProgress = await completeAiProgress(
      aiProgress.traceId,
      openclawContextResult.submitted ? "done" : "error",
      {
        message: openclawContextResult.submitted ? "OpenClaw 已接收本次偏好上下文。" : "OpenClaw 上下文提交失败。",
        note: openclawContextResult.detail
      }
    );

    return NextResponse.json({
      ok: openclawContextResult.submitted,
      source: "openclaw-feed",
      diagnostics: {
        durationMs: Date.now() - startedAt,
        openclawContext: openclawContextResult,
        aiProgress: finalProgress || aiProgress
      }
    }, { status: openclawContextResult.submitted ? 200 : 502 });
  }

  try {
    await advanceAiProgress(aiProgress.traceId, "rank", {
      message: "正在把轻量上下文交给 OpenClaw 计算匹配排序。"
    });
    await advanceAiProgress(aiProgress.traceId, "compose", {
      message: "OpenClaw 正在生成推荐卡片和管家提醒。"
    });
    const result = await generateFoodRecommendationsWithOpenClaw(sanitizedRequest, {
      userId: auth.user.userId,
      context: openclawContext
    });
    const openclawContextResult = createOpenClawDataFeedResult(openclawContext, "submitted", {
      durationMs: Date.now() - startedAt,
      detail: "Context was included in the OpenClaw recommendation prompt."
    });
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
    const finalProgress = await completeAiProgress(aiProgress.traceId, "done", {
      message: "AI 管家已生成 2-3 个可执行推荐方案。",
      note: openclawContextResult.detail
    });

    return NextResponse.json({
      ...result,
      diagnostics: {
        durationMs: Date.now() - startedAt,
        openclawContext: openclawContextResult,
        aiProgress: finalProgress || aiProgress
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const openclawContextResult = createOpenClawDataFeedResult(openclawContext, "failed", {
      durationMs: Date.now() - startedAt,
      detail
    });
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
    const finalProgress = await completeAiProgress(aiProgress.traceId, "error", {
      message: "OpenClaw 生成中断，本次推荐没有完成。",
      note: detail
    });

    console.error("OpenClaw food recommendation failed", {
      durationMs: Date.now() - startedAt,
      detail
    });

    return NextResponse.json(
      {
        error: "OpenClaw recommendation failed.",
        detail,
        diagnostics: {
          durationMs: Date.now() - startedAt,
          openclawContext: openclawContextResult,
          aiProgress: finalProgress || aiProgress
        }
      },
      { status: 502 }
    );
  }
}
