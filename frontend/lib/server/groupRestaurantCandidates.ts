import { distanceKm } from "@/lib/restaurantData/geo";
import { loadRestaurantData } from "@/lib/restaurantData/loadData";
import type { GeoPoint, Region, Shop, ShopFeature } from "@/lib/restaurantData/types";
import type { DinnerTask, MockRestaurant, Participant } from "@/lib/types";

/**
 * Builds real multi-person dining candidates from the shared restaurant dataset
 * (data/restaurant/*) so the OpenClaw group prompt selects from the same ~130
 * shops the single-person flow uses — instead of a hardcoded 3-restaurant mock.
 *
 * The diet hard-constraint (忌口/不吃辣) is ALWAYS enforced server-side before
 * the LLM sees a candidate. Budget/distance are applied as a soft tier so the
 * model still has enough options to compare and to mark over-budget ones as a
 * "失败对照" in its audit, mirroring the single-food strict-then-relaxed pool.
 */

const DEFAULT_CANDIDATE_LIMIT = 10;
const MIN_CANDIDATES = 4;

const BUDGET_LEVEL_MIDPOINT: Record<string, number> = {
  "20-30": 25,
  "30-50": 40,
  "50-80": 65,
  "80+": 90
};

type GroupHardConstraints = {
  budgetMax: number;
  budgetTolerance: number;
  requireNonSpicy: boolean;
  maxWalkMinutes?: number;
};

type EnrichedShop = {
  shop: Shop;
  features?: ShopFeature;
  avgPrice: number;
  distanceM: number;
  walkMinutes: number;
  sceneScore: number;
};

function hasNoSpicyHard(participant: Participant) {
  return participant.extracted_constraints.hard_constraints.some((item) => item.includes("不吃辣"));
}

function wantsNear(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.some((item) => item.includes("近"));
}

export function summarizeGroupConstraints(task: DinnerTask, participants: Participant[]): GroupHardConstraints {
  const globalBudget =
    task.global_constraints?.budget_max && task.global_constraints.budget_max > 0 ? task.global_constraints.budget_max : 100;
  const personalBudgets = participants
    .map((participant) => participant.manual_fields?.budget_max)
    .filter((budget): budget is number => typeof budget === "number" && Number.isFinite(budget) && budget > 0);
  const budgetMax = personalBudgets.length > 0 ? Math.min(globalBudget, ...personalBudgets) : globalBudget;
  const hasDeadline = participants.some((participant) => Boolean(participant.manual_fields?.leave_before));
  const wantsNearby = participants.some(wantsNear);

  return {
    budgetMax,
    budgetTolerance: Math.max(15, Math.round(budgetMax * 0.25)),
    requireNonSpicy: participants.some(hasNoSpicyHard),
    maxWalkMinutes: hasDeadline ? 15 : wantsNearby ? 20 : undefined
  };
}

function resolveCenter(shop: Shop, regions: Region[]): GeoPoint | undefined {
  const region =
    regions.find((item) => item.id === shop.regionId) ?? regions.find((item) => item.id === "guangzhou_university_town");
  return region?.center;
}

function resolveAvgPrice(shop: Shop, features?: ShopFeature): number {
  if (typeof shop.avgPrice === "number" && shop.avgPrice > 0) {
    return shop.avgPrice;
  }
  const level = typeof features?.budgetLevel === "string" ? BUDGET_LEVEL_MIDPOINT[features.budgetLevel] : undefined;
  return level ?? 60;
}

function resolveDistance(shop: Shop, regions: Region[]): { distanceM: number; walkMinutes: number } {
  const center = resolveCenter(shop, regions);
  if (!center) {
    return { distanceM: 1200, walkMinutes: 15 };
  }
  const km = distanceKm(center, { latitude: shop.latitude, longitude: shop.longitude });
  const distanceM = Math.max(1, Math.round(km * 1000));
  return { distanceM, walkMinutes: Math.max(1, Math.round(distanceM / 80)) };
}

