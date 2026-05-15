import { NextResponse } from "next/server";
import { addOrUpdateParticipant } from "@/lib/server/taskStore";
import type { ParticipantInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  let input: ParticipantInput;

  try {
    input = (await request.json()) as ParticipantInput;
  } catch {
    return NextResponse.json({ error: "Invalid participant payload." }, { status: 400 });
  }

  if (!input.raw_preference?.trim()) {
    return NextResponse.json({ error: "Preference is required." }, { status: 400 });
  }

  const payload = await addOrUpdateParticipant(taskId, input);

  if (!payload) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
