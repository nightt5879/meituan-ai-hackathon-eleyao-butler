import { NextResponse } from "next/server";
import { generateOpenClawRecommendation } from "@/lib/server/openclawRecommendation";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult
} from "@/lib/server/openclawDataFeed";
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

  const shouldUseOpenClaw = inputRecord.useOpenClaw !== false && process.env.OPENCLAW_GROUP_RECOMMENDATION_ENABLED !== "0";
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
  let recommendation: RecommendationResult | undefined;
  let openclawContextResult = createOpenClawDataFeedResult(openclawContext, "skipped", {
    detail: "OpenClaw group recommendation skipped by request or deployment config."
  });

  if (shouldUseOpenClaw) {
    const startedAt = Date.now();

    try {
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
  }

  await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);
  const result = await saveGroupRecommendation(taskId, inviteToken, recommendation, openclawContextResult);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value);
}
