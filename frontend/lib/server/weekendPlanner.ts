import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { matchWeekendRoutes } from "../weekendData/matchService";
import type { WeekendRouteMatch, WeekendWeatherCondition, WeekendWeatherLike } from "../weekendData/types";

const PANYU_LATITUDE = 22.9387;
const PANYU_LONGITUDE = 113.3785;
const DEFAULT_BUDGET_MAX = 120;
const DEFAULT_START_AREA = "学校周边";
const DEFAULT_TIME_WINDOW = "周六下午";

type WeekendPlanDatabase = {
  version: 1;
  plans: Record<string, WeekendPlanResponse>;
};

type WeekendPlanRequest = {
  timeWindow: string;
  budgetMax: number;
  startArea: string;
  mood: string;
  energyLevel: string;
  companions: string;
  interests: string[];
  rawText: string;
};

type WeatherStatus = "available" | "unavailable";
type CheckStatus = "pass" | "risk" | "fail";
type WalkingIntensity = "low" | "medium" | "high";
type WeekendRouteType = "outdoor" | "balanced" | "indoor_backup";

type WeekendRouteCheck = {
  key: "budget" | "time_window" | "weather" | "walking_intensity" | "return_time";
  label: string;
  status: CheckStatus;
  detail: string;
};

type WeekendWeather = {
  status: WeatherStatus;
  provider: "Open-Meteo";
  location: string;
  summary: string;
  weatherCode?: number;
  weatherText?: string;
  temperatureC?: number;
  apparentTemperatureC?: number;
  precipitationMm?: number;
  rainMm?: number;
  windSpeedKmh?: number;
  precipitationProbabilityMax?: number;
  observedAt?: string;
  forecastDays?: Array<{
    date: string;
    weatherCode: number;
    weatherText: string;
    temperatureMaxC: number;
    temperatureMinC: number;
    precipitationProbabilityMax?: number;
  }>;
  isRainy: boolean;
  isHot: boolean;
  isAbnormal: boolean;
  fallback: boolean;
  note?: string;
};

type WeekendPlace = {
  id: string;
  name: string;
  category: string;
  indoor: boolean;
  interests: string[];
  averageCost: number;
  durationMinutes: number;
  walkMinutes: number;
  intensity: WalkingIntensity;
  description: string;
  risks: string[];
};

type WeekendRoute = {
  routeId: string;
  id?: string;
  templateId?: string;
  routeType: WeekendRouteType;
  title: string;
  summary: string;
  routeReason?: string;
  fallbackReason?: string;
  estimatedBudget: number;
  estimatedDurationMinutes: number;
  walkingIntensity: WalkingIntensity;
  timeline: Array<{
    time: string;
    title: string;
    placeName: string;
    activity: string;
    durationMinutes: number;
  }>;
  places: Array<{
    name: string;
    category: string;
    indoor: boolean;
    estimatedCost: number;
    walkMinutes: number;
  }>;
  transport: string;
  selfChecks: WeekendRouteCheck[];
  checks?: WeekendRouteCheck[];
  risks: string[];
  riskTips?: string[];
  inviteText: string;
  inviteCopy?: string;
};

export type WeekendPlanResponse = {
  planId: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt: string;
  request: WeekendPlanRequest;
  weather: WeekendWeather;
  routes: [WeekendRoute, WeekendRoute, WeekendRoute];
  source: {
    weather: "open-meteo-real" | "fallback-conservative";
    poi: "mock-school-area" | "weekend-synthetic-mvp";
    planner: "rules-v1" | "weekend-data-rules-v1";
  };
};

