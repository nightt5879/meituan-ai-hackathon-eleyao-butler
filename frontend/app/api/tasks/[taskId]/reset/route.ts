import { NextResponse } from "next/server";
import { resetDemoTask } from "@/lib/server/taskStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  const payload = await resetDemoTask(taskId);

  if (!payload) {
    return NextResponse.json({ error: "Demo task reset is only available for the built-in demo task." }, { status: 404 });
  }

  return NextResponse.json(payload);
}
