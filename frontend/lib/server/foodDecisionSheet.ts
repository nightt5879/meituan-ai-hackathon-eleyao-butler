import { execFile } from "node:child_process";
import { buildOpenClawRequestScope, buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";

type StringMap = Record<string, unknown>;

export type FoodDecisionDimension = {
  key: string;
  label: string;
  value: string;
  source: "fixed" | "dynamic";
  hard?: boolean;
  reason?: string;
};

export type FoodDecisionSheet = {
  fixed: FoodDecisionDimension[];
  dynamic: FoodDecisionDimension[];
  readiness: {
    hardReady: boolean;
    missingHardKeys: string[];
    optionalReadyCount: number;
  };
  source: "client" | "server";
};

export type FoodDynamicQuestion = {
  id: string;
  kind: "choice" | "multi-choice";
  slot: string;
  label: string;
  title: string;
  options: string[];
  optional: boolean;
  allowEmpty: boolean;
  targetDimension: string;
  reason: string;
};

export type FoodQuestionPlanRequest = {
  slots: {
    mealPurpose: string;
    branchPreference: string;
    budget: string;
    distance: string;
  };
  preferences: {
    tasteTags: string[];
    needTags: string[];
    avoidTags: string[];
    spicyLevel: string;
  };
  decisionSheet?: FoodDecisionSheet;
};

export type FoodQuestionPlanResponse = {
  status: "ready";
  questions: FoodDynamicQuestion[];
  decisionSheet: FoodDecisionSheet;
  source: "openclaw" | "rules";
  message?: string;
};

type FoodQuestionPlanOptions = {
  userId?: string;
};

const DEFAULT_QUESTION_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_CHARS = 8000;

const FALLBACK_QUESTIONS: FoodDynamicQuestion[] = [
  {
    id: "ai-priority",
    kind: "choice",
    slot: "dynamic.priority",
    label: "本次优先级",
    title: "这顿饭你最想优先满足哪一点？",
    options: ["近一点", "便宜一点", "快一点", "好吃更重要", "安静一点"],
    optional: true,
    allowEmpty: true,
    targetDimension: "priority",
    reason: "用于在预算、距离、速度和体验之间做最终取舍。"
  },
  {
    id: "ai-queue-tolerance",
    kind: "choice",
    slot: "dynamic.queueTolerance",
    label: "排队容忍",
    title: "能接受等位或排队吗？",
    options: ["不能排队", "10 分钟以内", "20 分钟以内", "无所谓"],
    optional: true,
    allowEmpty: true,
    targetDimension: "queueTolerance",
    reason: "用于规避高峰期不稳定方案。"
  },
  {
    id: "ai-dining-state",
    kind: "choice",
    slot: "dynamic.diningState",
    label: "当前状态",
    title: "你现在更像是哪种状态？",
    options: ["很饿要快", "想轻松坐会", "想犒劳自己", "只想随便解决"],
    optional: true,
    allowEmpty: true,
    targetDimension: "diningState",
    reason: "用于判断推荐应偏效率、舒适还是满足感。"
  }
];

export function sanitizeFoodQuestionPlanRequest(input: unknown): FoodQuestionPlanRequest {
  const payload = isRecord(input) ? input : {};
  const slots = isRecord(payload.slots) ? payload.slots : {};
  const preferences = isRecord(payload.preferences) ? payload.preferences : {};

  const request: FoodQuestionPlanRequest = {
    slots: {
      mealPurpose: readString(slots.mealPurpose),
      branchPreference: readString(slots.branchPreference),
      budget: readString(slots.budget),
      distance: readString(slots.distance)
    },
    preferences: {
      tasteTags: readStringArray(preferences.tasteTags),
      needTags: readStringArray(preferences.needTags),
      avoidTags: readStringArray(preferences.avoidTags),
      spicyLevel: readString(preferences.spicyLevel)
    }
  };

  request.decisionSheet = sanitizeFoodDecisionSheet(payload.decisionSheet, request);
  return request;
}

export async function createFoodQuestionPlan(
  request: FoodQuestionPlanRequest,
  options: FoodQuestionPlanOptions = {}
): Promise<FoodQuestionPlanResponse> {
  const baseSheet = buildFoodDecisionSheet(request);

  try {
    const questions = await generateQuestionsWithOpenClaw(request, baseSheet, options);
    const normalizedQuestions = normalizeDynamicQuestions(questions, baseSheet.dynamic);

    if (normalizedQuestions.length) {
      return {
        status: "ready",
        questions: normalizedQuestions,
        decisionSheet: baseSheet,
        source: "openclaw"
      };
    }
  } catch {
    // Dynamic questions are optional. The rule planner keeps the UI moving
    // when OpenClaw is slow, offline, or returns unusable JSON.
  }

  return {
    status: "ready",
    questions: buildRuleQuestions(request, baseSheet),
    decisionSheet: baseSheet,
    source: "rules",
    message: "OpenClaw question plan unavailable; using server rule plan."
  };
}

export function sanitizeFoodDecisionSheet(
  input: unknown,
  request?: Pick<FoodQuestionPlanRequest, "slots" | "preferences">
): FoodDecisionSheet {
  const payload = isRecord(input) ? input : {};
  const fixed = request ? buildFixedDimensions(request) : sanitizeDimensions(payload.fixed, "fixed");
  const dynamic = sanitizeDimensions(payload.dynamic, "dynamic");

  return {
    fixed,
    dynamic,
    readiness: buildReadiness(fixed),
    source: "server"
  };
}

export function buildFoodDecisionSheet(request: FoodQuestionPlanRequest): FoodDecisionSheet {
  const clientDynamic = request.decisionSheet?.dynamic || [];
  const dynamic = sanitizeDimensions(clientDynamic, "dynamic");
  const fixed = buildFixedDimensions(request);

  return {
    fixed,
    dynamic,
    readiness: buildReadiness(fixed),
    source: "server"
  };
}

function buildFixedDimensions(request: Pick<FoodQuestionPlanRequest, "slots" | "preferences">) {
  const slots = request.slots || {};
  const preferences = request.preferences || {};
  const taste = (preferences.tasteTags || []).concat(preferences.needTags || []).join("、");
  const avoid = (preferences.avoidTags || []).join("、");

  return [
    fixedDimension("mealPurpose", "就餐场景", slots.mealPurpose, true),
    fixedDimension("branchPreference", "品类/偏好", slots.branchPreference, false),
    fixedDimension("taste", "口味/感觉", taste, false),
    fixedDimension("avoid", "忌口", avoid, true),
    fixedDimension("spicyLevel", "辣度", preferences.spicyLevel, true),
    fixedDimension("budget", "预算", slots.budget, true),
    fixedDimension("distance", "距离", slots.distance, true)
  ];
}

function fixedDimension(key: string, label: string, value: unknown, hard: boolean): FoodDecisionDimension {
  return {
    key,
    label,
    value: readString(value),
    source: "fixed",
    hard
  };
}

function buildReadiness(fixed: FoodDecisionDimension[]) {
  const missingHardKeys = fixed
    .filter((dimension) => dimension.hard && !dimension.value && dimension.key !== "avoid" && dimension.key !== "spicyLevel")
    .map((dimension) => dimension.key);
  const optionalReadyCount = fixed.filter((dimension) => !dimension.hard && !!dimension.value).length;

  return {
    hardReady: missingHardKeys.length === 0,
    missingHardKeys,
    optionalReadyCount
  };
}

function buildRuleQuestions(request: FoodQuestionPlanRequest, sheet: FoodDecisionSheet) {
  const answeredKeys = new Set(sheet.dynamic.map((dimension) => dimension.key));
  const selected: FoodDynamicQuestion[] = [];
  const text = [
    request.slots.mealPurpose,
    request.slots.branchPreference,
    request.preferences.tasteTags.join(" "),
    request.preferences.needTags.join(" ")
  ].join(" ");

  if (!answeredKeys.has("priority")) {
    selected.push(FALLBACK_QUESTIONS[0]);
  }

  if (!answeredKeys.has("queueTolerance") && /(午餐|晚餐|夜宵|快|近|随便|没想法)/.test(text)) {
    selected.push(FALLBACK_QUESTIONS[1]);
  }

  if (!answeredKeys.has("diningState") && selected.length < 3) {
    selected.push(FALLBACK_QUESTIONS[2]);
  }

  return selected.slice(0, 3);
}

async function generateQuestionsWithOpenClaw(
  request: FoodQuestionPlanRequest,
  sheet: FoodDecisionSheet,
  options: FoodQuestionPlanOptions
): Promise<unknown> {
  if (process.env.OPENCLAW_ENABLE_QUESTION_PLAN === "0") {
    throw new Error("OpenClaw question plan disabled.");
  }

  const prompt = [
    "你是微信小程序「今天吃什么」的点餐管家。",
    "请根据已收集的固定字段，提出 0-3 个最有价值的补充问题，用于完善最终匹配维度表。",
    "只能返回严格 JSON，不要 Markdown，不要解释。",
    "返回 schema:",
    '{"questions":[{"id":"ai-priority","kind":"choice","slot":"dynamic.priority","label":"本次优先级","title":"这顿饭你最想优先满足哪一点？","options":["近一点","便宜一点","快一点"],"optional":true,"allowEmpty":true,"targetDimension":"priority","reason":"用于取舍"}]}',
    "问题必须适合小程序按钮选择，kind 只能是 choice 或 multi-choice。",
    "不要重复已经在 decisionSheet.dynamic 里有答案的 targetDimension。",
    "输入:",
    JSON.stringify({ slots: request.slots, preferences: request.preferences, decisionSheet: sheet }, null, 2)
  ].join("\n");
  const rawContent = await runOpenClawAgentCli(prompt, buildQuestionOpenClawSessionId(request, options));
  const parsed = JSON.parse(extractJsonObject(rawContent));

  return isRecord(parsed) ? parsed.questions : [];
}

function buildQuestionOpenClawSessionId(request: FoodQuestionPlanRequest, options: FoodQuestionPlanOptions) {
  const userPart = options.userId ? `user-${shortHash(options.userId)}` : "anonymous";
  const mealPart = request.slots.mealPurpose || "unknown-scene";
  return buildScopedOpenClawSessionId(
    "meituan-food-questions",
    ["questions", userPart, mealPart, buildOpenClawRequestScope(request)],
    { envPrefixes: ["OPENCLAW_QUESTION_SESSION_ID"] }
  );
}

function normalizeDynamicQuestions(input: unknown, existingDimensions: FoodDecisionDimension[]) {
  const existingKeys = new Set(existingDimensions.map((dimension) => dimension.key));
  const rawQuestions = Array.isArray(input) ? input : [];
  const result: FoodDynamicQuestion[] = [];

  rawQuestions.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const targetDimension = normalizeKey(readString(item.targetDimension) || readString(item.slot).replace(/^dynamic\./, ""));
    const options = readStringArray(item.options).slice(0, 6);

    if (!targetDimension || existingKeys.has(targetDimension) || options.length < 2) {
      return;
    }

    result.push({
      id: normalizeQuestionId(readString(item.id), targetDimension, index),
      kind: readString(item.kind) === "multi-choice" ? "multi-choice" : "choice",
      slot: `dynamic.${targetDimension}`,
      label: readString(item.label).slice(0, 12) || "补充偏好",
      title: readString(item.title).slice(0, 48) || "再补充一个偏好？",
      options,
      optional: item.optional !== false,
      allowEmpty: item.allowEmpty !== false,
      targetDimension,
      reason: readString(item.reason).slice(0, 80)
    });
  });

  return dedupeQuestions(result).slice(0, 3);
}

