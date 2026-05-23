import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(frontendRoot, "data", "restaurant");

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(from, to) {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(dataDir, relativePath), "utf8");
  return JSON.parse(raw);
}

function pushError(errors, message) {
  errors.push(message);
}

const [regionFile, shopsFile, dishesFile, featuresFile, metaFile] = await Promise.all([
  readJson(path.join("regions", "guangzhou_university_town.json")),
  readJson("shops.gut.seed.json"),
  readJson("dishes.gut.seed.json"),
  readJson("shop-features.gut.seed.json"),
  readJson("data-source-meta.json")
]);

const errors = [];
const regions = regionFile.regions ?? [];
const shops = shopsFile.shops ?? [];
const dishes = dishesFile.dishes ?? [];
const features = featuresFile.features ?? [];
const sourceKinds = metaFile.sourceKinds ?? {};
const sourceIds = new Set((metaFile.sources ?? []).map((source) => source.id));
const regionById = new Map(regions.map((region) => [region.id, region]));
const shopById = new Map(shops.map((shop) => [shop.id, shop]));
const dishesByShopId = new Map();

function validateSource(entityName, entity) {
  if (!required(entity.source)) {
    pushError(errors, `${entityName} is missing source.`);
  } else if (!sourceKinds[entity.source]) {
    pushError(errors, `${entityName} has unknown source "${entity.source}".`);
  }

  if (!required(entity.sourceId)) {
    pushError(errors, `${entityName} is missing sourceId.`);
  } else if (!sourceIds.has(entity.sourceId)) {
    pushError(errors, `${entityName} has sourceId "${entity.sourceId}" not found in data-source-meta.json.`);
  }
}

if (regions.length === 0) {
  pushError(errors, "At least one region is required.");
}

regions.forEach((region) => {
  validateSource(`region ${region.id}`, region);
});

shops.forEach((shop) => {
  ["id", "name", "category", "address", "latitude", "longitude", "source"].forEach((field) => {
    if (!required(shop[field])) {
      pushError(errors, `shop ${shop.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(`shop ${shop.id}`, shop);

  const region = regionById.get(shop.regionId);
  if (!region) {
    pushError(errors, `shop ${shop.id} references unknown regionId "${shop.regionId}".`);
  } else {
    const distance = distanceKm({ latitude: shop.latitude, longitude: shop.longitude }, region.center);
    if (distance > region.validationRadiusKm) {
      pushError(errors, `shop ${shop.id} is ${distance.toFixed(2)}km from ${region.id}, outside validationRadiusKm ${region.validationRadiusKm}.`);
    }
  }
});

dishes.forEach((dish) => {
  ["id", "shopId", "name", "price", "source"].forEach((field) => {
    if (!required(dish[field])) {
      pushError(errors, `dish ${dish.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(`dish ${dish.id}`, dish);

  if (!shopById.has(dish.shopId)) {
    pushError(errors, `dish ${dish.id} references unknown shopId "${dish.shopId}".`);
  }

  const current = dishesByShopId.get(dish.shopId) ?? [];
  current.push(dish);
  dishesByShopId.set(dish.shopId, current);
});

shops.forEach((shop) => {
  const count = (dishesByShopId.get(shop.id) ?? []).length;
  if (count < 5) {
    pushError(errors, `shop ${shop.id} has ${count} dishes; at least 5 are required.`);
  }
});

features.forEach((feature) => {
  if (!required(feature.shopId)) {
    pushError(errors, "shop-feature is missing shopId.");
  } else if (!shopById.has(feature.shopId)) {
    pushError(errors, `shop-feature references unknown shopId "${feature.shopId}".`);
  }

  validateSource(`shop-feature ${feature.shopId}`, feature);
});

if (Object.keys(sourceKinds).length === 0) {
  pushError(errors, "data-source-meta.json must explain source kind meanings.");
}

if (sourceIds.size === 0) {
  pushError(errors, "data-source-meta.json must include source batches.");
}

if (errors.length > 0) {
  console.error("Restaurant data validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Restaurant data validation passed: ${shops.length} shops, ${dishes.length} dishes, ${features.length} feature records.`);
