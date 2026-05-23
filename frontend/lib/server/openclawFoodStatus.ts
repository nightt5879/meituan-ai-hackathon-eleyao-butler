import { execFile } from "node:child_process";

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
    profile: string;
    agentId: string;
    sessionId: string;
    timeoutMs: number;
    detail: string;
  };
};

const DEFAULT_STATUS_TIMEOUT_MS = 5000;

export async function checkFoodOpenClawStatus(): Promise<FoodOpenClawStatus> {
  const timeoutMs = readNumberEnv("OPENCLAW_STATUS_TIMEOUT_MS", DEFAULT_STATUS_TIMEOUT_MS);
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || "/home/nightt/.npm-global/bin/openclaw";
  const profile = process.env.OPENCLAW_PROFILE?.trim() || "meituan01";
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
  const sessionId = process.env.OPENCLAW_CHAT_SESSION_ID?.trim() ||
    process.env.OPENCLAW_CHAT_SESSION_KEY?.trim() ||
    "meituan-single-food";
  const configured = Boolean(cliPath && profile && agentId);
  const checkedAt = new Date().toISOString();

  if (!configured) {
    return buildStatus({
      checkedAt,
      ok: false,
      configured,
      cliReachable: false,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: "OpenClaw CLI is not configured."
    });
  }

  try {
    await runOpenClawStatusCli(cliPath, profile, timeoutMs);
    return buildStatus({
      checkedAt,
      ok: true,
      configured,
      cliReachable: true,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: "OpenClaw CLI status check succeeded."
    });
  } catch (error) {
    return buildStatus({
      checkedAt,
      ok: false,
      configured,
      cliReachable: false,
      profile,
      agentId,
      sessionId,
      timeoutMs,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

function buildStatus(input: {
  checkedAt: string;
  ok: boolean;
  configured: boolean;
  cliReachable: boolean;
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
      profile: input.profile,
      agentId: input.agentId,
      sessionId: input.sessionId,
      timeoutMs: input.timeoutMs,
      detail: input.detail
    }
  };
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
