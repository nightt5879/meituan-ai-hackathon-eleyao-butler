import { distanceKm } from "./geo";
import { loadRestaurantData } from "./loadData";
import type { DiningScene, DishSearchItem, GeoPoint, SearchDishesFilters, SearchShopsQuery, Shop, ShopSearchItem } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown) {
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

function includesAll(sourceTags: string[], requiredTags: string[]) {
  if (requiredTags.length === 0) {
    return true;
  }

  return requiredTags.every((tag) => sourceTags.includes(tag));
}

function matchesKeyword(shop: Shop, keyword: string) {
  if (!keyword) {
    return true;
  }

  const haystack = [shop.name, shop.category, shop.address, ...(shop.cuisines ?? []), ...shop.tags].join(" ").toLowerCase();
  return haystack.includes(keyword);
}

function combinedShopTags(shop: ShopSearchItem) {
  return [
    ...shop.tags,
    ...(shop.cuisines ?? []),
    ...(shop.features?.featureTags ?? []),
    ...(shop.features?.tasteTags ?? []),
    ...(shop.features?.sceneTags ?? []),
    ...(shop.features?.crowdTags ?? [])
  ];
}

export async function searchShops(rawQuery: SearchShopsQuery = {}) {
  const data = await loadRestaurantData();
  const query = asRecord(rawQuery);
  const keyword = normalizeText(query.keyword);
  const categories = normalizeStringList(query.categories);
  const tags = normalizeStringList(query.tags);
  const sources = normalizeStringList(query.sources);
  const center = normalizeGeoPoint(query.center);
  const radiusKm = normalizeNumber(query.radiusKm);
  const maxAvgPrice = normalizeNumber(query.maxAvgPrice);
  const regionId = normalizeString(query.regionId);
  const scene = normalizeScene(query.scene);
  const limit = normalizeLimit(query.limit, 20, data.shops.length);

  const items: ShopSearchItem[] = data.shops
    .filter((shop) => !regionId || shop.regionId === regionId)
    .filter((shop) => categories.length === 0 || categories.includes(shop.category))
    .filter((shop) => sources.length === 0 || sources.includes(shop.source))
    .filter((shop) => maxAvgPrice === undefined || shop.avgPrice === null || shop.avgPrice <= maxAvgPrice)
    .filter((shop) => matchesKeyword(shop, keyword))
    .map((shop) => {
      const distance = center ? distanceKm(center, { latitude: shop.latitude, longitude: shop.longitude }) : undefined;

      return {
        ...shop,
        distanceKm: distance,
        features: data.featuresByShopId.get(shop.id),
        sceneFit: data.sceneFitByShopId.get(shop.id)
      };
    })
    .filter((shop) => includesAll(combinedShopTags(shop), tags))
    .filter((shop) => radiusKm === undefined || shop.distanceKm === undefined || shop.distanceKm <= radiusKm)
    .sort((a, b) => {
      if (scene) {
        const sceneDelta = (b.sceneFit?.sceneScores[scene] ?? -1) - (a.sceneFit?.sceneScores[scene] ?? -1);

        if (sceneDelta !== 0) {
          return sceneDelta;
        }
      }

      if (a.distanceKm !== undefined || b.distanceKm !== undefined) {
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      }

      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });

  return {
    items: items.slice(0, limit),
    total: items.length,
    limit
  };
}

export async function getShopDetail(shopId: string) {
  const data = await loadRestaurantData();
  const shop = data.shopsById.get(shopId);

  if (!shop) {
    return null;
  }

  return {
    shop,
    features: data.featuresByShopId.get(shop.id) ?? null,
    sceneFit: data.sceneFitByShopId.get(shop.id) ?? null,
    dishes: data.dishesByShopId.get(shop.id) ?? [],
    sourceMeta: data.sourceMeta.sources.filter((source) => source.id === shop.sourceId)
  };
}

export async function searchDishes(rawFilters: SearchDishesFilters = {}) {
  const data = await loadRestaurantData();
  const filters = asRecord(rawFilters);
  const keyword = normalizeText(filters.keyword);
  const shopId = normalizeString(filters.shopId);
  const tags = normalizeStringList(filters.tags);
  const spicyLevels = normalizeStringList(filters.spicyLevels);
  const sources = normalizeStringList(filters.sources);
  const maxPrice = normalizeNumber(filters.maxPrice);
  const limit = normalizeLimit(filters.limit, 20, 100);

  const items: DishSearchItem[] = data.dishes
    .filter((dish) => !shopId || dish.shopId === shopId)
    .filter((dish) => sources.length === 0 || sources.includes(dish.source))
    .filter((dish) => maxPrice === undefined || dish.price <= maxPrice)
    .filter((dish) => spicyLevels.length === 0 || spicyLevels.includes(dish.spicyLevel))
    .filter((dish) => includesAll(dish.tags, tags))
    .filter((dish) => {
      if (!keyword) {
        return true;
      }

      const shop = data.shopsById.get(dish.shopId);
      const haystack = [dish.name, dish.category, ...(dish.tags ?? []), shop?.name ?? "", shop?.category ?? ""].join(" ").toLowerCase();
      return haystack.includes(keyword);
    })
    .map((dish) => {
      const shop = data.shopsById.get(dish.shopId);

      return {
        ...dish,
        shop: {
          id: shop?.id ?? dish.shopId,
          name: shop?.name ?? "Unknown shop",
          category: shop?.category ?? "unknown",
          source: shop?.source ?? dish.source,
          sourceId: shop?.sourceId ?? dish.sourceId
        }
      };
    })
    .sort((a, b) => a.price - b.price);

  return {
    items: items.slice(0, limit),
    total: items.length,
    limit
  };
}
