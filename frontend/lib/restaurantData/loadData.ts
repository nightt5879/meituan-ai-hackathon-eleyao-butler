import { promises as fs } from "fs";
import path from "path";
import type { DataSourceMetaFile, Dish, Region, RestaurantDataSet, SceneFit, Shop, ShopFeature } from "./types";

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

type SceneFitsFile = {
  sceneFits: SceneFit[];
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
  const [regionFile, gutShopsFile, syntheticShopsFile, gutDishesFile, syntheticDishesFile, gutFeaturesFile, syntheticFeaturesFile, sceneFitsFile, sourceMeta] = await Promise.all([
    readJsonFile<RegionFile>(path.join(baseDir, "regions", "guangzhou_university_town.json")),
    readJsonFile<ShopsFile>(path.join(baseDir, "shops.gut.seed.json")),
    readJsonFile<ShopsFile>(path.join(baseDir, "shops.synthetic.seed.json")),
    readJsonFile<DishesFile>(path.join(baseDir, "dishes.gut.seed.json")),
    readJsonFile<DishesFile>(path.join(baseDir, "dishes.synthetic.seed.json")),
    readJsonFile<FeaturesFile>(path.join(baseDir, "shop-features.gut.seed.json")),
    readJsonFile<FeaturesFile>(path.join(baseDir, "shop-features.synthetic.seed.json")),
    readJsonFile<SceneFitsFile>(path.join(baseDir, "scene-fit.synthetic.seed.json")),
    readJsonFile<DataSourceMetaFile>(path.join(baseDir, "data-source-meta.json"))
  ]);

  const shops = [...gutShopsFile.shops, ...syntheticShopsFile.shops];
  const dishes = [...gutDishesFile.dishes, ...syntheticDishesFile.dishes];
  const features = [...gutFeaturesFile.features, ...syntheticFeaturesFile.features];
  const sceneFits = sceneFitsFile.sceneFits;
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const dishesByShopId = new Map<string, Dish[]>();

  dishes.forEach((dish) => {
    const current = dishesByShopId.get(dish.shopId) ?? [];
    current.push(dish);
    dishesByShopId.set(dish.shopId, current);
  });

  const featuresByShopId = new Map(features.map((feature) => [feature.shopId, feature]));
  const sceneFitByShopId = new Map(sceneFits.map((sceneFit) => [sceneFit.shopId, sceneFit]));

  cachedData = {
    regions: regionFile.regions,
    shops,
    dishes,
    features,
    sceneFits,
    sourceMeta,
    shopsById,
    dishesByShopId,
    featuresByShopId,
    sceneFitByShopId
  };

  return cachedData;
}
