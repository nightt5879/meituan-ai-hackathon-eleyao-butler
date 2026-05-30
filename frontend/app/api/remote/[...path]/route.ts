import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const DEFAULT_REMOTE_API_BASE_URL = "https://meituan-ai-hackathon.cn";
const ALLOWED_REMOTE_PATHS = new Set([
  "food/ping",
  "food/status",
  "food/recommend"
]);

function getRemoteApiBaseUrl() {
  const configured = process.env.MEITUAN_REMOTE_API_BASE_URL?.trim();
  return (configured || DEFAULT_REMOTE_API_BASE_URL).replace(/\/+$/, "");
}

function remoteTimeoutMs(pathname: string) {
  return pathname === "food/recommend" ? 130_000 : 20_000;
}

async function proxyRemoteApi(request: Request, { params }: RouteContext) {
  const { path } = await params;
  const pathname = path.join("/");

  if (!ALLOWED_REMOTE_PATHS.has(pathname)) {
    return NextResponse.json(
      {
        error: {
          code: "REMOTE_API_PATH_NOT_ALLOWED",
          message: "This remote API path is not exposed by the web demo proxy."
        }
      },
      { status: 404 }
    );
  }

  const baseUrl = getRemoteApiBaseUrl();
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`/api/${pathname}${sourceUrl.search}`, baseUrl);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  const authorization = request.headers.get("authorization");
  const sessionToken = request.headers.get("x-session-token");

  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (authorization) headers.set("authorization", authorization);
  if (sessionToken) headers.set("x-session-token", sessionToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remoteTimeoutMs(pathname));

  try {
    const method = request.method.toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal
    });
    const responseText = await response.text();
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");

    if (responseContentType) {
      responseHeaders.set("content-type", responseContentType);
    }
    responseHeaders.set("x-meituan-remote-api-base", baseUrl);

    return new NextResponse(responseText, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          code: "REMOTE_API_UNREACHABLE",
          message
        },
        remote: {
          baseUrl,
          path: `/api/${pathname}`
        }
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRemoteApi(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRemoteApi(request, context);
}
