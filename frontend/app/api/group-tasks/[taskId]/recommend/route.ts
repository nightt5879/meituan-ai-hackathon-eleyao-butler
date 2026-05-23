import { NextResponse } from "next/server";
import { saveGroupRecommendation } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const inviteToken = typeof input === "object" && input && "inviteToken" in input ? String(input.inviteToken ?? "") : "";
  const result = await saveGroupRecommendation(taskId, inviteToken);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value);
}
