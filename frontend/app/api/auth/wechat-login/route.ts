import { NextResponse } from "next/server";
import { createWechatSession } from "@/lib/server/sessionStore";
import { exchangeWechatCodeForSession, WechatAuthConfigError, WechatCodeSessionError } from "@/lib/server/wechatAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Invalid login payload."
        }
      },
      { status: 400 }
    );
  }

  const code = typeof body === "object" && body && "code" in body ? String(body.code || "").trim() : "";

  if (!code) {
    return NextResponse.json(
      {
        error: {
          code: "CODE_REQUIRED",
          message: "wx.login code is required."
        }
      },
      { status: 400 }
    );
  }

  try {
    const codeSession = await exchangeWechatCodeForSession(code);
    const { user, sessionToken } = await createWechatSession(codeSession.openid);

    return NextResponse.json({
      ok: true,
      userId: user.userId,
      sessionToken,
      identityType: user.identityType,
      isStable: user.isStable
    });
  } catch (error) {
    if (error instanceof WechatAuthConfigError) {
      return NextResponse.json(
        {
          error: {
            code: "WECHAT_AUTH_NOT_CONFIGURED",
            message: error.message
          }
        },
        { status: 503 }
      );
    }

    if (error instanceof WechatCodeSessionError) {
      return NextResponse.json(
        {
          error: {
            code: "WECHAT_CODE_SESSION_FAILED",
            message: error.message
          }
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "WECHAT_LOGIN_FAILED",
          message: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500 }
    );
  }
}
