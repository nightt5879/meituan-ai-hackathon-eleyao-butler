import { NextResponse } from "next/server";
import { requireMiniProgramUser } from "@/lib/server/requestAuth";
import { ensureUserProfile } from "@/lib/server/userProfileStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMiniProgramUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const profile = await ensureUserProfile(auth.user.userId);

  return NextResponse.json({
    ok: true,
    profile,
    profileId: profile.profileId,
    profileInitialized: profile.initialized
  });
}
