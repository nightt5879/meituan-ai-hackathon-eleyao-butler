import { NextResponse } from "next/server";
import {
  generateFoodRecommendationsWithOpenClaw,
  sanitizeFoodRecommendRequest
} from "@/lib/server/openclawFoodRecommendation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const sanitizedRequest = sanitizeFoodRecommendRequest(body);

  try {
    const result = await generateFoodRecommendationsWithOpenClaw(sanitizedRequest);
    return NextResponse.json({
      ...result,
      diagnostics: {
        durationMs: Date.now() - startedAt
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("OpenClaw food recommendation failed", {
      durationMs: Date.now() - startedAt,
      detail
    });

    return NextResponse.json(
      {
        error: "OpenClaw recommendation failed.",
        detail,
        diagnostics: {
          durationMs: Date.now() - startedAt
        }
      },
      { status: 502 }
    );
  }
}
