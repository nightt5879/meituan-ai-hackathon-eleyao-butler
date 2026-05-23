import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const importDir = path.join(frontendRoot, "data", "restaurant", "import");
const manualInputPath = path.join(importDir, "shops.manual.template.csv");
const advancedInputPath = path.join(importDir, "shops.template.csv");
const outputPath = path.join(importDir, "shops.imported.draft.json");
const metaPath = path.join(frontendRoot, "data", "restaurant", "data-source-meta.json");
const regionPath = path.join(frontendRoot, "data", "restaurant", "regions", "guangzhou_university_town.json");

const expectedHeaders = [
  "id",
  "name",
  "category",
  "cuisines",
  "avgPrice",
  "rating",
  "address",
  "latitude",
  "longitude",
  "regionId",
  "source",
  "sourceId",
  "sourceUrl",
  "collectedAt",
  "confidence",
  "tags",
  "featureTags",
  "dishSeedMode",
  "notes"
];

const requiredRowFields = ["id", "name", "category", "address", "latitude", "longitude", "regionId", "source", "sourceId", "collectedAt", "confidence"];
const manualHeaders = ["店名", "类别", "人均", "地址", "纬度", "经度", "代表菜"];
const manualRequiredRowFields = ["店名", "类别", "纬度", "经度"];
const today = new Date().toISOString().slice(0, 10);

const categoryDefaults = [
  {
    match: ["粤菜", "广府菜", "茶餐厅"],
    cuisines: ["粤菜"],
    tags: ["粤菜", "不辣可选", "多人聚餐"],
    featureTags: ["cantonese", "non_spicy_available", "group_friendly"]
  },
  {
    match: ["川湘菜", "川菜", "湘菜", "香辣"],
    cuisines: ["川菜", "湘菜"],
    tags: ["川湘菜", "香辣", "下饭"],
    featureTags: ["spicy", "rice_friendly", "group_friendly"]
  },
  {
    match: ["火锅"],
    cuisines: ["火锅"],
    tags: ["火锅", "多人聚餐", "可选辣度"],
    featureTags: ["hotpot", "group_friendly", "spicy_options"]
  },
  {
    match: ["烧烤", "烤肉", "串"],
    cuisines: ["烧烤"],
    tags: ["烧烤", "夜宵", "多人聚餐"],
    featureTags: ["bbq", "late_night", "group_friendly"]
  },
  {
    match: ["日料", "日本料理", "寿司"],
    cuisines: ["日料"],
    tags: ["日料", "简餐", "不辣可选"],
    featureTags: ["japanese", "non_spicy_available", "light_meal"]
  },
  {
    match: ["韩餐", "韩国料理", "韩式"],
    cuisines: ["韩餐"],
    tags: ["韩餐", "多人聚餐", "可选辣度"],
    featureTags: ["korean", "group_friendly", "spicy_options"]
  },
  {
    match: ["粉面", "面", "粉", "粥"],
    cuisines: ["粉面"],
    tags: ["粉面", "快餐", "预算友好"],
    featureTags: ["noodle", "quick_meal", "budget_friendly"]
  },
  {
    match: ["快餐", "简餐", "盖饭", "便当"],
    cuisines: ["快餐"],
    tags: ["快餐", "预算友好", "单人友好"],
    featureTags: ["quick_meal", "budget_friendly", "solo_friendly"]
  },
  {
    match: ["奶茶", "饮品"],
    cuisines: ["奶茶", "饮品"],
    tags: ["奶茶饮品", "下午茶", "外带"],
    featureTags: ["drink", "takeaway", "afternoon_tea"]
  },
  {
    match: ["轻食", "沙拉", "健康餐"],
    cuisines: ["轻食"],
    tags: ["轻食", "低油", "不辣可选"],
    featureTags: ["light_meal", "low_oil", "non_spicy_available"]
  },
  {
    match: ["咖啡"],
    cuisines: ["咖啡"],
    tags: ["咖啡", "下午茶", "适合聊天"],
    featureTags: ["coffee", "afternoon_tea", "chat_friendly"]
  },
  {
    match: ["甜品"],
    cuisines: ["甜品"],
    tags: ["甜品", "下午茶", "外带"],
    featureTags: ["dessert", "afternoon_tea", "takeaway"]
  },
  {
    match: ["其他"],
    cuisines: ["其他"],
    tags: ["其他", "人工整理"],
    featureTags: ["manual_curated", "needs_review"]
  }
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function parseNumber(value, fieldName, rowIndex) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowIndex} has invalid ${fieldName}: "${value}".`);
  }

  return parsed;
}

function parseOptionalNumber(value, fieldName, rowIndex) {
  return value ? parseNumber(value, fieldName, rowIndex) : null;
}

function parseConfidence(value, rowIndex) {
  const confidence = parseNumber(value, "confidence", rowIndex);

  if (confidence < 0 || confidence > 1) {
    throw new Error(`Row ${rowIndex} has invalid confidence "${value}". Use a number from 0 to 1.`);
  }

  return confidence;
}

function parseList(value) {
  return value
    ? value
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function padNumber(value) {
  return String(value).padStart(3, "0");
}

function getInputPath() {
  const arg = process.argv.find((item) => item.startsWith("--input="));
  const configured = arg?.slice("--input=".length);

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  return manualInputPath;
}

function getCategoryDefaults(category) {
  const matched = categoryDefaults.find((item) => item.match.some((keyword) => category.includes(keyword)));

  return matched ?? {
    cuisines: [category || "其他"],
    tags: [category, "人工整理"],
    featureTags: ["manual_curated", "needs_review"]
  };
}

function looksLikeManualHeaders(headers) {
  return manualHeaders.every((header) => headers.includes(header));
}

function looksLikeAdvancedHeaders(headers) {
  return expectedHeaders.every((header) => headers.includes(header));
}

function normalizeDate(value, rowIndex) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Row ${rowIndex} has invalid collectedAt "${value}". Use YYYY-MM-DD.`);
  }

  return value;
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

