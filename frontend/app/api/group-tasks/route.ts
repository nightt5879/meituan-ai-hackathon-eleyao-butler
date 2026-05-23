import { NextResponse } from "next/server";
import { createGroupTask } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: unknown = {};

  try {
    input = await request.json();
  } catch {
    input = {};
  }

  const payload = await createGroupTask(input);

  return NextResponse.json(payload, { status: 201 });
}