const mockPlaces: WeekendPlace[] = [
  {
    id: "east_gate_cafe",
    name: "东门咖啡小馆",
    category: "咖啡",
    indoor: true,
    interests: ["咖啡", "轻食", "拍照"],
    averageCost: 38,
    durationMinutes: 55,
    walkMinutes: 8,
    intensity: "low",
    description: "适合开场坐一下，确认当天状态和预算。",
    risks: ["周末下午可能需要等位 5-10 分钟。"]
  },
  {
    id: "campus_lake_walk",
    name: "校园湖畔步道",
    category: "citywalk",
    indoor: false,
    interests: ["citywalk", "公园", "拍照"],
    averageCost: 0,
    durationMinutes: 45,
    walkMinutes: 18,
    intensity: "medium",
    description: "轻量散步路线，适合晴天和不赶时间的下午。",
    risks: ["下雨或高温时体验下降。"]
  },
  {
    id: "panyu_micro_gallery",
    name: "番禺小展厅",
    category: "展览",
    indoor: true,
    interests: ["展览", "拍照", "citywalk"],
    averageCost: 25,
    durationMinutes: 70,
    walkMinutes: 12,
    intensity: "low",
    description: "室内轻展览，适合雨天、低体力和拍照。",
    risks: ["展陈内容偏轻量，不适合作为长时间主活动。"]
  },
  {
    id: "light_meal_corner",
    name: "学校周边轻食角",
    category: "轻食",
    indoor: true,
    interests: ["轻食", "咖啡"],
    averageCost: 42,
    durationMinutes: 50,
    walkMinutes: 10,
    intensity: "low",
    description: "可补一顿简单餐，预算可控。",
    risks: ["饭点可能略拥挤。"]
  },
  {
    id: "bookstore_cafe",
    name: "书店咖啡自习角",
    category: "咖啡",
    indoor: true,
    interests: ["咖啡", "展览", "拍照"],
    averageCost: 32,
    durationMinutes: 60,
    walkMinutes: 9,
    intensity: "low",
    description: "安静、低体力，适合聊天和避雨。",
    risks: ["座位不一定连续。"]
  },
  {
    id: "pocket_park",
    name: "口袋公园短线",
    category: "公园",
    indoor: false,
    interests: ["公园", "citywalk", "拍照"],
    averageCost: 0,
    durationMinutes: 35,
    walkMinutes: 15,
    intensity: "medium",
    description: "短时间户外透气点，适合天气正常时插入。",
    risks: ["遮阴有限，高温天不建议停留过久。"]
  },
  {
    id: "dessert_stop",
    name: "甜品收尾小店",
    category: "甜品",
    indoor: true,
    interests: ["轻食", "拍照", "咖啡"],
    averageCost: 28,
    durationMinutes: 35,
    walkMinutes: 6,
    intensity: "low",
    description: "适合最后坐一会儿、复制邀约后收尾。",
    risks: ["甜品店翻台快，聊天时间不宜过长。"]
  }
];

let operationQueue: Promise<unknown> = Promise.resolve();

function getStateFilePath() {
  const configured = process.env.MEITUAN_WEEKEND_STATE_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "weekend-plans.json");
}

function nowIso() {
  return new Date().toISOString();
}