function resolveQueueRisk(features?: ShopFeature): MockRestaurant["queue_risk"] {
  const risk = features?.queueRisk;
  return risk === "low" || risk === "high" ? risk : "medium";
}

function parseOpeningHours(hours?: string): { open: string; close: string } {
  const times = typeof hours === "string" ? hours.match(/\d{1,2}:\d{2}/g) : null;
  if (!times || times.length === 0) {
    return { open: "待确认", close: "待确认" };
  }
  return { open: times[0], close: times[times.length - 1] };
}

function isHotpot(shop: Shop): boolean {
  return [shop.category, ...(shop.cuisines ?? []), ...shop.tags].join(" ").includes("火锅");
}

function buildTags(shop: Shop, features?: ShopFeature): string[] {
  const tags = [...shop.tags, ...(features?.featureTags ?? []), ...(features?.tasteTags ?? [])]
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 6);
}

function toCandidate(entry: EnrichedShop): MockRestaurant {
  const { shop, features, avgPrice, distanceM, walkMinutes } = entry;
  const hours = parseOpeningHours(shop.openingHours);

  return {
    restaurant_id: shop.id,
    name: shop.name,
    category: shop.category || "餐饮",
    avg_price: avgPrice,
    distance_m: distanceM,
    walk_minutes: walkMinutes,
    open_time: hours.open,
    close_time: hours.close,
    supports_spicy: features?.supportsSpicy !== false,
    supports_non_spicy: features?.supportsNonSpicy !== false,
    is_hotpot: isHotpot(shop),
    quiet_score: typeof features?.quietScore === "number" ? features.quietScore : 4,
    chat_friendly: features?.chatFriendly !== false,
    queue_risk: resolveQueueRisk(features),
    rating: shop.rating ?? shop.syntheticRating ?? 4.5,
    tags: buildTags(shop, features)
  };
}

export async function buildGroupRestaurantCandidates(
  task: DinnerTask,
  participants: Participant[],
  options: { limit?: number } = {}
): Promise<MockRestaurant[]> {
  const limit = Math.max(MIN_CANDIDATES, options.limit ?? DEFAULT_CANDIDATE_LIMIT);
  const data = await loadRestaurantData();
  const constraints = summarizeGroupConstraints(task, participants);

  const enriched: EnrichedShop[] = data.shops.map((shop) => {
    const features = data.featuresByShopId.get(shop.id);
    const distance = resolveDistance(shop, data.regions);
    return {
      shop,
      features,
      avgPrice: resolveAvgPrice(shop, features),
      distanceM: distance.distanceM,
      walkMinutes: distance.walkMinutes,
      sceneScore: data.sceneFitByShopId.get(shop.id)?.sceneScores.groupMeetup ?? 0
    };
  });

  const passesNonSpicy = (entry: EnrichedShop) =>
    constraints.requireNonSpicy ? entry.features?.supportsNonSpicy !== false : true;
  const passesBudget = (entry: EnrichedShop) => entry.avgPrice <= constraints.budgetMax + constraints.budgetTolerance;
  const passesWalk = (entry: EnrichedShop) =>
    constraints.maxWalkMinutes === undefined ? true : entry.walkMinutes <= constraints.maxWalkMinutes + 5;

  const byScene = (a: EnrichedShop, b: EnrichedShop) =>
    b.sceneScore !== a.sceneScore ? b.sceneScore - a.sceneScore : a.distanceM - b.distanceM;

  // Tier 1: fully compliant with all hard constraints.
  const compliant = enriched
    .filter((entry) => passesNonSpicy(entry) && passesBudget(entry) && passesWalk(entry))
    .sort(byScene);

  // Tier 2: keep the non-negotiable diet constraint, relax budget/distance to fill the pool.
  const relaxedFill = enriched
    .filter((entry) => passesNonSpicy(entry) && !(passesBudget(entry) && passesWalk(entry)))
    .sort(byScene);

  const ordered = [...compliant, ...relaxedFill];
  const pool = ordered.length > 0 ? ordered : enriched.slice().sort(byScene);

  return pool.slice(0, limit).map(toCandidate);
}
