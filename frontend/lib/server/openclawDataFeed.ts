import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";
import type { UserProfile } from "@/lib/server/userProfileStore";

export type OpenClawDataScene = "food_recommendation" | "group_dining" | "weekend_plan";

export type OpenClawDataContext = {
  schemaVersion: "openclaw-context-v1";
  traceId: string;
  scene: OpenClawDataScene;
  createdAt: string;
  user: {
    userId: string;
    userRef: string;
    profileId: string;
    profileRef: string;
  };
  profile: {
    initialized: boolean;
    initializedAt: string | null;
    butler: UserProfile["butler"];
    preferences: UserProfile["preferences"];
    memories: UserProfile["memories"];
  };
  contextBlocks: string[];
  payload: unknown;
  privacy: {
    containsOpenid: false;
    containsSessionToken: false;
    acceptsClientUserOverride: false;
  };
};

export type OpenClawDataFeedResult = {
  traceId: string;
  scene: OpenClawDataScene;
  submitted: boolean;
  status: "submitted" | "skipped" | "failed";
  sessionRef: string;
  contextBlocks: string[];
  durationMs: number;
  detail?: string;
};

type CreateContextInput = {
  userId: string;
  profile: UserProfile;
  contextBlocks: string[];
  payload: unknown;
};

type FeedAuditRecord = OpenClawDataFeedResult & {
  userRef: string;
  profileRef: string;
  recordedAt: string;
};

const DEFAULT_FEED_TIMEOUT_MS = 130_000;
const DEFAULT_MAX_RESPONSE_CHARS = 8000;