function createPlanId() {
  return `weekend_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

async function writeDatabase(database: WeekendPlanDatabase) {
  const filePath = getStateFilePath();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${randomUUID()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readDatabase(): Promise<WeekendPlanDatabase> {
  const filePath = getStateFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as WeekendPlanDatabase;

    if (parsed.version !== 1 || !parsed.plans) {
      throw new Error("Unsupported weekend plan store format.");
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const database: WeekendPlanDatabase = {
      version: 1,
      plans: {}
    };
    await writeDatabase(database);
    return database;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberField(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeInterests(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  }

  if (typeof value === "string") {
    return Array.from(new Set(value.split(/[、,\s]+/).map((item) => item.trim()).filter(Boolean)));
  }

  return [];
}

function normalizeRequest(input: unknown): WeekendPlanRequest {
  const payload = isRecord(input) ? input : {};
  const interests = normalizeInterests(payload.interests);

  return {
    timeWindow: stringField(payload.timeWindow ?? payload.time_window, DEFAULT_TIME_WINDOW),
    budgetMax: numberField(payload.budgetMax ?? payload.budget_max, DEFAULT_BUDGET_MAX),
    startArea: stringField(payload.startArea ?? payload.start_area, DEFAULT_START_AREA),
    mood: stringField(payload.mood, "轻松一点"),
    energyLevel: stringField(payload.energyLevel ?? payload.energy_level, "中等"),
    companions: stringField(payload.companions, "自己"),
    interests,
    rawText: stringField(payload.rawText ?? payload.raw_text, "")
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function deriveWeekendDataInterestTags(request: WeekendPlanRequest, weather: WeekendWeather) {
  const text = [request.mood, request.companions, request.rawText, ...request.interests].filter(Boolean).join(" ");
  const tags: string[] = [];

  if (/聊天|朋友|多人|同学|轻聚|聚会/.test(text)) {
    tags.push("朋友", "聊天", "安静聊天", "茶饮", "桌游", "剧本杀");
  }

  if (/轻松|放空|不累|少走|低体力|坐坐|休息/.test(text)) {
    tags.push("少走路", "适合放空", "室内休息点");
  }

  if (/室内|雨|热|晒|空调/.test(text) || weather.isRainy || weather.isHot || weather.fallback) {
    tags.push("雨天友好", "室内活动", "室内休息点");
  }

  if (/出门|散步|走走|户外|公园|江边|citywalk|骑行/.test(text)) {
    tags.push("citywalk", "散步", "户外活动", "公园", "江边散步");
  }

  if (/咖啡|甜品|奶茶|茶饮|轻食|小吃/.test(text)) {
    tags.push("咖啡", "甜品", "奶茶", "茶饮", "轻食", "小吃");
  }

  if (/电影|电玩|电玩城|娱乐|商场/.test(text)) {
    tags.push("电影", "电玩城", "轻娱乐", "购物");
  }

  return uniqueStrings(tags);
}

function mapWeekendDataWeatherCondition(weather: WeekendWeather): WeekendWeatherCondition {
  if (weather.fallback || weather.status === "unavailable") {
    return "unknown";
  }

  if (weather.isRainy) {
    return "rainy";
  }

  if (weather.isHot) {
    return "hot";
  }

  if (weather.weatherCode === 0 || /晴|sunny/i.test(weather.weatherText ?? "")) {
    return "sunny";
  }

  if ([1, 2, 3, 45, 48].includes(weather.weatherCode ?? -1) || /云|阴|cloud/i.test(weather.weatherText ?? "")) {
    return "cloudy";
  }

  return "unknown";
}

function createWeekendDataWeather(weather: WeekendWeather): WeekendWeatherLike {
  const condition = mapWeekendDataWeatherCondition(weather);
  const isConservative = condition === "unknown";

  return {
    summary: weather.summary,
    condition,
    weatherText: weather.weatherText,
    status: weather.status,
    isRainy: isConservative ? false : weather.isRainy,
    isHot: isConservative ? false : weather.isHot,
    fallback: weather.fallback
  };
}

function createWeekendDataRequest(request: WeekendPlanRequest, weather: WeekendWeather) {
  const derivedTags = deriveWeekendDataInterestTags(request, weather);

  return {
    timeWindow: request.timeWindow,
    budgetMax: request.budgetMax,
    startArea: request.startArea,
    mood: request.mood,
    energyLevel: request.energyLevel,
    companions: request.companions,
    interests: request.interests,
    interestTags: uniqueStrings([...request.interests, ...derivedTags]),
    rawText: [request.rawText, request.mood, request.companions].filter(Boolean).join(" ")
  };
}

function weatherCodeText(code: number) {
  if (code === 0) return "晴";
  if ([1, 2].includes(code)) return "少云";
  if (code === 3) return "多云";
  if ([45, 48].includes(code)) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "小雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气未知";
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fallbackWeather(note = "天气暂不可用，已按保守方案生成。"): WeekendWeather {
  return {
    status: "unavailable",
    provider: "Open-Meteo",
    location: "广州番禺",
    summary: note,
    isRainy: true,
    isHot: false,
    isAbnormal: true,
    fallback: true,
    note
  };
}

async function fetchPanyuWeather(): Promise<WeekendWeather> {
  if (process.env.MEITUAN_WEEKEND_WEATHER_DISABLED === "1") {
    return fallbackWeather();
  }

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${PANYU_LATITUDE}` +
    `&longitude=${PANYU_LONGITUDE}` +
    "&current=temperature_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&forecast_days=3" +
    "&timezone=Asia%2FShanghai";

  try {
    const response = await fetchWithTimeout(url, 6000);

    if (!response.ok) {
      return fallbackWeather(`天气暂不可用，Open-Meteo 返回 HTTP ${response.status}，已按保守方案生成。`);
    }

    const data = (await response.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        apparent_temperature?: number;
        precipitation?: number;
        rain?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
      };
    };
    const current = data.current ?? {};
    const code = typeof current.weather_code === "number" ? current.weather_code : -1;
    const weatherText = weatherCodeText(code);
    const precipitation = current.precipitation ?? 0;
    const rain = current.rain ?? 0;
    const apparentTemperature = current.apparent_temperature;
    const temperature = current.temperature_2m;
    const dailyProbability = data.daily?.precipitation_probability_max?.[0] ?? 0;
    const isRainy = rain > 0 || precipitation > 0 || dailyProbability >= 50 || ["小雨", "雨", "雷雨"].includes(weatherText);
    const isHot = typeof apparentTemperature === "number" ? apparentTemperature >= 33 : typeof temperature === "number" && temperature >= 33;
    const isAbnormal = isRainy || isHot || weatherText === "雷雨" || (current.wind_speed_10m ?? 0) >= 35;
    const summaryParts = [
      `广州番禺当前${weatherText}`,
      typeof temperature === "number" ? `${Math.round(temperature)}°C` : "",
      typeof apparentTemperature === "number" ? `体感${Math.round(apparentTemperature)}°C` : "",
      dailyProbability > 0 ? `未来 3 天最高降水概率 ${Math.max(...(data.daily?.precipitation_probability_max ?? [dailyProbability]))}%` : ""
    ].filter(Boolean);

    return {
      status: "available",
      provider: "Open-Meteo",
      location: "广州番禺",
      summary: summaryParts.join("，"),
      weatherCode: code,
      weatherText,
      temperatureC: temperature,
      apparentTemperatureC: apparentTemperature,
      precipitationMm: precipitation,
      rainMm: rain,
      windSpeedKmh: current.wind_speed_10m,
      precipitationProbabilityMax: dailyProbability,
      observedAt: current.time,
      forecastDays: (data.daily?.time ?? []).slice(0, 3).map((date, index) => ({
        date,
        weatherCode: data.daily?.weather_code?.[index] ?? -1,
        weatherText: weatherCodeText(data.daily?.weather_code?.[index] ?? -1),
        temperatureMaxC: data.daily?.temperature_2m_max?.[index] ?? 0,
        temperatureMinC: data.daily?.temperature_2m_min?.[index] ?? 0,
        precipitationProbabilityMax: data.daily?.precipitation_probability_max?.[index]
      })),
      isRainy,
      isHot,
      isAbnormal,
      fallback: false
    };
  } catch (error) {
    return fallbackWeather(error instanceof Error ? `天气暂不可用：${error.message}。已按保守方案生成。` : undefined);
  }
}

