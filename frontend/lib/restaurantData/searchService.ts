import { distanceKm } from "./geo";
import { loadRestaurantData } from "./loadData";
import type { DishSearchItem, SearchDishesFilters, SearchShopsQuery, Shop, ShopSearchItem } from "./types";

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesAll(sourceTags: string[], requiredTags: string[] | undefined) {
  if (!requiredTags || requiredTags.length === 0) {
    return true;
  }

  return requiredTags.every((tag) => sourceTags.includes(tag));
}

function matchesKeyword(shop: Shop, keyword: string) {
  if (!keyword) {
    return true;
  }

  const haystack = [shop.name, shop.category, shop.address, ...shop.tags].join(" ").toLowerCase();
  return haystack.includes(keyword);
}

export async function searchShops(query: SearchShopsQuery = {}) {
  const data = await loadRestaurantData();
  const keyword = normalizeText(query.keyword);
  const categories = query.categories ?? [];
  const limit = Math.max(1, Math.min(query.limit ?? 20, 100));

  const items: ShopSearchItem[] = data.shops
    .filter((shop) => !query.regionId || shop.regionId === query.regionId)
    .filter((shop) => categories.length === 0 || categories.includes(shop.category))
    .filter((shop) => query.sources === undefined || query.sources.includes(shop.source))
    .filter((shop) => query.maxAvgPrice === undefined || shop.avgPrice === null || shop.avgPrice <= query.maxAvgPrice)
    .filter((shop) => includesAll(shop.tags, query.tags))
    .filter((shop) => matchesKeyword(shop, keyword))
    .map((shop) => {
      const distance = query.center ? distanceKm(query.center, { latitude: shop.latitude, longitude: shop.longitude }) : undefined;

      return {
        ...shop,
        distanceKm: distance,
        features: data.featuresByShopId.get(shop.id)
      };
    })
    .filter((shop) => query.radiusKm === undefined || shop.distanceKm === undefined || shop.distanceKm <= query.radiusKm)
    .sort((a, b) => {
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
    dishes: data.dishesByShopId.get(shop.id) ?? [],
    sourceMeta: data.sourceMeta.sources.filter((source) => source.id === shop.sourceId)
  };
}

export async function searchDishes(filters: SearchDishesFilters = {}) {
  const data = await loadRestaurantData();
  const keyword = normalizeText(filters.keyword);
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));

  const items: DishSearchItem[] = data.dishes
    .filter((dish) => !filters.shopId || dish.shopId === filters.shopId)
    .filter((dish) => filters.sources === undefined || filters.sources.includes(dish.source))
    .filter((dish) => filters.maxPrice === undefined || dish.price <= filters.maxPrice)
    .filter((dish) => filters.spicyLevels === undefined || filters.spicyLevels.includes(dish.spicyLevel))
    .filter((dish) => includesAll(dish.tags, filters.tags))
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