export function createOpenClawDataContext(scene: OpenClawDataScene, input: CreateContextInput): OpenClawDataContext {
  const traceId = `occtx_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

  return {
    schemaVersion: "openclaw-context-v1",
    traceId,
    scene,
    createdAt: new Date().toISOString(),
    user: {
      userId: input.userId,
      userRef: `user_${shortHash(input.userId, 12)}`,
      profileId: input.profile.profileId,
      profileRef: `profile_${shortHash(input.profile.profileId, 12)}`
    },
    profile: {
      initialized: input.profile.initialized,
      initializedAt: input.profile.initializedAt,
      butler: input.profile.butler,
      preferences: input.profile.preferences,
      memories: input.profile.memories
    },
    contextBlocks: input.contextBlocks,
    payload: input.payload,
    privacy: {
      containsOpenid: false,
      containsSessionToken: false,
      acceptsClientUserOverride: false
    }
  };
}

export function createOpenClawDataFeedResult(
  context: OpenClawDataContext,
  status: OpenClawDataFeedResult["status"],
  input: {
    durationMs?: number;
    detail?: string;
    sessionId?: string;
  } = {}
): OpenClawDataFeedResult {
  const sessionId = input.sessionId || buildDataFeedSessionId(context);

  return {
    traceId: context.traceId,
    scene: context.scene,
    submitted: status === "submitted",
    status,
    sessionRef: `session_${shortHash(sessionId, 12)}`,
    contextBlocks: context.contextBlocks,
    durationMs: Math.max(0, Math.round(input.durationMs || 0)),
    detail: input.detail
  };
}

export async function submitOpenClawDataFeed(context: OpenClawDataContext): Promise<OpenClawDataFeedResult> {
  const startedAt = Date.now();
  const sessionId = buildDataFeedSessionId(context);

  if (process.env.OPENCLAW_DATA_FEED_ENABLED === "0") {
    const result = createOpenClawDataFeedResult(context, "skipped", {
      sessionId,
      detail: "OPENCLAW_DATA_FEED_ENABLED=0"
    });
    await writeAudit(context, result);
    return result;
  }

  try {
    await runOpenClawDataFeedCli(buildDataFeedPrompt(context), sessionId);
    const result = createOpenClawDataFeedResult(context, "submitted", {
      sessionId,
      durationMs: Date.now() - startedAt,
      detail: "OpenClaw accepted context payload."
    });
    await writeAudit(context, result);
    return result;
  } catch (error) {
    const result = createOpenClawDataFeedResult(context, "failed", {
      sessionId,
      durationMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error)
    });
    await writeAudit(context, result);
    return result;
  }
}

export async function recordOpenClawDataFeedResult(context: OpenClawDataContext, result: OpenClawDataFeedResult) {
  await writeAudit(context, result);
}

function buildDataFeedSessionId(context: OpenClawDataContext) {
  return buildScopedOpenClawSessionId("meituan-data-feed", [
    "feed",
    context.scene,
    context.user.userRef,
    context.traceId
  ]);
}

function buildDataFeedPrompt(context: OpenClawDataContext) {
  return [
    "You are the OpenClaw memory and context intake agent for the Meituan AI butler.",
    "Ingest the following structured context so later recommendations can use the same user/profile/business state.",
    "Do not claim that you accessed real Meituan, Dianping, map, inventory, booking, or payment systems.",
    "Return ONLY strict JSON with this schema:",
    '{"ok":true,"traceId":"...","acceptedContext":["profile","scene_request"],"warnings":[]}',
    "Context payload:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function runOpenClawDataFeedCli(content: string, sessionId: string): Promise<void> {
  const timeoutMs = readNumberEnv("OPENCLAW_DATA_FEED_TIMEOUT_MS", DEFAULT_FEED_TIMEOUT_MS);
  const maxResponseChars = readNumberEnv("OPENCLAW_MAX_RESPONSE_CHARS", DEFAULT_MAX_RESPONSE_CHARS);
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || process.env.OPENCLAW_BIN?.trim() || "/home/nightt/.npm-global/bin/openclaw";
  const profile = process.env.OPENCLAW_PROFILE?.trim() || "meituan01";
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args = [
    "--profile",
    profile,
    "agent",
    "--agent",
    agentId,
    "--session-id",
    sessionId,
    "--message",
    content,
    "--timeout",
    String(timeoutSeconds),
    "--json"
  ];

  return new Promise((resolve, reject) => {
    execFile(
      cliPath,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: Math.max(maxResponseChars * 4, 1024 * 1024),
        env: {
          ...process.env,
          PATH: process.env.PATH || "/usr/bin:/home/nightt/.local/bin:/home/nightt/.npm-global/bin:/usr/local/bin:/bin"
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(buildCliErrorMessage(error, stderr)));
          return;
        }

        if (!extractCliPayloadText(stdout).trim()) {
          reject(new Error("OpenClaw data feed returned no assistant text."));
          return;
        }

        resolve();
      }
    );
  });
}

function extractCliPayloadText(stdout: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`OpenClaw CLI stdout JSON parse failed: ${(error as Error).message}`);
  }

  const parsedRecord = isRecord(parsed) ? parsed : {};
  const result = isRecord(parsedRecord.result) ? parsedRecord.result : {};
  const payloads = Array.isArray(result.payloads) ? result.payloads : [];
  const payloadText = payloads
    .map((payload) => isRecord(payload) ? readString(payload.text) : "")
    .filter(Boolean)
    .join("\n");
  const meta = isRecord(result.meta) ? result.meta : {};

  return payloadText || readString(meta.finalAssistantVisibleText) || readString(meta.finalAssistantRawText);
}

async function writeAudit(context: OpenClawDataContext, result: OpenClawDataFeedResult) {
  const filePath = getAuditFilePath();
  const record: FeedAuditRecord = {
    ...result,
    userRef: context.user.userRef,
    profileRef: context.user.profileRef,
    recordedAt: new Date().toISOString()
  };

  try {
    const database = await readAuditFile(filePath);
    database.records.unshift(record);
    database.records = database.records.slice(0, 100);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  } catch (error) {
    console.warn("[openclawDataFeed] failed to write audit file", error);
  }
}

async function readAuditFile(filePath: string): Promise<{ version: 1; records: FeedAuditRecord[] }> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown; records?: unknown };

    if (parsed.version === 1 && Array.isArray(parsed.records)) {
      return {
        version: 1,
        records: parsed.records.filter(isRecord).map((record) => record as FeedAuditRecord)
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return {
    version: 1,
    records: []
  };
}

function getAuditFilePath() {
  const configured = process.env.MEITUAN_OPENCLAW_FEED_AUDIT_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "openclaw-feed-audit.json");
}

function buildCliErrorMessage(error: Error & { code?: unknown; signal?: unknown; killed?: boolean }, stderr: string) {
  const timeoutSuffix = error.killed || error.signal === "SIGTERM"
    ? ` OpenClaw data feed timed out after ${readNumberEnv("OPENCLAW_DATA_FEED_TIMEOUT_MS", DEFAULT_FEED_TIMEOUT_MS)}ms.`
    : "";
  const codeText = error.code ? ` code=${String(error.code)}` : "";
  const signalText = error.signal ? ` signal=${String(error.signal)}` : "";
  const stderrSummary = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Config warnings?:/i.test(line))
    .slice(-6)
    .join(" | ")
    .slice(0, 1200);

  return `OpenClaw data feed failed${codeText}${signalText}.${timeoutSuffix}${stderrSummary ? ` stderr: ${stderrSummary}` : ""}`;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
