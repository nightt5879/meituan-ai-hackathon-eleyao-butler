export type RestaurantSource =
  | "generated"
  | "generated_from_hints"
  | "synthetic_mvp"
  | "manual_sample"
  | "manual_public_curated"
  | "amap_poi_draft"
  | "tencent_poi_draft";

export type QueueRisk = "low" | "medium" | "high" | "unknown";
export type NoiseLevel = "low" | "medium" | "high" | "unknown";
export type SpicyLevel = "none" | "mild" | "medium" | "hot" | "unknown";
export type AddressPrecision = "business_district" | "approximate" | "street_block" | "exact" | "unknown";
export type SpatialSource = "manual_region_scaffold" | "synthetic_within_region" | "manual_geocoded" | "unknown";
export type BudgetLevel = "20-30" | "30-50" | "50-80" | "80+";
export type DiningScene = "soloToday" | "groupMeetup" | "weekendPlan";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type Region = {
  id: string;
  name: string;
  city: string;
  description: string;
  center: GeoPoint;
  radiusKm: number;
  validationRadiusKm: number;
  futureExpansion: {
    enabled: boolean;
    maxRadiusKm: number;
    notes: string;
  };
  source: RestaurantSource;
  sourceId: string;
  updatedAt: string;
};

export type Shop = {
  id: string;
  name: string;
  category: string;
  cuisines?: string[];
  address: string;
  latitude: number;
  longitude: number;
  avgPrice: number | null;
  rating: number | null;
  syntheticRating?: number | null;
  tags: string[];
  regionId: string;
  syntheticRegionId?: string;
  openingHours?: string;
  source: RestaurantSource;
  sourceId: string;
  synthetic?: boolean;
  confidence?: number;
  addressPrecision?: AddressPrecision;
  spatialSource?: SpatialSource;
  createdAt?: string;
  updatedAt: string;
};

export type Dish = {
  id: string;
  shopId: string;
  name: string;
  category: string;
  price: number;
  spicyLevel: SpicyLevel;
  tags: string[];
  portionSize?: "single" | "shareable" | "snack" | "drink" | string;
  description?: string;
  imageUrl?: string | null;
  signature?: boolean;
  source: RestaurantSource;
  sourceId: string;
  synthetic?: boolean;
  confidence?: number;
};

export type ShopFeature = {
  shopId: string;
  supportsSpicy: boolean;
  supportsNonSpicy: boolean;
  quietScore: number;
  tasteTags?: string[];
  sceneTags?: string[];
  crowdTags?: string[];
  budgetLevel?: BudgetLevel | string;
  goodFor?: string[];
  avoidTags?: string[];
  chatFriendly: boolean;
  groupFriendly: boolean;
  soloFriendly?: boolean;
  indoor?: boolean;
  rainyDayFriendly?: boolean;
  queueRisk: QueueRisk;
  noiseLevel?: NoiseLevel;
  featureTags: string[];
  explainHints?: string[];
  riskHints?: string[];
  source: RestaurantSource;
  sourceId: string;
  synthetic?: boolean;
  confidence?: number;
};

export type SceneScoreMap = Record<DiningScene, number>;

export type SceneHints = Record<DiningScene, string[]>;

export type SceneFit = {
  shopId: string;
  sceneScores: SceneScoreMap;
  explainHints: SceneHints;
  riskHints: SceneHints;
  source: RestaurantSource;
  sourceId: string;
  synthetic?: boolean;
  confidence?: number;
};

export type SourceKindMeta = {
  label: string;
  synthetic: boolean;
  trustLevel: "low" | "medium" | "high";
  description: string;
};

export type SourceBatchMeta = {
  id: string;
  source: RestaurantSource;
  title: string;
  collectedAt: string;
  description: string;
};

export type DataSourceMetaFile = {
  schemaVersion: number;
  sourceKinds: Record<RestaurantSource, SourceKindMeta>;
  sources: SourceBatchMeta[];
};

export type RestaurantDataSet = {
  regions: Region[];
  shops: Shop[];
  dishes: Dish[];
  features: ShopFeature[];
  sceneFits: SceneFit[];
  sourceMeta: DataSourceMetaFile;
  shopsById: Map<string, Shop>;
  dishesByShopId: Map<string, Dish[]>;
  featuresByShopId: Map<string, ShopFeature>;
  sceneFitByShopId: Map<string, SceneFit>;
};

export type SearchShopsQuery = {
  keyword?: string;
  regionId?: string;
  center?: GeoPoint;
  radiusKm?: number;
  categories?: string[];
  tags?: string[];
  maxAvgPrice?: number;
  sources?: RestaurantSource[];
  scene?: DiningScene;
  limit?: number;
};

export type SearchDishesFilters = {
  keyword?: string;
  shopId?: string;
  tags?: string[];
  spicyLevels?: SpicyLevel[];
  maxPrice?: number;
  sources?: RestaurantSource[];
  limit?: number;
};

export type PreferenceSlots = {
  budgetMax?: number;
  tasteTags?: string[];
  needTags?: string[];
  avoidTags?: string[];
  categories?: string[];
  center?: GeoPoint;
  maxDistanceKm?: number;
  scene?: DiningScene;
};

export type UserMemory = {
  likedTags?: string[];
  dislikedTags?: string[];
  favoriteShopIds?: string[];
  avoidedShopIds?: string[];
};

export type ShopSearchItem = Shop & {
  distanceKm?: number;
  features?: ShopFeature;
  sceneFit?: SceneFit;
};

export type DishSearchItem = Dish & {
  shop: Pick<Shop, "id" | "name" | "category" | "source" | "sourceId">;
};

export type RankedShop = ShopSearchItem & {
  score: number;
  matchedTags: string[];
  rankReasons: string[];
  riskHints: string[];
};
