import { NextResponse } from "next/server";
import { getTask, saveRecommendation } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  const current = await getTask(taskId);

  if (!current) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (current.participants.length === 0) {
    return NextResponse.json({ error: "Please add participants before generating a recommendation." }, { status: 400 });
  }

  const payload = await saveRecommendation(taskId);

  if (!payload) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
