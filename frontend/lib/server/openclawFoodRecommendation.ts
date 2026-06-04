import { execFile } from "node:child_process";
import type { FoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import { sanitizeFoodDecisionSheet } from "@/lib/server/foodDecisionSheet";
import type { OpenClawDataContext } from "@/lib/server/openclawDataFeed";
import { buildOpenClawRequestScope, buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";
import { loadRestaurantData } from "@/lib/restaurantData/loadData";
import { distanceKm } from "@/lib/restaurantData/geo";
import type { DiningScene, GeoPoint, Region, RestaurantSource, RestaurantDataSet, SceneFit, Shop, ShopFeature } from "@/lib/restaurantData/types";

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
    temporaryAvoidTags: string[];
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
  distanceMaxMeters?: number;
  noSpicy: boolean;
  allowedCategories: string[];
  blockedCategories: string[];
  preferredTerms: string[];
  avoidTerms: string[];
  avoidCategories: string[];
  temporaryAvoidTags: string[];
  hardDynamicTerms: string[];
};

type FoodPositiveIntent =
  | "noodles"
  | "fastMeal"
  | "light"
  | "lowOil"
  | "warm"
  | "soupy"
  | "quick"
  | "filling"
  | "crave"
  | "spicy"
  | "mildSpicy"
  | "mala"
  | "heavyTaste"
  | "sichuanHunan"
  | "xinjiangFood"
  | "northeastFood"
  | "homeStyle"
  | "cantoneseFood"
  | "japaneseFood"
  | "koreanFood"
  | "milkTea"
  | "coffee"
  | "dessert"
  | "lightFood"
  | "refreshing"
  | "richTaste"
  | "sweetSour"
  | "freshSavory"
  | "saltySavory"
  | "chat"
  | "group"
  | "workdayFast"
  | "weekend"
  | "breakfast"
  | "lateNight"
  | "lowBudget"
  | "nearby";

type PositiveFoodPreferencePolicy = {
  tokens: string[];
  intents: FoodPositiveIntent[];
  scene?: DiningScene;
  hasExplicitIntent: boolean;
  noSpicy: boolean;
};

type PositiveFoodCandidateScore = {
  score: number;
  anchorScore: number;
  reasons: string[];
};

type FoodCandidateEvaluation = {
  shop: Shop;
  text: string;
  strictMatch: boolean;
  hardAllowed: boolean;
  baseScore: number;
  positiveScore: number;
  anchorScore: number;
  score: number;
  positiveReasons: string[];
  hardViolations: string[];
};

const DEFAULT_TIMEOUT_MS = 130_000;
const DEFAULT_MAX_RESPONSE_CHARS = 4000;
const DEFAULT_CANDIDATE_LIMIT = 12;
const STRONG_POSITIVE_MATCH_LIMIT = 6;
const STRONG_POSITIVE_MIN_SCORE = 24;
const ANCHOR_BOOST_MAX = 18;

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
      temporaryAvoidTags: canUseTaste ? readStringArray(preferences.temporaryAvoidTags) : [],
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
  const hardFilter = buildHardFoodFilterPolicy(request);
  const auditedRecommendations = auditAndRepairRecommendations(normalized.recommendations, localCandidates, hardFilter);
  const normalizeMs = Date.now() - normalizeStartedAt;

  assertNoHardConstraintViolation(auditedRecommendations, request.preferences);

  return {
    recommendations: auditedRecommendations,
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
      "AI owns the final selection inside the server-audited candidate catalog.",
      "The server has already removed hard-constraint violations; never choose against category, budget, distance, spicy, or avoid constraints.",
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
    temporaryAvoidTags: request.preferences.temporaryAvoidTags,
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
  const positivePolicy = buildPositiveFoodPreferencePolicy(request, hardFilter);
  const candidates = buildDiverseAiCatalog(data, limit, excludedIds, hardFilter, positivePolicy).map((evaluation) => {
    return toFoodCandidateCard(
      evaluation.shop,
      data.featuresByShopId.get(evaluation.shop.id),
      data.sceneFitByShopId.get(evaluation.shop.id),
      data.regions,
      positivePolicy,
      evaluation.positiveReasons
    );
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
  hardFilter: HardFoodFilterPolicy,
  positivePolicy: PositiveFoodPreferencePolicy
) {
  const evaluations = data.shops
    .filter((shop) => !excludedIds.has(shop.id))
    .map((shop) => evaluateFoodCandidate(shop, data, hardFilter, positivePolicy))
    .filter((evaluation) => evaluation.hardAllowed);
  const candidateLimit = Math.max(2, limit);
  const ordered = orderFoodCandidateEvaluations(evaluations, hardFilter);

  if (!positivePolicy.hasExplicitIntent) {
    return ordered.slice(0, candidateLimit);
  }

  const strong = selectStrongPositiveMatches(
    evaluations,
    positivePolicy,
    Math.min(STRONG_POSITIVE_MATCH_LIMIT, candidateLimit)
  );

  if (strong.length < 2) {
    return ordered.slice(0, candidateLimit);
  }

  return mergeStrongAndFillerCandidates(strong, ordered, candidateLimit, positivePolicy);
}

function buildHardFoodFilterPolicy(request: FoodRecommendRequest): HardFoodFilterPolicy {
  const stableFoodPreferences = request.memoryProfile?.stableFoodPreferences;
  const adjustment = request.requestContext?.adjustment;
  const hardDynamicDimensions = (request.decisionSheet?.dynamic ?? []).filter((dimension) => dimension.hard === true);
  const categoryPolicy = buildCategoryPreferencePolicy([
    request.slots.branchPreference,
    ...hardDynamicDimensions.map((dimension) => dimension.value)
  ]);
  const temporaryAvoidPolicy = buildTemporaryAvoidPolicy(request.preferences.temporaryAvoidTags);
  const adjustmentAvoidPolicy = buildTemporaryAvoidPolicy([
    ...(adjustment?.avoidCategories ?? []),
    ...(adjustment?.types ?? []).filter((item) => /^不想|^不要|^避开/.test(item))
  ]);
  const rawAvoidTerms = uniqueStrings([
    ...request.preferences.avoidTags,
    ...request.preferences.temporaryAvoidTags,
    ...(stableFoodPreferences?.avoidTags ?? [])
  ]);
  const spicyText = [
    request.preferences.spicyLevel,
    stableFoodPreferences?.spicyLevel,
    ...rawAvoidTerms,
    ...temporaryAvoidPolicy.avoidTerms
  ].join(" ");

  return {
    budgetMax: extractBudgetMax(request.slots.budget),
    distanceMaxMeters: extractDistanceMaxMeters(request.slots.distance),
    noSpicy: /(不吃辣|不要辣|忌辣|不能吃辣|无辣|不想吃太辣|不想吃重口|重口|no.?spicy|non.?spicy)/i.test(spicyText),
    allowedCategories: categoryPolicy.allowedCategories,
    blockedCategories: uniqueStrings([
      ...categoryPolicy.blockedCategories,
      ...temporaryAvoidPolicy.blockedCategories,
      ...adjustmentAvoidPolicy.blockedCategories
    ]),
    preferredTerms: categoryPolicy.preferredTerms,
    avoidTerms: uniqueStrings([
      ...rawAvoidTerms.filter((term) => {
        return term.length >= 2 && !/(不吃辣|不要辣|忌辣|不能吃辣|无辣|辣度)/i.test(term);
      }),
      ...temporaryAvoidPolicy.avoidTerms,
      ...adjustmentAvoidPolicy.avoidTerms
    ]),
    avoidCategories: uniqueStrings([
      ...(adjustment?.avoidCategories ?? []),
      ...(adjustment?.types ?? []).filter((item) => /^不想|^不要|^避开/.test(item))
    ]),
    temporaryAvoidTags: request.preferences.temporaryAvoidTags,
    hardDynamicTerms: hardDynamicDimensions
      .flatMap((dimension) => splitPreferenceTokens(dimension.value))
      .filter((term) => /^不想|^不要|^避开|^不能/.test(term))
  };
}

function evaluateFoodCandidate(
  shop: Shop,
  data: RestaurantDataSet,
  hardFilter: HardFoodFilterPolicy,
  positivePolicy: PositiveFoodPreferencePolicy
): FoodCandidateEvaluation {
  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const text = buildFoodCandidateSearchText(shop, features, dishes);
  const hardViolations = collectFoodCandidateHardViolations(shop, data, hardFilter, text, features);
  const strictMatch = isStrictFoodCandidateMatch(shop, text, hardFilter);
  const baseScore = scoreFoodCandidate(shop, data, hardFilter, text, strictMatch);
  const positive = scorePositiveFoodCandidate(shop, data, positivePolicy, text);

  return {
    shop,
    text,
    strictMatch,
    hardAllowed: hardViolations.length === 0,
    baseScore,
    positiveScore: positive.score,
    anchorScore: positive.anchorScore,
    score: baseScore + positive.score + positive.anchorScore,
    positiveReasons: positive.reasons,
    hardViolations
  };
}

function collectFoodCandidateHardViolations(
  shop: Shop,
  data: RestaurantDataSet,
  hardFilter: HardFoodFilterPolicy,
  text: string,
  features?: ShopFeature
) {
  const violations: string[] = [];

  if (hardFilter.budgetMax && shop.avgPrice !== null && shop.avgPrice > hardFilter.budgetMax + budgetTolerance(hardFilter.budgetMax)) {
    violations.push("budget");
  }

  if (hardFilter.distanceMaxMeters) {
    const distance = getShopDistanceInfo(shop, data.regions);
    if (distance.distanceMeters !== undefined && distance.distanceMeters > hardFilter.distanceMaxMeters + distanceTolerance(hardFilter.distanceMaxMeters)) {
      violations.push("distance");
    }
  }

  if (hardFilter.noSpicy && isClearlySpicyCandidate(text, features)) {
    violations.push("spicy");
  }

  if (hardFilter.blockedCategories.includes(shop.category)) {
    violations.push("blocked_category");
  }

  if (hardFilter.avoidCategories.some((term) => candidateTextIncludes(text, term))) {
    violations.push("avoid_category");
  }

  if (hardFilter.avoidTerms.some((term) => candidateTextIncludes(text, term))) {
    violations.push("avoid_term");
  }

  if (hardFilter.hardDynamicTerms.some((term) => candidateTextIncludes(text, stripNegativePrefix(term)))) {
    violations.push("dynamic_hard");
  }

  return violations;
}

function isStrictFoodCandidateMatch(shop: Shop, text: string, hardFilter: HardFoodFilterPolicy) {
  const hasAllowedCategory = hardFilter.allowedCategories.length > 0;
  const hasPreferredTerms = hardFilter.preferredTerms.length > 0;

  if (!hasAllowedCategory && !hasPreferredTerms) {
    return true;
  }

  const categoryMatched = !hasAllowedCategory || hardFilter.allowedCategories.includes(shop.category);
  const termMatched = !hasPreferredTerms || hardFilter.preferredTerms.some((term) => candidateTextIncludes(text, term));

  return categoryMatched && (termMatched || !hasPreferredTerms);
}

function scoreFoodCandidate(
  shop: Shop,
  data: RestaurantDataSet,
  hardFilter: HardFoodFilterPolicy,
  text: string,
  strictMatch: boolean
) {
  const features = data.featuresByShopId.get(shop.id);
  const sceneFit = data.sceneFitByShopId.get(shop.id);
  const distance = getShopDistanceInfo(shop, data.regions);
  let score = strictMatch ? 100 : 40;

  if (hardFilter.allowedCategories.includes(shop.category)) {
    score += 42;
  }

  score += hardFilter.preferredTerms.filter((term) => candidateTextIncludes(text, term)).length * 10;

  if (shop.source === "manual_sample" || shop.source === "manual_public_curated") {
    score += 12;
  }

  if (shop.avgPrice !== null) {
    score += Math.max(0, 18 - Math.round(shop.avgPrice / 8));
  }

  if (hardFilter.budgetMax && shop.avgPrice !== null && shop.avgPrice <= hardFilter.budgetMax) {
    score += 18;
  }

  if (distance.distanceMeters !== undefined) {
    score += Math.max(0, 18 - Math.round(distance.distanceMeters / 120));
  }

  if (hardFilter.distanceMaxMeters && distance.distanceMeters !== undefined && distance.distanceMeters <= hardFilter.distanceMaxMeters) {
    score += 14;
  }

  if (features?.soloFriendly) {
    score += 8;
  }

  if (features?.queueRisk === "low") {
    score += 6;
  }

  score += Math.round(((sceneFit?.sceneScores.soloToday ?? 50) - 50) * 0.25);

  return score;
}

function buildPositiveFoodPreferencePolicy(
  request: FoodRecommendRequest,
  hardFilter: HardFoodFilterPolicy
): PositiveFoodPreferencePolicy {
  const softDynamicDimensions = (request.decisionSheet?.dynamic ?? []).filter((dimension) => dimension.hard !== true);
  const tokens = uniqueStrings([
    request.slots.mealPurpose,
    request.slots.branchPreference,
    ...request.preferences.tasteTags,
    ...request.preferences.needTags,
    ...softDynamicDimensions.map((dimension) => dimension.value)
  ].flatMap(splitPreferenceTokens).map(stripNegativePrefix))
    .filter((token) => token && !/都可以|随便|没想法|不限|无所谓|没有补充/.test(token));
  const text = tokens.join(" ");
  const intents: FoodPositiveIntent[] = [];
  const addIntent = (intent: FoodPositiveIntent, pattern: RegExp) => {
    if (pattern.test(text)) {
      intents.push(intent);
    }
  };

  addIntent("noodles", /粉面|面条|汤粉|汤面|云吞|小面|粥粉面|米粉|河粉/);
  addIntent("fastMeal", /简餐|快餐|米饭|套餐|盖饭|便当|中式简餐/);
  addIntent("light", /清淡|平淡|不辣可选|少油|轻食|轻负担/);
  addIntent("lowOil", /不油腻|少油|低脂|减脂|轻负担|沙拉/);
  addIntent("warm", /热乎|热汤|热饮|热食|暖|温热/);
  addIntent("soupy", /汤汤水水|汤水|喝汤|汤粉|汤面|粥|云吞|糖水|汤饭/);
  addIntent("quick", /快一点|快点|快取|赶时间|不能排队|排队少|很饿要快|近一点/);
  addIntent("filling", /饱腹|管饱|下饭|很饿|饭量|顶饿/);
  addIntent("crave", /解馋|犒劳|重口|烧烤|烤串|火锅|炸物|炸鸡|麻辣烫|冒菜/);
  addIntent("xinjiangFood", /新疆菜|新疆|大盘鸡|手抓饭|新疆拌面|羊肉串|烤馕|馕/);
  addIntent("northeastFood", /东北菜|东北|铁锅炖|锅包肉|地三鲜|东北大拉皮/);
  addIntent("homeStyle", /家常菜|家常|下饭|炒菜|汤饭/);
  addIntent("cantoneseFood", /粤菜|广式|烧腊|肠粉|茶餐厅|煲仔饭|老广|鸡煲/);
  addIntent("japaneseFood", /日料|寿司|咖喱饭|日式|拉面|鳗鱼|和食/);
  addIntent("koreanFood", /韩餐|韩式|年糕|部队锅|拌饭|炸鸡/);
  addIntent("milkTea", /奶茶|茶饮|果茶|水果茶|柠檬茶/);
  addIntent("coffee", /咖啡|拿铁|美式|冷萃|摩卡/);
  addIntent("dessert", /甜品|糖水|蛋糕|布丁|芋圆|甜汤/);
  addIntent("lightFood", /轻食|沙拉|减脂|低脂|低卡/);
  addIntent("refreshing", /爽口|清爽/);
  addIntent("richTaste", /浓郁|咖喱|芝士|奶香|浓汤|酱香/);
  addIntent("sweetSour", /酸甜|糖醋|番茄|酸梅/);
  addIntent("freshSavory", /鲜香|鲜味|鲜美|菌汤|鸡汤/);
  addIntent("saltySavory", /咸香|卤味|烧腊|酱香|下饭/);
  if (!hardFilter.noSpicy) {
    addIntent("spicy", /想吃辣|辣一点|辣味|微辣|中辣|重辣|香辣|麻辣|川菜|湘菜|川湘|川味|湘味|重口|干锅|小炒|烧烤|烤串|火锅|冒菜|麻辣烫|串串|烤鱼|酸辣粉|螺蛳粉/);
    addIntent("mildSpicy", /微辣|小辣|辣一点|辣度可调|可选辣/);
    addIntent("mala", /麻辣|香辣|麻辣烫|冒菜|串串|烤鱼|酸辣粉|螺蛳粉/);
    addIntent("heavyTaste", /中辣|重辣|重口|重口味|干锅|小炒|下饭|香辣|麻辣|烧烤|烤串/);
    addIntent("sichuanHunan", /川湘|川菜|湘菜|川味|湘味/);
  }
  addIntent("chat", /适合聊天|聊天|安静|坐会|坐一会|慢慢聊|停留/);
  addIntent("group", /朋友|一起吃|多人|约饭|聚餐|和朋友一起吃/);
  addIntent("workdayFast", /工作日快餐|上班|上课|赶时间/);
  addIntent("weekend", /周末|放松|慢慢吃|想轻松坐会/);
  addIntent("breakfast", /早餐|早饭|早点|早上/);
  addIntent("lateNight", /夜宵|宵夜|深夜/);
  addIntent("lowBudget", /低预算|便宜|省钱|实惠|学生预算|便宜一点/);
  addIntent("nearby", /距离近|附近|就近|近一点|500米/);

  if (request.slots.mealPurpose === "和朋友一起吃") {
    intents.push("group", "chat");
  }

  if (request.slots.mealPurpose === "工作日快餐") {
    intents.push("workdayFast", "quick", "fastMeal");
  }

  if (request.slots.mealPurpose === "周末放松吃") {
    intents.push("weekend", "chat");
  }

  if (request.slots.mealPurpose === "早餐") {
    intents.push("breakfast", "quick");
  }

  if (request.slots.mealPurpose === "夜宵") {
    intents.push("lateNight", "warm");
  }

  if (hardFilter.allowedCategories.includes("粉面")) {
    intents.push("noodles");
  }

  if (hardFilter.allowedCategories.includes("快餐")) {
    intents.push("fastMeal");
  }

  if (hardFilter.allowedCategories.includes("新疆菜")) {
    intents.push("xinjiangFood");
  }

  if (hardFilter.allowedCategories.includes("东北菜")) {
    intents.push("northeastFood");
  }

  if (hardFilter.allowedCategories.includes("家常菜")) {
    intents.push("homeStyle");
  }

  if (hardFilter.allowedCategories.includes("粤菜") || hardFilter.allowedCategories.includes("潮汕菜")) {
    intents.push("cantoneseFood");
  }

  if (hardFilter.allowedCategories.includes("日料")) {
    intents.push("japaneseFood");
  }

  if (hardFilter.allowedCategories.includes("韩餐")) {
    intents.push("koreanFood");
  }

  if (hardFilter.allowedCategories.includes("奶茶")) {
    intents.push("milkTea");
  }

  if (hardFilter.allowedCategories.includes("咖啡")) {
    intents.push("coffee");
  }

  if (hardFilter.allowedCategories.includes("甜品")) {
    intents.push("dessert");
  }

  if (hardFilter.allowedCategories.includes("轻食")) {
    intents.push("lightFood", "light", "lowOil");
  }

  if (!hardFilter.noSpicy) {
    if (hardFilter.allowedCategories.includes("川湘菜")) {
      intents.push("sichuanHunan", "spicy");
    }

    if (hardFilter.allowedCategories.includes("火锅")) {
      intents.push("spicy", "mala", "heavyTaste");
    }

    if (hardFilter.allowedCategories.includes("烧烤")) {
      intents.push("spicy", "heavyTaste");
    }
  }

  const uniqueIntents = uniqueStrings(intents) as FoodPositiveIntent[];

  return {
    tokens,
    intents: uniqueIntents,
    scene: inferPositiveFoodScene(uniqueIntents),
    hasExplicitIntent: uniqueIntents.length > 0,
    noSpicy: hardFilter.noSpicy
  };
}

function inferPositiveFoodScene(intents: FoodPositiveIntent[]): DiningScene | undefined {
  if (intents.includes("group") || intents.includes("chat")) {
    return "groupMeetup";
  }

  if (intents.includes("weekend")) {
    return "weekendPlan";
  }

  if (intents.includes("quick") || intents.includes("workdayFast") || intents.includes("breakfast")) {
    return "soloToday";
  }

  return undefined;
}

function scorePositiveFoodCandidate(
  shop: Shop,
  data: RestaurantDataSet,
  policy: PositiveFoodPreferencePolicy,
  hardText: string
): PositiveFoodCandidateScore {
  if (!policy.hasExplicitIntent) {
    return { score: 0, anchorScore: 0, reasons: [] };
  }

  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const sceneFit = data.sceneFitByShopId.get(shop.id);
  const distance = getShopDistanceInfo(shop, data.regions);
  const text = buildPositiveFoodCandidateSearchText(shop, features, dishes, sceneFit, hardText);
  let score = 0;
  let anchorScore = 0;
  const reasons: string[] = [];
  const hasIntent = (intent: FoodPositiveIntent) => policy.intents.includes(intent);
  const add = (condition: boolean, points: number, reason: string) => {
    if (!condition) {
      return;
    }

    score += points;
    reasons.push(reason);
  };
  const addAnchor = (condition: boolean, points: number, reason: string) => {
    if (!condition) {
      return;
    }

    anchorScore += points;
    reasons.push(reason);
  };
  const addText = (terms: string[], pointsPerMatch: number, maxPoints: number, reason: string) => {
    const matches = countCandidateTextMatches(text, terms);
    if (!matches) {
      return;
    }

    score += Math.min(maxPoints, matches * pointsPerMatch);
    reasons.push(reason);
  };
  const canScoreSpicy = !policy.noSpicy;
  const spicyCategories = ["川湘菜", "火锅", "烧烤"];
  const spicyTerms = [
    "香辣",
    "麻辣",
    "微辣",
    "中辣",
    "重辣",
    "辣味",
    "川湘",
    "川菜",
    "湘菜",
    "川味",
    "湘味",
    "火锅",
    "冒菜",
    "麻辣烫",
    "串串",
    "烤鱼",
    "烧烤",
    "烤串",
    "酸辣粉",
    "螺蛳粉",
    "干锅",
    "小炒",
    "重口味"
  ];
  const mildSpicyTerms = ["微辣", "小辣", "辣一点", "辣度可调", "可选辣"];
  const malaTerms = ["麻辣", "香辣", "麻辣烫", "冒菜", "串串", "烤鱼", "酸辣粉", "螺蛳粉"];
  const heavyTasteTerms = ["中辣", "重辣", "重口", "重口味", "干锅", "小炒", "下饭", "香辣", "麻辣", "烧烤", "烤串"];
  const sichuanHunanTerms = ["川湘", "川菜", "湘菜", "川味", "湘味", "香辣", "麻辣", "小炒"];
  const scoreDirectCategory = (
    intent: FoodPositiveIntent,
    categories: string[],
    terms: string[],
    reason: string,
    relatedCategories: string[] = []
  ) => {
    if (!hasIntent(intent)) {
      return;
    }

    add(categories.includes(shop.category), 26, reason);
    add(relatedCategories.includes(shop.category), 10, reason);
    addText(terms, 5, 22, reason);
    addAnchor(categories.includes(shop.category) || candidateMatchesAny(text, terms), 10, `${reason}锚点`);
  };

  scoreDirectCategory("xinjiangFood", ["新疆菜"], ["新疆菜", "新疆", "大盘鸡", "手抓饭", "新疆拌面", "羊肉串", "烤馕", "馕", "孜然"], "新疆菜");
  scoreDirectCategory("northeastFood", ["东北菜"], ["东北菜", "东北", "铁锅炖", "锅包肉", "地三鲜", "东北大拉皮"], "东北菜");
  scoreDirectCategory("homeStyle", ["家常菜"], ["家常菜", "家常", "下饭", "炒菜", "小炒", "套餐", "米饭", "便当", "汤饭", "盖饭", "饭堂", "小灶"], "家常菜", ["快餐", "粤菜", "潮汕菜", "东北菜"]);
  scoreDirectCategory("cantoneseFood", ["粤菜", "潮汕菜"], ["粤菜", "广式", "烧腊", "肠粉", "茶餐厅", "煲仔饭", "老广", "鸡煲", "潮汕"], "粤菜");
  scoreDirectCategory("japaneseFood", ["日料"], ["日料", "寿司", "咖喱饭", "日式", "拉面", "鳗鱼", "和食"], "日料");
  scoreDirectCategory("koreanFood", ["韩餐"], ["韩餐", "韩式", "年糕", "部队锅", "拌饭", "炸鸡"], "韩餐");
  scoreDirectCategory("milkTea", ["奶茶"], ["奶茶", "茶饮", "果茶", "水果茶", "柠檬茶"], "奶茶");
  scoreDirectCategory("coffee", ["咖啡"], ["咖啡", "拿铁", "美式", "冷萃", "摩卡"], "咖啡");
  scoreDirectCategory("dessert", ["甜品"], ["甜品", "糖水", "蛋糕", "布丁", "芋圆", "甜汤"], "甜品");
  scoreDirectCategory("lightFood", ["轻食"], ["轻食", "沙拉", "低脂", "低卡", "减脂", "轻负担", "不油腻"], "轻食");

  if (hasIntent("refreshing")) {
    add(["轻食", "奶茶", "甜品"].includes(shop.category), 14, "爽口清爽");
    add(features?.supportsNonSpicy === true, 4, "清爽不辣");
    addText(["爽口", "清爽", "沙拉", "轻食", "清淡", "不油腻", "少油", "低脂", "低卡", "酸甜", "水果茶", "柠檬茶", "冷饮"], 5, 24, "爽口清爽");
    addAnchor(["轻食", "奶茶"].includes(shop.category) || candidateMatchesAny(text, ["爽口", "清爽", "沙拉", "水果茶", "柠檬茶"]), 10, "爽口锚点");
  }

  if (hasIntent("richTaste")) {
    add(["日料", "西餐", "火锅", "烧烤", "咖啡", "甜品"].includes(shop.category), 10, "浓郁");
    addText(["浓郁", "咖喱", "芝士", "奶香", "浓汤", "火锅", "烧烤", "重口味", "酱香", "牛排", "奶油", "摩卡"], 6, 24, "浓郁");
    addAnchor(candidateMatchesAny(text, ["咖喱", "芝士", "浓汤", "火锅", "酱香"]), 10, "浓郁锚点");
  }

  if (hasIntent("sweetSour")) {
    addText(["酸甜", "糖醋", "番茄", "酸梅", "水果茶", "柠檬茶"], 6, 22, "酸甜");
    addAnchor(candidateMatchesAny(text, ["酸甜", "糖醋", "番茄"]), 8, "酸甜锚点");
  }

  if (hasIntent("freshSavory")) {
    add(["粤菜", "潮汕菜", "粉面", "家常菜"].includes(shop.category), 8, "鲜香");
    addText(["鲜香", "鲜味", "鲜美", "菌汤", "鸡汤", "清汤", "云吞", "潮汕", "热汤"], 5, 20, "鲜香");
  }

  if (hasIntent("saltySavory")) {
    add(["粤菜", "家常菜", "快餐"].includes(shop.category), 8, "咸香");
    addText(["咸香", "卤味", "烧腊", "酱香", "下饭", "盖饭", "便当"], 5, 20, "咸香");
  }

  if (hasIntent("noodles")) {
    add(shop.category === "粉面", 24, "粉面");
    addText(["粉面", "面条", "汤粉", "汤面", "云吞", "小面", "粥粉面", "米粉", "河粉"], 5, 18, "粉面");
    addAnchor(shop.category === "粉面" || candidateMatchesAny(text, ["汤粉", "汤面", "云吞"]), 8, "粉面锚点");
  }

  if (hasIntent("fastMeal")) {
    add(shop.category === "快餐", 22, "简餐快餐");
    add(["家常菜", "粤菜", "潮汕菜", "东北菜", "粉面"].includes(shop.category), 8, "简餐快餐");
    addText(["简餐", "快餐", "套餐", "便当", "盖饭", "单人快吃", "工作日快餐"], 5, 18, "简餐快餐");
    add(features?.queueRisk === "low", 6, "出餐较快");
    addAnchor(shop.category === "快餐" || candidateMatchesAny(text, ["工作日快餐", "quick_meal"]), 8, "简餐锚点");
  }

  if (hasIntent("light")) {
    add(features?.supportsNonSpicy === true, 8, "清淡可选");
    add(shop.category === "轻食", 16, "清淡轻负担");
    addText(["清淡", "清淡可选", "不辣可选", "少油", "轻食", "沙拉", "粥"], 4, 18, "清淡");
    addAnchor(candidateMatchesAny(text, ["清淡可选", "不辣可选", "轻食"]), 8, "清淡锚点");
  }

  if (hasIntent("lowOil")) {
    add(shop.category === "轻食", 16, "不油腻");
    addText(["不油腻", "少油", "低脂", "减脂", "轻负担", "沙拉", "清淡"], 5, 18, "不油腻");
    addAnchor(candidateMatchesAny(text, ["低脂", "轻食", "清淡可选"]), 8, "轻负担锚点");
  }

  if (hasIntent("warm")) {
    add(["粉面", "快餐", "家常菜", "火锅"].includes(shop.category), 8, "热乎");
    addText(["热乎", "热汤", "热饮", "热食", "汤粉", "汤面", "粥", "砂锅", "汤饭"], 5, 20, "热乎");
    addAnchor(candidateMatchesAny(text, ["热乎", "热汤", "汤粉", "汤面", "粥"]), 8, "热乎锚点");
  }

  if (hasIntent("soupy")) {
    add(["粉面", "甜品", "家常菜"].includes(shop.category), 8, "汤汤水水");
    addText(["汤", "汤粉", "汤面", "粥", "云吞", "糖水", "汤饭"], 5, 22, "汤汤水水");
    addAnchor(candidateMatchesAny(text, ["汤粉", "汤面", "粥", "云吞", "汤饭"]), 10, "汤水锚点");
  }

  if (hasIntent("quick")) {
    add(features?.queueRisk === "low", 14, "快一点");
    add(features?.soloFriendly === true, 6, "单人快吃");
    add(shop.category === "快餐", 10, "快一点");
    add(distance.distanceMeters !== undefined && distance.distanceMeters <= 500, 6, "距离近");
    addText(["快一点", "快取", "单人快吃", "工作日快餐", "quick_meal", "排队少"], 5, 16, "快一点");
  }

  if (hasIntent("filling")) {
    add(["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category), 10, "饱腹感强");
    addText(["饱腹", "管饱", "下饭", "套餐", "盖饭", "饭", "粉", "面", "顶饿"], 4, 18, "饱腹感强");
  }

  if (hasIntent("crave")) {
    if (policy.noSpicy) {
      add(["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category), 10, "解馋");
      addText(["解馋", "饱腹", "管饱", "下饭", "套餐", "盖饭", "饭", "粉", "面", "热乎", "热汤", "汤饭"], 4, 20, "解馋");
    } else {
      add(["烧烤", "火锅", "川湘菜", "新疆菜", "韩餐"].includes(shop.category), 12, "解馋");
      addText(["解馋", "烧烤", "烤串", "火锅", "炸物", "炸鸡", "麻辣烫", "冒菜", "重口味"], 5, 20, "解馋");
    }
  }

  if (canScoreSpicy && hasIntent("spicy")) {
    add(spicyCategories.includes(shop.category), 18, "辣味");
    addText(spicyTerms, 5, 24, "辣味");
    add(features?.supportsNonSpicy === false, 6, "辣味明确");
    addAnchor(spicyCategories.includes(shop.category) || candidateMatchesAny(text, ["香辣", "麻辣", "川湘", "火锅", "烧烤", "干锅"]), 8, "辣味锚点");
  }

  if (canScoreSpicy && hasIntent("mildSpicy")) {
    addText(mildSpicyTerms, 7, 18, "微辣");
    add(features?.supportsNonSpicy === true && candidateMatchesAny(text, ["微辣", "辣度可调", "可选辣"]), 8, "微辣可选");
    add(spicyCategories.includes(shop.category) && !isClearlySpicyCandidate(text, features), 8, "微辣候选");
    addAnchor(candidateMatchesAny(text, ["微辣", "辣度可调", "可选辣"]), 8, "微辣锚点");
  }

  if (canScoreSpicy && hasIntent("mala")) {
    add(["川湘菜", "火锅"].includes(shop.category), 20, "麻辣香辣");
    addText(malaTerms, 6, 24, "麻辣香辣");
    addAnchor(["川湘菜", "火锅"].includes(shop.category) || candidateMatchesAny(text, ["麻辣", "香辣", "麻辣烫", "冒菜", "串串"]), 10, "麻辣锚点");
  }

  if (canScoreSpicy && hasIntent("heavyTaste")) {
    add(["川湘菜", "火锅", "烧烤"].includes(shop.category), 18, "重口下饭");
    addText(heavyTasteTerms, 6, 24, "重口下饭");
    addAnchor(["川湘菜", "烧烤"].includes(shop.category) || candidateMatchesAny(text, ["重口", "重辣", "中辣", "干锅", "小炒", "烤串"]), 10, "重口锚点");
  }

  if (canScoreSpicy && hasIntent("sichuanHunan")) {
    add(shop.category === "川湘菜", 24, "川湘");
    addText(sichuanHunanTerms, 6, 24, "川湘");
    addAnchor(shop.category === "川湘菜" || candidateMatchesAny(text, ["川湘", "川菜", "湘菜", "川味", "湘味"]), 12, "川湘锚点");
  }

  if (hasIntent("chat")) {
    add(features?.chatFriendly === true, 18, "适合聊天");
    add(features?.groupFriendly === true, 8, "多人友好");
    add(features?.noiseLevel === "low" || features?.noiseLevel === "medium", 6, "聊天环境");
    addSceneScore(sceneFit, "groupMeetup", 14, "适合聊天");
    addText(["适合聊天", "朋友聊天", "chat_friendly", "安静", "坐会", "停留"], 5, 20, "适合聊天");
    addAnchor(features?.chatFriendly === true || candidateMatchesAny(text, ["适合聊天", "朋友聊天"]), 12, "聊天锚点");
  }

  if (hasIntent("group")) {
    add(features?.groupFriendly === true, 16, "和朋友一起吃");
    add(features?.chatFriendly === true, 8, "适合聊天");
    addSceneScore(sceneFit, "groupMeetup", 14, "多人约饭");
    addText(["多人约饭", "朋友聊天", "group_friendly", "聚餐", "朋友"], 5, 18, "和朋友一起吃");
    addAnchor(features?.groupFriendly === true || candidateMatchesAny(text, ["多人约饭", "group_friendly"]), 10, "朋友聚餐锚点");
  }

  if (hasIntent("workdayFast")) {
    add(features?.queueRisk === "low", 14, "工作日快餐");
    add(features?.soloFriendly === true, 8, "单人快吃");
    add(["快餐", "粉面"].includes(shop.category), 10, "工作日快餐");
    addSceneScore(sceneFit, "soloToday", 10, "工作日快餐");
    addText(["工作日快餐", "工作日简餐", "单人快吃", "quick_meal"], 5, 18, "工作日快餐");
  }

  if (hasIntent("weekend")) {
    addSceneScore(sceneFit, "weekendPlan", 18, "周末放松");
    add(features?.chatFriendly === true, 10, "适合停留聊天");
    add(features?.rainyDayFriendly === true, 6, "室内放松");
    add(["咖啡", "甜品", "轻食", "西餐", "日料", "韩餐"].includes(shop.category), 8, "周末放松");
    addText(["周末规划", "周末", "放松", "朋友聊天", "适合聊天"], 5, 20, "周末放松");
    addAnchor(candidateMatchesAny(text, ["周末规划", "朋友聊天"]) || features?.chatFriendly === true, 10, "周末锚点");
  }

  if (hasIntent("breakfast")) {
    add(["快餐", "粉面", "咖啡", "轻食"].includes(shop.category), 8, "早餐");
    addText(["早餐", "包子", "点心", "豆浆", "粥", "肠粉", "早饭"], 5, 20, "早餐");
  }

  if (hasIntent("lateNight")) {
    add(["烧烤", "火锅", "粉面", "快餐", "甜品"].includes(shop.category), 8, "夜宵");
    addText(["夜宵", "宵夜", "深夜", "热乎", "烧烤", "粉面", "粥"], 5, 20, "夜宵");
  }

  if (hasIntent("lowBudget")) {
    add(shop.avgPrice !== null && shop.avgPrice <= 30, 14, "低预算");
    addText(["低预算", "20-30", "student_budget", "便宜", "实惠"], 5, 16, "低预算");
  }

  if (hasIntent("nearby")) {
    add(distance.distanceMeters !== undefined && distance.distanceMeters <= 500, 12, "距离近");
    add(distance.distanceMeters !== undefined && distance.distanceMeters > 500 && distance.distanceMeters <= 1000, 6, "距离近");
  }

  return {
    score: Math.min(90, score),
    anchorScore: Math.min(ANCHOR_BOOST_MAX, anchorScore),
    reasons: uniqueStrings(reasons).slice(0, 6)
  };

  function addSceneScore(sceneFitValue: SceneFit | undefined, scene: DiningScene, maxPoints: number, reason: string) {
    const sceneScore = sceneFitValue?.sceneScores[scene];
    if (sceneScore === undefined) {
      return;
    }

    const points = Math.max(0, Math.min(maxPoints, Math.round((sceneScore - 50) * 0.35)));
    if (points <= 0) {
      return;
    }

    score += points;
    reasons.push(reason);
  }
}

function buildPositiveFoodCandidateSearchText(
  shop: Shop,
  features: ShopFeature | undefined,
  dishes: Array<{ name: string; category: string; tags: string[]; description?: string }>,
  sceneFit: SceneFit | undefined,
  hardText: string
) {
  return [
    hardText,
    ...(features?.crowdTags ?? []),
    ...(features?.goodFor ?? []),
    ...(features?.explainHints ?? []),
    ...(features?.riskHints ?? []),
    ...Object.values(sceneFit?.explainHints ?? {}).flat(),
    ...Object.values(sceneFit?.riskHints ?? {}).flat(),
    ...dishes.flatMap((dish) => [dish.description ?? ""])
  ].join(" ").toLowerCase();
}

function candidateMatchesAny(text: string, terms: string[]) {
  return terms.some((term) => candidateTextIncludes(text, term));
}

function countCandidateTextMatches(text: string, terms: string[]) {
  return uniqueStrings(terms).filter((term) => candidateTextIncludes(text, term)).length;
}

function orderFoodCandidateEvaluations(evaluations: FoodCandidateEvaluation[], hardFilter: HardFoodFilterPolicy) {
  const strict = evaluations.filter((evaluation) => evaluation.strictMatch);
  const relaxed = evaluations.filter((evaluation) => !evaluation.strictMatch);
  const hasExplicitIntent = hardFilter.allowedCategories.length > 0 || hardFilter.preferredTerms.length > 0;

  return hasExplicitIntent
    ? [...sortCandidateEvaluations(strict), ...sortCandidateEvaluations(relaxed)]
    : sortCandidateEvaluations(roundRobinByCategoryEvaluation(evaluations));
}

function selectStrongPositiveMatches(
  evaluations: FoodCandidateEvaluation[],
  policy: PositiveFoodPreferencePolicy,
  limit: number
) {
  const categoryCap = isNarrowPositivePolicy(policy) ? limit : 3;
  const categoryCounts = new Map<string, number>();
  const result: FoodCandidateEvaluation[] = [];

  for (const evaluation of sortCandidateEvaluations(evaluations).filter((item) => {
    return item.positiveScore + item.anchorScore >= STRONG_POSITIVE_MIN_SCORE;
  })) {
    const category = evaluation.shop.category || "other";
    const used = categoryCounts.get(category) ?? 0;

    if (used >= categoryCap) {
      continue;
    }

    result.push(evaluation);
    categoryCounts.set(category, used + 1);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function isNarrowPositivePolicy(policy: PositiveFoodPreferencePolicy) {
  return policy.intents.some((intent) => {
    return [
      "noodles",
      "fastMeal",
      "xinjiangFood",
      "northeastFood",
      "homeStyle",
      "cantoneseFood",
      "japaneseFood",
      "koreanFood",
      "milkTea",
      "coffee",
      "dessert",
      "lightFood"
    ].includes(intent);
  });
}

function mergeStrongAndFillerCandidates(
  strong: FoodCandidateEvaluation[],
  ordered: FoodCandidateEvaluation[],
  limit: number,
  policy: PositiveFoodPreferencePolicy
) {
  const usedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const categoryCap = isNarrowPositivePolicy(policy) ? Math.min(8, limit) : Math.min(4, limit);
  const result: FoodCandidateEvaluation[] = [];
  const add = (evaluation: FoodCandidateEvaluation, enforceCategoryCap: boolean) => {
    if (usedIds.has(evaluation.shop.id) || result.length >= limit) {
      return;
    }

    const category = evaluation.shop.category || "other";
    const usedCategoryCount = categoryCounts.get(category) ?? 0;
    if (enforceCategoryCap && usedCategoryCount >= categoryCap) {
      return;
    }

    usedIds.add(evaluation.shop.id);
    categoryCounts.set(category, usedCategoryCount + 1);
    result.push(evaluation);
  };

  strong.forEach((evaluation) => add(evaluation, true));
  ordered.forEach((evaluation) => add(evaluation, true));

  if (result.length < limit) {
    ordered.forEach((evaluation) => add(evaluation, false));
  }

  return result;
}

function buildCategoryPreferencePolicy(values: string[]) {
  const tokens = values.flatMap(splitPreferenceTokens);
  const allowedCategories: string[] = [];
  const blockedCategories: string[] = [];
  const preferredTerms: string[] = [];
  const allow = (categories: string[], terms: string[] = []) => {
    allowedCategories.push(...categories);
    preferredTerms.push(...terms);
  };
  const block = (categories: string[]) => blockedCategories.push(...categories);

  tokens.forEach((token) => {
    const clean = stripNegativePrefix(token);

    if (!clean || /都可以|随便|没想法|不限/.test(clean)) {
      return;
    }

    if (/中式简餐|中餐简餐|中式|中餐/.test(clean)) {
      allow(["快餐", "粉面", "家常菜", "粤菜", "潮汕菜", "东北菜"], ["中式", "简餐", "饭", "粉", "面"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/粉面|面条|汤粉|云吞|小面|粥粉面/.test(clean)) {
      allow(["粉面"], ["粉", "面", "云吞", "汤粉"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品"]);
      return;
    }

    if (/米饭|套餐|盖饭|便当|快餐|简餐/.test(clean)) {
      allow(["快餐", "家常菜", "粤菜", "潮汕菜", "东北菜"], ["饭", "套餐", "便当", "简餐"]);
      block(["咖啡", "奶茶", "甜品"]);
      return;
    }

    if (/家常菜|下饭|炒菜/.test(clean)) {
      allow(["家常菜", "快餐", "粤菜", "潮汕菜", "东北菜"], ["家常菜", "下饭", "炒菜", "套餐", "米饭", "汤饭"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/新疆菜|新疆|大盘鸡|手抓饭|新疆拌面|羊肉串|烤馕|馕/.test(clean)) {
      allow(["新疆菜"], ["新疆菜", "新疆", "大盘鸡", "手抓饭", "新疆拌面", "羊肉串", "烤馕", "馕"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/东北菜|东北|铁锅炖|锅包肉|地三鲜|东北大拉皮/.test(clean)) {
      allow(["东北菜"], ["东北菜", "东北", "铁锅炖", "锅包肉", "地三鲜", "东北大拉皮"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/粤菜|广式|烧腊|肠粉|茶餐厅|煲仔饭|老广|鸡煲/.test(clean)) {
      allow(["粤菜", "潮汕菜"], ["粤菜", "广式", "烧腊", "肠粉", "茶餐厅", "煲仔饭", "老广", "鸡煲"]);
      return;
    }

    if (/轻食|沙拉|减脂|低脂/.test(clean)) {
      allow(["轻食"], ["轻食", "沙拉", "清淡", "低脂"]);
      block(["火锅", "烧烤", "川湘菜", "新疆菜"]);
      return;
    }

    if (/西餐|披萨|意面|牛排/.test(clean)) {
      allow(["西餐"], ["西餐", "披萨", "意面", "牛排"]);
      return;
    }

    if (/日料|寿司|咖喱饭|日式/.test(clean)) {
      allow(["日料"], ["日料", "寿司", "日式"]);
      return;
    }

    if (/韩餐|韩式|年糕|部队锅/.test(clean)) {
      allow(["韩餐"], ["韩餐", "韩式"]);
      return;
    }

    if (/川湘|川菜|湘菜|香辣|麻辣|辣味|干锅|小炒/.test(clean)) {
      allow(["川湘菜", "家常菜"], ["川湘", "川菜", "湘菜", "香辣", "麻辣", "干锅", "小炒", "下饭"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/火锅|冒菜|麻辣烫/.test(clean)) {
      allow(["火锅", "川湘菜"], ["火锅", "冒菜", "麻辣烫"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/烧烤|烤串|炸物|炸鸡/.test(clean)) {
      allow(["烧烤", "快餐"], ["烧烤", "烤", "炸"]);
      return;
    }

    if (/奶茶|茶饮/.test(clean)) {
      allow(["奶茶"], ["奶茶", "茶饮"]);
      return;
    }

    if (/咖啡/.test(clean)) {
      allow(["咖啡"], ["咖啡"]);
      return;
    }

    if (/甜品|糖水/.test(clean)) {
      allow(["甜品"], ["甜品", "糖水"]);
    }
  });

  return {
    allowedCategories: uniqueStrings(allowedCategories),
    blockedCategories: uniqueStrings(blockedCategories),
    preferredTerms: uniqueStrings(preferredTerms)
  };
}

function buildTemporaryAvoidPolicy(values: string[]) {
  const blockedCategories: string[] = [];
  const avoidTerms: string[] = [];
  const block = (categories: string[], terms: string[] = []) => {
    blockedCategories.push(...categories);
    avoidTerms.push(...terms);
  };

  values.flatMap(splitPreferenceTokens).forEach((token) => {
    const clean = stripNegativePrefix(token);

    if (!clean || /没有忌口|无忌口|都可以/.test(clean)) {
      return;
    }

    if (/油炸|炸物|炸鸡|薯条/.test(clean)) {
      block([], ["油炸", "炸物", "炸鸡", "薯条", "炸"]);
      return;
    }

    if (/太辣|重口|麻辣|香辣|辣/.test(clean)) {
      block(["川湘菜", "火锅", "烧烤"], ["麻辣", "香辣", "重辣", "中辣", "重口"]);
      return;
    }

    if (/米饭|饭|盖饭|便当|焗饭|炒饭|抓饭|套餐饭/.test(clean)) {
      block([], ["米饭", "盖饭", "便当", "焗饭", "炒饭", "抓饭", "套餐饭", "饭"]);
      return;
    }

    if (/汤粉|汤面|粉面|面条|面|云吞/.test(clean)) {
      block(["粉面"], ["汤粉", "汤面", "粉面", "面条", "云吞面", "小面"]);
      return;
    }

    if (/甜口|甜品|糖水|奶茶/.test(clean)) {
      block(["甜品", "奶茶"], ["甜", "糖水", "奶茶"]);
      return;
    }

    if (/冷食|沙拉/.test(clean)) {
      block(["轻食"], ["沙拉", "冷食"]);
      return;
    }

    if (/西餐|披萨|意面|牛排/.test(clean)) {
      block(["西餐"], ["西餐", "披萨", "意面", "牛排"]);
      return;
    }

    if (/日料|寿司|日式/.test(clean)) {
      block(["日料"], ["日料", "寿司", "日式"]);
      return;
    }

    if (/韩餐|韩式/.test(clean)) {
      block(["韩餐"], ["韩餐", "韩式"]);
      return;
    }

    avoidTerms.push(clean);
  });

  return {
    blockedCategories: uniqueStrings(blockedCategories),
    avoidTerms: uniqueStrings(avoidTerms)
  };
}

function splitPreferenceTokens(value: string) {
  return String(value || "")
    .split(/[、,，/／;；|｜\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripNegativePrefix(value: string) {
  return value
    .trim()
    .replace(/^(这次)?(不想吃|不想要|不要|别来|避开|不能吃|不吃)/, "")
    .trim();
}

function sortCandidateEvaluations(evaluations: FoodCandidateEvaluation[]) {
  return evaluations.slice().sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.baseScore !== a.baseScore) {
      return b.baseScore - a.baseScore;
    }

    return a.shop.name.localeCompare(b.shop.name, "zh-Hans-CN");
  });
}

function roundRobinByCategoryEvaluation(evaluations: FoodCandidateEvaluation[]) {
  const sourceOrder: RestaurantSource[] = ["manual_sample", "manual_public_curated", "synthetic_mvp"];
  const orderedBySource = [
    ...sourceOrder.flatMap((source) => evaluations.filter((evaluation) => evaluation.shop.source === source)),
    ...evaluations.filter((evaluation) => !sourceOrder.includes(evaluation.shop.source))
  ];
  const groups = new Map<string, FoodCandidateEvaluation[]>();

  for (const evaluation of orderedBySource) {
    const key = evaluation.shop.category || "other";
    groups.set(key, [...(groups.get(key) ?? []), evaluation]);
  }

  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const result: FoodCandidateEvaluation[] = [];
  let index = 0;

  while (result.length < orderedBySource.length) {
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

function distanceTolerance(distanceMaxMeters: number) {
  return Math.max(80, Math.round(distanceMaxMeters * 0.15));
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

function extractDistanceMaxMeters(value: string) {
  const text = value.trim().toLowerCase();
  if (!text || /远一点|远点|都可以|不限|无所谓/.test(text)) {
    return undefined;
  }

  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:公里|km|千米)/i);
  if (kmMatch) {
    return Math.round(Number(kmMatch[1]) * 1000);
  }

  const meterMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:米|m)/i);
  if (meterMatch) {
    return Math.round(Number(meterMatch[1]));
  }

  return undefined;
}

function toFoodCandidateCard(
  shop: Shop,
  features?: ShopFeature,
  sceneFit?: SceneFit,
  regions: Region[] = [],
  positivePolicy?: PositiveFoodPreferencePolicy,
  positiveReasons: string[] = []
): FoodRecommendationCard {
  const sceneKey = getCandidateSummarySceneKey(positivePolicy);
  const matchedTags = uniqueStrings([
    ...positiveReasons,
    ...shop.tags,
    ...(shop.cuisines ?? []),
    ...(features?.featureTags ?? []),
    ...(features?.tasteTags ?? []),
    ...(features?.sceneTags ?? []),
    ...(features?.crowdTags ?? [])
  ]).slice(0, 6);
  const riskHints = uniqueStrings([
    ...(sceneFit?.riskHints[sceneKey] ?? []),
    ...(features?.riskHints ?? []),
  ]).slice(0, 3);
  const rankReasons = uniqueStrings([
    ...positiveReasons,
    ...buildContextualFeatureHints(features, positivePolicy),
    ...(sceneFit?.explainHints[sceneKey] ?? []),
    ...(features?.explainHints ?? []),
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

function getCandidateSummarySceneKey(policy?: PositiveFoodPreferencePolicy): DiningScene {
  if (policy?.scene) {
    return policy.scene;
  }

  return "soloToday";
}

function buildContextualFeatureHints(features: ShopFeature | undefined, policy?: PositiveFoodPreferencePolicy) {
  if (!features || !policy) {
    return [];
  }

  const hints: string[] = [];

  if ((policy.intents.includes("chat") || policy.intents.includes("group")) && features.chatFriendly) {
    hints.push("适合聊天");
  }

  if (policy.intents.includes("group") && features.groupFriendly) {
    hints.push("多人约饭友好");
  }

  if ((policy.intents.includes("quick") || policy.intents.includes("workdayFast")) && features.queueRisk === "low") {
    hints.push("排队风险较低");
  }

  if (policy.intents.includes("weekend") && features.rainyDayFriendly) {
    hints.push("适合周末停留");
  }

  if ((policy.intents.includes("light") || policy.intents.includes("lowOil")) && features.supportsNonSpicy) {
    hints.push("清淡不辣可选");
  }

  return hints;
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

function auditAndRepairRecommendations(
  recommendations: FoodRecommendationCard[],
  localCandidates: FoodRecommendationCard[],
  hardFilter: HardFoodFilterPolicy
) {
  const usedIds = new Set<string>();
  const accepted: FoodRecommendationCard[] = [];

  recommendations.forEach((recommendation) => {
    if (usedIds.has(recommendation.id) || !isRecommendationCardAllowed(recommendation, hardFilter)) {
      return;
    }

    accepted.push(recommendation);
    usedIds.add(recommendation.id);
  });

  localCandidates.forEach((candidate) => {
    if (accepted.length >= 3 || usedIds.has(candidate.id) || !isRecommendationCardAllowed(candidate, hardFilter)) {
      return;
    }

    accepted.push(candidate);
    usedIds.add(candidate.id);
  });

  if (accepted.length < 2) {
    throw new Error("Food recommendation audit left fewer than 2 valid recommendations.");
  }

  return accepted.slice(0, 3);
}

function isRecommendationCardAllowed(recommendation: FoodRecommendationCard, hardFilter: HardFoodFilterPolicy) {
  const text = buildRecommendationCardSearchText(recommendation);
  const price = readNumberFromText(recommendation.perCapita);

  if (hardFilter.budgetMax && price !== undefined && price > hardFilter.budgetMax + budgetTolerance(hardFilter.budgetMax)) {
    return false;
  }

  if (hardFilter.distanceMaxMeters && recommendation.distanceMeters !== undefined && recommendation.distanceMeters > hardFilter.distanceMaxMeters + distanceTolerance(hardFilter.distanceMaxMeters)) {
    return false;
  }

  if (hardFilter.noSpicy && isClearlySpicyRecommendation(text)) {
    return false;
  }

  if (hardFilter.blockedCategories.includes(recommendation.type)) {
    return false;
  }

  if (hardFilter.avoidTerms.some((term) => candidateTextIncludes(text, term))) {
    return false;
  }

  if (hardFilter.hardDynamicTerms.some((term) => candidateTextIncludes(text, stripNegativePrefix(term)))) {
    return false;
  }

  return true;
}

function buildRecommendationCardSearchText(recommendation: FoodRecommendationCard) {
  return [
    recommendation.name,
    recommendation.type,
    recommendation.perCapita,
    recommendation.distance,
    recommendation.matchedTags.join(" "),
    recommendation.reason,
    recommendation.riskTip
  ].join(" ").toLowerCase();
}

function isClearlySpicyRecommendation(text: string) {
  const nonSpicyPattern = /(不辣可选|不辣|无辣|少辣|清淡|non.?spicy|no.?spicy)/i;
  const spicyPattern = /(麻辣|香辣|重辣|中辣|川菜|湘菜|火锅|冒菜|串串|烤鱼|酸辣粉|螺蛳粉|spicy|mala|hotpot)/i;

  return spicyPattern.test(text) && !nonSpicyPattern.test(text);
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
