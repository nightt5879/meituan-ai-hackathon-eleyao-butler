import { NextResponse } from "next/server";
import { getCurrentUserFromRequest, type AuthenticatedUser } from "@/lib/server/sessionStore";

export type RequiredUserResult =
  | {
      ok: true;
      user: AuthenticatedUser;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireMiniProgramUser(request: Request): Promise<RequiredUserResult> {
  const user = await getCurrentUserFromRequest(request);

  if (user) {
    return {
      ok: true,
      user
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: {
          code: "AUTH_REQUIRED",
          message: "Wechat login is required."
        }
      },
      { status: 401 }
    )
  };
}
