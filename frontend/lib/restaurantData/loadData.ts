import { promises as fs } from "fs";
import path from "path";
import type { DataSourceMetaFile, Dish, Region, RestaurantDataSet, Shop, ShopFeature } from "./types";

type RegionFile = {
  regions: Region[];
};

type ShopsFile = {
  shops: Shop[];
};

type DishesFile = {
  dishes: Dish[];
};

type FeaturesFile = {
  features: ShopFeature[];
};

let cachedData: RestaurantDataSet | null = null;

function restaurantDataDir() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "restaurant");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadRestaurantData(options: { fresh?: boolean } = {}): Promise<RestaurantDataSet> {
  if (cachedData && !options.fresh) {
    return cachedData;
  }

  const baseDir = restaurantDataDir();
  const [regionFile, shopsFile, dishesFile, featuresFile, sourceMeta] = await Promise.all([
    readJsonFile<RegionFile>(path.join(baseDir, "regions", "guangzhou_university_town.json")),
    readJsonFile<ShopsFile>(path.join(baseDir, "shops.gut.seed.json")),
    readJsonFile<DishesFile>(path.join(baseDir, "dishes.gut.seed.json")),
    readJsonFile<FeaturesFile>(path.join(baseDir, "shop-features.gut.seed.json")),
    readJsonFile<DataSourceMetaFile>(path.join(baseDir, "data-source-meta.json"))
  ]);

  const shopsById = new Map(shopsFile.shops.map((shop) => [shop.id, shop]));
  const dishesByShopId = new Map<string, Dish[]>();

  dishesFile.dishes.forEach((dish) => {
    const current = dishesByShopId.get(dish.shopId) ?? [];
    current.push(dish);
    dishesByShopId.set(dish.shopId, current);
  });

  const featuresByShopId = new Map(featuresFile.features.map((feature) => [feature.shopId, feature]));

  cachedData = {
    regions: regionFile.regions,
    shops: shopsFile.shops,
    dishes: dishesFile.dishes,
    features: featuresFile.features,
    sourceMeta,
    shopsById,
    dishesByShopId,
    featuresByShopId
  };

  return cachedData;
}
