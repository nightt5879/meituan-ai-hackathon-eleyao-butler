import { execFile } from "node:child_process";
import { createConnection } from "node:net";

export type FoodOpenClawStatus = {
  backend: {
    ok: true;
    checkedAt: string;
  };
  openclaw: {
    ok: boolean;
    mode: "cli";
    configured: boolean;
    cliReachable: boolean;
    gatewayReachable: boolean;
    gatewayUrl: string;
    profile: string;
    agentId: string;
    sessionId: string;
    timeoutMs: number;
    detail: string;
  };
};

const DEFAULT_STATUS_TIMEOUT_MS = 5000;
const DEFAULT_GATEWAY_TIMEOUT_MS = 1500;

export async function checkFoodOpenClawStatus(): Promise<FoodOpenClawStatus> {
  const timeoutMs = readNumberEnv("OPENCLAW_STATUS_TIMEOUT_MS", DEFAULT_STATUS_TIMEOUT_MS);
  const gatewayTimeoutMs = readNumberEnv("OPENCLAW_GATEWAY_PROBE_TIMEOUT_MS", DEFAULT_GATEWAY_TIMEOUT_MS);
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim() || "ws://127.0.0.1:19789";
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || "openclaw";
  const profile = process.env.OPENCLAW_PROFILE?.trim() || "default";
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
  const sessionId = process.env.OPENCLAW_CHAT_SESSION_ID?.trim() ||
    process.env.OPENCLAW_CHAT_SESSION_KEY?.trim() ||
    "meituan-single-food";
  const configured = Boolean(cliPath && profile && agentId);
  const checkedAt = new Date().toISOString();
  const gatewayProbe = await probeOpenClawGateway(gatewayUrl, gatewayTimeoutMs);

  if (!configured) {
    return buildStatus({
      checkedAt,
      ok: false,
      configured,
      cliReachable: false,
      gatewayReachable: gatewayProbe.ok,
      gatewayUrl,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: joinDetails("OpenClaw CLI is not configured.", gatewayProbe.detail)
    });
  }

  try {
    await runOpenClawStatusCli(cliPath, profile, timeoutMs);
    return buildStatus({
      checkedAt,
      ok: true,
      configured,
      cliReachable: true,
      gatewayReachable: gatewayProbe.ok,
      gatewayUrl,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: joinDetails("OpenClaw CLI status check succeeded.", gatewayProbe.detail)
    });
  } catch (error) {
    const cliDetail = error instanceof Error ? error.message : String(error);
    return buildStatus({
      checkedAt,
      ok: false,
      configured,
      cliReachable: false,
      gatewayReachable: gatewayProbe.ok,
      gatewayUrl,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: joinDetails(cliDetail, gatewayProbe.detail)
    });
  }
}

function buildStatus(input: {
  checkedAt: string;
  ok: boolean;
  configured: boolean;
  cliReachable: boolean;
  gatewayReachable: boolean;
  gatewayUrl: string;
  profile: string;
  agentId: string;
  sessionId: string;
  timeoutMs: number;
  detail: string;
}): FoodOpenClawStatus {
  return {
    backend: {
      ok: true,
      checkedAt: input.checkedAt
    },
    openclaw: {
      ok: input.ok,
      mode: "cli",
      configured: input.configured,
      cliReachable: input.cliReachable,
      gatewayReachable: input.gatewayReachable,
      gatewayUrl: input.gatewayUrl,
      profile: input.profile,
      agentId: input.agentId,
      sessionId: input.sessionId,
      timeoutMs: input.timeoutMs,
      detail: input.detail
    }
  };
}

function probeOpenClawGateway(gatewayUrl: string, timeoutMs: number): Promise<{ ok: boolean; detail: string }> {
  let parsed: URL;

  try {
    parsed = new URL(gatewayUrl);
  } catch {
    return Promise.resolve({
      ok: false,
      detail: `Gateway URL is invalid: ${gatewayUrl}`
    });
  }

  const port = Number(parsed.port || (parsed.protocol === "wss:" ? 443 : 80));
  const host = parsed.hostname;

  if (!host || !Number.isFinite(port)) {
    return Promise.resolve({
      ok: false,
      detail: `Gateway URL is missing host or port: ${gatewayUrl}`
    });
  }

  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;

    const finish = (ok: boolean, detail: string) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve({ ok, detail });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish(true, `Gateway TCP reachable: ${gatewayUrl}`);
    });
    socket.once("timeout", () => {
      finish(false, `Gateway TCP probe timed out after ${timeoutMs}ms: ${gatewayUrl}`);
    });
    socket.once("error", (error) => {
      finish(false, `Gateway TCP probe failed: ${error.message}`);
    });
  });
}

function joinDetails(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

function runOpenClawStatusCli(cliPath: string, profile: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      cliPath,
      ["--profile", profile, "status", "--json"],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: process.env
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(buildCliErrorMessage(error, stderr)));
          return;
        }

        if (!stdout.trim()) {
          reject(new Error("OpenClaw status returned empty stdout."));
          return;
        }

        resolve();
      }
    );
  });
}

function buildCliErrorMessage(error: Error & { code?: unknown; signal?: unknown; killed?: boolean }, stderr: string) {
  const timeoutSuffix = error.killed || error.signal === "SIGTERM"
    ? " OpenClaw status check timed out."
    : "";
  const codeText = error.code ? ` code=${String(error.code)}` : "";
  const signalText = error.signal ? ` signal=${String(error.signal)}` : "";
  const stderrSummary = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-4)
    .join(" | ")
    .slice(0, 500);

  return `OpenClaw status failed${codeText}${signalText}.${timeoutSuffix}${stderrSummary ? ` stderr: ${stderrSummary}` : ""}`;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
