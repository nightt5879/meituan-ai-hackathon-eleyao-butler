export type RestaurantSource =
  | "generated"
  | "generated_from_hints"
  | "manual_sample"
  | "manual_public_curated"
  | "amap_poi_draft"
  | "tencent_poi_draft";

export type QueueRisk = "low" | "medium" | "high" | "unknown";
export type SpicyLevel = "none" | "mild" | "medium" | "hot" | "unknown";

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
  address: string;
  latitude: number;
  longitude: number;
  avgPrice: number | null;
  rating: number | null;
  tags: string[];
  regionId: string;
  source: RestaurantSource;
  sourceId: string;
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
  source: RestaurantSource;
  sourceId: string;
};

export type ShopFeature = {
  shopId: string;
  supportsSpicy: boolean;
  supportsNonSpicy: boolean;
  quietScore: number;
  chatFriendly: boolean;
  groupFriendly: boolean;
  queueRisk: QueueRisk;
  featureTags: string[];
  source: RestaurantSource;
  sourceId: string;
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
  sourceMeta: DataSourceMetaFile;
  shopsById: Map<string, Shop>;
  dishesByShopId: Map<string, Dish[]>;
  featuresByShopId: Map<string, ShopFeature>;
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
};

export type DishSearchItem = Dish & {
  shop: Pick<Shop, "id" | "name" | "category" | "source" | "sourceId">;
};

export type RankedShop = ShopSearchItem & {
  score: number;
  matchedTags: string[];
  rankReasons: string[];
};
