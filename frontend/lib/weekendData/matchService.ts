import { loadWeekendData } from "./loadData";
import type {
  CheckStatus,
  MatchWeekendRoutesInput,
  WeekendCheck,
  WeekendEnergyLevel,
  WeekendPlanLikeRequest,
  WeekendPoi,
  WeekendPoiFilters,
  WeekendRouteMatch,
  WeekendRouteMode,
  WeekendRouteSlot,
  WeekendRouteStop,
  WeekendRouteTemplate,
  WeekendTimelineItem,
  WeekendWeatherCondition,
  WeekendWeatherLike,
  WalkingIntensity
} from "./types";

const MODE_ORDER: WeekendRouteMode[] = ["outdoor", "balanced", "indoor_backup"];
const DEFAULT_BUDGET_MAX = 120;
const DEFAULT_START_AREA = "学校周边";
const DEFAULT_TIME_WINDOW_MINUTES = 180;

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(value.map((item) => String(item)));
  }

  if (typeof value === "string") {
    return unique(value.split(/[、,\s]+/));
  }

  return [];
}

function normalizeEnergy(value: unknown): WeekendEnergyLevel {
  const text = String(value ?? "").trim();

  if (/低|少走|不累|轻松|low/i.test(text)) {
    return "low";
  }

  if (/高|能走|多走|citywalk|high/i.test(text)) {
    return "high";
  }

  return "medium";
}

function normalizeWeather(weather: WeekendWeatherLike = {}): WeekendWeatherCondition {
  if (weather.isRainy || /雨|rain/i.test(weather.weatherText ?? "")) {
    return "rainy";
  }

  if (weather.isHot || /热|hot/i.test(weather.weatherText ?? "")) {
    return "hot";
  }

  if (weather.fallback || weather.status === "unavailable") {
    return "unknown";
  }

  if (weather.condition) {
    return weather.condition;
  }

  return "cloudy";
}

function weatherSummary(weather: WeekendWeatherLike = {}) {
  return weather.summary?.trim() || "天气信息暂不可用，按保守方案处理";
}

function numberField(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function intensityRank(intensity: WalkingIntensity | WeekendEnergyLevel) {
  if (intensity === "low") return 1;
  if (intensity === "medium") return 2;
  return 3;
}

function routeIntensity(stops: WeekendRouteStop[]): WalkingIntensity {
  const maxRank = Math.max(1, ...stops.map((stop) => intensityRank(stop.walkingIntensity)));
  return maxRank >= 3 ? "high" : maxRank >= 2 ? "medium" : "low";
}

function intensityText(intensity: WalkingIntensity) {
  if (intensity === "low") return "低体力";
  if (intensity === "medium") return "中等步行";
  return "步行较多";
}

function statusText(status: CheckStatus) {
  if (status === "pass") return "通过";
  if (status === "risk") return "留意";
  return "不通过";
}

function parseTimeWindowMinutes(timeWindow: string | undefined) {
  const text = timeWindow ?? "";
  const rangeMatch = text.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);

  if (rangeMatch) {
    const start = Number(rangeMatch[1]) * 60 + Number(rangeMatch[2]);
    const end = Number(rangeMatch[3]) * 60 + Number(rangeMatch[4]);
    if (end > start) {
      return end - start;
    }
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|hour)/i);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }

  const minuteMatch = text.match(/(\d{2,3})\s*(?:分钟|min)/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  if (/全天|all\s*day/i.test(text)) {
    return 360;
  }

  if (/短|一小时|1小时/.test(text)) {
    return 90;
  }

  return DEFAULT_TIME_WINDOW_MINUTES;
}

function parseStartMinutes(timeWindow: string | undefined) {
  const text = timeWindow ?? "";
  const match = text.match(/(\d{1,2}):(\d{2})/);

  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }

  if (text.includes("上午")) return 10 * 60;
  if (text.includes("晚上") || text.includes("傍晚")) return 18 * 60;
  return 14 * 60;
}

