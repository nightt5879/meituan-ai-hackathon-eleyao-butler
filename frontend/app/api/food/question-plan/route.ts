import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import {
  createFoodQuestionPlan,
  sanitizeFoodQuestionPlanRequest
} from "@/lib/server/foodDecisionSheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const sanitizedRequest = sanitizeFoodQuestionPlanRequest(body);
  const result = await createFoodQuestionPlan(sanitizedRequest);

  return NextResponse.json(result);
}
