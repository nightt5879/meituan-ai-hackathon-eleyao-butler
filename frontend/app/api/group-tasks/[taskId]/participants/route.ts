import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { addOrUpdateGroupParticipant } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { taskId } = await params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Invalid participant payload."
        }
      },
      { status: 400 }
    );
  }

  const inviteToken = typeof input === "object" && input && "inviteToken" in input ? String(input.inviteToken ?? "") : "";
  const result = await addOrUpdateGroupParticipant(taskId, inviteToken, input, auth.user.userId);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value);
}