function buildReviewWarnings(record, sourceKinds, sourceIds, regionById) {
  const warnings = [];
  const sourceKind = sourceKinds[record.source];
  const region = regionById.get(record.regionId);

  if (!sourceKind) {
    warnings.push(`Unknown source kind "${record.source}". Add it to data-source-meta.json or correct the CSV.`);
  }

  if (!sourceIds.has(record.sourceId)) {
    warnings.push(`sourceId "${record.sourceId}" is not declared in data-source-meta.json yet.`);
  }

  if (record.source === "manual_public_curated" && !record.sourceUrl) {
    warnings.push("manual_public_curated rows should include sourceUrl when possible.");
  }

  if (!region) {
    warnings.push(`Unknown regionId "${record.regionId}".`);
  } else {
    const distance = distanceKm({ latitude: record.latitude, longitude: record.longitude }, region.center);
    if (distance > region.validationRadiusKm) {
      warnings.push(`Coordinates are ${distance.toFixed(2)}km from ${region.id}, outside validationRadiusKm ${region.validationRadiusKm}.`);
    }
  }

  if (record.latitude > 90 || record.latitude < -90 || record.longitude > 180 || record.longitude < -180) {
    warnings.push("Latitude/longitude are outside valid geographic ranges; check whether they were reversed.");
  }

  if (record.latitude < 22.8 || record.latitude > 23.3 || record.longitude < 113.1 || record.longitude > 113.7) {
    warnings.push("Coordinates are not close to Guangzhou University Town. Expected latitude around 23.x and longitude around 113.x.");
  }

  if (record.latitude > 40 && record.longitude < 40) {
    warnings.push("Coordinates look reversed for Guangzhou. Use latitude around 23 and longitude around 113.");
  }

  return warnings;
}

const [metaRaw, regionRaw] = await Promise.all([fs.readFile(metaPath, "utf8"), fs.readFile(regionPath, "utf8")]);
const sourceMeta = JSON.parse(metaRaw);
const regionFile = JSON.parse(regionRaw);
const sourceKinds = sourceMeta.sourceKinds ?? {};
const sourceIds = new Set((sourceMeta.sources ?? []).map((source) => source.id));
const regionById = new Map((regionFile.regions ?? []).map((region) => [region.id, region]));
const inputPath = getInputPath();
const raw = await fs.readFile(inputPath, "utf8");
const rows = parseCsv(raw);

const headers = rows[0].map((header) => header.trim());
const inputMode = looksLikeManualHeaders(headers) ? "manual_zh" : looksLikeAdvancedHeaders(headers) ? "advanced" : "unknown";

