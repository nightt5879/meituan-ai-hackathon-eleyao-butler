import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { createGroupTask } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  let input: unknown = {};

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const payload = await createGroupTask(input, auth.user.userId);

  return NextResponse.json(payload, { status: 201 });
}
