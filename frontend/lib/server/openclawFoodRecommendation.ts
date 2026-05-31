import { execFile } from "node:child_process";
import type { FoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import { sanitizeFoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import type { OpenClawDataContext } from "@/lib/server/openclawDataFeed";
import { buildOpenClawRequestScope, buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";
import { loadRestaurantData } from "@/lib/restaurantData/loadData";
import { distanceKm } from "@/lib/restaurantData/geo";
import type { GeoPoint, Region, RestaurantSource, RestaurantDataSet, SceneFit, Shop, ShopFeature } from "@/lib/restaurantData/types";

type StringMap = Record<string, unknown>;

export type FoodRecommendationCard = {
  id: string;
  name: string;
  type: string;
  perCapita: string;
  distance: string;
  distanceMeters?: number;
  walkMinutes?: number;
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
  diagnostics: FoodOpenClawDiagnostics;
};

export type FoodOpenClawDiagnostics = {
  localCandidateMs: number;
  inputMode: "compact-json";
  payloadChars: number;
  promptChars: number;
  candidateCount: number;
  cliMs: number;
  responseChars: number;
  parseMs: number;
  normalizeMs: number;
  outputMode: "selected" | "legacy";
  selectedCount: number;
};

type OpenClawFoodOptions = {
  userId?: string;
  context?: OpenClawDataContext;
};

type HardFoodFilterPolicy = {
  budgetMax?: number;
  noSpicy: boolean;
  avoidTerms: string[];
  avoidCategories: string[];
};

const DEFAULT_TIMEOUT_MS = 130_000;
const DEFAULT_MAX_RESPONSE_CHARS = 4000;
const DEFAULT_CANDIDATE_LIMIT = 12;

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
  const localCandidateStartedAt = Date.now();
  const localCandidates = await buildLocalFoodCandidates(request);
  const localCandidateMs = Date.now() - localCandidateStartedAt;
  const prompt = buildFoodRecommendationPrompt(request, options.context, localCandidates);
  const payloadChars = prompt.payload.length;
  const cliStartedAt = Date.now();
  const rawContent = await runOpenClawAgentCli(prompt.content, buildFoodOpenClawSessionId(request, options));
  const cliMs = Date.now() - cliStartedAt;
  const parseStartedAt = Date.now();
  const parsed = parseOpenClawRecommendation(rawContent);
  const parseMs = Date.now() - parseStartedAt;
  const normalizeStartedAt = Date.now();
  const normalized = normalizeRecommendations(parsed, localCandidates);
  const normalizeMs = Date.now() - normalizeStartedAt;

  assertNoHardConstraintViolation(normalized.recommendations, request.preferences);

  return {
    recommendations: normalized.recommendations,
    source: "openclaw",
    diagnostics: {
      localCandidateMs,
      inputMode: "compact-json",
      payloadChars,
      promptChars: prompt.content.length,
      candidateCount: localCandidates.length,
      cliMs,
      responseChars: rawContent.length,
      parseMs,
      normalizeMs,
      outputMode: normalized.outputMode,
      selectedCount: normalized.recommendations.length
    }
  };
}

function buildFoodOpenClawSessionId(request: FoodRecommendRequest, options: OpenClawFoodOptions) {
  const userPart = options.userId ? `user-${shortHash(options.userId)}` : "anonymous";
  const mealPart = request.slots.mealPurpose || "unknown-scene";
  return buildScopedOpenClawSessionId("meituan-food", ["food", userPart, mealPart, buildOpenClawRequestScope(request)]);
}

function buildFoodRecommendationPrompt(
  request: FoodRecommendRequest,
  context: OpenClawDataContext | undefined,
  localCandidates: FoodRecommendationCard[]
) {
  const promptPayload = buildOpenClawPromptPayload(request, context, localCandidates);
  const payload = JSON.stringify(promptPayload);

  return {
    payload,
    content: [
      "Task: choose 2-3 food shops from decisionPayload.candidates.",
      "AI owns the final selection. The server only prepared a compact, non-ranked candidate catalog.",
      "Candidate order is NOT a recommendation ranking. Decide from constraints and candidate facts.",
      "Hard constraints in decisionPayload.constraints are mandatory; avoid spicy/high-spice shops when no-spicy is requested.",
      "Use exact candidate ids only. Do not invent shops. Backend fills display fields.",
      "Return exactly one JSON object that JSON.parse can parse.",
      "Do not wrap the JSON in markdown fences. Do not add explanations, comments, bullets, or trailing commas.",
      "Every selected item must be separated by a comma. Escape any double quote inside string values.",
      "Schema: {\"selected\":[{\"id\":\"candidate_id\",\"why\":\"short_reason\",\"tip\":\"short_risk_tip\",\"tags\":[\"short_tag\"]}]}",
      `decisionPayload=${payload}`
    ].join("\n")
  };
}

function buildOpenClawPromptPayload(
  request: FoodRecommendRequest,
  context: OpenClawDataContext | undefined,
  localCandidates: FoodRecommendationCard[]
) {
  const adjustment = omitEmptyValues({
    types: request.requestContext?.adjustment?.types,
    avoidCategories: request.requestContext?.adjustment?.avoidCategories
  });

  return omitEmptyValues({
    task: "select_food_recommendations",
    traceId: context?.traceId,
    constraints: buildCompactConstraints(request),
    candidates: localCandidates.map(toCompactDecisionCandidate),
    requestContext: omitEmptyValues({
      excludeIds: request.requestContext?.excludeIds,
      batchIndex: request.requestContext?.batchIndex,
      adjustment: Object.keys(adjustment).length ? adjustment : undefined
    }),
    output: {
      selected: "2-3 candidate ids with short Chinese why, tip and up to 2 tags"
    }
  });
}

function buildCompactConstraints(request: FoodRecommendRequest) {
  const stableFoodPreferences = request.memoryProfile?.stableFoodPreferences;
  const dynamicDimensions = compactDecisionDimensions(request.decisionSheet?.dynamic ?? []);

  return omitEmptyValues({
    scene: request.slots.mealPurpose,
    categoryPreference: request.slots.branchPreference,
    budget: request.slots.budget,
    distance: request.slots.distance,
    tasteTags: request.preferences.tasteTags,
    needTags: request.preferences.needTags,
    avoidTags: uniqueStrings([
      ...request.preferences.avoidTags,
      ...(stableFoodPreferences?.avoidTags ?? [])
    ]),
    spicyLevel: request.preferences.spicyLevel || stableFoodPreferences?.spicyLevel,
    memory: request.memoryProfile?.enabled
      ? omitEmptyValues({
          avoidTags: stableFoodPreferences?.avoidTags,
          spicyLevel: stableFoodPreferences?.spicyLevel
        })
      : undefined,
    dynamic: dynamicDimensions.length ? dynamicDimensions : undefined
  });
}

function compactDecisionDimensions(dimensions: NonNullable<FoodDecisionSheet["dynamic"]>) {
  return dimensions
    .map((dimension) => omitEmptyValues({
      key: dimension.key,
      value: dimension.value,
      hard: dimension.hard === true ? true : undefined
    }))
    .filter((dimension) => Object.keys(dimension).length > 1);
}

function toCompactDecisionCandidate(candidate: FoodRecommendationCard) {
  return omitEmptyValues({
    id: candidate.id,
    name: candidate.name,
    category: candidate.type,
    priceYuan: readNumberFromText(candidate.perCapita),
    distanceMeters: candidate.distanceMeters,
    walkMinutes: candidate.walkMinutes,
    rating: candidate.rating > 0 ? Number(candidate.rating.toFixed(1)) : undefined,
    tags: candidate.matchedTags.slice(0, 3),
    signal: splitCompactText(candidate.reason, 1)[0],
    risk: splitCompactText(candidate.riskTip, 1)[0]
  });
}

function splitCompactText(value: string, limit: number) {
  return value
    .split(/[；;。]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function readNumberFromText(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

async function buildLocalFoodCandidates(request: FoodRecommendRequest): Promise<FoodRecommendationCard[]> {
  const limit = readNumberEnv("OPENCLAW_FOOD_CANDIDATE_LIMIT", DEFAULT_CANDIDATE_LIMIT);
  const data = await loadRestaurantData();
  const excludedIds = new Set(request.requestContext?.excludeIds ?? []);
  const hardFilter = buildHardFoodFilterPolicy(request);
  const candidates = buildDiverseAiCatalog(data, limit, excludedIds, hardFilter).map((shop) => {
    return toFoodCandidateCard(shop, data.featuresByShopId.get(shop.id), data.sceneFitByShopId.get(shop.id), data.regions);
  });

  if (candidates.length < 2) {
    throw new Error("Local restaurant candidate pool returned fewer than 2 shops.");
  }

  return candidates;
}

function buildDiverseAiCatalog(
  data: RestaurantDataSet,
  limit: number,
  excludedIds: Set<string>,
  hardFilter: HardFoodFilterPolicy
) {
  // Keep this catalog non-ranked: hard filters remove impossible options, OpenClaw owns final selection and ranking.
  const sourceOrder: RestaurantSource[] = ["manual_sample", "manual_public_curated", "synthetic_mvp"];
  const allowedShops = data.shops.filter((shop) => {
    return !excludedIds.has(shop.id) && isHardFoodCandidateAllowed(shop, data, hardFilter);
  });
  const fallbackShops = data.shops.filter((shop) => !excludedIds.has(shop.id));
  const pool = allowedShops.length >= 2 ? allowedShops : fallbackShops;
  const bySource = sourceOrder.flatMap((source) => pool.filter((shop) => shop.source === source));
  const remaining = pool.filter((shop) => !sourceOrder.includes(shop.source));
  const ordered = [...bySource, ...remaining];

  return roundRobinByCategory(ordered).slice(0, Math.max(2, limit));
}

function buildHardFoodFilterPolicy(request: FoodRecommendRequest): HardFoodFilterPolicy {
  const stableFoodPreferences = request.memoryProfile?.stableFoodPreferences;
  const adjustment = request.requestContext?.adjustment;
  const rawAvoidTerms = uniqueStrings([
    ...request.preferences.avoidTags,
    ...(stableFoodPreferences?.avoidTags ?? [])
  ]);
  const spicyText = [
    request.preferences.spicyLevel,
    stableFoodPreferences?.spicyLevel,
    ...rawAvoidTerms
  ].join(" ");

  return {
    budgetMax: extractBudgetMax(request.slots.budget),
    noSpicy: /(不吃辣|不要辣|忌辣|不能吃辣|无辣|no.?spicy|non.?spicy)/i.test(spicyText),
    avoidTerms: rawAvoidTerms.filter((term) => {
      return term.length >= 2 && !/(不吃辣|不要辣|忌辣|不能吃辣|无辣|辣度)/i.test(term);
    }),
    avoidCategories: uniqueStrings([
      ...(adjustment?.avoidCategories ?? []),
      ...(adjustment?.types ?? []).filter((item) => /^不想|^不要|^避开/.test(item))
    ])
  };
}

function isHardFoodCandidateAllowed(shop: Shop, data: RestaurantDataSet, hardFilter: HardFoodFilterPolicy) {
  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const text = buildFoodCandidateSearchText(shop, features, dishes);

  if (hardFilter.budgetMax && shop.avgPrice !== null && shop.avgPrice > hardFilter.budgetMax + budgetTolerance(hardFilter.budgetMax)) {
    return false;
  }

  if (hardFilter.noSpicy && isClearlySpicyCandidate(text, features)) {
    return false;
  }

  if (hardFilter.avoidCategories.some((term) => candidateTextIncludes(text, term))) {
    return false;
  }

  if (hardFilter.avoidTerms.some((term) => candidateTextIncludes(text, term))) {
    return false;
  }

  return true;
}

function buildFoodCandidateSearchText(shop: Shop, features: ShopFeature | undefined, dishes: Array<{ name: string; category: string; tags: string[] }>) {
  return [
    shop.name,
    shop.category,
    ...(shop.cuisines ?? []),
    ...shop.tags,
    ...(features?.featureTags ?? []),
    ...(features?.tasteTags ?? []),
    ...(features?.sceneTags ?? []),
    ...(features?.avoidTags ?? []),
    ...dishes.flatMap((dish) => [dish.name, dish.category, ...dish.tags])
  ].join(" ").toLowerCase();
}

function isClearlySpicyCandidate(text: string, features?: ShopFeature) {
  if (features?.supportsNonSpicy === false) {
    return true;
  }

  const nonSpicyAvailable = /(不辣可选|不辣|无辣|清淡|non_spicy|non-spicy|no spicy)/i.test(text);
  const highSpice = /(麻辣|香辣|重辣|中辣|川菜|湘菜|火锅|冒菜|串串|烤鱼|酸辣粉|螺蛳粉|mala|hotpot|sichuan|hunan)/i.test(text);

  return highSpice && !nonSpicyAvailable;
}

function candidateTextIncludes(text: string, term: string) {
  return text.includes(term.trim().toLowerCase());
}

function budgetTolerance(budgetMax: number) {
  return Math.max(6, Math.round(budgetMax * 0.2));
}

function extractBudgetMax(value: string) {
  const text = value.trim();
  if (!text || /(以上|起|不设限|不限|无所谓)/.test(text)) {
    return undefined;
  }

  const numbers = Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
  if (!numbers.length) {
    return undefined;
  }

  return Math.max(...numbers);
}

function roundRobinByCategory(shops: Shop[]) {
  const groups = new Map<string, Shop[]>();

  for (const shop of shops) {
    const key = shop.category || "other";
    groups.set(key, [...(groups.get(key) ?? []), shop]);
  }

  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const result: Shop[] = [];
  let index = 0;

  while (result.length < shops.length) {
    let added = false;

    for (const key of keys) {
      const group = groups.get(key) ?? [];
      const item = group[index];

      if (item) {
        result.push(item);
        added = true;
      }
    }

    if (!added) {
      break;
    }

    index += 1;
  }

  return result;
}

function toFoodCandidateCard(
  shop: Shop,
  features?: ShopFeature,
  sceneFit?: SceneFit,
  regions: Region[] = []
): FoodRecommendationCard {
  const matchedTags = uniqueStrings([
    ...shop.tags,
    ...(shop.cuisines ?? []),
    ...(features?.featureTags ?? []),
    ...(features?.tasteTags ?? []),
    ...(features?.sceneTags ?? [])
  ]).slice(0, 6);
  const riskHints = uniqueStrings([
    ...(features?.riskHints ?? []),
    ...(sceneFit?.riskHints.soloToday ?? [])
  ]).slice(0, 3);
  const rankReasons = uniqueStrings([
    ...(features?.explainHints ?? []),
    ...(sceneFit?.explainHints.soloToday ?? [])
  ]).slice(0, 3);
  const rating = shop.rating ?? shop.syntheticRating ?? 4.5;
  const distance = getShopDistanceInfo(shop, regions);

  return {
    id: shop.id,
    name: shop.name,
    type: shop.category || "餐饮推荐",
    perCapita: shop.avgPrice !== null ? `人均 ${shop.avgPrice} 元` : "人均待确认",
    distance: distance.text,
    distanceMeters: distance.distanceMeters,
    walkMinutes: distance.walkMinutes,
    rating,
    matchedTags,
    matchedTagsText: matchedTags.length ? matchedTags.join("、") : shop.category || "候选店",
    reason: rankReasons.length ? rankReasons.join("；") : "本地餐厅库命中当前偏好",
    riskTip: riskHints.length ? riskHints.join("；") : "到店前建议确认营业、排队和库存情况。",
    source: "openclaw"
  };
}

function getShopDistanceInfo(shop: Shop, regions: Region[]) {
  const center = getShopDistanceCenter(shop, regions);

  if (!center) {
    return {
      text: "距离待确认",
      distanceMeters: undefined,
      walkMinutes: undefined
    };
  }

  const km = distanceKm(center, { latitude: shop.latitude, longitude: shop.longitude });
  const distanceMeters = Math.max(1, Math.round(km * 1000));
  const walkMinutes = Math.max(1, Math.round(distanceMeters / 80));
  const distanceText = distanceMeters >= 1000
    ? `约 ${(distanceMeters / 1000).toFixed(1)} km`
    : `约 ${Math.round(distanceMeters / 10) * 10} m`;

  return {
    text: `${distanceText} / 步行 ${walkMinutes} 分钟`,
    distanceMeters,
    walkMinutes
  };
}

function getShopDistanceCenter(shop: Shop, regions: Region[]): GeoPoint | undefined {
  const region = regions.find((item) => item.id === shop.regionId) ?? regions.find((item) => item.id === "guangzhou_university_town");
  return region?.center;
}

function buildContextEnvelope(context: OpenClawDataContext) {
  return {
    schemaVersion: context.schemaVersion,
    traceId: context.traceId,
    scene: context.scene,
    createdAt: context.createdAt,
    user: context.user,
    profile: context.profile,
    contextBlocks: context.contextBlocks,
    privacy: context.privacy
  };
}

function runOpenClawAgentCli(content: string, sessionId: string): Promise<string> {
  const timeoutMs = readNumberEnv("OPENCLAW_GATEWAY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
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
  const parsed = parseOpenClawCliStdout(stdout);

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

function parseOpenClawCliStdout(stdout: string) {
  try {
    return JSON.parse(stdout);
  } catch (directError) {
    const jsonText = extractBalancedJsonObject(stdout);

    if (!jsonText) {
      throw new Error(`OpenClaw CLI stdout JSON parse failed: ${(directError as Error).message}`);
    }

    try {
      return JSON.parse(jsonText);
    } catch (extractedError) {
      throw new Error(`OpenClaw CLI stdout JSON parse failed: ${(extractedError as Error).message}`);
    }
  }
}

function parseOpenClawRecommendation(rawContent: string): unknown {
  const jsonText = extractJsonObject(rawContent);

  if (!jsonText) {
    logOpenClawJsonParseFailure(rawContent, "", "no JSON object found");
    throw new Error("OpenClaw response did not contain a JSON object.");
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const repairedJsonText = repairOpenClawJsonText(jsonText);

    if (repairedJsonText !== jsonText) {
      try {
        return JSON.parse(repairedJsonText);
      } catch (repairError) {
        logOpenClawJsonParseFailure(rawContent, jsonText, (repairError as Error).message, repairedJsonText);
      }
    } else {
      logOpenClawJsonParseFailure(rawContent, jsonText, (error as Error).message);
    }

    throw new Error(`OpenClaw response JSON parse failed: ${(error as Error).message}`);
  }
}

function normalizeRecommendations(input: unknown, localCandidates: FoodRecommendationCard[]) {
  const payload = isRecord(input) ? input : {};
  const selected = readSelectedDecisionArray(payload);

  if (selected.length > 0) {
    const enriched = enrichSelectedRecommendations(selected, localCandidates);

    if (enriched.length >= 2) {
      return {
        recommendations: enriched,
        outputMode: "selected" as const
      };
    }
  }

  const rawRecommendations = readRecommendationArray(payload);
  const recommendations = rawRecommendations.slice(0, 3).map((item, index) => {
    const raw = isRecord(item) ? item : {};
    const matchedTags = readStringArrayFrom(raw, ["tags", "matchedTags", "matched_tags", "labels"]);
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
    const reason = readStringFrom(raw, ["why", "reason", "r", "rationale", "recommendReason", "recommend_reason"]);
    const riskTip = readStringFrom(raw, ["tip", "riskTip", "risk_tip", "risk", "tips", "note"]);

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

  return {
    recommendations: valid,
    outputMode: "legacy" as const
  };
}

function enrichSelectedRecommendations(rawSelected: unknown[], localCandidates: FoodRecommendationCard[]) {
  const candidatesById = new Map(localCandidates.map((candidate) => [candidate.id, candidate]));
  const usedIds = new Set<string>();
  const cards: FoodRecommendationCard[] = [];

  for (const item of rawSelected.slice(0, 3)) {
    const raw = isRecord(item) ? item : {};
    const candidateId = readStringFrom(raw, ["id", "shopId", "shop_id", "restaurantId", "restaurant_id"]);
    const candidateName = readStringFrom(raw, ["name", "shopName", "shop_name", "restaurantName", "restaurant_name", "title"]);
    const candidate = candidatesById.get(candidateId) ||
      localCandidates.find((entry) => candidateName && entry.name === candidateName);

    if (!candidate || usedIds.has(candidate.id)) {
      continue;
    }

    usedIds.add(candidate.id);
    const matchedTags = readStringArrayFrom(raw, ["tags", "matchedTags", "matched_tags", "labels"]);
    const reason = readStringFrom(raw, ["why", "reason", "r", "rationale", "recommendReason", "recommend_reason"]);
    const riskTip = readStringFrom(raw, ["tip", "riskTip", "risk_tip", "risk", "tips", "note"]);
    const finalTags = normalizeAiShortTags(matchedTags, candidate.matchedTags);

    cards.push({
      ...candidate,
      matchedTags: finalTags,
      matchedTagsText: finalTags.join("、"),
      reason: normalizeAiShortText(reason, candidate.reason, 26),
      riskTip: normalizeAiShortText(riskTip, candidate.riskTip, 24)
    });
  }

  return cards;
}

function normalizeAiShortTags(aiTags: string[], fallbackTags: string[]) {
  const tags = uniqueStrings(aiTags).slice(0, 2);
  return tags.length ? tags : fallbackTags.slice(0, 2);
}

function normalizeAiShortText(value: string, fallback: string, maxChars: number) {
  const source = readString(value) || fallback;
  const firstSentence = source.split(/[。；;\n]/).map((item) => item.trim()).find(Boolean) || source;

  return firstSentence.length > maxChars ? `${firstSentence.slice(0, maxChars - 1)}…` : firstSentence;
}

function readSelectedDecisionArray(payload: StringMap) {
  const directKeys = ["selected", "selection", "decisions", "chosen"];

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
  const unfenced = stripMarkdownJsonFence(trimmed);
  const balanced = extractBalancedJsonObject(unfenced);

  return balanced || "";
}

function stripMarkdownJsonFence(content: string) {
  const fencedMatch = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch && fencedMatch[1] ? fencedMatch[1].trim() : content.trim();
}

function extractBalancedJsonObject(content: string) {
  const source = stripMarkdownJsonFence(content);
  const start = source.indexOf("{");

  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1).trim();
      }
    }
  }

  return "";
}

function repairOpenClawJsonText(jsonText: string) {
  return stripMarkdownJsonFence(jsonText)
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/}\s*{/g, "},{")
    .trim();
}

function logOpenClawJsonParseFailure(
  rawContent: string,
  jsonText: string,
  detail: string,
  repairedJsonText?: string
) {
  console.warn("[openclawFoodRecommendation] JSON parse diagnostics", {
    detail,
    rawExcerpt: summarizeLogExcerpt(rawContent),
    jsonExcerpt: summarizeLogExcerpt(jsonText),
    repairedExcerpt: repairedJsonText ? summarizeLogExcerpt(repairedJsonText) : undefined
  });
}

function summarizeLogExcerpt(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
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

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => typeof value === "string" ? value.trim() : "").filter(Boolean)));
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
