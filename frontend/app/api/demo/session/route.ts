import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createWechatSession } from "@/lib/server/sessionStore";
import { ensureUserProfile } from "@/lib/server/userProfileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDemoId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalized || "guest";
}

function demoOpenidFromId(demoId: string) {
  const digest = createHash("sha256").update(`meituan-web-demo:${demoId}`).digest("hex").slice(0, 32);
  return `demo_web_${digest}`;
}

export async function POST(request: Request) {
  if (process.env.MEITUAN_DEMO_AUTH_ENABLED === "0") {
    return NextResponse.json(
      {
        error: {
          code: "DEMO_AUTH_DISABLED",
          message: "Demo auth is disabled on this deployment."
        }
      },
      { status: 503 }
    );
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const demoUserId = normalizeDemoId(readString(record.demoUserId, "guest"));
  const displayName = readString(record.displayName, demoUserId === "guest" ? "评审 Demo 用户" : demoUserId).slice(0, 32);
  const { user, sessionToken } = await createWechatSession(demoOpenidFromId(demoUserId));
  const profile = await ensureUserProfile(user.userId);

  return NextResponse.json({
    ok: true,
    demo: true,
    demoUserId,
    displayName,
    userId: user.userId,
    sessionToken,
    profile,
    profileId: profile.profileId,
    profileInitialized: profile.initialized,
    identityType: user.identityType,
    isStable: user.isStable
  });
}
