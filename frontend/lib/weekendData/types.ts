export type WeekendSource = "synthetic_weekend_mvp";

export type WeekendWeatherCondition = "sunny" | "cloudy" | "rainy" | "hot" | "unknown";
export type WeekendEnergyLevel = "low" | "medium" | "high";
export type WalkingIntensity = "low" | "medium" | "high";
export type WeekendRouteMode = "outdoor" | "balanced" | "indoor_backup";
export type CheckStatus = "pass" | "risk" | "fail";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type WeekendArea = {
  id: string;
  name: string;
  aliases: string[];
  center: GeoPoint;
  radiusKm: number;
  polygon?: GeoPoint[];
};

export type WeekendRegion = {
  id: string;
  name: string;
  city: string;
  description: string;
  center: GeoPoint;
  validationRadiusKm: number;
  areas: WeekendArea[];
  anchors: Array<GeoPoint & { id: string; name: string }>;
  source: WeekendSource;
  sourceId: string;
  synthetic: boolean;
  confidence: number;
  updatedAt: string;
};

export type WeekendPoi = {
  id: string;
  name: string;
  type: string;
  area: string;
  addressText: string;
  latitude: number;
  longitude: number;
  indoor: boolean;
  rainyDayFriendly?: boolean;
  hotDayFriendly?: boolean;
  cost: number;
  durationMinutes: number;
  walkingIntensity: WalkingIntensity;
  tags: string[];
  routeNodeRoles?: string[];
  suitableWeather: WeekendWeatherCondition[];
  suitableEnergy: WeekendEnergyLevel[];
  riskTips: string[];
  source: WeekendSource;
  sourceId: string;
  synthetic: boolean;
  confidence: number;
  notes: string;
};

export type WeekendPoiFilters = {
  areaAny?: string[];
  typeAny?: string[];
  tagsAny?: string[];
  routeNodeRolesAny?: string[];
  indoor?: boolean;
  suitableWeatherAny?: WeekendWeatherCondition[];
  suitableEnergyAny?: WeekendEnergyLevel[];
  walkingIntensityAny?: WalkingIntensity[];
  maxCost?: number;
};

export type WeekendRouteSlot = {
  id: string;
  label: string;
  role: string;
  required: boolean;
  durationMinutes: number;
  poiFilters: WeekendPoiFilters;
  fallbackPoiIds?: string[];
};

export type WeekendCheckKey = "budget" | "time_window" | "weather" | "walking_intensity" | "return_time";

export type WeekendCheckTemplate = {
  key: WeekendCheckKey;
  label: string;
};

export type WeekendRouteTemplate = {
  id: string;
  title: string;
  mode: WeekendRouteMode;
  slots?: WeekendRouteSlot[];
  stopIds?: string[];
  estimatedDurationMinutes: number;
  estimatedBudget: number;
  transportNote: string;
  routeReason: string;
  fallbackReason: string;
  inviteCopyTemplate: string;
  checkTemplates: WeekendCheckTemplate[];
  riskTipTemplates: string[];
  source: WeekendSource;
  sourceId: string;
  synthetic: boolean;
  confidence: number;
};

export type WeekendDataSourceKindMeta = {
  label: string;
  synthetic: boolean;
  trustLevel: "low" | "medium" | "high";
  description: string;
};

export type WeekendSourceBatchMeta = {
  id: string;
  source: WeekendSource;
  title: string;
  collectedAt: string;
  description: string;
};

export type WeekendDataSourceMetaFile = {
  schemaVersion: number;
  sourceKinds: Record<WeekendSource, WeekendDataSourceKindMeta>;
  sources: WeekendSourceBatchMeta[];
};

export type WeekendDataSet = {
  regions: WeekendRegion[];
  areas: WeekendArea[];
  pois: WeekendPoi[];
  routeTemplates: WeekendRouteTemplate[];
  sourceMeta: WeekendDataSourceMetaFile;
  areasById: Map<string, WeekendArea>;
  poisById: Map<string, WeekendPoi>;
  routeTemplatesById: Map<string, WeekendRouteTemplate>;
};

export type WeekendPlanLikeRequest = {
  timeWindow?: string;
  budgetMax?: number;
  startArea?: string;
  mood?: string;
  energyLevel?: string;
  companions?: string;
  interests?: string[];
  interestTags?: string[];
  rawText?: string;
};

export type WeekendWeatherLike = {
  summary?: string;
  condition?: WeekendWeatherCondition;
  weatherText?: string;
  status?: string;
  isRainy?: boolean;
  isHot?: boolean;
  fallback?: boolean;
};

export type WeekendRouteStop = {
  slotId: string;
  role: string;
  poiId: string;
  name: string;
  type: string;
  area: string;
  indoor: boolean;
  cost: number;
  durationMinutes: number;
  walkingIntensity: WalkingIntensity;
  tags: string[];
};

export type WeekendTimelineItem = {
  id: string;
  time: string;
  title: string;
  placeName: string;
  activity: string;
  durationMinutes: number;
};

export type WeekendCheck = {
  key: WeekendCheckKey;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type WeekendRouteMatch = {
  id: string;
  templateId: string;
  mode: WeekendRouteMode;
  title: string;
  routeReason: string;
  fallbackReason: string;
  estimatedBudget: number;
  estimatedDurationMinutes: number;
  walkingIntensity: WalkingIntensity;
  transportNote: string;
  stops: WeekendRouteStop[];
  timeline: WeekendTimelineItem[];
  checks: WeekendCheck[];
  riskTips: string[];
  inviteCopy: string;
  score: number;
};

export type MatchWeekendRoutesInput = {
  request?: WeekendPlanLikeRequest;
  weather?: WeekendWeatherLike;
  limit?: number;
};
