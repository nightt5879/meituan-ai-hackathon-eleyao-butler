"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DivIcon, Map as LeafletMap, Marker, TileLayer } from "leaflet";
import manualShopsSeed from "@/data/restaurant/shops.gut.seed.json";
import syntheticShopsSeed from "@/data/restaurant/shops.synthetic.seed.json";
import weekendPoisSeed from "@/data/weekend/weekend-pois.seed.json";
import weekendRouteTemplatesSeed from "@/data/weekend/weekend-route-templates.seed.json";
import styles from "./DataSandboxSection.module.css";

type SandboxPointType = "manual_sample" | "synthetic_mvp" | "weekend_poi";
type LayerKey = SandboxPointType;
type ClusterTone = SandboxPointType | "mixed";
type Confidence = "high" | "medium" | "demo";
type PointKind = "manual" | "synthetic" | "poi";
type LegendTone = SandboxPointType | "walk" | "rain" | "lowBudget" | "selected";

type RadarProfile = {
  budget: number;
  nonSpicy: number;
  chat: number;
  distance: number;
  rainy: number;
  queueRisk: number;
};

type SandboxPoint = {
  id: string;
  name: string;
  type: SandboxPointType;
  latlng: [number, number];
  category: string;
  address: string;
  markerLabel: string;
  source: string;
  sourceId: string;
  seedFile: string;
  synthetic: boolean;
  confidence: Confidence;
  scenarioTags: string[];
  radar: RadarProfile;
  why: string[];
};

type SandboxCluster = {
  id: string;
  count: number;
  counts: Record<SandboxPointType, number>;
  dominantType: ClusterTone;
  label: string;
  latlng: [number, number];
  bounds: [[number, number], [number, number]];
  points: SandboxPoint[];
};

type MapRenderItem =
  | { kind: "point"; point: SandboxPoint }
  | { cluster: SandboxCluster; kind: "cluster" };

type SeedRestaurantShop = {
  id: string;
  name: string;
  category?: string;
  cuisines?: string[];
  address?: string;
  latitude: number;
  longitude: number;
  avgPrice?: number | null;
  tags?: string[];
  source?: string;
  sourceId?: string;
  synthetic?: boolean;
  confidence?: number | string | null;
};

type SeedWeekendPoi = {
  id: string;
  name: string;
  type?: string;
  area?: string;
  addressText?: string;
  latitude: number;
  longitude: number;
  indoor?: boolean;
  rainyDayFriendly?: boolean;
  hotDayFriendly?: boolean;
  cost?: number | null;
  durationMinutes?: number | null;
  walkingIntensity?: "low" | "medium" | "high" | string;
  tags?: string[];
  routeNodeRoles?: string[];
  suitableWeather?: string[];
  source?: string;
  sourceId?: string;
  synthetic?: boolean;
  confidence?: number | string | null;
  notes?: string;
};

const UNIVERSITY_TOWN_CENTER: [number, number] = [23.05, 113.39];
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";
const SINGLE_POINT_ZOOM = 16;
const LARGE_CLUSTER_MAX_ZOOM = 13;
const FALLBACK_COPY =
  "地图底图暂不可用，已切换为静态 MVP 数据沙盘。推荐与路线逻辑仍基于候选、标签和边界声明展示。";

const manualShopRows = (manualShopsSeed as { shops?: SeedRestaurantShop[] }).shops ?? [];
const syntheticShopRows = (syntheticShopsSeed as { shops?: SeedRestaurantShop[] }).shops ?? [];
const weekendPoiRows = (weekendPoisSeed as { pois?: SeedWeekendPoi[] }).pois ?? [];
const routeTemplateRows = (weekendRouteTemplatesSeed as { templates?: unknown[] }).templates ?? [];

const layerDefinitions: Array<{
  key: LayerKey;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: "manual_sample",
    label: "人工样本餐厅",
    shortLabel: "人工样本",
    description: "30 个 reviewed sample 候选"
  },
  {
    key: "synthetic_mvp",
    label: "MVP 合成餐饮点",
    shortLabel: "合成餐饮",
    description: "100 个 synthetic_mvp 扩展候选"
  },
  {
    key: "weekend_poi",
    label: "周末 POI",
    shortLabel: "周末 POI",
    description: "70 个路线节点候选"
  }
];

const defaultLayerFilters: Record<LayerKey, boolean> = {
  manual_sample: true,
  synthetic_mvp: true,
  weekend_poi: true
};

const sceneTags = [
  "今天吃什么",
  "多人约饭",
  "周末规划",
  "雨天友好",
  "低预算",
  "适合聊天",
  "不辣可选",
  "距离近",
  "排队低风险"
];

const sandboxPoints: SandboxPoint[] = [
  ...manualShopRows.map((shop, index) => createRestaurantPoint(shop, "manual_sample", index)),
  ...syntheticShopRows.map((shop, index) => createRestaurantPoint(shop, "synthetic_mvp", index)),
  ...weekendPoiRows.map((poi, index) => createWeekendPoint(poi, index))
];

