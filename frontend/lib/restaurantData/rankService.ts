import { searchShops } from "./searchService";
import type { DiningScene, GeoPoint, PreferenceSlots, RankedShop, ShopSearchItem, UserMemory } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeList(value: unknown) {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];

  return values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLimit(value: unknown, fallback: number, max: number) {
  const parsed = normalizeNumber(value);

  if (parsed === undefined) {
    return fallback;
  }

  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function normalizeGeoPoint(value: unknown): GeoPoint | undefined {
  const record = asRecord(value);
  const latitude = normalizeNumber(record.latitude);
  const longitude = normalizeNumber(record.longitude);

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  return { latitude, longitude };
}

function normalizeScene(value: unknown): DiningScene | undefined {
  return value === "soloToday" || value === "groupMeetup" || value === "weekendPlan" ? value : undefined;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function hasAnyTag(shop: ShopSearchItem, tags: string[]) {
  const shopTags = [
    ...shop.tags,
    ...(shop.cuisines ?? []),
    ...(shop.features?.featureTags ?? []),
    ...(shop.features?.tasteTags ?? []),
    ...(shop.features?.sceneTags ?? []),
    ...(shop.features?.crowdTags ?? [])
  ];
  return tags.filter((tag) => shopTags.includes(tag));
}

export async function rankShopsByPreference(rawSlots: PreferenceSlots = {}, rawUserMemory: UserMemory = {}, rawLimit = 5) {
  const slots = asRecord(rawSlots);
  const userMemory = asRecord(rawUserMemory);
  const tasteTags = normalizeList(slots.tasteTags);
  const needTags = normalizeList(slots.needTags);
  const avoidTags = normalizeList(slots.avoidTags);
  const likedTags = normalizeList(userMemory.likedTags);
  const dislikedTags = normalizeList(userMemory.dislikedTags);
  const favoriteShopIds = normalizeList(userMemory.favoriteShopIds);
  const avoidedShopIds = normalizeList(userMemory.avoidedShopIds);
  const budgetMax = normalizeNumber(slots.budgetMax);
  const maxDistanceKm = normalizeNumber(slots.maxDistanceKm);
  const scene = normalizeScene(slots.scene);
  const limit = normalizeLimit(rawLimit, 5, 20);

  const searchResult = await searchShops({
    center: normalizeGeoPoint(slots.center),
    radiusKm: maxDistanceKm,
    categories: normalizeList(slots.categories),
    maxAvgPrice: budgetMax ? budgetMax + 20 : undefined,
    scene,
    limit: 100
  });

  const ranked: RankedShop[] = searchResult.items
    .filter((shop) => !avoidedShopIds.includes(shop.id))
    .map((shop) => {
      let score = 50;
      const matchedTags: string[] = [];
      const rankReasons: string[] = [];
      const riskHints: string[] = [];
      const tasteMatches = hasAnyTag(shop, tasteTags);
      const needMatches = hasAnyTag(shop, needTags);
      const likedMatches = hasAnyTag(shop, likedTags);
      const dislikedMatches = hasAnyTag(shop, dislikedTags);
      const avoidMatches = hasAnyTag(shop, avoidTags);
      const sceneScore = scene ? shop.sceneFit?.sceneScores[scene] : undefined;

      if (budgetMax && shop.avgPrice !== null) {
        if (shop.avgPrice <= budgetMax) {
          score += 18;
          rankReasons.push("预算内");
        } else {
          score -= 12;
          rankReasons.push("略超预算");
        }
      }

      if (tasteMatches.length > 0) {
        score += tasteMatches.length * 8;
        matchedTags.push(...tasteMatches);
      }

      if (needMatches.length > 0) {
        score += needMatches.length * 10;
        matchedTags.push(...needMatches);
      }

      if (likedMatches.length > 0) {
        score += likedMatches.length * 6;
        matchedTags.push(...likedMatches);
      }

      if (dislikedMatches.length > 0) {
        score -= dislikedMatches.length * 8;
      }

      if (avoidMatches.length > 0) {
        score -= avoidMatches.length * 20;
        rankReasons.push("命中回避标签");
      }

      if (favoriteShopIds.includes(shop.id)) {
        score += 12;
        rankReasons.push("历史偏好店铺");
      }

      if (shop.features?.chatFriendly && needTags.includes("适合聊天")) {
        score += 10;
        rankReasons.push("适合聊天");
      }

      if (shop.features?.supportsNonSpicy && (needTags.includes("不辣可选") || tasteTags.includes("清淡"))) {
        score += 8;
        rankReasons.push("不辣可选");
      }

      if (shop.features?.queueRisk === "low") {
        score += 5;
      } else if (shop.features?.queueRisk === "high") {
        score -= 8;
        riskHints.push("模拟风险：高峰时段可能需要预留等待弹性");
      }

      if (shop.distanceKm !== undefined) {
        score += Math.max(0, 10 - shop.distanceKm * 2);
      }

      if (scene && sceneScore !== undefined) {
        score += Math.round((sceneScore - 50) * 0.45);
        rankReasons.push(...(shop.sceneFit?.explainHints[scene] ?? []));
        riskHints.push(...(shop.sceneFit?.riskHints[scene] ?? []));
      }

      if (scene === "soloToday") {
        if (shop.features?.soloFriendly) {
          score += 12;
          rankReasons.push("适合单人快吃");
        }

        if (shop.features?.queueRisk === "low") {
          score += 8;
          rankReasons.push("模拟排队风险较低");
        }

        if (shop.features?.supportsNonSpicy && (needTags.includes("不辣可选") || tasteTags.includes("清淡"))) {
          score += 6;
        }
      }

      if (scene === "groupMeetup") {
        if (shop.features?.groupFriendly) {
          score += 12;
          rankReasons.push("多人约饭适配");
        }

        if (shop.features?.chatFriendly) {
          score += 8;
          rankReasons.push("适合朋友聊天");
        }

        if (shop.features?.noiseLevel === "low" || shop.features?.noiseLevel === "medium") {
          score += 6;
          rankReasons.push("噪声模拟等级可接受");
        } else if (shop.features?.noiseLevel === "high") {
          score -= 12;
          riskHints.push("模拟风险：环境可能偏热闹，不适合安静聊天");
        }
      }

      if (scene === "weekendPlan") {
        if (shop.features?.rainyDayFriendly) {
          score += 8;
          rankReasons.push("雨天室内友好");
        }

        if (shop.features?.chatFriendly) {
          score += 6;
          rankReasons.push("适合停留聊天");
        }

        if (["咖啡", "甜品", "轻食"].includes(shop.category)) {
          score += 8;
          rankReasons.push("适合作为咖啡甜品或轻食节点");
        }
      }

      riskHints.push(...(shop.features?.riskHints ?? []));

      return {
        ...shop,
        score: Math.max(0, Math.min(100, Math.round(score))),
        matchedTags: unique(matchedTags),
        rankReasons: rankReasons.length > 0 ? unique(rankReasons) : ["基础匹配"],
        riskHints: unique(riskHints)
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    items: ranked.slice(0, limit),
    total: ranked.length,
    limit
  };
}
