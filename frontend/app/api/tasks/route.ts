import { NextResponse } from "next/server";
import { createTask } from "@/lib/server/taskStore";
import type { StoredTaskFields } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildUrls(request: Request, taskId: string) {
  const origin = new URL(request.url).origin;

  return {
    share_url: `${origin}/dinner/${taskId}/fill`,
    fill_url: `${origin}/dinner/${taskId}/fill`,
    board_url: `${origin}/dinner/${taskId}`
  };
}

export async function POST(request: Request) {
  let input: Partial<StoredTaskFields> = {};

  try {
    input = (await request.json()) as Partial<StoredTaskFields>;
  } catch {
    input = {};
  }

  const payload = await createTask(input);

  return NextResponse.json(
    {
      ...payload,
      task_id: payload.task.task_id,
      status: payload.recommendation_state.status,
      ...buildUrls(request, payload.task.task_id)
    },
    { status: 201 }
  );
}
