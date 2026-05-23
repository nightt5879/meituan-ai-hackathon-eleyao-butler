import { NextResponse } from "next/server";
import { getGroupTaskBoard } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  const inviteToken = new URL(request.url).searchParams.get("inviteToken") ?? "";
  const result = await getGroupTaskBoard(taskId, inviteToken);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value);
}