function parseTimeWindowMinutes(timeWindow: string) {
  const hourMatch = timeWindow.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|hour)/i);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }

  const minuteMatch = timeWindow.match(/(\d{2,3})\s*(?:分钟|min)/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  if (timeWindow.includes("短") || timeWindow.includes("一小时") || timeWindow.includes("1小时")) {
    return 90;
  }

  return 180;
}

function energyRank(energyLevel: string) {
  if (/低|少走|不累|轻松|low/i.test(energyLevel)) return 1;
  if (/高|能走|citywalk|high/i.test(energyLevel)) return 3;
  return 2;
}

function intensityRank(intensity: WalkingIntensity) {
  return intensity === "low" ? 1 : intensity === "medium" ? 2 : 3;
}

function intensityText(intensity: WalkingIntensity) {
  return intensity === "low" ? "低体力" : intensity === "medium" ? "中等步行" : "步行较多";
}

function routeIntensity(places: WeekendPlace[]): WalkingIntensity {
  const maxRank = Math.max(...places.map((place) => intensityRank(place.intensity)));
  return maxRank >= 3 ? "high" : maxRank >= 2 ? "medium" : "low";
}

function scorePlace(place: WeekendPlace, request: WeekendPlanRequest, weather: WeekendWeather, preferIndoor: boolean) {
  let score = 0;

  for (const interest of request.interests.length > 0 ? request.interests : ["咖啡", "citywalk", "轻食"]) {
    if (place.interests.includes(interest) || place.category === interest) {
      score += 10;
    }
  }

  if (place.averageCost <= request.budgetMax) score += 8;
  if (energyRank(request.energyLevel) >= intensityRank(place.intensity)) score += 6;
  if (preferIndoor && place.indoor) score += 12;
  if (!preferIndoor && !place.indoor && !weather.isAbnormal) score += 8;
  if ((weather.isRainy || weather.fallback) && !place.indoor) score -= 20;
  if (weather.isHot && !place.indoor) score -= 12;

  return score;
}

