import { NextResponse } from "next/server";
import { generateOpenClawRecommendation } from "@/lib/server/openclawRecommendation";
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

  try {
    const recommendation = await generateOpenClawRecommendation(current.task, current.participants, current.conflicts);
    const payload = await saveRecommendation(taskId, recommendation);

    if (!payload) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("OpenClaw recommendation failed", error);
    return NextResponse.json(
      {
        error: "OpenClaw recommendation failed.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 502 }
    );
  }
}
