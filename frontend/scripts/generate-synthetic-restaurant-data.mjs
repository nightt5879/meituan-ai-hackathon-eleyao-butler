import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(frontendRoot, "data", "restaurant");
const regionDir = path.join(dataDir, "regions");

const sourceId = "synthetic_mvp_2026_05_24";
const generatedAt = "2026-05-24";
const seed = 20260524;
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const outputPaths = {
  shops: path.join(dataDir, "shops.synthetic.seed.json"),
  dishes: path.join(dataDir, "dishes.synthetic.seed.json"),
  features: path.join(dataDir, "shop-features.synthetic.seed.json"),
  sceneFits: path.join(dataDir, "scene-fit.synthetic.seed.json"),
  businessDistricts: path.join(regionDir, "gut-business-districts.synthetic.json")
};

function mulberry32(initialSeed) {
  let value = initialSeed;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(seed);

function randomBetween(min, max) {
  return min + (max - min) * random();
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pick(values) {
  return values[Math.floor(random() * values.length)];
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const polygonDistricts = [
  {
    id: "gogo_xintiandi",
    name: "GOGO 新天地片区",
    addressLabel: "广州大学城 GOGO 新天地片区",
    description: "大学城较完整购物中心，中低端商场，适合生成连锁餐饮、西餐、奶茶、轻食、商场环境较好的饭馆、朋友约饭、周末坐坐。",
    polygon: [
      { latitude: 23.063797, longitude: 113.391345 },
      { latitude: 23.063788, longitude: 113.392094 },
      { latitude: 23.061038, longitude: 113.392374 },
      { latitude: 23.060844, longitude: 113.391657 }
    ],
    profile: {
      recommendedCategories: ["西餐", "奶茶", "咖啡", "轻食", "甜品", "日料", "韩餐", "粤菜"],
      budgetLevels: ["30-50", "50-80", "80+"],
      sceneTags: ["朋友聊天", "多人约饭", "周末规划", "雨天室内"]
    }
  },
  {
    id: "beigang_village",
    name: "贝岗村片区",
    addressLabel: "广州大学城贝岗村片区",
    description: "GOGO 旁边城中村，烟火气强，适合生成大排档、烧烤、粥粉面、低价快餐、炸鸡汉堡、小炒、夜宵；预算偏低，环境和噪声风险相对更高。",
    polygon: [
      { latitude: 23.063997, longitude: 113.392431 },
      { latitude: 23.060884, longitude: 113.392834 },
      { latitude: 23.063778, longitude: 113.394592 },
      { latitude: 23.060452, longitude: 113.395345 }
    ],
    profile: {
      recommendedCategories: ["粉面", "快餐", "烧烤", "家常菜", "川湘菜", "奶茶", "火锅"],
      budgetLevels: ["20-30", "30-50", "50-80"],
      sceneTags: ["单人快吃", "夜宵", "低预算", "重口味聚餐"]
    }
  },
  {
    id: "chuangzhi_park",
    name: "创智园片区",
    addressLabel: "广州大学城创智园片区",
    description: "靠近大学城北地铁站的科技园 / 办公园区，小规模快餐和小饭馆，适合工作日简餐、单人快吃、低中预算、轻食/咖啡。",
    polygon: [
      { latitude: 23.058147, longitude: 113.387875 },
      { latitude: 23.057563, longitude: 113.388769 },
      { latitude: 23.057337, longitude: 113.386958 },
      { latitude: 23.05665, longitude: 113.387663 }
    ],
    profile: {
      recommendedCategories: ["快餐", "咖啡", "轻食", "粉面", "甜品"],
      budgetLevels: ["20-30", "30-50"],
      sceneTags: ["工作日简餐", "单人快吃", "咖啡轻食"]
    }
  },
  {
    id: "beiting_village",
    name: "北亭村片区",
    addressLabel: "广州大学城北亭村片区",
    description: "城中村餐饮区，适合粥粉面、烧烤、大排档、小炒、快餐，也可生成广东式小酒楼/家常酒楼，用于多人聚餐和稍正式约饭。",
    polygon: [
      { latitude: 23.048121, longitude: 113.370672 },
      { latitude: 23.045996, longitude: 113.374717 },
      { latitude: 23.05143, longitude: 113.376753 },
      { latitude: 23.052559, longitude: 113.37456 }
    ],
    profile: {
      recommendedCategories: ["粉面", "粤菜", "家常菜", "烧烤", "快餐", "川湘菜", "潮汕菜", "东北菜"],
      budgetLevels: ["20-30", "30-50", "50-80", "80+"],
      sceneTags: ["单人快吃", "多人约饭", "低预算", "重口味聚餐"]
    }
  },
  {
    id: "qingchuanghui",
    name: "广州大学城青创汇片区",
    addressLabel: "广州大学城青创汇片区",
    description: "小规模园区/办公生活混合点，类似创智园，适合连锁快餐、小饭馆、轻食、咖啡、工作日简餐、单人快吃。",
    polygon: [
      { latitude: 23.053845, longitude: 113.372505 },
      { latitude: 23.052878, longitude: 113.374222 },
      { latitude: 23.051157, longitude: 113.372208 },
      { latitude: 23.051463, longitude: 113.371292 }
    ],
    profile: {
      recommendedCategories: ["快餐", "咖啡", "轻食", "奶茶", "粉面", "甜品"],
      budgetLevels: ["20-30", "30-50"],
      sceneTags: ["工作日简餐", "单人快吃", "咖啡轻食", "雨天室内"]
    }
  },
  {
    id: "nanting_village",
    name: "南亭村片区",
    addressLabel: "广州大学城南亭村片区",
    description: "城中村餐饮区，适合快餐、粥粉面、小炒、烧烤、火锅鸡、鸡煲、夜宵，低到中预算，也可生成少量多人聚餐型店铺。",
    polygon: [
      { latitude: 23.035209, longitude: 113.385137 },
      { latitude: 23.037719, longitude: 113.385493 },
      { latitude: 23.037333, longitude: 113.391064 },
      { latitude: 23.033749, longitude: 113.389754 }
    ],
    profile: {
      recommendedCategories: ["快餐", "粉面", "家常菜", "烧烤", "火锅", "川湘菜", "潮汕菜", "新疆菜", "粤菜"],
      budgetLevels: ["20-30", "30-50", "50-80"],
      sceneTags: ["低预算", "多人约饭", "夜宵", "重口味聚餐"]
    }
  },
  {
    id: "suishi_village",
    name: "穗石村片区",
    addressLabel: "广州大学城穗石村片区",
    description: "大学城东侧城中村餐饮补充区，适合粉面、快餐、小炒、烧烤、大排档、东北菜、家常菜、低预算多人聚餐。",
    polygon: [
      { latitude: 23.048, longitude: 113.40845 },
      { latitude: 23.05217, longitude: 113.410511 },
      { latitude: 23.050956, longitude: 113.414965 },
      { latitude: 23.046386, longitude: 113.411394 }
    ],
    profile: {
      recommendedCategories: ["粉面", "快餐", "烧烤", "东北菜", "家常菜", "川湘菜", "粤菜", "新疆菜"],
      budgetLevels: ["20-30", "30-50", "50-80"],
      sceneTags: ["低预算", "多人约饭", "重口味聚餐"]
    }
  }
];

const campusAnchors = [
  { id: "campus_anchor_001", latitude: 23.041374, longitude: 113.372118 },
  { id: "campus_anchor_002", latitude: 23.050576, longitude: 113.383492 },
  { id: "campus_anchor_003", latitude: 23.053636, longitude: 113.383072 },
  { id: "campus_anchor_004", latitude: 23.05915, longitude: 113.3969 },
  { id: "campus_anchor_005", latitude: 23.054588, longitude: 113.400043 },
  { id: "campus_anchor_006", latitude: 23.050639, longitude: 113.40174 },
  { id: "campus_anchor_007", latitude: 23.04336, longitude: 113.387376 },
  { id: "campus_anchor_008", latitude: 23.042713, longitude: 113.393067 },
  { id: "campus_anchor_009", latitude: 23.039966, longitude: 113.381655 },
  { id: "campus_anchor_010", latitude: 23.051027, longitude: 113.40229 }
];

const districtById = new Map(polygonDistricts.map((district) => [district.id, district]));

const districtPlans = [
  { districtId: "gogo_xintiandi", count: 12, categories: ["西餐", "西餐", "奶茶", "奶茶", "咖啡", "咖啡", "轻食", "轻食", "甜品", "日料", "韩餐", "粤菜"] },
  { districtId: "beigang_village", count: 14, categories: ["粉面", "粉面", "粉面", "快餐", "快餐", "烧烤", "烧烤", "烧烤", "家常菜", "家常菜", "川湘菜", "川湘菜", "奶茶", "火锅"] },
  { districtId: "chuangzhi_park", count: 8, categories: ["快餐", "快餐", "咖啡", "咖啡", "轻食", "轻食", "粉面", "甜品"] },
  { districtId: "beiting_village", count: 12, categories: ["粉面", "粉面", "粤菜", "粤菜", "家常菜", "家常菜", "烧烤", "烧烤", "快餐", "川湘菜", "潮汕菜", "东北菜"] },
  { districtId: "qingchuanghui", count: 8, categories: ["快餐", "快餐", "咖啡", "咖啡", "轻食", "奶茶", "粉面", "甜品"] },
  { districtId: "nanting_village", count: 12, categories: ["快餐", "粉面", "粉面", "家常菜", "家常菜", "烧烤", "烧烤", "火锅", "火锅", "川湘菜", "潮汕菜", "新疆菜"] },
  { districtId: "suishi_village", count: 12, categories: ["粉面", "粉面", "快餐", "烧烤", "烧烤", "东北菜", "东北菜", "家常菜", "家常菜", "川湘菜", "粤菜", "新疆菜"] },
  { districtId: "campus_anchors", count: 12, categories: ["快餐", "快餐", "奶茶", "奶茶", "咖啡", "咖啡", "轻食", "轻食", "粉面", "日料", "西餐", "甜品"] },
  { districtId: "manual_sample_jitter", count: 10, categories: ["韩餐", "韩餐", "日料", "西餐", "火锅", "粤菜", "家常菜", "潮汕菜", "新疆菜", "甜品"] }
];

const categoryMeta = {
  粉面: { cuisines: ["粥粉面", "粉面"], suffixes: ["粉面铺", "汤粉档", "云吞面馆"], light: true, nonSpicy: true },
  快餐: { cuisines: ["快餐", "简餐"], suffixes: ["简餐社", "饭档", "便当屋"], light: true, nonSpicy: true },
  奶茶: { cuisines: ["茶饮", "奶茶"], suffixes: ["茶饮铺", "奶茶社", "果茶站"], light: true, nonSpicy: true },
  咖啡: { cuisines: ["咖啡", "轻咖啡"], suffixes: ["咖啡馆", "咖啡角", "咖啡小站"], light: true, nonSpicy: true },
  甜品: { cuisines: ["甜品"], suffixes: ["甜品屋", "糖水铺", "甜汤社"], light: true, nonSpicy: true },
  轻食: { cuisines: ["轻食", "沙拉"], suffixes: ["轻食社", "沙拉碗", "能量餐吧"], light: true, nonSpicy: true },
  粤菜: { cuisines: ["粤菜", "广府菜"], suffixes: ["粤味小馆", "广府饭堂", "煲仔小馆"], light: false, nonSpicy: true },
  家常菜: { cuisines: ["家常菜", "小炒"], suffixes: ["小炒馆", "家常饭堂", "小灶"], light: false, nonSpicy: true },
  川湘菜: { cuisines: ["川湘菜", "香辣小炒"], suffixes: ["川湘小馆", "香辣饭堂", "下饭小灶"], light: false, nonSpicy: false },
  火锅: { cuisines: ["火锅", "锅物"], suffixes: ["锅物局", "小火锅", "热锅社"], light: false, nonSpicy: true },
  烧烤: { cuisines: ["烧烤", "烤串"], suffixes: ["烧烤铺", "烤串档", "炭烤小馆"], light: false, nonSpicy: false },
  韩餐: { cuisines: ["韩餐"], suffixes: ["韩食馆", "拌饭社", "年糕食堂"], light: false, nonSpicy: true },
  日料: { cuisines: ["日料", "日式简餐"], suffixes: ["日式食堂", "寿司小馆", "咖喱饭社"], light: true, nonSpicy: true },
  西餐: { cuisines: ["西餐", "意面披萨"], suffixes: ["西餐社", "意面屋", "披萨小馆"], light: true, nonSpicy: true },
  东北菜: { cuisines: ["东北菜"], suffixes: ["东北小馆", "饺子炖菜馆", "铁锅小厨"], light: false, nonSpicy: true },
  新疆菜: { cuisines: ["新疆菜", "西北风味"], suffixes: ["西北食堂", "新疆小馆", "拌面烤馕铺"], light: false, nonSpicy: true },
  潮汕菜: { cuisines: ["潮汕菜"], suffixes: ["潮汕小馆", "粿条汤铺", "卤味饭堂"], light: false, nonSpicy: true }
};

const nameLeft = ["青", "云", "岛", "桥", "禾", "星", "南", "北", "小", "晴", "竹", "溪", "湾", "石", "晓"];
const nameRight = ["禾", "桥", "屿", "巷", "田", "湾", "棠", "笙", "橙", "谷", "亭", "知", "味", "澜", "安"];

const budgetQuotas = {
  "20-30": 24,
  "30-50": 34,
  "50-80": 28,
  "80+": 14
};

const budgetPreferences = {
  粉面: ["20-30", "30-50"],
  快餐: ["20-30", "30-50"],
  奶茶: ["20-30", "30-50"],
  咖啡: ["30-50", "20-30", "50-80"],
  甜品: ["30-50", "20-30", "50-80"],
  轻食: ["30-50", "50-80", "20-30"],
  粤菜: ["50-80", "80+", "30-50"],
  家常菜: ["30-50", "50-80", "20-30"],
  川湘菜: ["30-50", "50-80", "80+"],
  火锅: ["50-80", "80+", "30-50"],
  烧烤: ["50-80", "30-50", "80+"],
  韩餐: ["50-80", "80+", "30-50"],
  日料: ["50-80", "80+", "30-50"],
  西餐: ["50-80", "80+", "30-50"],
  东北菜: ["50-80", "30-50", "80+"],
  新疆菜: ["50-80", "30-50", "80+"],
  潮汕菜: ["50-80", "80+", "30-50"]
};

const budgetPriceRanges = {
  "20-30": [22, 30],
  "30-50": [32, 49],
  "50-80": [52, 79],
  "80+": [82, 118]
};

function assignBudgetLevel(category) {
  const preferences = budgetPreferences[category] ?? ["30-50", "50-80", "20-30", "80+"];
  const level = preferences.find((candidate) => budgetQuotas[candidate] > 0) ?? Object.keys(budgetQuotas).find((candidate) => budgetQuotas[candidate] > 0);

  if (!level) {
    throw new Error("Budget quota exhausted before all shops were generated.");
  }

  budgetQuotas[level] -= 1;
  return level;
}

function avgPriceForBudget(level) {
  const [min, max] = budgetPriceRanges[level];
  return randomInt(min, max);
}

function normalizePolygon(points) {
  const center = {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length
  };

  return [...points].sort((a, b) => Math.atan2(a.latitude - center.latitude, a.longitude - center.longitude) - Math.atan2(b.latitude - center.latitude, b.longitude - center.longitude));
}

function pointInPolygon(point, polygon) {
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

function randomPointInPolygon(points) {
  const polygon = normalizePolygon(points);
  const minLat = Math.min(...polygon.map((point) => point.latitude));
  const maxLat = Math.max(...polygon.map((point) => point.latitude));
  const minLng = Math.min(...polygon.map((point) => point.longitude));
  const maxLng = Math.max(...polygon.map((point) => point.longitude));

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = {
      latitude: randomBetween(minLat, maxLat),
      longitude: randomBetween(minLng, maxLng)
    };

    if (pointInPolygon(candidate, polygon)) {
      return {
        latitude: round(candidate.latitude),
        longitude: round(candidate.longitude)
      };
    }
  }

  return {
    latitude: round((minLat + maxLat) / 2),
    longitude: round((minLng + maxLng) / 2)
  };
}

function jitterPoint(anchor, minMeters, maxMeters) {
  const distanceMeters = randomBetween(minMeters, maxMeters);
  const angle = randomBetween(0, Math.PI * 2);
  const deltaLat = (Math.cos(angle) * distanceMeters) / 111320;
  const deltaLng = (Math.sin(angle) * distanceMeters) / (111320 * Math.cos((anchor.latitude * Math.PI) / 180));

  return {
    latitude: round(anchor.latitude + deltaLat),
    longitude: round(anchor.longitude + deltaLng)
  };
}

function getPointForPlan(plan, indexWithinDistrict, manualShops) {
  if (plan.districtId === "campus_anchors") {
    const anchor = campusAnchors[indexWithinDistrict % campusAnchors.length];
    return {
      ...jitterPoint(anchor, 120, 250),
      syntheticRegionId: "campus_anchors",
      address: "广州大学城校内餐饮点位附近",
      addressPrecision: "approximate"
    };
  }

  if (plan.districtId === "manual_sample_jitter") {
    const anchor = manualShops[(indexWithinDistrict * 3) % manualShops.length];
    return {
      ...jitterPoint({ latitude: anchor.latitude, longitude: anchor.longitude }, 80, 180),
      syntheticRegionId: "manual_sample_jitter",
      address: "广州大学城人工样例店铺周边虚拟点位",
      addressPrecision: "approximate"
    };
  }

  const district = districtById.get(plan.districtId);

  if (!district) {
    throw new Error(`Unknown district ${plan.districtId}`);
  }

  return {
    ...randomPointInPolygon(district.polygon),
    syntheticRegionId: district.id,
    address: `${district.addressLabel}虚拟点位`,
    addressPrecision: "business_district"
  };
}

function openingHoursFor(category, districtId) {
  if (category === "咖啡" || category === "甜品" || category === "轻食") {
    return "09:30-21:30";
  }

  if (category === "奶茶") {
    return "10:00-22:30";
  }

  if (category === "烧烤") {
    return districtId === "campus_anchors" ? "16:30-22:30" : "17:00-01:00";
  }

  if (category === "粉面" || category === "快餐") {
    return "10:30-21:00";
  }

  return "11:00-22:00";
}

function tagsForShop(category, budgetLevel, districtId, featureProfile) {
  const tags = [category, ...categoryMeta[category].cuisines, budgetLevel, featureProfile.soloFriendly ? "单人快吃" : "", featureProfile.groupFriendly ? "多人约饭" : "", featureProfile.chatFriendly ? "适合聊天" : "", featureProfile.rainyDayFriendly ? "雨天室内" : "", featureProfile.supportsNonSpicy ? "不辣可选" : "", featureProfile.heavyTaste ? "重口味聚餐" : ""];

  if (budgetLevel === "20-30") {
    tags.push("低预算");
  }

  if (districtId === "campus_anchors") {
    tags.push("校内");
  }

  if (["gogo_xintiandi", "qingchuanghui", "chuangzhi_park"].includes(districtId)) {
    tags.push("室内");
  }

  return unique(tags);
}

function queueRiskFor(category, districtId) {
  if (districtId === "gogo_xintiandi" && ["西餐", "奶茶", "咖啡", "甜品"].includes(category)) {
    return "medium";
  }

  if (["beigang_village", "nanting_village"].includes(districtId) && ["烧烤", "火锅", "川湘菜"].includes(category)) {
    return "high";
  }

  if (["粉面", "快餐", "轻食", "咖啡"].includes(category)) {
    return "low";
  }

  return "medium";
}

function noiseLevelFor(category, districtId) {
  if (["烧烤", "火锅", "川湘菜"].includes(category)) {
    return "high";
  }

  if (["咖啡", "轻食", "甜品"].includes(category)) {
    return "low";
  }

  if (["beigang_village", "nanting_village", "suishi_village", "beiting_village"].includes(districtId)) {
    return "medium";
  }

  return "low";
}

function featureProfileFor(category, budgetLevel, districtId) {
  const meta = categoryMeta[category];
  const queueRisk = queueRiskFor(category, districtId);
  const noiseLevel = noiseLevelFor(category, districtId);
  const soloFriendly = ["粉面", "快餐", "奶茶", "咖啡", "甜品", "轻食", "日料", "西餐"].includes(category);
  const groupFriendly = ["粤菜", "家常菜", "川湘菜", "火锅", "烧烤", "韩餐", "东北菜", "新疆菜", "潮汕菜", "西餐"].includes(category);
  const chatFriendly = ["咖啡", "甜品", "轻食", "西餐", "粤菜", "韩餐", "日料"].includes(category) || ["gogo_xintiandi", "qingchuanghui"].includes(districtId);
  const indoor = !["烧烤"].includes(category) || districtId === "gogo_xintiandi";
  const rainyDayFriendly = indoor && noiseLevel !== "high";
  const heavyTaste = ["川湘菜", "火锅", "烧烤", "东北菜", "新疆菜"].includes(category);

  return {
    supportsSpicy: ["川湘菜", "火锅", "烧烤", "韩餐", "粉面", "快餐", "家常菜", "新疆菜"].includes(category),
    supportsNonSpicy: meta.nonSpicy,
    quietScore: noiseLevel === "low" ? 4.4 : noiseLevel === "medium" ? 3.4 : 2.3,
    queueRisk,
    noiseLevel,
    soloFriendly,
    groupFriendly,
    chatFriendly,
    indoor,
    rainyDayFriendly,
    heavyTaste,
    budgetLevel
  };
}

const dishTemplates = {
  粉面: [
    ["鲜虾云吞面", "none", ["不辣", "汤面", "单人"], "single", 0.75],
    ["牛腩汤粉", "mild", ["微辣可选", "饱腹"], "single", 0.82],
    ["番茄鸡蛋拌粉", "none", ["清淡", "不辣"], "single", 0.68],
    ["酸辣肉末粉", "medium", ["香辣", "下饭"], "single", 0.72],
    ["青菜瘦肉粥", "none", ["清淡", "低油"], "single", 0.58],
    ["卤味双拼粉", "mild", ["卤味", "饱腹"], "single", 0.88]
  ],
  快餐: [
    ["黑椒鸡腿饭", "mild", ["单人", "饱腹"], "single", 0.86],
    ["番茄牛肉饭", "none", ["不辣", "下饭"], "single", 0.92],
    ["香煎鱼排便当", "none", ["低油", "单人"], "single", 0.98],
    ["咖喱鸡排饭", "mild", ["微辣", "饱腹"], "single", 0.88],
    ["时蔬双拼饭", "none", ["清淡", "不辣"], "single", 0.76],
    ["照烧肥牛饭", "none", ["不辣", "单人"], "single", 0.94]
  ],
  奶茶: [
    ["茉莉轻乳茶", "none", ["不辣", "饮品", "低负担"], "drink", 0.58],
    ["桂花乌龙拿铁", "none", ["饮品", "适合聊天"], "drink", 0.65],
    ["芋泥鲜奶茶", "none", ["甜口", "饮品"], "drink", 0.7],
    ["柠檬气泡茶", "none", ["清爽", "饮品"], "drink", 0.55],
    ["厚乳红茶", "none", ["甜口", "饮品"], "drink", 0.62],
    ["手作冻柠茶", "none", ["清爽", "饮品"], "drink", 0.52]
  ],
  咖啡: [
    ["燕麦拿铁", "none", ["咖啡", "不辣"], "drink", 0.7],
    ["冷萃美式", "none", ["咖啡", "低糖"], "drink", 0.62],
    ["海盐焦糖拿铁", "none", ["咖啡", "甜口"], "drink", 0.76],
    ["蘑菇鸡肉帕尼尼", "none", ["轻食", "单人"], "single", 0.92],
    ["烤南瓜沙拉", "none", ["低油", "清淡"], "single", 0.86],
    ["巴斯克小蛋糕", "none", ["甜品", "适合分享"], "snack", 0.68]
  ],
  甜品: [
    ["杨枝甘露", "none", ["甜品", "不辣"], "snack", 0.68],
    ["桃胶银耳羹", "none", ["清润", "不辣"], "snack", 0.72],
    ["芋圆双皮奶", "none", ["甜口", "适合聊天"], "snack", 0.65],
    ["红豆冰沙", "none", ["清爽", "甜品"], "snack", 0.58],
    ["椰汁西米露", "none", ["不辣", "甜品"], "snack", 0.55],
    ["焦糖布丁杯", "none", ["甜口", "适合分享"], "snack", 0.62]
  ],
  轻食: [
    ["香草鸡胸沙拉", "none", ["低油", "高蛋白"], "single", 0.92],
    ["牛油果虾仁碗", "none", ["清淡", "不辣"], "single", 1.05],
    ["烟熏三文鱼贝果", "none", ["轻食", "单人"], "single", 0.98],
    ["烤南瓜藜麦碗", "none", ["低油", "饱腹"], "single", 0.88],
    ["蜂蜜酸奶杯", "none", ["甜口", "轻食"], "snack", 0.62],
    ["番茄罗勒意面杯", "none", ["不辣", "简餐"], "single", 0.86]
  ],
  粤菜: [
    ["豉汁蒸排骨", "none", ["粤菜", "不辣", "适合分享"], "shareable", 0.92],
    ["咸蛋黄啫鸡煲", "mild", ["微辣", "多人"], "shareable", 1.18],
    ["叉烧滑蛋饭", "none", ["不辣", "单人"], "single", 0.78],
    ["清蒸时蔬", "none", ["清淡", "低油"], "shareable", 0.55],
    ["砂锅例汤", "none", ["不辣", "清润"], "shareable", 0.62],
    ["干炒牛河", "none", ["粤菜", "饱腹"], "shareable", 0.82]
  ],
  家常菜: [
    ["番茄牛腩煲", "none", ["不辣", "下饭"], "shareable", 1.05],
    ["鱼香茄子饭", "medium", ["香辣", "下饭"], "single", 0.76],
    ["蒜蓉空心菜", "none", ["清淡", "适合分享"], "shareable", 0.45],
    ["土豆炖鸡块", "mild", ["微辣", "多人"], "shareable", 0.92],
    ["青椒肉丝", "mild", ["下饭", "微辣"], "shareable", 0.78],
    ["家常豆腐", "mild", ["下饭", "素菜"], "shareable", 0.62]
  ],
  川湘菜: [
    ["小炒黄牛肉", "hot", ["香辣", "重口", "下饭"], "shareable", 1.08],
    ["剁椒鱼片", "hot", ["香辣", "适合分享"], "shareable", 1.18],
    ["干锅花菜", "medium", ["香辣", "素菜"], "shareable", 0.62],
    ["酸菜肉末粉", "medium", ["酸辣", "单人"], "single", 0.58],
    ["麻辣香锅小份", "hot", ["重口", "多人"], "shareable", 0.98],
    ["蒜香排骨", "mild", ["下饭", "适合分享"], "shareable", 1.02]
  ],
  火锅: [
    ["番茄牛腩锅底", "none", ["不辣", "适合分享"], "shareable", 0.88],
    ["藤椒鸳鸯锅底", "medium", ["可选辣度", "多人"], "shareable", 0.92],
    ["鲜切肥牛盘", "none", ["涮菜", "多人"], "shareable", 1.12],
    ["手打虾滑", "none", ["涮菜", "适合分享"], "shareable", 0.78],
    ["菌菇蔬菜拼盘", "none", ["不辣", "清淡"], "shareable", 0.52],
    ["双人暖锅套餐", "medium", ["多人", "套餐"], "shareable", 1.35]
  ],
  烧烤: [
    ["孜然牛肉串", "medium", ["烧烤", "重口"], "shareable", 0.72],
    ["蜜汁鸡翅", "mild", ["微辣", "适合分享"], "shareable", 0.68],
    ["烤茄子", "medium", ["香辣", "素菜"], "shareable", 0.48],
    ["蒜香生蚝", "mild", ["适合分享", "夜宵"], "shareable", 0.92],
    ["烤馒头片", "none", ["不辣", "低预算"], "snack", 0.32],
    ["双人烤串拼盘", "hot", ["重口", "多人"], "shareable", 1.28]
  ],
  韩餐: [
    ["石锅拌饭", "mild", ["单人", "微辣"], "single", 0.82],
    ["芝士年糕锅", "medium", ["适合分享", "微辣"], "shareable", 1.05],
    ["泡菜豆腐汤", "medium", ["香辣", "汤锅"], "single", 0.72],
    ["韩式炸鸡半份", "mild", ["适合分享", "聊天"], "shareable", 0.92],
    ["海苔饭团", "none", ["不辣", "轻食"], "snack", 0.45],
    ["烤肉拌饭", "mild", ["单人", "饱腹"], "single", 0.88]
  ],
  日料: [
    ["照烧鸡排饭", "none", ["不辣", "单人"], "single", 0.82],
    ["日式咖喱蛋包饭", "mild", ["微辣", "饱腹"], "single", 0.88],
    ["三文鱼寿司卷", "none", ["不辣", "适合分享"], "shareable", 0.92],
    ["豚骨拉面", "none", ["汤面", "单人"], "single", 0.78],
    ["味噌汤", "none", ["清淡", "不辣"], "single", 0.32],
    ["天妇罗拼盘", "none", ["适合分享", "日料"], "shareable", 0.86]
  ],
  西餐: [
    ["番茄肉酱意面", "none", ["不辣", "单人"], "single", 0.82],
    ["黑椒牛排饭", "mild", ["微辣", "饱腹"], "single", 1.08],
    ["玛格丽特披萨", "none", ["适合分享", "不辣"], "shareable", 1.02],
    ["奶油蘑菇汤", "none", ["清淡", "不辣"], "single", 0.42],
    ["凯撒鸡肉沙拉", "none", ["轻食", "低油"], "single", 0.72],
    ["烤鸡翅拼盘", "mild", ["适合分享", "聊天"], "shareable", 0.86]
  ],
  东北菜: [
    ["锅包肉", "none", ["不辣", "适合分享"], "shareable", 0.92],
    ["酸菜白肉锅", "none", ["多人", "热乎"], "shareable", 1.18],
    ["地三鲜", "none", ["素菜", "下饭"], "shareable", 0.58],
    ["猪肉白菜饺子", "none", ["不辣", "单人"], "single", 0.65],
    ["小鸡炖蘑菇", "none", ["多人", "下饭"], "shareable", 1.08],
    ["东北大拉皮", "mild", ["清爽", "适合分享"], "shareable", 0.52]
  ],
  新疆菜: [
    ["孜然羊肉拌面", "medium", ["重口", "饱腹"], "single", 0.86],
    ["大盘鸡中份", "medium", ["多人", "适合分享"], "shareable", 1.22],
    ["烤馕拼盘", "none", ["不辣", "适合分享"], "shareable", 0.42],
    ["番茄牛肉汤饭", "none", ["不辣", "热乎"], "single", 0.68],
    ["椒麻鸡小份", "medium", ["香辣", "冷菜"], "shareable", 0.82],
    ["酸奶水果杯", "none", ["甜口", "解辣"], "snack", 0.46]
  ],
  潮汕菜: [
    ["牛肉粿条汤", "none", ["不辣", "汤粉"], "single", 0.72],
    ["卤水双拼饭", "none", ["卤味", "单人"], "single", 0.82],
    ["砂锅海鲜粥", "none", ["清淡", "适合分享"], "shareable", 1.05],
    ["普宁豆干", "none", ["小吃", "适合分享"], "shareable", 0.48],
    ["沙茶牛肉炒粿", "mild", ["微辣", "饱腹"], "single", 0.86],
    ["时蔬鱼丸汤", "none", ["清淡", "不辣"], "single", 0.55]
  ]
};

function makeShopName(category, index) {
  const left = nameLeft[Math.floor(index / nameRight.length) % nameLeft.length];
  const right = nameRight[index % nameRight.length];
  return `${left}${right}${pick(categoryMeta[category].suffixes)}`;
}

function makeFeature(shop, profile) {
  const tasteTags = unique([...categoryMeta[shop.category].cuisines, profile.supportsNonSpicy ? "不辣可选" : "", profile.supportsSpicy ? "可选辣度" : "", profile.heavyTaste ? "重口味" : "清淡可选"]);
  const sceneTags = unique([
    profile.soloFriendly ? "单人快吃" : "",
    profile.groupFriendly ? "多人约饭" : "",
    profile.chatFriendly ? "朋友聊天" : "",
    profile.rainyDayFriendly ? "雨天室内" : "",
    shop.avgPrice <= 30 ? "低预算" : "",
    profile.heavyTaste ? "重口味聚餐" : "",
    ["咖啡", "甜品", "轻食"].includes(shop.category) ? "周末规划" : ""
  ]);
  const crowdTags = unique([profile.soloFriendly ? "solo_friendly" : "", profile.groupFriendly ? "group_friendly" : "", profile.chatFriendly ? "chat_friendly" : "", shop.avgPrice <= 30 ? "student_budget" : ""]);
  const goodFor = unique([profile.soloFriendly ? "今天一个人快速解决" : "", profile.groupFriendly ? "三到六人约饭" : "", profile.chatFriendly ? "边吃边聊天" : "", profile.rainyDayFriendly ? "雨天室内备选" : ""]);
  const avoidTags = unique([profile.noiseLevel === "high" ? "介意嘈杂" : "", profile.queueRisk === "high" ? "赶时间" : "", !profile.supportsNonSpicy ? "完全不吃辣" : ""]);
  const explainHints = unique([
    profile.soloFriendly ? "合成画像显示适合单人快吃" : "",
    profile.groupFriendly ? "合成画像显示适合多人分食或约饭" : "",
    profile.chatFriendly ? "空间画像偏适合聊天停留" : "",
    profile.rainyDayFriendly ? "以室内点位为主，适合作为雨天备选" : "",
    shop.avgPrice <= 50 ? "预算压力较低" : "适合预算更宽松的一餐"
  ]);
  const riskHints = unique([
    profile.queueRisk === "high" ? "模拟风险：热门时段可能需要预留等待弹性" : "",
    profile.noiseLevel === "high" ? "模拟风险：环境可能偏热闹，不适合安静聊天" : "",
    profile.supportsNonSpicy ? "" : "模拟风险：口味画像偏辣，需确认同行忌口"
  ]);

  return {
    shopId: shop.id,
    supportsSpicy: profile.supportsSpicy,
    supportsNonSpicy: profile.supportsNonSpicy,
    quietScore: profile.quietScore,
    tasteTags,
    sceneTags,
    crowdTags,
    budgetLevel: profile.budgetLevel,
    goodFor,
    avoidTags,
    queueRisk: profile.queueRisk,
    noiseLevel: profile.noiseLevel,
    chatFriendly: profile.chatFriendly,
    groupFriendly: profile.groupFriendly,
    soloFriendly: profile.soloFriendly,
    indoor: profile.indoor,
    rainyDayFriendly: profile.rainyDayFriendly,
    featureTags: unique([...tasteTags, ...sceneTags, ...crowdTags, shop.category, ...shop.tags]),
    explainHints,
    riskHints,
    source: "synthetic_mvp",
    sourceId,
    synthetic: true,
    confidence: 0.45
  };
}

function sceneScoresFor(shop, feature) {
  let soloToday = 35;
  let groupMeetup = 35;
  let weekendPlan = 35;

  if (feature.soloFriendly) soloToday += 25;
  if (feature.queueRisk === "low") soloToday += 15;
  if (shop.avgPrice <= 50) soloToday += 12;
  if (feature.supportsNonSpicy) soloToday += 8;
  if (feature.noiseLevel === "high") soloToday -= 8;

  if (feature.groupFriendly) groupMeetup += 32;
  if (feature.chatFriendly) groupMeetup += 15;
  if (feature.noiseLevel === "low") groupMeetup += 12;
  if (feature.noiseLevel === "medium") groupMeetup += 8;
  if (shop.avgPrice >= 30 && shop.avgPrice <= 80) groupMeetup += 10;
  if (feature.queueRisk === "high") groupMeetup -= 5;

  if (["咖啡", "甜品", "轻食", "西餐", "日料", "韩餐"].includes(shop.category)) weekendPlan += 22;
  if (feature.chatFriendly) weekendPlan += 12;
  if (feature.rainyDayFriendly) weekendPlan += 12;
  if (["gogo_xintiandi", "campus_anchors", "qingchuanghui"].includes(shop.syntheticRegionId)) weekendPlan += 8;
  if (feature.noiseLevel === "high") weekendPlan -= 10;

  return {
    soloToday: clamp(Math.round(soloToday), 0, 100),
    groupMeetup: clamp(Math.round(groupMeetup), 0, 100),
    weekendPlan: clamp(Math.round(weekendPlan), 0, 100)
  };
}

function makeSceneFit(shop, feature) {
  const sceneScores = sceneScoresFor(shop, feature);
  const budgetHint = shop.avgPrice <= 50 ? "预算友好" : "适合预算更宽松时选择";
  const queueHint = feature.queueRisk === "low" ? "模拟排队风险较低" : "建议给等待留一点弹性";
  const spiceHint = feature.supportsNonSpicy ? "不吃辣也有可选项" : "口味偏重，同行忌辣时需谨慎";

  return {
    shopId: shop.id,
    sceneScores,
    explainHints: {
      soloToday: unique([budgetHint, queueHint, feature.soloFriendly ? "适合一个人快速解决一餐" : "", spiceHint]),
      groupMeetup: unique([feature.groupFriendly ? "菜品画像适合多人分食" : "", feature.chatFriendly ? "适合边吃边聊" : "", feature.noiseLevel !== "high" ? "噪声模拟等级不过高" : "", "人均预算适合作为约饭参考"]),
      weekendPlan: unique([feature.rainyDayFriendly ? "雨天也适合作为室内节点" : "", ["咖啡", "甜品", "轻食"].includes(shop.category) ? "适合作为咖啡甜品或轻食停留点" : "", feature.chatFriendly ? "停留聊天适配较好" : "", "可作为大学城片区路线中的餐饮节点"])
    },
    riskHints: {
      soloToday: unique([feature.queueRisk === "high" ? "模拟风险：赶时间时不建议优先选" : "", feature.noiseLevel === "high" ? "模拟风险：环境可能偏热闹" : ""]),
      groupMeetup: unique([feature.noiseLevel === "high" ? "模拟风险：聊天体验可能受噪声影响" : "", feature.queueRisk === "high" ? "模拟风险：多人同行需要预留等待弹性" : ""]),
      weekendPlan: unique([feature.rainyDayFriendly ? "" : "模拟风险：雨天舒适度一般", shop.avgPrice > 80 ? "模拟风险：人均预算偏高" : ""])
    },
    source: "synthetic_mvp",
    sourceId,
    synthetic: true,
    confidence: 0.45
  };
}

function makeDishes(shop) {
  const templates = dishTemplates[shop.category];

  return templates.slice(0, 6).map(([name, spicyLevel, tags, portionSize, priceRatio], index) => ({
    id: `dish_${shop.id}_${String(index + 1).padStart(3, "0")}`,
    shopId: shop.id,
    name,
    category: shop.category,
    price: Math.max(8, Math.round(shop.avgPrice * priceRatio + randomInt(-3, 3))),
    spicyLevel,
    tags: unique([shop.category, ...tags]),
    portionSize,
    description: `合成菜品画像，用于测试${shop.category}推荐解释，不代表真实菜单。`,
    imageUrl: null,
    signature: index < 2,
    source: "synthetic_mvp",
    sourceId,
    synthetic: true,
    confidence: 0.45
  }));
}

function expandPlans() {
  const plans = [];

  districtPlans.forEach((districtPlan) => {
    if (districtPlan.count !== districtPlan.categories.length) {
      throw new Error(`${districtPlan.districtId} count does not match category list.`);
    }

    districtPlan.categories.forEach((category, indexWithinDistrict) => {
      plans.push({
        districtId: districtPlan.districtId,
        indexWithinDistrict,
        category
      });
    });
  });

  if (plans.length !== 100) {
    throw new Error(`Expected 100 synthetic shops, got ${plans.length}.`);
  }

  return plans;
}

async function readManualShops() {
  const raw = await fs.readFile(path.join(dataDir, "shops.gut.seed.json"), "utf8");
  const parsed = JSON.parse(raw);
  return parsed.shops ?? [];
}

function makeBusinessDistrictFile() {
  return {
    schemaVersion: 1,
    source: "synthetic_mvp",
    sourceId,
    synthetic: true,
    confidence: 0.45,
    spatialSource: "manual_region_scaffold",
    description: "广州大学城 synthetic 餐饮 seed 的空间脚手架。polygon 和 anchor 只用于合成点位生成与校验，不是精确行政边界，也不代表真实商户位置。",
    businessDistricts: polygonDistricts.map((district) => ({
      id: district.id,
      name: district.name,
      type: "polygon",
      description: district.description,
      polygon: district.polygon,
      spatialSource: "manual_region_scaffold",
      profile: district.profile
    })),
    campusAnchors: {
      id: "campus_anchors",
      name: "校内 / 高校内部餐饮 anchors",
      type: "anchors",
      description: "大学内部商业区 / 校内餐饮点位附近的 synthetic 生成锚点。每个点位周围 jitter 120-250 米，不生成城中村大排档或小巷烧烤风格。",
      jitterRadiusMeters: { min: 120, max: 250 },
      anchors: campusAnchors,
      spatialSource: "manual_region_scaffold",
      profile: {
        recommendedCategories: ["快餐", "奶茶", "咖啡", "轻食", "粉面", "日料", "西餐", "甜品"],
        budgetLevels: ["20-30", "30-50", "50-80"],
        sceneTags: ["校内", "单人快吃", "雨天室内", "周末规划"]
      }
    },
    manualSampleJitter: {
      id: "manual_sample_jitter",
      name: "manual_sample 周边 synthetic jitter 点位",
      type: "manual_shop_anchor_jitter",
      description: "基于现有 manual_sample 店铺坐标生成的虚拟可选项，坐标带 80-180 米 jitter，不与 manual 店铺完全重合。",
      jitterRadiusMeters: { min: 80, max: 180 },
      spatialSource: "manual_region_scaffold",
      profile: {
        recommendedCategories: ["韩餐", "日料", "西餐", "火锅", "粤菜", "家常菜", "潮汕菜", "新疆菜", "甜品"],
        budgetLevels: ["30-50", "50-80", "80+"],
        sceneTags: ["多人约饭", "朋友聊天", "周末规划"]
      }
    },
    updatedAt: generatedAt
  };
}

function validateGeneratedData(shops, dishes, features, sceneFits) {
  const categoryCounts = new Map();
  const budgetCounts = new Map();
  const dishCountByShopId = new Map();

  shops.forEach((shop) => {
    categoryCounts.set(shop.category, (categoryCounts.get(shop.category) ?? 0) + 1);
    const budgetLevel = features.find((feature) => feature.shopId === shop.id)?.budgetLevel;
    budgetCounts.set(budgetLevel, (budgetCounts.get(budgetLevel) ?? 0) + 1);
  });

  dishes.forEach((dish) => {
    dishCountByShopId.set(dish.shopId, (dishCountByShopId.get(dish.shopId) ?? 0) + 1);
  });

  const requiredCategories = ["粉面", "快餐", "奶茶", "咖啡", "甜品", "轻食", "粤菜", "家常菜", "川湘菜", "火锅", "烧烤", "韩餐", "日料", "西餐", "东北菜", "新疆菜", "潮汕菜"];
  const missingCategory = requiredCategories.find((category) => (categoryCounts.get(category) ?? 0) < 3);

  if (missingCategory) {
    throw new Error(`Category ${missingCategory} has fewer than 3 shops.`);
  }

  const sceneStrongCounts = {
    soloToday: sceneFits.filter((item) => item.sceneScores.soloToday >= 75).length,
    groupMeetup: sceneFits.filter((item) => item.sceneScores.groupMeetup >= 75).length,
    weekendPlan: sceneFits.filter((item) => item.sceneScores.weekendPlan >= 75).length,
    lowBudget: features.filter((item) => item.budgetLevel === "20-30").length,
    rainyDay: features.filter((item) => item.rainyDayFriendly).length,
    chat: features.filter((item) => item.chatFriendly).length,
    heavyTaste: features.filter((item) => item.sceneTags.includes("重口味聚餐")).length,
    nonSpicy: features.filter((item) => item.supportsNonSpicy).length
  };

  const sceneMinimums = {
    soloToday: 20,
    groupMeetup: 20,
    weekendPlan: 15,
    lowBudget: 20,
    rainyDay: 20,
    chat: 20,
    heavyTaste: 10,
    nonSpicy: 20
  };

  Object.entries(sceneMinimums).forEach(([key, minimum]) => {
    if (sceneStrongCounts[key] < minimum) {
      throw new Error(`Scene coverage ${key} is ${sceneStrongCounts[key]}, expected at least ${minimum}.`);
    }
  });

  shops.forEach((shop) => {
    if ((dishCountByShopId.get(shop.id) ?? 0) < 5) {
      throw new Error(`${shop.id} has fewer than 5 dishes.`);
    }
  });

  if (shops.length !== 100 || dishes.length < 500 || features.length !== 100 || sceneFits.length !== 100) {
    throw new Error(`Unexpected totals: ${shops.length} shops, ${dishes.length} dishes, ${features.length} features, ${sceneFits.length} sceneFits.`);
  }

  if (Object.values(budgetQuotas).some((remaining) => remaining !== 0)) {
    throw new Error(`Budget quotas were not exhausted: ${JSON.stringify(budgetQuotas)}`);
  }

  return {
    categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))),
    budgetCounts: Object.fromEntries([...budgetCounts.entries()].sort()),
    sceneStrongCounts
  };
}

