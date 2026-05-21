import WebSocket from "ws";

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
};

export type FoodRecommendResponse = {
  recommendations: FoodRecommendationCard[];
  source: "openclaw";
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

  return {
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
}

export async function generateFoodRecommendationsWithOpenClaw(
  request: FoodRecommendRequest
): Promise<FoodRecommendResponse> {
  const gatewayUrl = readRequiredEnv("OPENCLAW_GATEWAY_URL");
  const gatewayToken = readRequiredEnv("OPENCLAW_GATEWAY_TOKEN");
  const prompt = buildFoodRecommendationPrompt(request);
  const rawContent = await sendOpenClawChat(gatewayUrl, gatewayToken, prompt);
  const parsed = parseOpenClawRecommendation(rawContent);
  const recommendations = normalizeRecommendations(parsed);

  assertNoHardConstraintViolation(recommendations, request.preferences);

  return {
    recommendations,
    source: "openclaw"
  };
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
    memoryProfile,
    requestContext: omitEmptyValues({
      excludeIds: request.requestContext?.excludeIds,
      batchIndex: request.requestContext?.batchIndex,
      adjustment: Object.keys(adjustment).length ? adjustment : undefined
    })
  };
}

function sendOpenClawChat(gatewayUrl: string, gatewayToken: string, content: string): Promise<string> {
  const timeoutMs = readNumberEnv("OPENCLAW_GATEWAY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxResponseChars = readNumberEnv("OPENCLAW_MAX_RESPONSE_CHARS", DEFAULT_MAX_RESPONSE_CHARS);
  const requestId = `food-recommend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const wsUrl = normalizeGatewayUrl(gatewayUrl);
  const sessionId = process.env.OPENCLAW_CHAT_SESSION_ID?.trim();
  const sessionKey = process.env.OPENCLAW_CHAT_SESSION_KEY?.trim();
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim();

  return new Promise((resolve, reject) => {
    let settled = false;
    let accumulated = "";
    const socket = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${gatewayToken}`
      }
    });
    const timer = setTimeout(() => {
      finish(new Error(`OpenClaw Gateway timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    function finish(error?: Error, value?: string) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      try {
        socket.close();
      } catch {
        // ignore close errors
      }

      if (error) {
        reject(error);
      } else {
        resolve((value || accumulated).slice(0, maxResponseChars));
      }
    }

    socket.on("open", () => {
      const message: StringMap = {
        type: "chat.send",
        id: requestId,
        content,
        metadata: {
          source: "meituan-mini-program",
          stream: true,
          expect: "food-recommendation-json"
        },
        senderId: process.env.OPENCLAW_SENDER_ID?.trim() || "meituan-food-backend",
        senderName: process.env.OPENCLAW_SENDER_NAME?.trim() || "Meituan Food Backend"
      };

      if (sessionId) {
        message.sessionId = sessionId;
      }

      if (sessionKey) {
        message.sessionKey = sessionKey;
      }

      if (agentId) {
        message.agent = agentId;
      }

      socket.send(JSON.stringify(message));
    });

    socket.on("message", (raw) => {
      const event = parseGatewayEvent(raw.toString());
      const eventType = readString(event.type || event.event || event.method);
      const text = extractEventText(event);

      if (isNonChatEvent(eventType)) {
        return;
      }

      if (isGatewayError(event)) {
        finish(new Error(extractGatewayErrorMessage(event)));
        return;
      }

      if (text && isUserEcho(event, text, content)) {
        return;
      }

      if (text) {
        if (isDeltaEvent(eventType)) {
          accumulated += text;
        } else if (looksLikeFoodRecommendationJson(text)) {
          finish(undefined, text);
          return;
        } else if (!accumulated) {
          accumulated = text;
        }
      }

      if (isFinalEvent(eventType)) {
        finish(undefined, text || accumulated);
      }
    });

    socket.on("error", (error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });

    socket.on("close", () => {
      if (!settled && accumulated) {
        finish(undefined, accumulated);
      } else if (!settled) {
        finish(new Error("OpenClaw Gateway closed without a response."));
      }
    });
  });
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
  const rawRecommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  const recommendations = rawRecommendations.slice(0, 3).map((item, index) => {
    const raw = isRecord(item) ? item : {};
    const matchedTags = readStringArray(raw.matchedTags);

    return {
      id: readString(raw.id) || `openclaw_${index + 1}`,
      name: readString(raw.name),
      type: readString(raw.type || raw.category),
      perCapita: readString(raw.perCapita || raw.price),
      distance: readString(raw.distance || raw.distanceText),
      rating: readNumber(raw.rating, 0),
      matchedTags,
      matchedTagsText: matchedTags.length ? matchedTags.join("、") : "OpenClaw recommendation",
      reason: readString(raw.reason),
      riskTip: readString(raw.riskTip || raw.risk),
      source: "openclaw" as const
    };
  });

  const valid = recommendations.filter((item) => {
    return item.name && item.type && item.perCapita && item.distance && item.reason && item.riskTip;
  });

  if (valid.length < 2) {
    throw new Error("OpenClaw returned fewer than 2 valid recommendations.");
  }

  return valid;
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

function parseGatewayEvent(raw: string): StringMap {
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : { content: raw };
  } catch {
    return { content: raw };
  }
}

function extractEventText(event: StringMap): string {
  const candidates = [
    event.content,
    event.delta,
    event.text,
    event.message,
    getNested(event, ["data", "content"]),
    getNested(event, ["data", "delta"]),
    getNested(event, ["data", "text"]),
    getNested(event, ["payload", "content"]),
    getNested(event, ["payload", "delta"]),
    getNested(event, ["payload", "text"]),
    getNested(event, ["result", "content"]),
    getNested(event, ["result", "delta"]),
    getNested(event, ["result", "text"]),
    getNested(event, ["result", "message", "content"])
  ];

  for (const candidate of candidates) {
    const text = readMessageContent(candidate);
    if (text) {
      return text;
    }
  }

  return "";
}

function readMessageContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(readMessageContent).filter(Boolean).join("");
  }

  if (isRecord(value)) {
    return readMessageContent(value.text || value.content || value.value);
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

function isDeltaEvent(eventType: string) {
  return /delta|chunk|partial/i.test(eventType);
}

function isNonChatEvent(eventType: string) {
  return /history|presence|health|tick|ready|ack/i.test(eventType);
}

function isFinalEvent(eventType: string) {
  return /final|complete|completed|done|message|assistant/i.test(eventType);
}

function isGatewayError(event: StringMap) {
  const eventType = readString(event.type || event.event || event.method);
  return /error/i.test(eventType) || !!event.error;
}

function isUserEcho(event: StringMap, text: string, prompt: string) {
  const role = readString(
    event.role ||
    getNested(event, ["data", "role"]) ||
    getNested(event, ["payload", "role"]) ||
    getNested(event, ["result", "role"])
  );

  return role === "user" || text === prompt || text.startsWith("You are the recommendation engine");
}

function extractGatewayErrorMessage(event: StringMap) {
  return readString(event.error) ||
    readString(getNested(event, ["error", "message"])) ||
    readString(getNested(event, ["data", "error"])) ||
    "OpenClaw Gateway returned an error.";
}

function looksLikeFoodRecommendationJson(text: string) {
  return text.indexOf('"recommendations"') >= 0 && text.indexOf("{") >= 0 && text.indexOf("}") >= 0;
}

function normalizeGatewayUrl(url: string) {
  const trimmed = url.trim();

  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }

  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }

  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }

  return trimmed;
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
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