const layerCounts = layerDefinitions.reduce<Record<LayerKey, number>>(
  (counts, layer) => ({
    ...counts,
    [layer.key]: sandboxPoints.filter((point) => point.type === layer.key).length
  }),
  { manual_sample: 0, synthetic_mvp: 0, weekend_poi: 0 }
);

const totalPointCount = sandboxPoints.length;

const legendItems: Array<{ label: string; tone: LegendTone }> = [
  { label: "manual_sample 餐厅", tone: "manual_sample" },
  { label: "synthetic_mvp 餐饮点", tone: "synthetic_mvp" },
  { label: "weekend POI", tone: "weekend_poi" },
  { label: "当前选中点位", tone: "selected" },
  { label: "步行友好范围", tone: "walk" },
  { label: "雨天备选区", tone: "rain" },
  { label: "低预算友好区", tone: "lowBudget" }
];

const radarMetrics: Array<{
  key: keyof RadarProfile;
  label: string;
  note: string;
}> = [
  { key: "budget", label: "预算友好", note: "低预算约束" },
  { key: "nonSpicy", label: "不辣可选", note: "忌口约束" },
  { key: "chat", label: "适合聊天", note: "氛围标签" },
  { key: "distance", label: "距离友好", note: "步行圈" },
  { key: "rainy", label: "雨天友好", note: "备选区" },
  { key: "queueRisk", label: "排队低风险", note: "风险标签" }
];

const stats = [
  { value: String(layerCounts.manual_sample), label: "个手动样本餐厅" },
  { value: String(layerCounts.synthetic_mvp), label: "个 synthetic 餐饮点" },
  { value: String(layerCounts.weekend_poi), label: "个周末 POI" },
  { value: String(routeTemplateRows.length), label: "条周末路线模板" }
];

export function DataSandboxSection() {
  const [selectedPointId, setSelectedPointId] = useState(sandboxPoints[0]?.id ?? "");
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>(defaultLayerFilters);
  const visiblePoints = useMemo(
    () => sandboxPoints.filter((point) => activeLayers[point.type]),
    [activeLayers]
  );
  const selectedPoint = useMemo(() => {
    return (
      visiblePoints.find((point) => point.id === selectedPointId) ??
      visiblePoints[0] ??
      sandboxPoints[0]
    );
  }, [selectedPointId, visiblePoints]);

  useEffect(() => {
    if (visiblePoints.length === 0) return;
    if (!visiblePoints.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(visiblePoints[0].id);
    }
  }, [selectedPointId, visiblePoints]);

  const handleToggleLayer = useCallback((layer: LayerKey) => {
    setActiveLayers((current) => {
      const next = { ...current, [layer]: !current[layer] };
      const hasVisibleLayer = Object.values(next).some(Boolean);
      return hasVisibleLayer ? next : current;
    });
  }, []);

  if (!selectedPoint) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="data-sandbox-title">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Data Sandbox / Leaflet v0.4</p>
        <h2 id="data-sandbox-title">我们为大学城搭了一个可解释的本地生活沙盘</h2>
        <p className={styles.subtitle}>
          让 AI 管家的建议落在具体候选、地点、标签和约束上，而不是凭空生成一段“看起来合理”的话。
        </p>
      </div>

      <LeafletSandboxMap
        activeLayers={activeLayers}
        layerCounts={layerCounts}
        onSelectPoint={setSelectedPointId}
        onToggleLayer={handleToggleLayer}
        selectedPointId={selectedPoint.id}
        visiblePoints={visiblePoints}
      />

      <div className={styles.controlDeck}>
        <FilterRadar point={selectedPoint} />
        <SelectedPointProfile point={selectedPoint} />
        <DataStats visibleCount={visiblePoints.length} />
        <BoundaryNote selectedTags={selectedPoint.scenarioTags} />
      </div>
    </section>
  );
}

