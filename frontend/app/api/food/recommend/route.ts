import { NextResponse } from "next/server";
import {
  createOpenClawDataContext,
  createOpenClawDataFeedResult,
  recordOpenClawDataFeedResult
} from "@/lib/server/openclawDataFeed";
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
  const profile = await ensureUserProfile(auth.user.userId);
  const openclawContext = createOpenClawDataContext("food_recommendation", {
    userId: auth.user.userId,
    profile,
    contextBlocks: ["user_profile", "food_preferences", "food_decision_sheet", "current_food_request"],
    payload: {
      request: sanitizedRequest
    }
  });

  try {
    const result = await generateFoodRecommendationsWithOpenClaw(sanitizedRequest, {
      userId: auth.user.userId,
      context: openclawContext
    });
    const openclawContextResult = createOpenClawDataFeedResult(openclawContext, "submitted", {
      durationMs: Date.now() - startedAt,
      detail: "Context was included in the OpenClaw recommendation prompt."
    });
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);

    return NextResponse.json({
      ...result,
      diagnostics: {
        durationMs: Date.now() - startedAt,
        openclawContext: openclawContextResult
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const openclawContextResult = createOpenClawDataFeedResult(openclawContext, "failed", {
      durationMs: Date.now() - startedAt,
      detail
    });
    await recordOpenClawDataFeedResult(openclawContext, openclawContextResult);

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
          openclawContext: openclawContextResult
        }
      },
      { status: 502 }
    );
  }
}