function pickPlaces(request: WeekendPlanRequest, weather: WeekendWeather, mode: "outdoor" | "balanced" | "indoor_backup") {
  const preferIndoor = mode === "indoor_backup" || weather.isRainy || weather.isHot || weather.fallback;
  const ranked = [...mockPlaces].sort((a, b) => scorePlace(b, request, weather, preferIndoor) - scorePlace(a, request, weather, preferIndoor));

  if (mode === "outdoor" && !preferIndoor) {
    return [
      ranked.find((place) => !place.indoor) ?? mockPlaces[1],
      ranked.find((place) => place.category === "咖啡") ?? mockPlaces[0],
      ranked.find((place) => place.category === "甜品") ?? mockPlaces[6]
    ];
  }

  if (mode === "balanced") {
    return [
      ranked.find((place) => place.category === "咖啡") ?? mockPlaces[0],
      ranked.find((place) => place.indoor && place.category !== "咖啡") ?? mockPlaces[2],
      ranked.find((place) => place.category === "轻食" || place.category === "甜品") ?? mockPlaces[3]
    ];
  }

  return [
    ranked.find((place) => place.id === "bookstore_cafe") ?? mockPlaces[4],
    ranked.find((place) => place.id === "panyu_micro_gallery") ?? mockPlaces[2],
    ranked.find((place) => place.id === "dessert_stop") ?? mockPlaces[6]
  ];
}

function dedupePlaces(places: WeekendPlace[]) {
  const seen = new Set<string>();
  const result: WeekendPlace[] = [];

  for (const place of places) {
    if (!seen.has(place.id)) {
      seen.add(place.id);
      result.push(place);
    }
  }

  return result;
}

function routeBudget(places: WeekendPlace[]) {
  return places.reduce((sum, place) => sum + place.averageCost, 0);
}

function routeDuration(places: WeekendPlace[]) {
  return places.reduce((sum, place) => sum + place.durationMinutes + place.walkMinutes, 0);
}

function createTimeline(places: WeekendPlace[], request: WeekendPlanRequest) {
  const startsAt = request.timeWindow.includes("上午") ? 10 : request.timeWindow.includes("晚上") ? 18 : 14;
  let minutes = startsAt * 60;

  return places.map((place, index) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    minutes += place.durationMinutes + place.walkMinutes;

    return {
      time,
      title: index === 0 ? "集合开场" : index === places.length - 1 ? "收尾确认" : "主活动",
      placeName: place.name,
      activity: place.description,
      durationMinutes: place.durationMinutes
    };
  });
}

function createSelfChecks(places: WeekendPlace[], request: WeekendPlanRequest, weather: WeekendWeather): WeekendRoute["selfChecks"] {
  const budget = routeBudget(places);
  const duration = routeDuration(places);
  const windowMinutes = parseTimeWindowMinutes(request.timeWindow);
  const intensity = routeIntensity(places);
  const hasOutdoor = places.some((place) => !place.indoor);
  const energy = energyRank(request.energyLevel);

  return [
    {
      key: "budget",
      label: "预算",
      status: budget <= request.budgetMax ? "pass" : budget <= request.budgetMax + 30 ? "risk" : "fail",
      detail: `预计 ${budget} 元，预算上限 ${request.budgetMax} 元。`
    },
    {
      key: "time_window",
      label: "时间窗口",
      status: duration <= windowMinutes ? "pass" : duration <= windowMinutes + 45 ? "risk" : "fail",
      detail: `预计 ${Math.round(duration / 60 * 10) / 10} 小时，时间窗口约 ${Math.round(windowMinutes / 60 * 10) / 10} 小时。`
    },
    {
      key: "weather",
      label: "天气",
      status: !hasOutdoor || (!weather.isRainy && !weather.isHot && weather.status === "available") ? "pass" : hasOutdoor ? "risk" : "pass",
      detail: hasOutdoor ? `${weather.summary}；含户外点位。` : `${weather.summary}；路线以室内为主。`
    },
    {
      key: "walking_intensity",
      label: "步行强度",
      status: energy >= intensityRank(intensity) ? "pass" : energy + 1 >= intensityRank(intensity) ? "risk" : "fail",
      detail: `路线为${intensityText(intensity)}，你的体力偏好为 ${request.energyLevel || "中等"}。`
    },
    {
      key: "return_time",
      label: "返程时间",
      status: duration <= windowMinutes ? "pass" : "risk",
      detail: "默认预留 15-20 分钟返程缓冲，时间紧时建议砍掉最后一站。"
    }
  ];
}