function LeafletSandboxMap({
  activeLayers,
  layerCounts,
  onSelectPoint,
  onToggleLayer,
  selectedPointId,
  visiblePoints
}: {
  activeLayers: Record<LayerKey, boolean>;
  layerCounts: Record<LayerKey, number>;
  onSelectPoint: (id: string) => void;
  onToggleLayer: (layer: LayerKey) => void;
  selectedPointId: string;
  visiblePoints: SandboxPoint[];
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [fallbackReason, setFallbackReason] = useState(FALLBACK_COPY);
  const [wheelZoomEnabled, setWheelZoomEnabled] = useState(false);
  const [mapZoom, setMapZoom] = useState(14);
  const visiblePointKey = useMemo(
    () => visiblePoints.map((point) => point.id).join("|"),
    [visiblePoints]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setFallbackReason(FALLBACK_COPY);
      setMapStatus("fallback");
      return;
    }

    const container = mapContainerRef.current;
    if (!container) {
      setFallbackReason(FALLBACK_COPY);
      setMapStatus("fallback");
      return;
    }

    let disposed = false;
    let tileErrors = 0;
    let tileLoaded = false;
    let tileLoadTimeout: number | undefined;
    const teardownMap = () => {
      if (tileLoadTimeout) {
        window.clearTimeout(tileLoadTimeout);
      }
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      tileLayerRef.current?.remove();
      tileLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
    const triggerFallback = () => {
      teardownMap();
      setFallbackReason(FALLBACK_COPY);
      setMapStatus("fallback");
    };

    const mountMap = async () => {
      try {
        const L = await import("leaflet");
        if (disposed) return;

        leafletRef.current = L;
        const map = L.map(container, {
          center: UNIVERSITY_TOWN_CENTER,
          zoom: 14,
          minZoom: 12,
          maxZoom: 18,
          zoomControl: false,
          attributionControl: true,
          doubleClickZoom: true,
          touchZoom: true,
          scrollWheelZoom: false
        });

        mapRef.current = map;
        setMapZoom(map.getZoom());
        L.control.zoom({ position: "bottomright" }).addTo(map);

        const tileLayer = L.tileLayer(OSM_TILE_URL, {
          attribution: OSM_ATTRIBUTION,
          crossOrigin: true,
          detectRetina: true,
          maxZoom: 19
        });

        tileLayerRef.current = tileLayer;
        tileLayer.on("tileload", () => {
          tileErrors = 0;
          tileLoaded = true;
          if (tileLoadTimeout) {
            window.clearTimeout(tileLoadTimeout);
          }
          if (!disposed) {
            setMapStatus("ready");
          }
        });
        tileLayer.on("load", () => {
          tileLoaded = true;
          if (tileLoadTimeout) {
            window.clearTimeout(tileLoadTimeout);
          }
          if (!disposed) {
            setMapStatus("ready");
          }
        });
        tileLayer.on("tileerror", () => {
          tileErrors += 1;
          if (tileErrors >= 8 && !disposed) {
            triggerFallback();
          }
        });
        tileLayer.addTo(map);
        tileLoadTimeout = window.setTimeout(() => {
          if (!disposed && !tileLoaded) {
            triggerFallback();
          }
        }, 8000);

        map.on("click", () => {
          map.scrollWheelZoom.enable();
          setWheelZoomEnabled(true);
        });
        map.on("mouseout", () => {
          map.scrollWheelZoom.disable();
          setWheelZoomEnabled(false);
        });
        map.on("zoomend", () => {
          setMapZoom(map.getZoom());
        });

        window.requestAnimationFrame(() => {
          if (!disposed) {
            map.invalidateSize({ pan: false });
            tileLayer.redraw();
          }
        });
        window.setTimeout(() => {
          if (!disposed) {
            map.invalidateSize({ pan: false });
            tileLayer.redraw();
          }
        }, 120);
        window.setTimeout(() => {
          if (!disposed) {
            map.invalidateSize({ pan: false });
          }
        }, 420);
      } catch {
        if (!disposed) {
          triggerFallback();
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      mapRef.current?.scrollWheelZoom.disable();
      setWheelZoomEnabled(false);
    };

    window.addEventListener("keydown", handleEscape);
    void mountMap();

    return () => {
      disposed = true;
      window.removeEventListener("keydown", handleEscape);
      teardownMap();
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || mapStatus === "fallback") return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    buildMapRenderItems(visiblePoints, mapZoom).forEach((item) => {
      if (item.kind === "cluster") {
        const marker = L.marker(item.cluster.latlng, {
          icon: createClusterIcon(L, item.cluster),
          title: `${item.cluster.count} 个候选点`,
          riseOnHover: true
        });

        marker.on("click", () => {
          const bounds = L.latLngBounds(item.cluster.bounds);
          const nextZoom = map.getZoom() <= LARGE_CLUSTER_MAX_ZOOM ? 15 : 17;
          if (bounds.isValid()) {
            map.fitBounds(bounds, { animate: true, maxZoom: nextZoom, padding: [56, 56] });
          } else {
            map.setView(item.cluster.latlng, Math.min(map.getZoom() + 2, map.getMaxZoom()), { animate: true });
          }
        });

        marker.bindTooltip(clusterTooltip(item.cluster), {
          direction: "top",
          offset: [0, -18],
          opacity: 0.96
        });
        marker.addTo(map);
        markersRef.current[item.cluster.id] = marker;
        return;
      }

      const { point } = item;
      const marker = L.marker(point.latlng, {
        icon: createPointIcon(L, point, point.id === selectedPointId),
        title: point.name,
        riseOnHover: true
      });

      marker.on("click", () => {
        onSelectPoint(point.id);
        map.panTo(point.latlng, { animate: true });
      });

      marker.bindTooltip(
        `<strong>${escapeHtml(point.name)}</strong><br/><span>${escapeHtml(point.markerLabel)} / ${escapeHtml(
          point.scenarioTags.slice(0, 2).join(" · ")
        )}</span>`,
        { direction: "top", offset: [0, -12], opacity: 0.96 }
      );
      marker.addTo(map);
      markersRef.current[point.id] = marker;
    });
  }, [mapStatus, mapZoom, onSelectPoint, selectedPointId, visiblePointKey, visiblePoints]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || mapStatus === "fallback") return;

    if (visiblePoints.length > 1) {
      const bounds = L.latLngBounds(visiblePoints.map((point) => point.latlng));
      map.fitBounds(bounds, { animate: false, maxZoom: 15, padding: [34, 34] });
    } else if (visiblePoints[0]) {
      map.setView(visiblePoints[0].latlng, 15, { animate: false });
    }
  }, [mapStatus, visiblePointKey, visiblePoints]);

  if (mapStatus === "fallback") {
    return (
      <StaticSandboxMap
        activeLayers={activeLayers}
        fallbackReason={fallbackReason}
        layerCounts={layerCounts}
        onToggleLayer={onToggleLayer}
        visiblePoints={visiblePoints}
      />
    );
  }

  return (
    <div className={styles.mapStage}>
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.kicker}>大学城候选世界 / Leaflet + OSM</span>
          <strong>真实地图底图承载沙盘候选点位，点击点位会联动下方筛选雷达、数据画像和边界说明</strong>
        </div>
        <span className={styles.sourcePill}>source / synthetic / confidence</span>
      </div>

      <LayerControls
        activeLayers={activeLayers}
        layerCounts={layerCounts}
        onToggleLayer={onToggleLayer}
        visibleCount={visiblePoints.length}
      />

      <div className={styles.leafletCanvas} aria-label="广州大学城附近 Leaflet MVP 数据沙盘">
        <div ref={mapContainerRef} className={styles.leafletMap} />
        {mapStatus === "loading" ? (
          <div className={styles.leafletStatus}>正在加载 OpenStreetMap 底图...</div>
        ) : null}
        <div className={styles.zoomHint}>
          <strong>{wheelZoomEnabled ? "滚轮缩放已开启" : "点击地图后可滚轮缩放"}</strong>
          <span>也可使用 +/-、双击或触控缩放；离开地图或按 Esc 关闭滚轮缩放</span>
        </div>
        <div className={styles.boundaryBadge}>
          <strong>MVP 数据沙盘</strong>
          <span>非真实平台数据</span>
        </div>
      </div>

      <MapLegend />
    </div>
  );
}

