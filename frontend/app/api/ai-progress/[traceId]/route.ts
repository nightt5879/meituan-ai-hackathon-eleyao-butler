import { NextResponse } from "next/server";
import { getAiProgress } from "@/lib/server/aiProgress";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ traceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { traceId } = await params;
  const progress = await getAiProgress(traceId, auth.user.userId);

  if (!progress) {
    return NextResponse.json({ error: "AI progress trace not found." }, { status: 404 });
  }

  return NextResponse.json(progress);
}
