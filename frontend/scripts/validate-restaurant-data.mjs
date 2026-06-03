import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(frontendRoot, "data", "restaurant");
const syntheticSource = "synthetic_mvp";
const forbiddenSyntheticPhrases = ["美团评分", "大众点评榜单", "月售", "真实销量", "真实排队时间", "真实用户评论", "平台认证"];

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
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

function validateUniqueField(errors, items, field, label) {
  const seen = new Map();

  items.forEach((item, index) => {
    const value = item?.[field];
    if (!required(value)) {
      return;
    }

    if (seen.has(value)) {
      pushError(errors, `${label} ${field} "${value}" is duplicated at item ${index + 1}; first seen at item ${seen.get(value) + 1}.`);
      return;
    }

    seen.set(value, index);
  });
}

function normalizePolygon(points) {
  const center = {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length
  };

  return [...points].sort((a, b) => Math.atan2(a.latitude - center.latitude, a.longitude - center.longitude) - Math.atan2(b.latitude - center.latitude, b.longitude - center.longitude));
}

function pointInPolygon(point, rawPolygon) {
  const polygon = normalizePolygon(rawPolygon);
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersects = yi > point.latitude !== yj > point.latitude && point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInBbox(point, rawPolygon) {
  const minLat = Math.min(...rawPolygon.map((item) => item.latitude));
  const maxLat = Math.max(...rawPolygon.map((item) => item.latitude));
  const minLng = Math.min(...rawPolygon.map((item) => item.longitude));
  const maxLng = Math.max(...rawPolygon.map((item) => item.longitude));

  return point.latitude >= minLat && point.latitude <= maxLat && point.longitude >= minLng && point.longitude <= maxLng;
}

function validateSource(errors, sourceKinds, sourceIds, entityName, entity) {
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

function validateSyntheticEntity(errors, entityName, entity) {
  if (entity.source === syntheticSource && entity.synthetic !== true) {
    pushError(errors, `${entityName} has source=${syntheticSource} but synthetic is not true.`);
  }

  if (entity.synthetic === true && entity.source !== syntheticSource) {
    pushError(errors, `${entityName} is marked synthetic=true but source is "${entity.source}".`);
  }

  if (entity.source === syntheticSource && !isNumber(entity.confidence)) {
    pushError(errors, `${entityName} is synthetic_mvp but confidence is not a number.`);
  }
}

function validateSyntheticShopLocation(errors, shop, regionById, districtById, campusAnchors, manualShops) {
  const point = { latitude: shop.latitude, longitude: shop.longitude };
  const region = regionById.get(shop.regionId);

  if (region) {
    const distance = distanceKm(point, region.center);

    if (distance > region.validationRadiusKm) {
      pushError(errors, `synthetic shop ${shop.id} is ${distance.toFixed(2)}km from ${region.id}, outside validationRadiusKm ${region.validationRadiusKm}.`);
    }
  }

  if (!required(shop.syntheticRegionId)) {
    pushError(errors, `synthetic shop ${shop.id} is missing syntheticRegionId.`);
    return;
  }

  if (districtById.has(shop.syntheticRegionId)) {
    const district = districtById.get(shop.syntheticRegionId);

    if (!pointInPolygon(point, district.polygon) && !pointInBbox(point, district.polygon)) {
      pushError(errors, `synthetic shop ${shop.id} is outside polygon/bbox for ${shop.syntheticRegionId}.`);
    }

    return;
  }

  if (shop.syntheticRegionId === "campus_anchors") {
    const nearestAnchorDistance = Math.min(...campusAnchors.map((anchor) => distanceKm(point, anchor)));

    if (nearestAnchorDistance > 0.3) {
      pushError(errors, `synthetic shop ${shop.id} is ${nearestAnchorDistance.toFixed(2)}km from nearest campus anchor; expected <= 0.30km.`);
    }

    return;
  }

  if (shop.syntheticRegionId === "manual_sample_jitter") {
    const nearestManualDistance = Math.min(...manualShops.map((manualShop) => distanceKm(point, { latitude: manualShop.latitude, longitude: manualShop.longitude })));
    const exactlyOverlapsManual = manualShops.some((manualShop) => manualShop.latitude === shop.latitude && manualShop.longitude === shop.longitude);

    if (nearestManualDistance > 0.25) {
      pushError(errors, `synthetic shop ${shop.id} is ${nearestManualDistance.toFixed(2)}km from nearest manual sample; expected <= 0.25km.`);
    }

    if (exactlyOverlapsManual) {
      pushError(errors, `synthetic shop ${shop.id} exactly overlaps a manual sample coordinate.`);
    }

    return;
  }

  pushError(errors, `synthetic shop ${shop.id} references unknown syntheticRegionId "${shop.syntheticRegionId}".`);
}

const [
  regionFile,
  businessDistrictFile,
  gutShopsFile,
  syntheticShopsFile,
  gutDishesFile,
  syntheticDishesFile,
  gutFeaturesFile,
  syntheticFeaturesFile,
  sceneFitsFile,
  metaFile
] = await Promise.all([
  readJson(path.join("regions", "guangzhou_university_town.json")),
  readJson(path.join("regions", "gut-business-districts.synthetic.json")),
  readJson("shops.gut.seed.json"),
  readJson("shops.synthetic.seed.json"),
  readJson("dishes.gut.seed.json"),
  readJson("dishes.synthetic.seed.json"),
  readJson("shop-features.gut.seed.json"),
  readJson("shop-features.synthetic.seed.json"),
  readJson("scene-fit.synthetic.seed.json"),
  readJson("data-source-meta.json")
]);

const errors = [];
const regions = regionFile.regions ?? [];
const gutShops = gutShopsFile.shops ?? [];
const syntheticShops = syntheticShopsFile.shops ?? [];
const shops = [...gutShops, ...syntheticShops];
const dishes = [...(gutDishesFile.dishes ?? []), ...(syntheticDishesFile.dishes ?? [])];
const features = [...(gutFeaturesFile.features ?? []), ...(syntheticFeaturesFile.features ?? [])];
const sceneFits = sceneFitsFile.sceneFits ?? [];
const sourceKinds = metaFile.sourceKinds ?? {};
const sourceIds = new Set((metaFile.sources ?? []).map((source) => source.id));
const regionById = new Map(regions.map((region) => [region.id, region]));
const shopById = new Map(shops.map((shop) => [shop.id, shop]));
const syntheticShopById = new Map(syntheticShops.map((shop) => [shop.id, shop]));
const dishesByShopId = new Map();
const featuresByShopId = new Map();
const sceneFitByShopId = new Map();
const districtById = new Map((businessDistrictFile.businessDistricts ?? []).map((district) => [district.id, district]));
const campusAnchors = businessDistrictFile.campusAnchors?.anchors ?? [];

validateUniqueField(errors, metaFile.sources ?? [], "id", "data source");
validateUniqueField(errors, regions, "id", "region");
validateUniqueField(errors, shops, "id", "shop");
validateUniqueField(errors, dishes, "id", "dish");
validateUniqueField(errors, features, "shopId", "shop-feature");
validateUniqueField(errors, sceneFits, "shopId", "scene-fit");

[
  ...syntheticShops.map((entity) => ["synthetic shop", entity]),
  ...(syntheticDishesFile.dishes ?? []).map((entity) => ["synthetic dish", entity]),
  ...(syntheticFeaturesFile.features ?? []).map((entity) => ["synthetic shop-feature", entity]),
  ...sceneFits.map((entity) => ["synthetic scene-fit", entity])
].forEach(([entityType, entity]) => {
  if (entity.source !== syntheticSource) {
    pushError(errors, `${entityType} ${entity.id ?? entity.shopId ?? "(missing id)"} must use source=${syntheticSource}.`);
  }

  if (entity.synthetic !== true) {
    pushError(errors, `${entityType} ${entity.id ?? entity.shopId ?? "(missing id)"} must set synthetic=true.`);
  }

  if (!isNumber(entity.confidence)) {
    pushError(errors, `${entityType} ${entity.id ?? entity.shopId ?? "(missing id)"} must have numeric confidence.`);
  }
});

if (regions.length === 0) {
  pushError(errors, "At least one region is required.");
}

if (!sourceKinds[syntheticSource]) {
  pushError(errors, "data-source-meta.json must define synthetic_mvp.");
}

if (!sourceIds.has("synthetic_mvp_2026_05_24")) {
  pushError(errors, "data-source-meta.json must include source batch synthetic_mvp_2026_05_24.");
}

regions.forEach((region) => {
  validateSource(errors, sourceKinds, sourceIds, `region ${region.id}`, region);
});

shops.forEach((shop) => {
  ["id", "name", "category", "address", "latitude", "longitude", "source"].forEach((field) => {
    if (!required(shop[field])) {
      pushError(errors, `shop ${shop.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(errors, sourceKinds, sourceIds, `shop ${shop.id}`, shop);
  validateSyntheticEntity(errors, `shop ${shop.id}`, shop);

  const region = regionById.get(shop.regionId);
  if (!region) {
    pushError(errors, `shop ${shop.id} references unknown regionId "${shop.regionId}".`);
  } else if (shop.source !== syntheticSource) {
    const distance = distanceKm({ latitude: shop.latitude, longitude: shop.longitude }, region.center);
    if (distance > region.validationRadiusKm) {
      pushError(errors, `shop ${shop.id} is ${distance.toFixed(2)}km from ${region.id}, outside validationRadiusKm ${region.validationRadiusKm}.`);
    }
  }

  if (shop.source === syntheticSource) {
    ["cuisines", "openingHours", "addressPrecision", "spatialSource", "createdAt", "updatedAt"].forEach((field) => {
      if (!required(shop[field])) {
        pushError(errors, `synthetic shop ${shop.id} is missing ${field}.`);
      }
    });

    if (shop.spatialSource !== "synthetic_within_region") {
      pushError(errors, `synthetic shop ${shop.id} must use spatialSource=synthetic_within_region.`);
    }

    if (shop.addressPrecision !== "business_district" && shop.addressPrecision !== "approximate") {
      pushError(errors, `synthetic shop ${shop.id} has invalid addressPrecision "${shop.addressPrecision}".`);
    }

    validateSyntheticShopLocation(errors, shop, regionById, districtById, campusAnchors, gutShops);
  }
});

dishes.forEach((dish) => {
  ["id", "shopId", "name", "price", "source"].forEach((field) => {
    if (!required(dish[field])) {
      pushError(errors, `dish ${dish.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(errors, sourceKinds, sourceIds, `dish ${dish.id}`, dish);
  validateSyntheticEntity(errors, `dish ${dish.id}`, dish);

  const shop = shopById.get(dish.shopId);
  if (!shop) {
    pushError(errors, `dish ${dish.id} references unknown shopId "${dish.shopId}".`);
  }

  if (dish.source === syntheticSource) {
    ["portionSize", "description", "signature"].forEach((field) => {
      if (dish[field] === undefined || dish[field] === null) {
        pushError(errors, `synthetic dish ${dish.id} is missing ${field}.`);
      }
    });

    if (shop && shop.source !== syntheticSource) {
      pushError(errors, `synthetic dish ${dish.id} references non-synthetic shop ${dish.shopId}.`);
    }

    if (shop && dish.category !== shop.category) {
      pushError(errors, `synthetic dish ${dish.id} category "${dish.category}" does not match shop category "${shop.category}".`);
    }
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

  validateSource(errors, sourceKinds, sourceIds, `shop-feature ${feature.shopId}`, feature);
  validateSyntheticEntity(errors, `shop-feature ${feature.shopId}`, feature);

  if (feature.source === syntheticSource) {
    ["tasteTags", "sceneTags", "crowdTags", "budgetLevel", "goodFor", "avoidTags", "queueRisk", "noiseLevel", "chatFriendly", "groupFriendly", "soloFriendly", "indoor", "rainyDayFriendly", "explainHints", "riskHints"].forEach((field) => {
      if (feature[field] === undefined || feature[field] === null) {
        pushError(errors, `synthetic shop-feature ${feature.shopId} is missing ${field}.`);
      }
    });
  }

  featuresByShopId.set(feature.shopId, feature);
});

sceneFits.forEach((sceneFit) => {
  if (!required(sceneFit.shopId)) {
    pushError(errors, "scene-fit is missing shopId.");
  } else if (!shopById.has(sceneFit.shopId)) {
    pushError(errors, `scene-fit references unknown shopId "${sceneFit.shopId}".`);
  }

  validateSource(errors, sourceKinds, sourceIds, `scene-fit ${sceneFit.shopId}`, sceneFit);
  validateSyntheticEntity(errors, `scene-fit ${sceneFit.shopId}`, sceneFit);

  if (sceneFit.source !== syntheticSource) {
    pushError(errors, `scene-fit ${sceneFit.shopId} must use source=${syntheticSource}.`);
  }

  ["soloToday", "groupMeetup", "weekendPlan"].forEach((scene) => {
    const score = sceneFit.sceneScores?.[scene];
    if (!isNumber(score) || score < 0 || score > 100) {
      pushError(errors, `scene-fit ${sceneFit.shopId} has invalid ${scene} score.`);
    }

    if (!Array.isArray(sceneFit.explainHints?.[scene])) {
      pushError(errors, `scene-fit ${sceneFit.shopId} is missing explainHints.${scene}.`);
    }

    if (!Array.isArray(sceneFit.riskHints?.[scene])) {
      pushError(errors, `scene-fit ${sceneFit.shopId} is missing riskHints.${scene}.`);
    }
  });

  sceneFitByShopId.set(sceneFit.shopId, sceneFit);
});

syntheticShops.forEach((shop) => {
  if (!featuresByShopId.has(shop.id)) {
    pushError(errors, `synthetic shop ${shop.id} is missing shop-feature.`);
  }

  if (!sceneFitByShopId.has(shop.id)) {
    pushError(errors, `synthetic shop ${shop.id} is missing scene-fit.`);
  }
});

const syntheticPayload = JSON.stringify({
  shops: syntheticShopsFile,
  dishes: syntheticDishesFile,
  features: syntheticFeaturesFile,
  sceneFits: sceneFitsFile,
  businessDistricts: businessDistrictFile
});

forbiddenSyntheticPhrases.forEach((phrase) => {
  if (syntheticPayload.includes(phrase)) {
    pushError(errors, `synthetic data contains forbidden misleading phrase "${phrase}".`);
  }
});

if (syntheticShops.length < 100) {
  pushError(errors, `Expected at least 100 synthetic shops, got ${syntheticShops.length}.`);
}

if ((syntheticDishesFile.dishes ?? []).length < 500) {
  pushError(errors, `Expected at least 500 synthetic dishes, got ${(syntheticDishesFile.dishes ?? []).length}.`);
}

if ((syntheticFeaturesFile.features ?? []).length !== syntheticShops.length) {
  pushError(errors, `Expected ${syntheticShops.length} synthetic features, got ${(syntheticFeaturesFile.features ?? []).length}.`);
}

if (sceneFits.length !== syntheticShops.length) {
  pushError(errors, `Expected ${syntheticShops.length} scene-fit records, got ${sceneFits.length}.`);
}

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

console.log(
  `Restaurant data validation passed: ${shops.length} shops (${syntheticShops.length} synthetic), ${dishes.length} dishes (${(syntheticDishesFile.dishes ?? []).length} synthetic), ${features.length} feature records, ${sceneFits.length} scene-fit records.`
);
