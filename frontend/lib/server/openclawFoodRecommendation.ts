import { execFile } from "node:child_process";
import type { FoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import { sanitizeFoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import { buildOpenClawRequestScope, buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";

type StringMap = Record<string, unknown>;

export type FoodRecommendationCard = {
  id: string;
  name: string;
  type: string;
  perCapita: string;
  distance: string;
  rating: number;
  matchedTags: string[];
  matchedTagsText: string;
  reason: string;
  riskTip: string;
  source: "openclaw";
};

export type FoodRecommendRequest = {
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
  memoryProfile?: {
    enabled?: boolean;
    stableFoodPreferences?: {
      avoidTags?: string[];
      spicyLevel?: string;
      source?: string;
    };
    permissions?: Record<string, boolean>;
  };
  requestContext?: {
    excludeIds?: string[];
    batchIndex?: number;
    adjustment?: {
      types?: string[];
      avoidCategories?: string[];
    };
  };
  decisionSheet?: FoodDecisionSheet;
};

export type FoodRecommendResponse = {
  recommendations: FoodRecommendationCard[];
  source: "openclaw";
};

type OpenClawFoodOptions = {
  userId?: string;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RESPONSE_CHARS = 12000;

export function sanitizeFoodRecommendRequest(input: unknown): FoodRecommendRequest {
  const payload = isRecord(input) ? input : {};
  const slots = isRecord(payload.slots) ? payload.slots : {};
  const preferences = isRecord(payload.preferences) ? payload.preferences : {};
  const memoryProfile = isRecord(payload.memoryProfile) ? payload.memoryProfile : {};
  const requestContext = isRecord(payload.requestContext) ? payload.requestContext : {};
  const permissions = isRecord(memoryProfile.permissions) ? memoryProfile.permissions : {};
  const behaviorEnabled = permissions.behaviorLearningEnabled !== false;
  const canUseTaste = behaviorEnabled && permissions.rememberTastePattern !== false;
  const canUseBudget = behaviorEnabled && permissions.rememberBudgetByMeal !== false;
  const canUseCategory = behaviorEnabled && permissions.rememberCommonCategories !== false;
  const canUseDistance = behaviorEnabled && permissions.rememberDistancePreference !== false;
  const stableFoodPreferences = isRecord(memoryProfile.stableFoodPreferences)
    ? memoryProfile.stableFoodPreferences
    : {};
  const stableMemoryEnabled = memoryProfile.enabled !== false;

  const sanitized: FoodRecommendRequest = {
    slots: {
      mealPurpose: readString(slots.mealPurpose),
      branchPreference: canUseCategory ? readString(slots.branchPreference) : "",
      budget: canUseBudget ? readString(slots.budget) : "",
      distance: canUseDistance ? readString(slots.distance) : ""
    },
    preferences: {
      tasteTags: canUseTaste ? readStringArray(preferences.tasteTags) : [],
      needTags: canUseTaste ? readStringArray(preferences.needTags) : [],
      avoidTags: readStringArray(preferences.avoidTags),
      spicyLevel: readString(preferences.spicyLevel)
    },
    memoryProfile: stableMemoryEnabled
      ? {
          enabled: true,
          stableFoodPreferences: {
            avoidTags: readStringArray(stableFoodPreferences.avoidTags),
            spicyLevel: readString(stableFoodPreferences.spicyLevel),
            source: readString(stableFoodPreferences.source)
          },
          permissions: normalizePermissions(permissions)
        }
      : {
          enabled: false,
          permissions: normalizePermissions(permissions)
        },
    requestContext: sanitizeRequestContext(requestContext)
  };

  sanitized.decisionSheet = sanitizeFoodDecisionSheet(payload.decisionSheet, sanitized);
  return sanitized;
}

export async function generateFoodRecommendationsWithOpenClaw(
  request: FoodRecommendRequest,
  options: OpenClawFoodOptions = {}
): Promise<FoodRecommendResponse> {
  const prompt = buildFoodRecommendationPrompt(request);
  const rawContent = await runOpenClawAgentCli(prompt, buildFoodOpenClawSessionId(request, options));
  const parsed = parseOpenClawRecommendation(rawContent);
  const recommendations = normalizeRecommendations(parsed);

  assertNoHardConstraintViolation(recommendations, request.preferences);

  return {
    recommendations,
    source: "openclaw"
  };
}

function buildFoodOpenClawSessionId(request: FoodRecommendRequest, options: OpenClawFoodOptions) {
  const userPart = options.userId ? `user-${shortHash(options.userId)}` : "anonymous";
  const mealPart = request.slots.mealPurpose || "unknown-scene";
  return buildScopedOpenClawSessionId("meituan-food", ["food", userPart, mealPart, buildOpenClawRequestScope(request)]);
}

function buildFoodRecommendationPrompt(request: FoodRecommendRequest) {
  const promptPayload = buildOpenClawPromptPayload(request);

  return [
    "You are the recommendation engine for a WeChat mini-program food flow.",
    "Generate 2-3 actionable single-person meal recommendations.",
    "Return ONLY strict JSON. Do not wrap it in Markdown. Do not include explanations outside JSON.",
    "The JSON schema is:",
    '{"recommendations":[{"id":"shop_xxx","name":"...","type":"...","perCapita":"24 yuan/person","distance":"500 m","rating":4.6,"matchedTags":["..."],"reason":"...","riskTip":"..."}],"source":"openclaw"}',
    "Use Chinese copy for shop names, type, reason, and riskTip when possible.",
    "Treat decisionSheet as the final matching table: fixed dimensions are the stable required profile, dynamic dimensions are the user's extra AI-guided constraints.",
    "If dynamic dimensions are present, reference them in matchedTags/reason/riskTip when they affect the choice.",
    "Hard constraints are mandatory. If avoidTags or spicyLevel say no spicy, do not recommend spicy, hotpot, mala, Sichuan, Hunan, skewer, or similar high-spice shops.",
    "Do not infer or expose private data that is not present in the payload.",
    "Payload:",
    JSON.stringify(promptPayload, null, 2)
  ].join("\n");
}

function buildOpenClawPromptPayload(request: FoodRecommendRequest) {
  const slots = omitEmptyValues(request.slots);
  const preferences = omitEmptyValues({
    tasteTags: request.preferences.tasteTags,
    needTags: request.preferences.needTags,
    avoidTags: request.preferences.avoidTags,
    spicyLevel: request.preferences.spicyLevel
  });
  const adjustment = omitEmptyValues({
    types: request.requestContext?.adjustment?.types,
    avoidCategories: request.requestContext?.adjustment?.avoidCategories
  });
  const memoryProfile = request.memoryProfile?.enabled
    ? {
        enabled: true,
        stableFoodPreferences: omitEmptyValues({
          avoidTags: request.memoryProfile.stableFoodPreferences?.avoidTags,
          spicyLevel: request.memoryProfile.stableFoodPreferences?.spicyLevel,
          source: request.memoryProfile.stableFoodPreferences?.source
        }),
        permissions: request.memoryProfile.permissions || {}
      }
    : {
        enabled: false,
        permissions: request.memoryProfile?.permissions || {}
      };

  return {
    slots,
    preferences,
    decisionSheet: request.decisionSheet,
    memoryProfile,
    requestContext: omitEmptyValues({
      excludeIds: request.requestContext?.excludeIds,
      batchIndex: request.requestContext?.batchIndex,
      adjustment: Object.keys(adjustment).length ? adjustment : undefined
    })
  };
}

function runOpenClawAgentCli(content: string, sessionId: string): Promise<string> {
  const timeoutMs = readNumberEnv("OPENCLAW_GATEWAY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxResponseChars = readNumberEnv("OPENCLAW_MAX_RESPONSE_CHARS", DEFAULT_MAX_RESPONSE_CHARS);
  const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || "/home/nightt/.npm-global/bin/openclaw";
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
        env: process.env
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(buildCliErrorMessage(error, stderr)));
          return;
        }

        try {
          resolve(extractCliPayloadText(stdout).slice(0, maxResponseChars));
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error(String(parseError)));
        }
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

function buildCliErrorMessage(error: Error & { code?: unknown; signal?: unknown; killed?: boolean }, stderr: string) {
  const stderrSummary = summarizeCliStderr(stderr);
  const timeoutSuffix = error.killed || error.signal === "SIGTERM"
    ? ` OpenClaw CLI timed out after ${readNumberEnv("OPENCLAW_GATEWAY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)}ms.`
    : "";
  const codeText = error.code ? ` code=${String(error.code)}` : "";
  const signalText = error.signal ? ` signal=${String(error.signal)}` : "";

  return `OpenClaw CLI failed${codeText}${signalText}.${timeoutSuffix}${stderrSummary ? ` stderr: ${stderrSummary}` : ""}`;
}

function summarizeCliStderr(stderr: string) {
  return stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Config warnings?:/i.test(line))
    .slice(-6)
    .join(" | ")
    .slice(0, 1200);
}

function parseOpenClawRecommendation(rawContent: string): unknown {
  const jsonText = extractJsonObject(rawContent);

  if (!jsonText) {
    throw new Error("OpenClaw response did not contain a JSON object.");
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`OpenClaw response JSON parse failed: ${(error as Error).message}`);
  }
}

function normalizeRecommendations(input: unknown): FoodRecommendationCard[] {
  const payload = isRecord(input) ? input : {};
  const rawRecommendations = readRecommendationArray(payload);
  const recommendations = rawRecommendations.slice(0, 3).map((item, index) => {
    const raw = isRecord(item) ? item : {};
    const matchedTags = readStringArrayFrom(raw, ["matchedTags", "matched_tags", "tags", "labels"]);
    const name = readStringFrom(raw, ["name", "shopName", "shop_name", "restaurantName", "restaurant_name", "title"]);
    const type = readStringFrom(raw, ["type", "category", "cuisine", "shopType", "shop_type"]);
    const perCapita = readStringFrom(raw, [
      "perCapita",
      "per_capita",
      "price",
      "priceText",
      "price_text",
      "avgPrice",
      "avg_price",
      "averagePrice",
      "average_price"
    ]);
    const distance = readStringFrom(raw, ["distance", "distanceText", "distance_text"]);
    const reason = readStringFrom(raw, ["reason", "rationale", "why", "recommendReason", "recommend_reason"]);
    const riskTip = readStringFrom(raw, ["riskTip", "risk_tip", "risk", "tips", "tip", "note"]);

    return {
      id: readStringFrom(raw, ["id", "shopId", "shop_id", "restaurantId", "restaurant_id"]) || `openclaw_${index + 1}`,
      name,
      type: type || "餐饮推荐",
      perCapita: perCapita || "预算需确认",
      distance: distance || "距离需确认",
      rating: readNumberFrom(raw, ["rating", "score", "stars"], 0),
      matchedTags,
      matchedTagsText: matchedTags.length ? matchedTags.join("、") : "OpenClaw recommendation",
      reason: reason || "OpenClaw 已根据当前偏好生成该推荐。",
      riskTip: riskTip || "下单前建议再确认营业状态、排队情况和口味备注。",
      source: "openclaw" as const
    };
  });

  const valid = recommendations.filter((item) => {
    return item.name;
  });

  if (valid.length < 2) {
    throw new Error("OpenClaw returned fewer than 2 valid recommendations.");
  }

  return valid;
}

function readRecommendationArray(payload: StringMap) {
  const directKeys = ["recommendations", "items", "shops", "restaurants", "candidates"];

  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const nestedResult = payload.result;
  if (isRecord(nestedResult)) {
    for (const key of directKeys) {
      const value = nestedResult[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function readStringFrom(source: StringMap, keys: string[]) {
  for (const key of keys) {
    const value = readString(source[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function readStringArrayFrom(source: StringMap, keys: string[]) {
  for (const key of keys) {
    const value = readStringArray(source[key]);
    if (value.length) {
      return value;
    }
  }

  return [];
}

function readNumberFrom(source: StringMap, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = readNumber(source[key], Number.NaN);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function assertNoHardConstraintViolation(
  recommendations: FoodRecommendationCard[],
  preferences: FoodRecommendRequest["preferences"]
) {
  const noSpicy = isNoSpicyPreference(preferences);

  if (!noSpicy) {
    return;
  }

  const spicyPattern = /(麻辣|香辣|重辣|中辣|辣店|川菜|湘菜|火锅|冒菜|串串|spicy|mala|hotpot)/i;
  const nonSpicyPattern = /(不辣|无辣|少辣|non.?spicy|no.?spicy)/i;
  const violating = recommendations.find((item) => {
    const text = [
      item.name,
      item.type,
      item.reason,
      item.riskTip,
      item.matchedTags.join(" ")
    ].join(" ");
    return spicyPattern.test(text) && !nonSpicyPattern.test(text);
  });

  if (violating) {
    throw new Error(`OpenClaw recommendation violates no-spicy constraint: ${violating.name}`);
  }
}

function isNoSpicyPreference(preferences: FoodRecommendRequest["preferences"]) {
  const text = [preferences.spicyLevel].concat(preferences.avoidTags || []).join(" ");
  return /(不吃辣|不要辣|忌辣|no.?spicy|non.?spicy)/i.test(text);
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith("{") && fenced.endsWith("}")) {
      return fenced;
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return "";
}

function getNested(source: StringMap, pathParts: string[]) {
  let current: unknown = source;

  for (const part of pathParts) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readString).filter(Boolean);
}

function sanitizeRequestContext(input: StringMap): FoodRecommendRequest["requestContext"] {
  const adjustment = isRecord(input.adjustment) ? input.adjustment : {};
  const batchIndex = readNumber(input.batchIndex, 0);
  const result: NonNullable<FoodRecommendRequest["requestContext"]> = {
    excludeIds: readStringArray(input.excludeIds),
    adjustment: {
      types: readStringArray(adjustment.types),
      avoidCategories: readStringArray(adjustment.avoidCategories)
    }
  };

  if (batchIndex > 0) {
    result.batchIndex = batchIndex;
  }

  return result;
}

function omitEmptyValues<T extends Record<string, unknown>>(input: T) {
  const result: Record<string, unknown> = {};

  Object.keys(input).forEach((key) => {
    const value = input[key];

    if (value === "" || value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    if (isRecord(value) && Object.keys(value).length === 0) {
      return;
    }

    result[key] = value;
  });

  return result;
}

function normalizePermissions(input: StringMap) {
  const result: Record<string, boolean> = {};

  Object.keys(input).forEach((key) => {
    if (typeof input[key] === "boolean") {
      result[key] = input[key];
    }
  });

  return result;
}

function isRecord(value: unknown): value is StringMap {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