async function writeJson(filePath, value) {
  if (dryRun) {
    return;
  }

  if (!force) {
    try {
      await fs.access(filePath);
      throw new Error(`${path.relative(frontendRoot, filePath)} already exists. Pass --force to overwrite.`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const manualShops = await readManualShops();
  const plans = expandPlans();
  const shops = [];
  const dishes = [];
  const features = [];
  const sceneFits = [];

  plans.forEach((plan, index) => {
    const category = plan.category;
    const budgetLevel = assignBudgetLevel(category);
    const avgPrice = avgPriceForBudget(budgetLevel);
    const point = getPointForPlan(plan, plan.indexWithinDistrict, manualShops);
    const profile = featureProfileFor(category, budgetLevel, plan.districtId);
    const id = `synthetic_gut_${String(index + 1).padStart(3, "0")}`;
    const shop = {
      id,
      name: makeShopName(category, index),
      category,
      cuisines: categoryMeta[category].cuisines,
      address: point.address,
      latitude: point.latitude,
      longitude: point.longitude,
      avgPrice,
      rating: null,
      syntheticRating: null,
      tags: tagsForShop(category, budgetLevel, plan.districtId, profile),
      regionId: "guangzhou_university_town",
      syntheticRegionId: point.syntheticRegionId,
      openingHours: openingHoursFor(category, plan.districtId),
      source: "synthetic_mvp",
      sourceId,
      synthetic: true,
      confidence: 0.45,
      addressPrecision: point.addressPrecision,
      spatialSource: "synthetic_within_region",
      createdAt: generatedAt,
      updatedAt: generatedAt
    };

    const feature = makeFeature(shop, profile);
    const sceneFit = makeSceneFit(shop, feature);

    shops.push(shop);
    features.push(feature);
    sceneFits.push(sceneFit);
    dishes.push(...makeDishes(shop));
  });

  const summary = validateGeneratedData(shops, dishes, features, sceneFits);
  const files = {
    shops: {
      schemaVersion: 1,
      source: "synthetic_mvp",
      sourceId,
      synthetic: true,
      generatedAt,
      shops
    },
    dishes: {
      schemaVersion: 1,
      source: "synthetic_mvp",
      sourceId,
      synthetic: true,
      generatedAt,
      dishes
    },
    features: {
      schemaVersion: 1,
      source: "synthetic_mvp",
      sourceId,
      synthetic: true,
      generatedAt,
      features
    },
    sceneFits: {
      schemaVersion: 1,
      source: "synthetic_mvp",
      sourceId,
      synthetic: true,
      generatedAt,
      sceneFits
    },
    businessDistricts: makeBusinessDistrictFile()
  };

  await Promise.all(Object.entries(files).map(([key, value]) => writeJson(outputPaths[key], value)));

  console.log(
    JSON.stringify(
      {
        wrote: dryRun ? "dry-run" : Object.fromEntries(Object.entries(outputPaths).map(([key, value]) => [key, path.relative(frontendRoot, value)])),
        totals: {
          shops: shops.length,
          dishes: dishes.length,
          features: features.length,
          sceneFits: sceneFits.length
        },
        ...summary
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
