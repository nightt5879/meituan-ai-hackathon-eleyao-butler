import { searchShops } from "./searchService";
import type { PreferenceSlots, RankedShop, ShopSearchItem, UserMemory } from "./types";

function normalizeList(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function hasAnyTag(shop: ShopSearchItem, tags: string[]) {
  const shopTags = [...shop.tags, ...(shop.features?.featureTags ?? [])];
  return tags.filter((tag) => shopTags.includes(tag));
}

export async function rankShopsByPreference(slots: PreferenceSlots = {}, userMemory: UserMemory = {}, limit = 5) {
  const tasteTags = normalizeList(slots.tasteTags);
  const needTags = normalizeList(slots.needTags);
  const avoidTags = normalizeList(slots.avoidTags);
  const likedTags = normalizeList(userMemory.likedTags);
  const dislikedTags = normalizeList(userMemory.dislikedTags);
  const favoriteShopIds = normalizeList(userMemory.favoriteShopIds);
  const avoidedShopIds = normalizeList(userMemory.avoidedShopIds);
  const maxDistanceKm = slots.maxDistanceKm;

  const searchResult = await searchShops({
    center: slots.center,
    radiusKm: maxDistanceKm,
    categories: slots.categories,
    maxAvgPrice: slots.budgetMax ? slots.budgetMax + 20 : undefined,
    limit: 100
  });

  const ranked: RankedShop[] = searchResult.items
    .filter((shop) => !avoidedShopIds.includes(shop.id))
    .map((shop) => {
      let score = 50;
      const matchedTags: string[] = [];
      const rankReasons: string[] = [];
      const tasteMatches = hasAnyTag(shop, tasteTags);
      const needMatches = hasAnyTag(shop, needTags);
      const likedMatches = hasAnyTag(shop, likedTags);
      const dislikedMatches = hasAnyTag(shop, dislikedTags);
      const avoidMatches = hasAnyTag(shop, avoidTags);

      if (slots.budgetMax && shop.avgPrice !== null) {
        if (shop.avgPrice <= slots.budgetMax) {
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
      }

      if (shop.distanceKm !== undefined) {
        score += Math.max(0, 10 - shop.distanceKm * 2);
      }

      return {
        ...shop,
        score: Math.max(0, Math.min(100, Math.round(score))),
        matchedTags: unique(matchedTags),
        rankReasons: rankReasons.length > 0 ? unique(rankReasons) : ["基础匹配"]
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    items: ranked.slice(0, Math.max(1, Math.min(limit, 20))),
    total: ranked.length,
    limit
  };
}