if (inputMode === "unknown") {
  throw new Error(
    `CSV headers are not recognized. Use the Chinese manual template (${manualHeaders.join(",")}) or the advanced template (${expectedHeaders.join(",")}).`
  );
}

function buildAdvancedShop(record, rowIndex) {
  const missingFields = requiredRowFields.filter((field) => !record[field]);

  if (missingFields.length > 0) {
    throw new Error(`Row ${rowIndex} is missing required fields: ${missingFields.join(", ")}.`);
  }

  const latitude = parseNumber(record.latitude, "latitude", rowIndex);
  const longitude = parseNumber(record.longitude, "longitude", rowIndex);
  const shop = {
    id: record.id,
    name: record.name,
    category: record.category,
    cuisines: parseList(record.cuisines),
    address: record.address,
    latitude,
    longitude,
    avgPrice: parseOptionalNumber(record.avgPrice, "avgPrice", rowIndex),
    rating: parseOptionalNumber(record.rating, "rating", rowIndex),
    tags: parseList(record.tags),
    regionId: record.regionId,
    source: record.source,
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl || null,
    collectedAt: normalizeDate(record.collectedAt, rowIndex),
    confidence: parseConfidence(record.confidence, rowIndex),
    updatedAt: normalizeDate(record.collectedAt, rowIndex),
    importHints: {
      featureTags: parseList(record.featureTags),
      dishSeedMode: record.dishSeedMode || "needs_manual_review",
      notes: record.notes || "",
      reviewWarnings: []
    }
  };

  shop.importHints.reviewWarnings = buildReviewWarnings(shop, sourceKinds, sourceIds, regionById);
  return shop;
}

function buildManualShop(record, rowIndex, manualIndex) {
  const missingFields = manualRequiredRowFields.filter((field) => !record[field]);

  if (missingFields.length > 0) {
    throw new Error(`Row ${rowIndex} is missing required fields: ${missingFields.join(", ")}.`);
  }

  const latitude = parseNumber(record["纬度"], "纬度", rowIndex);
  const longitude = parseNumber(record["经度"], "经度", rowIndex);
  const defaults = getCategoryDefaults(record["类别"]);
  const dishHints = parseList(record["代表菜"]);
  const notes = "人工地图整理，菜品后续按类别生成补全";
  const shop = {
    id: `gut_manual_${padNumber(manualIndex)}`,
    name: record["店名"],
    category: record["类别"],
    cuisines: defaults.cuisines,
    address: record["地址"] || "",
    latitude,
    longitude,
    avgPrice: parseOptionalNumber(record["人均"], "人均", rowIndex),
    rating: null,
    tags: unique([...defaults.tags, ...dishHints]),
    regionId: "guangzhou_university_town",
    source: "manual_sample",
    sourceId: `manual_gut_${padNumber(manualIndex)}`,
    sourceUrl: null,
    collectedAt: today,
    confidence: 0.65,
    updatedAt: today,
    importHints: {
      featureTags: defaults.featureTags,
      dishSeedMode: "generated_by_category",
      notes,
      dishHints,
      reviewWarnings: []
    }
  };

  if (!shop.address) {
    shop.importHints.reviewWarnings.push("Address is empty. Add a reviewed address before merging into formal seed.");
  }

  shop.importHints.reviewWarnings.push(...buildReviewWarnings(shop, sourceKinds, sourceIds, regionById));
  return shop;
}

const dataRows = rows.slice(1).filter((row) => row.some((value) => value.trim() !== ""));
const shops = dataRows.map((row, rowOffset) => {
  const rowIndex = rowOffset + 2;
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));

  return inputMode === "manual_zh" ? buildManualShop(record, rowIndex, rowOffset + 1) : buildAdvancedShop(record, rowIndex);
});

const draft = {
  schemaVersion: 1,
  importedAt: new Date().toISOString(),
  sourceFile: path.relative(frontendRoot, inputPath).replaceAll("\\", "/"),
  inputMode,
  warning: "Draft only. Review manually before merging shops into shops.gut.seed.json and before creating dishes/features.",
  fields: inputMode === "manual_zh" ? manualHeaders : expectedHeaders,
  shops
};

await fs.writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
console.log(`Imported ${shops.length} shops to ${outputPath}`);