function StaticSandboxMap({
  activeLayers,
  fallbackReason,
  layerCounts,
  onToggleLayer,
  visiblePoints
}: {
  activeLayers: Record<LayerKey, boolean>;
  fallbackReason?: string;
  layerCounts: Record<LayerKey, number>;
  onToggleLayer: (layer: LayerKey) => void;
  visiblePoints: SandboxPoint[];
}) {
  const staticMapPoints = visiblePoints.slice(0, 34).map((point) => ({
    id: point.id,
    label: point.markerLabel,
    name: point.name,
    kind: typeToPointKind(point.type),
    x: lngToStaticX(point.latlng[1]),
    y: latToStaticY(point.latlng[0]),
    meta: point.scenarioTags.slice(0, 2).join(" / ")
  }));

  return (
    <div className={styles.mapStage}>
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.kicker}>大学城候选世界 / 静态 fallback</span>
          <strong>地图服务不可用时，仍展示候选、标签、步行圈与 MVP 数据边界</strong>
        </div>
        <span className={styles.sourcePill}>source / synthetic / confidence</span>
      </div>

      <LayerControls
        activeLayers={activeLayers}
        layerCounts={layerCounts}
        onToggleLayer={onToggleLayer}
        visibleCount={visiblePoints.length}
      />

      {fallbackReason ? <div className={styles.fallbackNotice}>{fallbackReason}</div> : null}

      <div className={styles.mapCanvas} aria-label="静态大学城本地生活数据沙盘">
        <span className={`${styles.road} ${styles.roadPrimary}`} aria-hidden="true" />
        <span className={`${styles.road} ${styles.roadSecond}`} aria-hidden="true" />
        <span className={`${styles.road} ${styles.roadThird}`} aria-hidden="true" />
        <span className={`${styles.routeLine} ${styles.routeOne}`} aria-hidden="true" />
        <span className={`${styles.routeLine} ${styles.routeTwo}`} aria-hidden="true" />

        <div className={`${styles.district} ${styles.campusZone}`}>
          <span>教学区</span>
          <small>课程后候选入口</small>
        </div>
        <div className={`${styles.district} ${styles.dormZone}`}>
          <span>宿舍区</span>
          <small>夜间与近距离约束</small>
        </div>
        <div className={`${styles.district} ${styles.marketZone}`}>
          <span>生活街区</span>
          <small>餐饮候选密集</small>
        </div>

        <div className={`${styles.specialZone} ${styles.rainZone}`}>
          <span>雨天备选区</span>
          <small>室内 POI + 近路段</small>
        </div>
        <div className={`${styles.specialZone} ${styles.budgetZone}`}>
          <span>低预算友好区</span>
          <small>价格约束优先</small>
        </div>
        <div className={styles.lakeZone}>
          <span>中心湖</span>
        </div>

        <div className={`${styles.walkCircle} ${styles.walkNorth}`}>
          <span>步行 12min</span>
        </div>
        <div className={`${styles.walkCircle} ${styles.walkSouth}`}>
          <span>步行 18min</span>
        </div>

        {staticMapPoints.map((point) => (
          <div
            className={`${styles.point} ${styles[point.kind]}`}
            key={point.id}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span className={styles.pointDot} aria-hidden="true" />
            <span className={styles.pointLabel}>
              <strong>{point.name}</strong>
              <small>{point.label} / {point.meta}</small>
            </span>
          </div>
        ))}

        <div className={styles.boundaryBadge}>
          <strong>MVP 数据沙盘</strong>
          <span>非真实平台数据</span>
        </div>
      </div>

      <MapLegend />
    </div>
  );
}