function createRoute(mode: WeekendRoute["routeType"], request: WeekendPlanRequest, weather: WeekendWeather): WeekendRoute {
  const places = dedupePlaces(pickPlaces(request, weather, mode)).slice(0, 3);
  const budget = routeBudget(places);
  const duration = routeDuration(places);
  const intensity = routeIntensity(places);
  const labels = {
    outdoor: "出门路线",
    balanced: "折中路线",
    indoor_backup: "雨天/低体力备选"
  } satisfies Record<WeekendRoute["routeType"], string>;
  const risks = Array.from(
    new Set([
      ...places.flatMap((place) => place.risks),
      budget > request.budgetMax ? "预算可能超出，建议减少一杯饮品或跳过甜品。" : "",
      duration > parseTimeWindowMinutes(request.timeWindow) ? "时间窗口偏紧，建议把最后一站作为可选。" : "",
      weather.isRainy && places.some((place) => !place.indoor) ? "天气有雨，户外点位建议缩短停留。" : "",
      weather.isHot && places.some((place) => !place.indoor) ? "体感温度偏高，建议避开正午户外。" : ""
    ].filter(Boolean))
  );

  return {
    routeId: `${mode}_${randomUUID().slice(0, 8)}`,
    routeType: mode,
    title: `${labels[mode]}：${places.map((place) => place.name).join(" → ")}`,
    summary:
      mode === "outdoor"
        ? "天气允许时优先出门透气，保留咖啡和甜品作为缓冲。"
        : mode === "balanced"
          ? "室内和短距离移动结合，适合大多数心情和体力。"
          : "保守室内路线，优先应对雨天、高温或低体力。",
    estimatedBudget: budget,
    estimatedDurationMinutes: duration,
    walkingIntensity: intensity,
    timeline: createTimeline(places, request),
    places: places.map((place) => ({
      name: place.name,
      category: place.category,
      indoor: place.indoor,
      estimatedCost: place.averageCost,
      walkMinutes: place.walkMinutes
    })),
    transport: places.every((place) => place.walkMinutes <= 12) ? "学校周边步行可达；雨天建议短打车或共享单车替代。" : "以步行为主，单段 10-20 分钟；体力低时建议减少户外段。",
    selfChecks: createSelfChecks(places, request, weather),
    risks: risks.length > 0 ? risks : ["当前没有明显硬风险，出发前确认营业和天气即可。"],
    inviteText: `这周末从${request.startArea}出发，按“${labels[mode]}”走：${places.map((place) => place.name).join("、")}。预计 ${Math.round(duration / 60 * 10) / 10} 小时，人均约 ${budget} 元，${weather.summary}。要不要一起？`
  };
}

function mapMatchedWeekendRoute(route: WeekendRouteMatch): WeekendRoute {
  const riskTips = route.riskTips.length > 0 ? route.riskTips : [route.fallbackReason].filter(Boolean);

  return {
    routeId: route.id || route.templateId,
    id: route.id,
    templateId: route.templateId,
    routeType: route.mode,
    title: route.title,
    summary: route.routeReason,
    routeReason: route.routeReason,
    fallbackReason: route.fallbackReason,
    estimatedBudget: route.estimatedBudget,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    walkingIntensity: route.walkingIntensity,
    timeline: route.timeline,
    places: route.stops.map((stop, index) => ({
      name: stop.name,
      category: stop.type,
      indoor: stop.indoor,
      estimatedCost: stop.cost,
      walkMinutes: index === route.stops.length - 1 ? 0 : 10
    })),
    transport: route.transportNote,
    selfChecks: route.checks,
    checks: route.checks,
    risks: riskTips,
    riskTips,
    inviteText: route.inviteCopy,
    inviteCopy: route.inviteCopy
  };
}

