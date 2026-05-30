import { NextResponse } from "next/server";
import { generateOpenClawRecommendation } from "@/lib/server/openclawRecommendation";
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
import { getGroupRecommendationSource, saveGroupRecommendation } from "@/lib/server/taskStore";
import { ensureUserProfile } from "@/lib/server/userProfileStore";
import type { RecommendationResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { taskId } = await params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const inputRecord = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const inviteToken = typeof inputRecord.inviteToken === "string" ? inputRecord.inviteToken : "";
  const source = await getGroupRecommendationSource(taskId, inviteToken);

  if (source.status !== 200) {
    return NextResponse.json({ error: source.error }, { status: source.status });
  }

  const shouldFeedOpenClaw = inputRecord.openclawFeed === true && process.env.OPENCLAW_DATA_FEED_ENABLED !== "0";
  const shouldUseOpenClaw = inputRecord.useOpenClaw === true && process.env.OPENCLAW_GROUP_RECOMMENDATION_ENABLED !== "0";
  const aiProgress = await startAiProgress("group_dining", {
    traceId: normalizeAiProgressTraceId(inputRecord.aiProgressTraceId),
    userId: auth.user.userId,
    message: "正在读取约饭任务、成员偏好和可见约束。"
  });
  await advanceAiProgress(aiProgress.traceId, "retrieve", {
    message: "正在整理成员偏好、冲突和候选餐厅上下文。"
  });
  const profile = await ensureUserProfile(auth.user.userId);
  const openclawContext = createOpenClawDataContext("group_dining", {
    userId: auth.user.userId,
    profile,
    contextBlocks: ["user_profile", "group_task", "participants", "conflicts", "candidate_restaurant_data"],
    payload: {
      task: source.value.task,
      participants: source.value.participants,
      conflicts: source.value.conflicts
    }
  });
  await advanceAiProgress(aiProgress.traceId, "filter", {
    message: "正在检查预算、忌口、时间和人数等硬约束。"
  });
  let recommendation: RecommendationResult | undefined;
  let openclawContextResult = createOpenClawDataFeedResult(openclawContext, "skipped", {
    detail: "OpenClaw group feed/recommendation skipped by request or deployment config."
  });

  console.info("[groupRecommend] OpenClaw decision", {
    taskId,
    traceId: openclawContext.traceId,
    openclawFeed: inputRecord.openclawFeed,
    useOpenClaw: inputRecord.useOpenClaw,
    shouldFeedOpenClaw,
    shouldUseOpenClaw,
    contextBlocks: openclawContext.contextBlocks
  });

  if (shouldFeedOpenClaw) {
    await advanceAiProgress(aiProgress.traceId, "rank", {
      message: "正在生成多人约饭折中排序。"
    });
    await advanceAiProgress(aiProgress.traceId, "compose", {
      message: "正在把多人约饭上下文同步给 OpenClaw。",
      note: "OpenClaw 用于接收任务、成员和冲突上下文，页面推荐由服务端 adapter 返回。"
    });
    openclawContextResult = await submitOpenClawDataFeed(openclawContext);
  } else if (shouldUseOpenClaw) {
    const startedAt = Date.now();

    try {
      await advanceAiProgress(aiProgress.traceId, "rank", {
        message: "正在请求 OpenClaw 计算群体推荐排序。"
      });
      await advanceAiProgress(aiProgress.traceId, "compose", {
        message: "OpenClaw 正在生成主推、备选和群发文案。"
      });
      recommendation = await generateOpenClawRecommendation(
        source.value.task,
        source.value.participants,
        source.value.conflicts,
        {
          taskId,
          userId: auth.user.userId,
          context: openclawContext
        }
      );
      openclawContextResult = createOpenClawDataFeedResult(openclawContext, "submitted", {
        durationMs: Date.now() - startedAt,
        detail: "Context was included in the OpenClaw group recommendation prompt."
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("OpenClaw group recommendation failed; using local fallback", {
        taskId,
        detail
      });
      openclawContextResult = createOpenClawDataFeedResult(openclawContext, "failed", {
        durationMs: Date.now() - startedAt,
        detail
      });
    }
  } else {
    await advanceAiProgress(aiProgress.traceId, "rank", {
      message: "正在用服务端 adapter 生成本地折中排序。"
    });
    await advanceAiProgress(aiProgress.traceId, "compose", {
      message: "正在整理多人约饭推荐结果。",
      note: "本次请求未启用 OpenClaw，已走服务端本地规则。"
    });
  }

  if (!shouldFeedOpenClaw) {
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
  }
  const result = await saveGroupRecommendation(taskId, inviteToken, recommendation, openclawContextResult);

  if (result.status !== 200) {
    const errorNote = typeof result.error === "string" ? result.error : result.error.message;
    await completeAiProgress(aiProgress.traceId, "error", {
      message: "多人约饭推荐保存失败。",
      note: errorNote
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const finalProgress = await completeAiProgress(
    aiProgress.traceId,
    openclawContextResult.status === "failed" ? "fallback" : "done",
    {
      message: openclawContextResult.status === "failed"
        ? "多人约饭推荐已用本地 adapter 兜底完成，OpenClaw 同步失败。"
        : "多人约饭推荐流程已完成。",
      note: openclawContextResult.detail
    }
  );

  return NextResponse.json({ ...result.value, aiProgress: finalProgress || aiProgress });
}