function LayerControls({
  activeLayers,
  layerCounts,
  onToggleLayer,
  visibleCount
}: {
  activeLayers: Record<LayerKey, boolean>;
  layerCounts: Record<LayerKey, number>;
  onToggleLayer: (layer: LayerKey) => void;
  visibleCount: number;
}) {
  return (
    <div className={styles.mapTools} aria-label="沙盘图层筛选">
      <div className={styles.layerControls}>
        {layerDefinitions.map((layer) => (
          <button
            aria-pressed={activeLayers[layer.key]}
            className={`${styles.layerButton} ${activeLayers[layer.key] ? styles.layerButtonActive : ""}`}
            key={layer.key}
            onClick={() => onToggleLayer(layer.key)}
            type="button"
          >
            <span className={`${styles.layerDot} ${styles[layer.key]}`} aria-hidden="true" />
            <span>
              <strong>{layer.label}</strong>
              <small>{layerCounts[layer.key]} 个 / {layer.description}</small>
            </span>
          </button>
        ))}
      </div>
      <span className={styles.visibleCount}>
        当前可见 <strong>{visibleCount}</strong> / {totalPointCount} 个点位
      </span>
    </div>
  );
}

function MapLegend() {
  return (
    <ul className={styles.legend} aria-label="地图图例">
      {legendItems.map((item) => (
        <li key={item.label}>
          <span className={`${styles.legendMarker} ${styles[item.tone]}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function FilterRadar({ point }: { point: SandboxPoint }) {
  return (
    <section className={`${styles.controlPanel} ${styles.radarPanel}`} aria-labelledby="filter-radar-title">
      <div className={styles.panelTitle}>
        <span>FilterRadar / 当前点位联动</span>
        <h3 id="filter-radar-title">{point.name} 的筛选维度</h3>
      </div>
      <div className={styles.radarList}>
        {radarMetrics.map((item) => {
          const value = point.radar[item.key];
          return (
            <div className={styles.radarItem} key={item.key}>
              <div className={styles.radarMeta}>
                <span>{item.label}</span>
                <small>{item.note} / {value}%</small>
              </div>
              <div className={styles.barTrack} aria-label={`${item.label} ${value}%`}>
                <span className={styles.barFill} style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelectedPointProfile({ point }: { point: SandboxPoint }) {
  return (
    <section className={`${styles.controlPanel} ${styles.profilePanel}`} aria-labelledby="selected-point-title">
      <div className={styles.panelTitle}>
        <span>SelectedPointProfile</span>
        <h3 id="selected-point-title">{point.name}</h3>
      </div>

      <div className={styles.profileGrid}>
        <InfoChip label="layer" value={typeLabel(point.type)} />
        <InfoChip label="source" value={point.source} />
        <InfoChip label="sourceId" value={point.sourceId} />
        <InfoChip label="seedFile" value={point.seedFile} />
        <InfoChip label="synthetic" value={point.synthetic ? "true / MVP 合成或场景数据" : "false / 人工样本"} />
        <InfoChip label="confidence" value={confidenceLabel(point.confidence)} />
      </div>

      <div className={styles.profileTags} aria-label="当前点位适配场景标签">
        {point.scenarioTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <ul className={styles.whyList}>
        {point.why.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoChip}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataStats({ visibleCount }: { visibleCount: number }) {
  return (
    <section className={`${styles.controlPanel} ${styles.statsPanel}`} aria-labelledby="data-stats-title">
      <div className={styles.panelTitle}>
        <span>DataStats</span>
        <h3 id="data-stats-title">MVP 候选规模</h3>
      </div>
      <div className={styles.visibleSummary}>
        <span>当前图层可见点位</span>
        <strong>{visibleCount} / {totalPointCount}</strong>
      </div>
      <div className={styles.statsGrid}>
        {stats.map((item) => (
          <div className={styles.statItem} key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.credibility}>
        每个候选都保留 source / synthetic / confidence 等来源标注，让 demo 明确知道哪些是人工样本，哪些是 MVP 合成数据，哪些只用于场景验证。
      </p>
    </section>
  );
}

function BoundaryNote({ selectedTags }: { selectedTags: string[] }) {
  return (
    <section className={`${styles.controlPanel} ${styles.boundaryPanel}`} aria-labelledby="boundary-note-title">
      <div className={styles.panelTitle}>
        <span>BoundaryNote</span>
        <h3 id="boundary-note-title">边界声明</h3>
      </div>
      <div className={styles.tagCloud} aria-label="场景标签">
        {sceneTags.map((tag) => (
          <span className={selectedTags.includes(tag) ? styles.activeTag : undefined} key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <p className={styles.boundaryText}>
        当前沙盘用于 Hackathon MVP 的推荐与路线逻辑验证，不代表真实美团 / 点评评分、销量、库存、排队时间或平台认证数据。
      </p>
    </section>
  );
}

function createRestaurantPoint(shop: SeedRestaurantShop, layer: Extract<LayerKey, "manual_sample" | "synthetic_mvp">, index: number): SandboxPoint {
  const category = shop.category ?? shop.cuisines?.[0] ?? "餐饮";
  const tags = cleanTags([category, ...(shop.cuisines ?? []), ...(shop.tags ?? [])]);
  const latlng: [number, number] = [shop.latitude, shop.longitude];
  const radar = buildRestaurantRadar(tags, shop.avgPrice, latlng);
  const scenarioTags = deriveRestaurantScenarioTags(tags, radar);
  const seedFile =
    layer === "manual_sample"
      ? "frontend/data/restaurant/shops.gut.seed.json"
      : "frontend/data/restaurant/shops.synthetic.seed.json";
  const sourceId = shop.sourceId ?? shop.id ?? `${layer}_${index + 1}`;

  return {
    id: `${layer}:${shop.id ?? index}`,
    name: shop.name || `餐饮候选 ${index + 1}`,
    type: layer,
    latlng,
    category,
    address: shop.address ?? "大学城附近沙盘地址",
    markerLabel: deriveRestaurantMarkerLabel(tags, shop.avgPrice),
    source: `${shop.source ?? layer} / ${sourceId}`,
    sourceId,
    seedFile,
    synthetic: layer === "synthetic_mvp" || Boolean(shop.synthetic),
    confidence: layer === "manual_sample" ? "high" : normalizeConfidence(shop.confidence, "medium"),
    scenarioTags,
    radar,
    why:
      layer === "manual_sample"
        ? [
            `${category} 候选来自人工样本 seed，保留 sourceId、标签和大学城附近坐标，用于证明推荐不是凭空生成。`,
            "排序画像只使用预算、口味、距离、聊天氛围等 MVP 标签，不读取真实评分、销量、库存或排队时间。"
          ]
        : [
            `${category} 候选来自 synthetic_mvp seed，用于扩大本地生活候选世界并验证筛选权重。`,
            "该点位只服务 Hackathon 场景验证，不声明真实商户、平台认证、供给状态或交易表现。"
          ]
  };
}

function createWeekendPoint(poi: SeedWeekendPoi, index: number): SandboxPoint {
  const type = poi.type ?? "weekend";
  const tags = cleanTags([type, poi.area, ...(poi.tags ?? []), ...(poi.routeNodeRoles ?? []), ...(poi.suitableWeather ?? [])]);
  const latlng: [number, number] = [poi.latitude, poi.longitude];
  const radar = buildWeekendRadar(poi, tags, latlng);
  const scenarioTags = deriveWeekendScenarioTags(poi, tags, radar);
  const sourceId = poi.sourceId ?? poi.id ?? `weekend_poi_${index + 1}`;

  return {
    id: `weekend_poi:${poi.id ?? index}`,
    name: poi.name || `周末 POI ${index + 1}`,
    type: "weekend_poi",
    latlng,
    category: type,
    address: poi.addressText ?? "大学城附近周末 POI 沙盘地址",
    markerLabel: deriveWeekendMarkerLabel(poi, tags),
    source: `${poi.source ?? "synthetic_weekend_mvp"} / ${sourceId}`,
    sourceId,
    seedFile: "frontend/data/weekend/weekend-pois.seed.json",
    synthetic: poi.synthetic ?? true,
    confidence: normalizeConfidence(poi.confidence, "demo"),
    scenarioTags,
    radar,
    why: [
      `${type} 节点来自 weekend POI seed，用于把餐饮候选接到周末路线模板的候选世界。`,
      "该节点只用于路线逻辑验证，不代表真实地图路线、活动档期、库存、排队时间或平台认证数据。"
    ]
  };
}

function buildRestaurantRadar(tags: string[], avgPrice: number | null | undefined, latlng: [number, number]): RadarProfile {
  const spicy = hasAny(tags, ["川湘", "火锅", "烧烤", "新疆", "辣"]);
  const nonSpicy = hasAny(tags, ["不辣", "西餐", "轻食", "甜品", "奶茶", "咖啡", "日料"]) ? 88 : spicy ? 54 : 72;
  const chat = hasAny(tags, ["聊天", "多人", "聚餐", "咖啡", "甜品", "西餐"]) ? 88 : 66;
  const rainy = hasAny(tags, ["雨天", "室内", "咖啡", "奶茶", "甜品", "西餐"]) ? 82 : 62;

  return {
    budget: scoreFromBudget(avgPrice, 96),
    nonSpicy,
    chat,
    distance: scoreFromDistance(latlng),
    rainy,
    queueRisk: clamp(Math.round((scoreFromBudget(avgPrice, 90) + scoreFromDistance(latlng)) / 2), 58, 90)
  };
}

function buildWeekendRadar(poi: SeedWeekendPoi, tags: string[], latlng: [number, number]): RadarProfile {
  const cost = typeof poi.cost === "number" ? poi.cost : null;
  const rainy = poi.rainyDayFriendly || poi.indoor || hasAny(tags, ["rainy", "雨天", "室内"]) ? 92 : 54;
  const chat = hasAny(tags, ["聊天", "咖啡", "茶", "书店", "草坪", "散步", "轻停留"]) ? 88 : 70;
  const walkingBonus = poi.walkingIntensity === "low" ? 90 : poi.walkingIntensity === "medium" ? 76 : 62;

  return {
    budget: scoreFromBudget(cost, 90),
    nonSpicy: 76,
    chat,
    distance: scoreFromDistance(latlng),
    rainy,
    queueRisk: walkingBonus
  };
}

function deriveRestaurantScenarioTags(tags: string[], radar: RadarProfile) {
  const result = new Set<string>(["今天吃什么"]);
  if (radar.chat >= 78 || hasAny(tags, ["多人", "聚餐", "聊天"])) result.add("多人约饭");
  if (radar.rainy >= 78) result.add("雨天友好");
  if (radar.budget >= 78) result.add("低预算");
  if (radar.chat >= 78) result.add("适合聊天");
  if (radar.nonSpicy >= 78) result.add("不辣可选");
  if (radar.distance >= 78) result.add("距离近");
  if (radar.queueRisk >= 78) result.add("排队低风险");
  return sceneTags.filter((tag) => result.has(tag));
}

function deriveWeekendScenarioTags(poi: SeedWeekendPoi, tags: string[], radar: RadarProfile) {
  const result = new Set<string>(["周末规划"]);
  if (radar.chat >= 78 || hasAny(tags, ["聊天", "咖啡", "茶", "书店"])) result.add("适合聊天");
  if (radar.rainy >= 78 || poi.rainyDayFriendly) result.add("雨天友好");
  if (radar.budget >= 78) result.add("低预算");
  if (radar.distance >= 78) result.add("距离近");
  if (radar.queueRisk >= 78) result.add("排队低风险");
  return sceneTags.filter((tag) => result.has(tag));
}

function deriveRestaurantMarkerLabel(tags: string[], avgPrice: number | null | undefined) {
  if (hasAny(tags, ["咖啡"])) return "咖啡";
  if (hasAny(tags, ["奶茶", "茶饮"])) return "茶饮";
  if (hasAny(tags, ["甜品"])) return "甜品";
  if (hasAny(tags, ["轻食"])) return "轻食";
  if (typeof avgPrice === "number" && avgPrice <= 35) return "低预算";
  if (hasAny(tags, ["不辣", "西餐", "日料"])) return "不辣";
  if (hasAny(tags, ["聊天", "多人", "聚餐"])) return "聊天";
  if (hasAny(tags, ["烧烤", "夜宵"])) return "夜宵";
  return "餐饮";
}

function deriveWeekendMarkerLabel(poi: SeedWeekendPoi, tags: string[]) {
  if (poi.rainyDayFriendly || poi.indoor || hasAny(tags, ["雨天", "室内", "rainy"])) return "雨天";
  if (hasAny(tags, ["咖啡"])) return "咖啡";
  if (hasAny(tags, ["茶", "甜品"])) return "茶点";
  if (hasAny(tags, ["书店", "museum", "gallery", "cinema"])) return "室内";
  if (hasAny(tags, ["walk", "散步", "park", "greenway", "riverside", "cycling"])) return "散步";
  if (hasAny(tags, ["meetup", "transit", "地铁", "集合"])) return "集合";
  return "周末";
}

function scoreFromBudget(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return clamp(Math.round(102 - value * 1.18), 46, 96);
}

function scoreFromDistance(latlng: [number, number]) {
  const latDistanceKm = Math.abs(latlng[0] - UNIVERSITY_TOWN_CENTER[0]) * 111;
  const lngDistanceKm = Math.abs(latlng[1] - UNIVERSITY_TOWN_CENTER[1]) * 102;
  const distanceKm = Math.sqrt(latDistanceKm ** 2 + lngDistanceKm ** 2);
  return clamp(Math.round(94 - distanceKm * 9), 48, 94);
}

function normalizeConfidence(value: number | string | null | undefined, fallback: Confidence): Confidence {
  if (typeof value === "string") {
    if (value === "high" || value === "medium" || value === "demo") return value;
  }
  if (typeof value === "number") {
    if (value >= 0.78) return "high";
    if (value >= 0.58) return "medium";
    return "demo";
  }
  return fallback;
}

function typeToPointKind(type: SandboxPointType): PointKind {
  if (type === "manual_sample") return "manual";
  if (type === "synthetic_mvp") return "synthetic";
  return "poi";
}

function typeLabel(type: SandboxPointType) {
  if (type === "manual_sample") return "manual_sample 餐厅";
  if (type === "synthetic_mvp") return "synthetic_mvp 餐饮点";
  return "weekend POI";
}

function confidenceLabel(confidence: Confidence) {
  if (confidence === "high") return "high / 人工确认或高置信样本";
  if (confidence === "medium") return "medium / 规则验证";
  return "demo / 场景验证";
}

function buildMapRenderItems(points: SandboxPoint[], zoom: number): MapRenderItem[] {
  if (zoom >= SINGLE_POINT_ZOOM || points.length <= 1) {
    return points.map((point) => ({ kind: "point", point }));
  }

  const grid = getClusterGridSize(zoom);
  const buckets = new Map<string, SandboxPoint[]>();

  points.forEach((point) => {
    const latBucket = Math.floor(point.latlng[0] / grid.lat);
    const lngBucket = Math.floor(point.latlng[1] / grid.lng);
    const key = `${grid.id}:${latBucket}:${lngBucket}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    if (bucket.length === 1) {
      return { kind: "point", point: bucket[0] };
    }

    return {
      cluster: createCluster(key, bucket),
      kind: "cluster"
    };
  });
}

function getClusterGridSize(zoom: number) {
  if (zoom <= LARGE_CLUSTER_MAX_ZOOM) {
    return { id: "large", lat: 0.0135, lng: 0.017 };
  }

  return { id: "medium", lat: 0.0055, lng: 0.007 };
}

function createCluster(key: string, points: SandboxPoint[]): SandboxCluster {
  const counts: Record<SandboxPointType, number> = {
    manual_sample: 0,
    synthetic_mvp: 0,
    weekend_poi: 0
  };
  let latSum = 0;
  let lngSum = 0;
  let minLat = Number.POSITIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    counts[point.type] += 1;
    latSum += point.latlng[0];
    lngSum += point.latlng[1];
    minLat = Math.min(minLat, point.latlng[0]);
    minLng = Math.min(minLng, point.latlng[1]);
    maxLat = Math.max(maxLat, point.latlng[0]);
    maxLng = Math.max(maxLng, point.latlng[1]);
  });

  return {
    id: `cluster:${key}`,
    count: points.length,
    counts,
    dominantType: getDominantClusterType(counts, points.length),
    label: getClusterLabel(counts, points.length),
    latlng: [latSum / points.length, lngSum / points.length],
    bounds: [[minLat, minLng], [maxLat, maxLng]],
    points
  };
}

function getDominantClusterType(counts: Record<SandboxPointType, number>, total: number): ClusterTone {
  const sorted = (Object.entries(counts) as Array<[SandboxPointType, number]>)
    .sort((left, right) => right[1] - left[1]);
  const [topType, topCount] = sorted[0];
  const activeTypeCount = sorted.filter(([, count]) => count > 0).length;

  if (activeTypeCount === 1 || topCount >= Math.ceil(total * 0.62)) {
    return topType;
  }

  return "mixed";
}

function getClusterLabel(counts: Record<SandboxPointType, number>, total: number) {
  if (counts.weekend_poi === total) return "周末";
  if (counts.manual_sample + counts.synthetic_mvp === total) return "餐饮";
  return "候选点";
}

function clusterSizeClass(count: number) {
  if (count >= 30) return styles.clusterLarge;
  if (count >= 12) return styles.clusterMedium;
  return styles.clusterSmall;
}

function clusterTooltip(cluster: SandboxCluster) {
  return `<strong>${cluster.count} 个候选点</strong><br/><span>manual ${cluster.counts.manual_sample} · synthetic ${cluster.counts.synthetic_mvp} · weekend ${cluster.counts.weekend_poi}</span>`;
}

function createClusterIcon(
  L: typeof import("leaflet"),
  cluster: SandboxCluster
): DivIcon {
  const baseSize = cluster.count >= 30 ? 68 : cluster.count >= 12 ? 58 : 50;
  const compact = typeof window !== "undefined" && window.matchMedia("(max-width: 680px)").matches;
  const size = compact ? Math.max(42, baseSize - 8) : baseSize;
  const classNames = [
    styles.clusterBubble,
    styles[cluster.dominantType],
    clusterSizeClass(cluster.count)
  ].filter(Boolean).join(" ");

  return L.divIcon({
    className: styles.leafletClusterIcon,
    html: `<span class="${classNames}"><span class="${styles.clusterGlow}"></span><strong>${cluster.count}</strong><small>${escapeHtml(cluster.label)}</small></span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size],
    tooltipAnchor: [0, -(size / 2)]
  });
}

function createPointIcon(
  L: typeof import("leaflet"),
  point: SandboxPoint,
  active: boolean
): DivIcon {
  const classNames = [
    styles.leafletPointPin,
    styles[point.type],
    active ? styles.activePin : ""
  ].filter(Boolean).join(" ");

  return L.divIcon({
    className: styles.leafletPointIcon,
    html: `<span class="${classNames}"><span class="${styles.leafletPointCore}"></span><span class="${styles.leafletPointText}">${escapeHtml(point.markerLabel)}</span></span>`,
    iconAnchor: [17, 17],
    iconSize: [34, 34],
    tooltipAnchor: [0, -18]
  });
}

function cleanTags(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function hasAny(values: string[], needles: string[]) {
  const joined = values.join(" ").toLowerCase();
  return needles.some((needle) => joined.includes(needle.toLowerCase()));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lngToStaticX(lng: number) {
  return clamp(Math.round(((lng - 113.36) / (113.416 - 113.36)) * 100), 7, 93);
}

function latToStaticY(lat: number) {
  return clamp(Math.round(((23.076 - lat) / (23.076 - 23.032)) * 100), 7, 93);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

export default DataSandboxSection;