function withRouteAliases(route: WeekendRoute): WeekendRoute {
  return {
    ...route,
    id: route.id ?? route.routeId,
    routeReason: route.routeReason ?? route.summary,
    fallbackReason: route.fallbackReason ?? route.summary,
    checks: route.checks ?? route.selfChecks,
    riskTips: route.riskTips ?? route.risks,
    inviteCopy: route.inviteCopy ?? route.inviteText
  };
}

function generateRoutes(request: WeekendPlanRequest, weather: WeekendWeather): [WeekendRoute, WeekendRoute, WeekendRoute] {
  const modes: WeekendRoute["routeType"][] = weather.isRainy || weather.isHot || weather.fallback || energyRank(request.energyLevel) === 1 ? ["balanced", "outdoor", "indoor_backup"] : ["outdoor", "balanced", "indoor_backup"];
  const routes = modes.map((mode) => createRoute(mode, request, weather));
  const backupIndex = routes.findIndex((route) => route.routeType === "indoor_backup");

  if (backupIndex !== 2) {
    const [backup] = routes.splice(backupIndex, 1);
    routes.push(backup);
  }

  return routes.map(withRouteAliases) as [WeekendRoute, WeekendRoute, WeekendRoute];
}

async function generateWeekendDataRoutes(request: WeekendPlanRequest, weather: WeekendWeather) {
  try {
    const matchedRoutes = await matchWeekendRoutes({
      request: createWeekendDataRequest(request, weather),
      weather: createWeekendDataWeather(weather),
      limit: 3
    });
    const routes = matchedRoutes.map(mapMatchedWeekendRoute).slice(0, 3);

    if (routes.length > 0) {
      if (routes.length < 3) {
        const legacyRoutes = generateRoutes(request, weather);
        const routeTypes = new Set(routes.map((route) => route.routeType));

        for (const legacyRoute of legacyRoutes) {
          if (routes.length >= 3) break;
          if (!routeTypes.has(legacyRoute.routeType)) {
            routes.push(legacyRoute);
            routeTypes.add(legacyRoute.routeType);
          }
        }

        for (const legacyRoute of legacyRoutes) {
          if (routes.length >= 3) break;
          routes.push(legacyRoute);
        }
      }

      return {
        routes: routes.slice(0, 3) as [WeekendRoute, WeekendRoute, WeekendRoute],
        source: {
          poi: "weekend-synthetic-mvp" as const,
          planner: "weekend-data-rules-v1" as const
        }
      };
    }
  } catch (error) {
    console.warn("[weekendPlanner] weekendData route matching failed; using legacy mock fallback.", error);
  }

  return {
    routes: generateRoutes(request, weather),
    source: {
      poi: "mock-school-area" as const,
      planner: "rules-v1" as const
    }
  };
}

export async function createWeekendPlan(input: unknown, ownerUserId: string): Promise<WeekendPlanResponse> {
  const request = normalizeRequest(input);
  const weather = await fetchPanyuWeather();
  const timestamp = nowIso();

  return enqueueWrite(async () => {
    const database = await readDatabase();
    let planId = createPlanId();

    while (database.plans[planId]) {
      planId = createPlanId();
    }

    const routeGeneration = await generateWeekendDataRoutes(request, weather);

    const plan: WeekendPlanResponse = {
      planId,
      ownerUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      request,
      weather,
      routes: routeGeneration.routes,
      source: {
        weather: weather.fallback ? "fallback-conservative" : "open-meteo-real",
        ...routeGeneration.source
      }
    };

    database.plans[planId] = plan;
    await writeDatabase(database);
    return plan;
  });
}

export async function getWeekendPlan(planId: string) {
  const database = await readDatabase();

  return database.plans[planId] ?? null;
}