function sanitizeDimensions(input: unknown, source: "fixed" | "dynamic") {
  const rawDimensions = Array.isArray(input) ? input : [];
  const dimensions: FoodDecisionDimension[] = [];

  rawDimensions.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const key = normalizeKey(readString(item.key));
    const value = readString(item.value);

    if (!key || !value) {
      return;
    }

    dimensions.push({
      key,
      label: readString(item.label).slice(0, 16) || key,
      value: value.slice(0, 80),
      source,
      hard: item.hard === true,
      reason: readString(item.reason).slice(0, 80)
    });
  });

  return dedupeDimensions(dimensions);
}

function dedupeDimensions(dimensions: FoodDecisionDimension[]) {
  const seen = new Set<string>();
  const result: FoodDecisionDimension[] = [];

  dimensions.forEach((dimension) => {
    if (seen.has(dimension.key)) {
      return;
    }

    seen.add(dimension.key);
    result.push(dimension);
  });

  return result.slice(0, 8);
}

function dedupeQuestions(questions: FoodDynamicQuestion[]) {
  const seen = new Set<string>();
  const result: FoodDynamicQuestion[] = [];

  questions.forEach((question) => {
    if (seen.has(question.targetDimension)) {
      return;
    }

    seen.add(question.targetDimension);
    result.push(question);
  });

  return result;
}

