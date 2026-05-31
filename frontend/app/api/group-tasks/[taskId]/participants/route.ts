import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/server/sessionStore";
import { addOrUpdateGroupParticipant } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUserFromRequest(request);
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
  const result = await addOrUpdateGroupParticipant(taskId, inviteToken, input, user?.userId ?? "");

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.value);
}
