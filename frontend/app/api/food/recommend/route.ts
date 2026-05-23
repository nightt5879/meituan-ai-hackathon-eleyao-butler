import { NextResponse } from "next/server";
import {
  generateFoodRecommendationsWithOpenClaw,
  sanitizeFoodRecommendRequest
} from "@/lib/server/openclawFoodRecommendation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const sanitizedRequest = sanitizeFoodRecommendRequest(body);

  try {
    const result = await generateFoodRecommendationsWithOpenClaw(sanitizedRequest);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "OpenClaw recommendation failed.",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
