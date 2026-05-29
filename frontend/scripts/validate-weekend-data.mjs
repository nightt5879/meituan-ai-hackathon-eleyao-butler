import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(frontendRoot, "data", "weekend");
const syntheticSource = "synthetic_weekend_mvp";
const forbiddenPhrases = ["美团评分", "真实销量", "真实排队时间", "大众点评榜单", "平台认证", "真实用户评论"];
const weatherValues = new Set(["sunny", "cloudy", "rainy", "hot", "unknown"]);
const energyValues = new Set(["low", "medium", "high"]);
const intensityValues = new Set(["low", "medium", "high"]);
const modeValues = new Set(["outdoor", "balanced", "indoor_backup"]);
const requiredCheckKeys = new Set(["budget", "time_window", "weather", "walking_intensity", "return_time"]);

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(dataDir, relativePath), "utf8");
  return JSON.parse(raw);
}

function pushError(errors, message) {
  errors.push(message);
}

function uniqueById(errors, items, label) {
  const seen = new Set();

  items.forEach((item) => {
    if (!required(item.id)) {
      pushError(errors, `${label} is missing id.`);
      return;
    }

    if (seen.has(item.id)) {
      pushError(errors, `${label} id "${item.id}" is duplicated.`);
      return;
    }

    seen.add(item.id);
  });
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

function validateSource(errors, sourceKinds, sourceIds, label, entity) {
  if (!required(entity.source)) {
    pushError(errors, `${label} is missing source.`);
  } else if (!sourceKinds[entity.source]) {
    pushError(errors, `${label} has unknown source "${entity.source}".`);
  }

  if (!required(entity.sourceId)) {
    pushError(errors, `${label} is missing sourceId.`);
  } else if (!sourceIds.has(entity.sourceId)) {
    pushError(errors, `${label} has sourceId "${entity.sourceId}" not found in data-source-meta.json.`);
  }
}

function validateSynthetic(errors, label, entity) {
  if (entity.source === syntheticSource && entity.synthetic !== true) {
    pushError(errors, `${label} uses source=${syntheticSource} but synthetic is not true.`);
  }

  if (entity.synthetic === true && entity.source !== syntheticSource) {
    pushError(errors, `${label} is synthetic=true but source is "${entity.source}".`);
  }

  if (entity.synthetic === true && (!isNumber(entity.confidence) || entity.confidence < 0 || entity.confidence > 1)) {
    pushError(errors, `${label} must have confidence between 0 and 1.`);
  }
}

function allValuesAllowed(errors, label, values, allowedSet) {
  if (!Array.isArray(values) || values.length === 0) {
    pushError(errors, `${label} must be a non-empty array.`);
    return;
  }

  values.forEach((value) => {
    if (!allowedSet.has(value)) {
      pushError(errors, `${label} has invalid value "${value}".`);
    }
  });
}

function hasAny(source, targets) {
  if (!targets || targets.length === 0) {
    return true;
  }

  const sourceSet = new Set(source ?? []);
  return targets.some((target) => sourceSet.has(target));
}

function poiMatchesFilters(poi, filters = {}) {
  if (filters.areaAny && !filters.areaAny.includes(poi.area)) return false;
  if (filters.typeAny && !filters.typeAny.includes(poi.type)) return false;
  if (filters.indoor !== undefined && poi.indoor !== filters.indoor) return false;
  if (filters.maxCost !== undefined && poi.cost > filters.maxCost) return false;
  if (!hasAny(poi.tags, filters.tagsAny)) return false;
  if (!hasAny(poi.routeNodeRoles, filters.routeNodeRolesAny)) return false;
  if (filters.suitableWeatherAny && !filters.suitableWeatherAny.some((item) => poi.suitableWeather.includes(item))) return false;
  if (filters.suitableEnergyAny && !filters.suitableEnergyAny.some((item) => poi.suitableEnergy.includes(item))) return false;
  if (filters.walkingIntensityAny && !filters.walkingIntensityAny.includes(poi.walkingIntensity)) return false;
  return true;
}

function renderTemplate(template, poisById, pois) {
  const selected = [];
  const selectedIds = new Set();

  for (const slot of template.slots ?? []) {
    const direct = pois.find((poi) => !selectedIds.has(poi.id) && poiMatchesFilters(poi, slot.poiFilters));
    const fallback = (slot.fallbackPoiIds ?? [])
      .map((poiId) => poisById.get(poiId))
      .find((poi) => poi && !selectedIds.has(poi.id));
    const poi = direct ?? fallback;

    if (!poi && slot.required) {
      return { ok: false, reason: `required slot "${slot.id}" cannot match a POI` };
    }

    if (poi) {
      selectedIds.add(poi.id);
      selected.push({
        slot,
        poi,
        durationMinutes: slot.durationMinutes || poi.durationMinutes
      });
    }
  }

  const stopIdsSeen = new Set();
  for (const poiId of template.stopIds ?? []) {
    if (stopIdsSeen.has(poiId)) {
      return { ok: false, reason: `stopId "${poiId}" is duplicated` };
    }
    stopIdsSeen.add(poiId);

    const poi = poisById.get(poiId);
    if (!poi) {
      return { ok: false, reason: `stopId "${poiId}" does not exist` };
    }
    if (selectedIds.has(poiId)) {
      return { ok: false, reason: `stopId "${poiId}" duplicates an already selected slot POI` };
    }
    selectedIds.add(poiId);
    selected.push({ slot: { id: poi.id, label: "停留点" }, poi, durationMinutes: poi.durationMinutes });
  }

  const timeline = selected.map((item, index) => ({
    time: `第 ${index + 1} 段`,
    title: item.slot.label,
    placeName: item.poi.name,
    activity: item.poi.tags.slice(0, 3).join("、"),
    durationMinutes: item.durationMinutes
  }));
  const checks = template.checkTemplates ?? [];
  const riskTips = [
    ...(template.riskTipTemplates ?? []),
    ...selected.flatMap((item) => item.poi.riskTips ?? [])
  ].filter(Boolean);
  const budget = selected.reduce((sum, item) => sum + item.poi.cost, 0);
  const duration = selected.reduce((sum, item) => sum + item.durationMinutes, 0) + Math.max(0, selected.length - 1) * 10;
  const inviteCopy = String(template.inviteCopyTemplate ?? "")
    .replaceAll("{startArea}", "学校周边")
    .replaceAll("{title}", template.title)
    .replaceAll("{stopNames}", selected.map((item) => item.poi.name).join("、"))
    .replaceAll("{durationHours}", String(Math.round((duration / 60) * 10) / 10))
    .replaceAll("{budget}", String(budget))
    .replaceAll("{weatherSummary}", "天气正常");

  if (timeline.length === 0) return { ok: false, reason: "timeline is empty" };
  if (checks.length === 0) return { ok: false, reason: "checks are empty" };
  if (riskTips.length === 0) return { ok: false, reason: "riskTips are empty" };
  if (!inviteCopy.trim() || inviteCopy.includes("{")) return { ok: false, reason: "inviteCopy is empty or has unreplaced placeholders" };

  return { ok: true };
}

const [regionFile, poiFile, templateFile, metaFile] = await Promise.all([
  readJson("weekend-area-regions.json"),
  readJson("weekend-pois.seed.json"),
  readJson("weekend-route-templates.seed.json"),
  readJson("data-source-meta.json")
]);

const errors = [];
const regions = regionFile.regions ?? [];
const areas = regions.flatMap((region) => region.areas ?? []);
const pois = poiFile.pois ?? [];
const templates = templateFile.templates ?? [];
const sourceKinds = metaFile.sourceKinds ?? {};
const sourceIds = new Set((metaFile.sources ?? []).map((source) => source.id));
const areaIds = new Set(areas.map((area) => area.id));
const poisById = new Map(pois.map((poi) => [poi.id, poi]));

if (!sourceKinds[syntheticSource]) {
  pushError(errors, `data-source-meta.json must define ${syntheticSource}.`);
}

if (!sourceIds.has("weekend_synthetic_mvp_2026_05_25")) {
  pushError(errors, "data-source-meta.json must include source batch weekend_synthetic_mvp_2026_05_25.");
}

if (pois.length < 30 || pois.length > 80) {
  pushError(errors, `Expected 30-80 weekend POIs, got ${pois.length}.`);
}

if (templates.length < 6 || templates.length > 11) {
  pushError(errors, `Expected 6-11 route templates, got ${templates.length}.`);
}

uniqueById(errors, regions, "region");
uniqueById(errors, areas, "area");
uniqueById(errors, pois, "POI");
uniqueById(errors, templates, "route template");

regions.forEach((region) => {
  validateSource(errors, sourceKinds, sourceIds, `region ${region.id}`, region);
  validateSynthetic(errors, `region ${region.id}`, region);

  if (!Array.isArray(region.areas) || region.areas.length === 0) {
    pushError(errors, `region ${region.id} must include at least one area.`);
  }
});

pois.forEach((poi) => {
  ["id", "name", "type", "area", "addressText", "latitude", "longitude", "cost", "durationMinutes", "walkingIntensity", "source", "sourceId", "notes"].forEach((field) => {
    if (!required(poi[field])) {
      pushError(errors, `POI ${poi.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(errors, sourceKinds, sourceIds, `POI ${poi.id}`, poi);
  validateSynthetic(errors, `POI ${poi.id}`, poi);

  if (!areaIds.has(poi.area)) {
    pushError(errors, `POI ${poi.id} references unknown area "${poi.area}".`);
  }

  if (!isNumber(poi.latitude) || !isNumber(poi.longitude)) {
    pushError(errors, `POI ${poi.id} must have numeric latitude and longitude.`);
  }

  if (!isNumber(poi.cost) || poi.cost < 0) {
    pushError(errors, `POI ${poi.id} must have non-negative numeric cost.`);
  }

  if (!isNumber(poi.durationMinutes) || poi.durationMinutes <= 0) {
    pushError(errors, `POI ${poi.id} must have positive durationMinutes.`);
  }

  if (!intensityValues.has(poi.walkingIntensity)) {
    pushError(errors, `POI ${poi.id} has invalid walkingIntensity "${poi.walkingIntensity}".`);
  }

  allValuesAllowed(errors, `POI ${poi.id}.suitableWeather`, poi.suitableWeather, weatherValues);
  allValuesAllowed(errors, `POI ${poi.id}.suitableEnergy`, poi.suitableEnergy, energyValues);

  if (!Array.isArray(poi.tags) || poi.tags.length === 0) {
    pushError(errors, `POI ${poi.id} must include tags.`);
  }

  if (!Array.isArray(poi.riskTips) || poi.riskTips.length === 0) {
    pushError(errors, `POI ${poi.id} must include riskTips.`);
  }

  const owningArea = areas.find((area) => area.id === poi.area);
  if (owningArea && isNumber(poi.latitude) && isNumber(poi.longitude)) {
    const distance = distanceKm({ latitude: poi.latitude, longitude: poi.longitude }, owningArea.center);
    if (distance > Math.max(owningArea.radiusKm + 1, 2.5)) {
      pushError(errors, `POI ${poi.id} is ${distance.toFixed(2)}km from area ${poi.area}, outside loose validation radius.`);
    }
  }
});

const modes = new Set();

templates.forEach((template) => {
  ["id", "title", "mode", "estimatedDurationMinutes", "estimatedBudget", "transportNote", "routeReason", "fallbackReason", "inviteCopyTemplate", "source", "sourceId"].forEach((field) => {
    if (!required(template[field])) {
      pushError(errors, `route template ${template.id ?? "(missing id)"} is missing ${field}.`);
    }
  });

  validateSource(errors, sourceKinds, sourceIds, `route template ${template.id}`, template);
  validateSynthetic(errors, `route template ${template.id}`, template);

  if (!modeValues.has(template.mode)) {
    pushError(errors, `route template ${template.id} has invalid mode "${template.mode}".`);
  } else {
    modes.add(template.mode);
  }

  if (!Array.isArray(template.slots) && !Array.isArray(template.stopIds)) {
    pushError(errors, `route template ${template.id} must include slots or stopIds.`);
  }

  if (!Array.isArray(template.checkTemplates) || template.checkTemplates.length === 0) {
    pushError(errors, `route template ${template.id} must include checkTemplates.`);
  } else {
    const keys = new Set(template.checkTemplates.map((check) => check.key));
    requiredCheckKeys.forEach((key) => {
      if (!keys.has(key)) {
        pushError(errors, `route template ${template.id} is missing checkTemplate "${key}".`);
      }
    });
  }

  if (!Array.isArray(template.riskTipTemplates) || template.riskTipTemplates.length === 0) {
    pushError(errors, `route template ${template.id} must include riskTipTemplates.`);
  }

  (template.slots ?? []).forEach((slot) => {
    if (!required(slot.id) || !required(slot.role)) {
      pushError(errors, `route template ${template.id} has a slot missing id or role.`);
    }

    const directMatches = pois.filter((poi) => poiMatchesFilters(poi, slot.poiFilters ?? {}));
    const fallbackIds = slot.fallbackPoiIds ?? [];

    fallbackIds.forEach((poiId) => {
      if (!poisById.has(poiId)) {
        pushError(errors, `route template ${template.id} slot ${slot.id} fallbackPoiId "${poiId}" does not exist.`);
      }
    });

    if (directMatches.length === 0 && fallbackIds.filter((poiId) => poisById.has(poiId)).length === 0) {
      pushError(errors, `route template ${template.id} slot ${slot.id} cannot match any POI.`);
    }
  });

  const stopIdsSeen = new Set();
  (template.stopIds ?? []).forEach((poiId) => {
    if (stopIdsSeen.has(poiId)) {
      pushError(errors, `route template ${template.id} stopId "${poiId}" is duplicated.`);
    }
    stopIdsSeen.add(poiId);

    if (!poisById.has(poiId)) {
      pushError(errors, `route template ${template.id} stopId "${poiId}" does not exist.`);
    }
  });

  const rendered = renderTemplate(template, poisById, pois);
  if (!rendered.ok) {
    pushError(errors, `route template ${template.id} cannot render: ${rendered.reason}.`);
  }
});

["outdoor", "balanced", "indoor_backup"].forEach((mode) => {
  if (!modes.has(mode)) {
    pushError(errors, `Route templates must cover mode "${mode}".`);
  }
});

const payload = JSON.stringify({ regionFile, poiFile, templateFile });
forbiddenPhrases.forEach((phrase) => {
  if (payload.includes(phrase)) {
    pushError(errors, `weekend data contains forbidden misleading phrase "${phrase}".`);
  }
});

if (errors.length > 0) {
  console.error("Weekend data validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Weekend data validation passed: ${pois.length} POIs, ${templates.length} route templates, ${regions.length} region file record(s).`);
