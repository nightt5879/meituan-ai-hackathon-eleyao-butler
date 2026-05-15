import { NextResponse } from "next/server";
import { deleteParticipant } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string; participantId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { taskId, participantId } = await params;
  const payload = await deleteParticipant(taskId, participantId);

  if (!payload) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
