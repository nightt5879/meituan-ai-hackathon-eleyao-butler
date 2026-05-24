type WechatCodeSessionResponse = {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

export class WechatAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WechatAuthConfigError";
  }
}

export class WechatCodeSessionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "WechatCodeSessionError";
    this.statusCode = statusCode;
  }
}

function getRequiredEnv(name: string, aliases: string[] = []) {
  const names = [name, ...aliases];
  const value = names.map((envName) => process.env[envName]?.trim()).find(Boolean);

  if (!value) {
    throw new WechatAuthConfigError(`${names.join(" or ")} is required.`);
  }

  return value;
}

export async function exchangeWechatCodeForSession(code: string) {
  const appId = getRequiredEnv("WECHAT_MINI_PROGRAM_APPID", ["WECHAT_MINIPROGRAM_APPID", "WECHAT_APP_ID"]);
  const secret = getRequiredEnv("WECHAT_MINI_PROGRAM_SECRET", ["WECHAT_MINIPROGRAM_SECRET", "WECHAT_APP_SECRET"]);
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");

  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new WechatCodeSessionError(`Wechat code2Session HTTP ${response.status}.`, 502);
    }

    const payload = (await response.json()) as WechatCodeSessionResponse;

    if (payload.errcode) {
      throw new WechatCodeSessionError(payload.errmsg || `Wechat code2Session failed with ${payload.errcode}.`, 401);
    }

    if (!payload.openid) {
      throw new WechatCodeSessionError("Wechat code2Session returned no openid.", 502);
    }

    return {
      openid: payload.openid,
      unionid: payload.unionid
    };
  } catch (error) {
    if (error instanceof WechatCodeSessionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new WechatCodeSessionError(`Wechat code2Session request failed: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}