function normalizeQuestionId(id: string, targetDimension: string, index: number) {
  const normalized = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return normalized || `ai-${targetDimension || index + 1}`;
}

function normalizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

function runOpenClawAgentCli(content: string, sessionId: string): Promise<string> {
  const timeoutMs = readNumberEnv("OPENCLAW_QUESTION_TIMEOUT_MS", DEFAULT_QUESTION_TIMEOUT_MS);
  const maxResponseChars = readNumberEnv("OPENCLAW_MAX_RESPONSE_CHARS", DEFAULT_MAX_RESPONSE_CHARS);
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || "openclaw";
  const profile = process.env.OPENCLAW_PROFILE?.trim() || "default";
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
        env: process.env
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(extractCliPayloadText(stdout).slice(0, maxResponseChars));
      }
    );
  });
}

function extractCliPayloadText(stdout: string) {
  const parsed = JSON.parse(stdout);
  const payloads = isRecord(parsed) && isRecord(parsed.result) && Array.isArray(parsed.result.payloads)
    ? parsed.result.payloads
    : [];
  const text = payloads
    .map((payload) => isRecord(payload) ? readString(payload.text) : "")
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("OpenClaw CLI returned no text payload.");
  }

  return text;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("OpenClaw question response did not contain JSON.");
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readString).filter(Boolean);
}

function isRecord(value: unknown): value is StringMap {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