function formatClock(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDurationHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}`;
}

function hasAny(source: string[] | undefined, targets: string[] | undefined) {
  if (!targets || targets.length === 0) {
    return true;
  }

  const sourceSet = new Set(source ?? []);
  return targets.some((target) => sourceSet.has(target));
}

function poiMatchesFilters(poi: WeekendPoi, filters: WeekendPoiFilters, weather: WeekendWeatherCondition, energy: WeekendEnergyLevel) {
  if (filters.areaAny && !filters.areaAny.includes(poi.area)) {
    return false;
  }

  if (filters.typeAny && !filters.typeAny.includes(poi.type)) {
    return false;
  }

  if (filters.indoor !== undefined && poi.indoor !== filters.indoor) {
    return false;
  }

  if (filters.maxCost !== undefined && poi.cost > filters.maxCost) {
    return false;
  }

  if (!hasAny(poi.tags, filters.tagsAny)) {
    return false;
  }

  if (!hasAny(poi.routeNodeRoles, filters.routeNodeRolesAny)) {
    return false;
  }

  if (filters.suitableWeatherAny && !filters.suitableWeatherAny.some((item) => poi.suitableWeather.includes(item))) {
    return false;
  }

  if (filters.suitableEnergyAny && !filters.suitableEnergyAny.some((item) => poi.suitableEnergy.includes(item))) {
    return false;
  }

  if (filters.walkingIntensityAny && !filters.walkingIntensityAny.includes(poi.walkingIntensity)) {
    return false;
  }

  if (weather === "rainy" && !poi.indoor && !poi.rainyDayFriendly) {
    return false;
  }

  if (energy === "low" && poi.walkingIntensity === "high") {
    return false;
  }

  return true;
}

function interestMatches(poi: WeekendPoi, interests: string[]) {
  const fields = [...poi.tags, ...(poi.routeNodeRoles ?? []), poi.type];
  return interests.filter((interest) => fields.includes(interest));
}

function scorePoi(poi: WeekendPoi, slot: WeekendRouteSlot, request: WeekendPlanLikeRequest, weather: WeekendWeatherCondition, energy: WeekendEnergyLevel, selectedIds: Set<string>) {
  const interests = unique([
    ...normalizeList(request.interests),
    ...normalizeList(request.interestTags),
    ...normalizeList(request.rawText)
  ]);
  const budgetMax = numberField(request.budgetMax, DEFAULT_BUDGET_MAX);
  let score = 50;

  if (selectedIds.has(poi.id)) {
    score -= 35;
  }

  if (poi.suitableWeather.includes(weather)) {
    score += 12;
  }

  if ((weather === "rainy" || weather === "unknown") && (poi.indoor || poi.rainyDayFriendly)) {
    score += 16;
  }

  if (weather === "hot" && (poi.indoor || poi.hotDayFriendly)) {
    score += 14;
  }

  if (poi.suitableEnergy.includes(energy)) {
    score += 10;
  }

  if (intensityRank(poi.walkingIntensity) <= intensityRank(energy)) {
    score += 8;
  } else {
    score -= 10;
  }

  if (poi.cost <= budgetMax / 3) {
    score += 8;
  } else if (poi.cost <= budgetMax) {
    score += 4;
  } else {
    score -= 12;
  }

  const matchedInterests = interestMatches(poi, interests);
  score += matchedInterests.length * 8;

  if (slot.poiFilters.routeNodeRolesAny && hasAny(poi.routeNodeRoles, slot.poiFilters.routeNodeRolesAny)) {
    score += 10;
  }

  score -= poi.riskTips.length * 3;
  return score;
}

function pickPoiForSlot(pois: WeekendPoi[], slot: WeekendRouteSlot, request: WeekendPlanLikeRequest, weather: WeekendWeatherCondition, energy: WeekendEnergyLevel, selectedIds: Set<string>) {
  const directCandidates = pois.filter((poi) => poiMatchesFilters(poi, slot.poiFilters, weather, energy));
  const fallbackCandidates = (slot.fallbackPoiIds ?? [])
    .map((poiId) => pois.find((poi) => poi.id === poiId))
    .filter((poi): poi is WeekendPoi => Boolean(poi));
  const candidates = directCandidates.length > 0 ? directCandidates : fallbackCandidates;

  return candidates
    .map((poi) => ({
      poi,
      score: scorePoi(poi, slot, request, weather, energy, selectedIds)
    }))
    .sort((a, b) => b.score - a.score)[0]?.poi;
}

function buildStops(template: WeekendRouteTemplate, pois: WeekendPoi[], request: WeekendPlanLikeRequest, weather: WeekendWeatherCondition, energy: WeekendEnergyLevel) {
  const selectedIds = new Set<string>();
  const stops: WeekendRouteStop[] = [];

  for (const slot of template.slots ?? []) {
    const poi = pickPoiForSlot(pois, slot, request, weather, energy, selectedIds);

    if (!poi && slot.required) {
      return null;
    }

    if (!poi) {
      continue;
    }

    selectedIds.add(poi.id);
    stops.push({
      slotId: slot.id,
      role: slot.role,
      poiId: poi.id,
      name: poi.name,
      type: poi.type,
      area: poi.area,
      indoor: poi.indoor,
      cost: poi.cost,
      durationMinutes: slot.durationMinutes || poi.durationMinutes,
      walkingIntensity: poi.walkingIntensity,
      tags: poi.tags
    });
  }

  if (template.stopIds && template.stopIds.length > 0) {
    for (const poiId of template.stopIds) {
      const poi = pois.find((item) => item.id === poiId);

      if (!poi) {
        return null;
      }

      stops.push({
        slotId: poi.id,
        role: poi.routeNodeRoles?.[0] ?? "stop",
        poiId: poi.id,
        name: poi.name,
        type: poi.type,
        area: poi.area,
        indoor: poi.indoor,
        cost: poi.cost,
        durationMinutes: poi.durationMinutes,
        walkingIntensity: poi.walkingIntensity,
        tags: poi.tags
      });
    }
  }

  return stops;
}

function createTimeline(stops: WeekendRouteStop[], request: WeekendPlanLikeRequest): WeekendTimelineItem[] {
  let cursor = parseStartMinutes(request.timeWindow);

  return stops.map((stop, index) => {
    const time = formatClock(cursor);
    cursor += stop.durationMinutes + (index === stops.length - 1 ? 0 : 10);

    return {
      id: `${stop.slotId}_${index}`,
      time,
      title: index === 0 ? "集合开场" : index === stops.length - 1 ? "收尾确认" : "主活动",
      placeName: stop.name,
      activity: `${stop.tags.slice(0, 3).join("、")}节点，停留约 ${stop.durationMinutes} 分钟。`,
      durationMinutes: stop.durationMinutes
    };
  });
}

function createChecks(template: WeekendRouteTemplate, stops: WeekendRouteStop[], request: WeekendPlanLikeRequest, weather: WeekendWeatherCondition, weatherText: string): WeekendCheck[] {
  const budgetMax = numberField(request.budgetMax, DEFAULT_BUDGET_MAX);
  const budget = stops.reduce((sum, stop) => sum + stop.cost, 0);
  const duration = stops.reduce((sum, stop) => sum + stop.durationMinutes, 0) + Math.max(0, stops.length - 1) * 10;
  const windowMinutes = parseTimeWindowMinutes(request.timeWindow);
  const intensity = routeIntensity(stops);
  const energy = normalizeEnergy(request.energyLevel);
  const hasOutdoor = stops.some((stop) => !stop.indoor);

  return template.checkTemplates.map((check) => {
    if (check.key === "budget") {
      const status: CheckStatus = budget <= budgetMax ? "pass" : budget <= budgetMax + 30 ? "risk" : "fail";
      return {
        key: check.key,
        label: check.label,
        status,
        detail: `${statusText(status)}：预计 ${budget} 元，预算上限 ${budgetMax} 元。`
      };
    }

    if (check.key === "time_window") {
      const status: CheckStatus = duration <= windowMinutes ? "pass" : duration <= windowMinutes + 45 ? "risk" : "fail";
      return {
        key: check.key,
        label: check.label,
        status,
        detail: `${statusText(status)}：预计 ${formatDurationHours(duration)} 小时，时间窗口约 ${formatDurationHours(windowMinutes)} 小时。`
      };
    }

    if (check.key === "weather") {
      const status: CheckStatus = !hasOutdoor || (weather !== "rainy" && weather !== "hot" && weather !== "unknown") ? "pass" : "risk";
      return {
        key: check.key,
        label: check.label,
        status,
        detail: hasOutdoor ? `${statusText(status)}：${weatherText}，含户外节点。` : `${statusText(status)}：${weatherText}，路线以室内为主。`
      };
    }

    if (check.key === "walking_intensity") {
      const status: CheckStatus = intensityRank(intensity) <= intensityRank(energy) ? "pass" : intensityRank(intensity) <= intensityRank(energy) + 1 ? "risk" : "fail";
      return {
        key: check.key,
        label: check.label,
        status,
        detail: `${statusText(status)}：路线为${intensityText(intensity)}，体力偏好为 ${request.energyLevel || "中等体力"}。`
      };
    }

    return {
      key: check.key,
      label: check.label,
      status: duration <= windowMinutes ? "pass" : "risk",
      detail: duration <= windowMinutes ? "通过：默认预留返程缓冲。" : "留意：时间偏紧，建议砍掉最后一站或提前返程。"
    };
  });
}

function templateModeScore(mode: WeekendRouteMode, weather: WeekendWeatherCondition, energy: WeekendEnergyLevel) {
  if (mode === "indoor_backup") {
    return weather === "rainy" || weather === "hot" || weather === "unknown" || energy === "low" ? 24 : -4;
  }

  if (mode === "balanced") {
    return weather === "rainy" || weather === "hot" || weather === "unknown" ? 12 : 10;
  }

  return weather === "sunny" || weather === "cloudy" ? 18 : -20;
}

function renderInvite(template: WeekendRouteTemplate, stops: WeekendRouteStop[], request: WeekendPlanLikeRequest, duration: number, budget: number, weatherText: string) {
  const replacements: Record<string, string> = {
    startArea: request.startArea?.trim() || DEFAULT_START_AREA,
    title: template.title,
    stopNames: stops.map((stop) => stop.name).join("、"),
    durationHours: formatDurationHours(duration),
    budget: String(budget),
    weatherSummary: weatherText
  };

  return Object.keys(replacements).reduce(
    (text, key) => text.replace(new RegExp(`\\{${key}\\}`, "g"), replacements[key]),
    template.inviteCopyTemplate
  );
}

function buildRiskTips(stops: WeekendRouteStop[], weather: WeekendWeatherCondition, request: WeekendPlanLikeRequest) {
  const budget = stops.reduce((sum, stop) => sum + stop.cost, 0);
  const budgetMax = numberField(request.budgetMax, DEFAULT_BUDGET_MAX);
  const dynamicTips = [
    budget > budgetMax ? "预算可能超出，建议减少饮品、甜品或删掉可选停留点。" : "",
    weather === "rainy" && stops.some((stop) => !stop.indoor) ? "天气有雨，户外点位建议缩短或直接替换为室内备选。" : "",
    weather === "hot" && stops.some((stop) => !stop.indoor) ? "体感偏热时，户外点位建议避开正午并缩短停留。" : "",
    weather === "unknown" && stops.some((stop) => !stop.indoor) ? "天气未知时按保守方案处理，户外段需要准备室内替代。" : ""
  ];

  return unique([
    ...dynamicTips
  ]);
}

function scoreRoute(template: WeekendRouteTemplate, stops: WeekendRouteStop[], checks: WeekendCheck[], riskTips: string[], weather: WeekendWeatherCondition, energy: WeekendEnergyLevel, request: WeekendPlanLikeRequest) {
  const budgetMax = numberField(request.budgetMax, DEFAULT_BUDGET_MAX);
  const budget = stops.reduce((sum, stop) => sum + stop.cost, 0);
  const interests = unique([
    ...normalizeList(request.interests),
    ...normalizeList(request.interestTags),
    ...normalizeList(request.rawText)
  ]);
  const interestHitCount = stops.reduce((sum, stop) => sum + stop.tags.filter((tag) => interests.includes(tag)).length, 0);
  const failedChecks = checks.filter((check) => check.status === "fail").length;
  const riskyChecks = checks.filter((check) => check.status === "risk").length;
  let score = 55 + templateModeScore(template.mode, weather, energy);

  if (budget <= budgetMax) {
    score += 12;
  } else {
    score -= 16;
  }

  score += interestHitCount * 5;
  score -= failedChecks * 18;
  score -= riskyChecks * 7;
  score -= Math.max(0, riskTips.length - 2) * 2;
  score += Math.round(template.confidence * 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function createRouteMatch(template: WeekendRouteTemplate, pois: WeekendPoi[], request: WeekendPlanLikeRequest, weather: WeekendWeatherCondition, weatherText: string): WeekendRouteMatch | null {
  const energy = normalizeEnergy(request.energyLevel);
  const stops = buildStops(template, pois, request, weather, energy);

  if (!stops || stops.length === 0) {
    return null;
  }

  const budget = stops.reduce((sum, stop) => sum + stop.cost, 0);
  const duration = stops.reduce((sum, stop) => sum + stop.durationMinutes, 0) + Math.max(0, stops.length - 1) * 10;
  const timeline = createTimeline(stops, request);
  const checks = createChecks(template, stops, request, weather, weatherText);
  const riskTips = unique([
    ...template.riskTipTemplates,
    ...stops.flatMap((stop) => {
      const poi = pois.find((item) => item.id === stop.poiId);
      return poi?.riskTips ?? [];
    }),
    ...buildRiskTips(stops, weather, request)
  ]);
  const score = scoreRoute(template, stops, checks, riskTips, weather, energy, request);

  return {
    id: template.id,
    templateId: template.id,
    mode: template.mode,
    title: template.title,
    routeReason: template.routeReason,
    fallbackReason: template.fallbackReason,
    estimatedBudget: budget,
    estimatedDurationMinutes: duration,
    walkingIntensity: routeIntensity(stops),
    transportNote: template.transportNote,
    stops,
    timeline,
    checks,
    riskTips,
    inviteCopy: renderInvite(template, stops, request, duration, budget, weatherText),
    score
  };
}

function pickRepresentativeRoutes(routes: WeekendRouteMatch[], limit: number) {
  if (limit < 3) {
    return routes.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const picked: WeekendRouteMatch[] = [];

  for (const mode of MODE_ORDER) {
    const best = routes.filter((route) => route.mode === mode).sort((a, b) => b.score - a.score)[0];
    if (best) {
      picked.push(best);
    }
  }

  const pickedIds = new Set(picked.map((route) => route.id));
  const rest = routes.filter((route) => !pickedIds.has(route.id)).sort((a, b) => b.score - a.score);

  return [...picked, ...rest].slice(0, limit);
}

export async function matchWeekendRoutes(input: MatchWeekendRoutesInput = {}): Promise<WeekendRouteMatch[]> {
  const data = await loadWeekendData();
  const request = input.request ?? {};
  const weather = normalizeWeather(input.weather);
  const weatherText = weatherSummary(input.weather);
  const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 3), 9));

  const routes = data.routeTemplates
    .map((template) => createRouteMatch(template, data.pois, request, weather, weatherText))
    .filter((route): route is WeekendRouteMatch => Boolean(route));

  return pickRepresentativeRoutes(routes, limit);
}
