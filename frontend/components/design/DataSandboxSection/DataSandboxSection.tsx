"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DivIcon, Map as LeafletMap, Marker, TileLayer } from "leaflet";
import styles from "./DataSandboxSection.module.css";

type SandboxPointType = "manual_sample" | "synthetic_mvp" | "weekend_poi";
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
  source: string;
  synthetic: boolean;
  confidence: Confidence;
  scenarioTags: string[];
  radar: RadarProfile;
  why: string[];
};

const UNIVERSITY_TOWN_CENTER: [number, number] = [23.05, 113.39];
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_COPY =
  "地图底图暂不可用，已切换为静态 MVP 数据沙盘。推荐与路线逻辑仍基于候选、标签和边界声明展示。";

const sandboxPoints: SandboxPoint[] = [
  {
    id: "lakeside-chat",
    name: "湖边聊天餐厅",
    type: "manual_sample",
    latlng: [23.0539, 113.3906],
    source: "manual_sample / demo_reviewed",
    synthetic: false,
    confidence: "high",
    scenarioTags: ["多人约饭", "适合聊天", "不辣可选", "距离近"],
    radar: { budget: 74, nonSpicy: 86, chat: 94, distance: 82, rainy: 62, queueRisk: 70 },
    why: ["用于展示人工样本如何进入候选池。", "强调氛围、忌口与步行距离等约束，不代表平台正式推荐。"]
  },
  {
    id: "south-gate-light",
    name: "南门轻食样本",
    type: "manual_sample",
    latlng: [23.0454, 113.3849],
    source: "manual_sample / campus_scenario",
    synthetic: false,
    confidence: "high",
    scenarioTags: ["今天吃什么", "低预算", "不辣可选", "距离近"],
    radar: { budget: 88, nonSpicy: 90, chat: 68, distance: 84, rainy: 60, queueRisk: 78 },
    why: ["用于说明轻食、不辣、低预算标签如何被筛选。", "坐标为广州大学城附近示意点位，不读取平台商户数据。"]
  },
  {
    id: "east-gate-budget",
    name: "东门预算餐饮点",
    type: "synthetic_mvp",
    latlng: [23.0492, 113.4034],
    source: "synthetic_mvp / rule_seed",
    synthetic: true,
    confidence: "medium",
    scenarioTags: ["低预算", "今天吃什么", "距离友好", "排队低风险"],
    radar: { budget: 96, nonSpicy: 70, chat: 60, distance: 79, rainy: 64, queueRisk: 84 },
    why: ["用于验证预算约束优先时的排序逻辑。", "synthetic_mvp 只服务 demo 场景验证，不代表平台地址或供给状态。"]
  },
  {
    id: "rainy-indoor",
    name: "雨天室内备选",
    type: "synthetic_mvp",
    latlng: [23.0587, 113.3978],
    source: "synthetic_mvp / rainy_route_case",
    synthetic: true,
    confidence: "demo",
    scenarioTags: ["雨天友好", "周末规划", "适合聊天"],
    radar: { budget: 70, nonSpicy: 72, chat: 86, distance: 76, rainy: 96, queueRisk: 66 },
    why: ["用于证明雨天约束会改变候选权重。", "该点位是室内备选场景样本，不声明排队时长。"]
  },
  {
    id: "creative-market",
    name: "创意市集 POI",
    type: "weekend_poi",
    latlng: [23.0435, 113.3972],
    source: "weekend_poi / route_template_node",
    synthetic: true,
    confidence: "demo",
    scenarioTags: ["周末规划", "多人约饭", "适合聊天"],
    radar: { budget: 78, nonSpicy: 62, chat: 88, distance: 68, rainy: 54, queueRisk: 72 },
    why: ["用于把餐饮候选和周末 POI 连接到半日路线模板。", "POI 为示意节点，不表示真实活动档期。"]
  },
  {
    id: "central-lake-poi",
    name: "中心湖周末 POI",
    type: "weekend_poi",
    latlng: [23.0524, 113.3866],
    source: "weekend_poi / lake_walk_case",
    synthetic: true,
    confidence: "medium",
    scenarioTags: ["周末规划", "距离近", "适合聊天"],
    radar: { budget: 92, nonSpicy: 58, chat: 90, distance: 90, rainy: 42, queueRisk: 86 },
    why: ["用于展示路线规划中的步行圈与休闲节点。", "只表达大学城地理语境，不代表真实地图路线承诺。"]
  },
  {
    id: "dorm-night-snack",
    name: "宿舍夜宵候选",
    type: "synthetic_mvp",
    latlng: [23.0606, 113.3828],
    source: "synthetic_mvp / night_food_case",
    synthetic: true,
    confidence: "medium",
    scenarioTags: ["今天吃什么", "距离近", "排队低风险"],
    radar: { budget: 82, nonSpicy: 64, chat: 58, distance: 94, rainy: 70, queueRisk: 88 },
    why: ["用于验证夜间、近距离、低排队风险组合。", "不包含营业时段、交易表现或排队时长承诺。"]
  },
  {
    id: "beigang-light",
    name: "贝岗周边轻食点",
    type: "manual_sample",
    latlng: [23.0579, 113.4122],
    source: "manual_sample / neighborhood_case",
    synthetic: false,
    confidence: "high",
    scenarioTags: ["低预算", "不辣可选", "多人约饭", "距离友好"],
    radar: { budget: 84, nonSpicy: 88, chat: 74, distance: 76, rainy: 66, queueRisk: 80 },
    why: ["用于覆盖大学城周边生活区的候选样本。", "只作为人工样本标签展示，不使用真实平台评分。"]
  }
];

const staticMapPoints: Array<{
  label: string;
  kind: PointKind;
  x: number;
  y: number;
  meta: string;
}> = [
  { label: "南门轻食样本", kind: "manual", x: 22, y: 61, meta: "manual_sample · 不辣可选" },
  { label: "贝岗周边轻食点", kind: "manual", x: 78, y: 57, meta: "manual_sample · 低预算" },
  { label: "湖边聊天餐厅", kind: "manual", x: 52, y: 47, meta: "manual_sample · 适合聊天" },
  { label: "东门预算餐饮点", kind: "synthetic", x: 73, y: 58, meta: "synthetic_mvp · 低预算" },
  { label: "宿舍夜宵候选", kind: "synthetic", x: 62, y: 75, meta: "synthetic_mvp · 排队低风险" },
  { label: "雨天室内备选", kind: "synthetic", x: 79, y: 32, meta: "synthetic_mvp · 雨天友好" },
  { label: "中心湖周末 POI", kind: "poi", x: 42, y: 24, meta: "weekend POI · 路线模板节点" },
  { label: "创意市集 POI", kind: "poi", x: 86, y: 68, meta: "weekend POI · 半日路线" }
];

const legendItems: Array<{ label: string; tone: LegendTone }> = [
  { label: "manual_sample 餐厅", tone: "manual_sample" },
  { label: "synthetic_mvp 餐饮点", tone: "synthetic_mvp" },
  { label: "weekend POI", tone: "weekend_poi" },
  { label: "当前选中点位", tone: "selected" },
  { label: "步行友好范围", tone: "walk" },
  { label: "雨天 / 低预算场景区", tone: "rain" }
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

const stats = [
  { value: "30", label: "个手动样本餐厅" },
  { value: "100", label: "个 synthetic 餐饮点" },
  { value: "70", label: "个周末 POI" },
  { value: "11", label: "条周末路线模板" }
];

export function DataSandboxSection() {
  const [selectedPointId, setSelectedPointId] = useState(sandboxPoints[0].id);
  const selectedPoint = useMemo(
    () => sandboxPoints.find((point) => point.id === selectedPointId) ?? sandboxPoints[0],
    [selectedPointId]
  );

  return (
    <section className={styles.section} aria-labelledby="data-sandbox-title">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Data Sandbox / Leaflet 实验版</p>
        <h2 id="data-sandbox-title">我们为大学城搭了一个可解释的本地生活沙盘</h2>
        <p className={styles.subtitle}>
          让 AI 管家的建议落在具体候选、地点、标签和约束上，而不是凭空生成一段“看起来合理”的话。
        </p>
      </div>

      <LeafletSandboxMap selectedPointId={selectedPoint.id} onSelectPoint={setSelectedPointId} />

      <div className={styles.controlDeck}>
        <FilterRadar point={selectedPoint} />
        <SelectedPointProfile point={selectedPoint} />
        <DataStats />
        <BoundaryNote selectedTags={selectedPoint.scenarioTags} />
      </div>
    </section>
  );
}

function LeafletSandboxMap({
  selectedPointId,
  onSelectPoint
}: {
  selectedPointId: string;
  onSelectPoint: (id: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [fallbackReason, setFallbackReason] = useState(FALLBACK_COPY);

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
    const teardownMap = () => {
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      tileLayerRef.current?.remove();
      tileLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
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
          minZoom: 13,
          maxZoom: 17,
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false
        });

        mapRef.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);

        const tileLayer = L.tileLayer(OSM_TILE_URL, {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
          detectRetina: true
        });

        tileLayerRef.current = tileLayer;
        tileLayer.on("tileerror", () => {
          tileErrors += 1;
          if (tileErrors >= 6 && !disposed) {
            triggerFallback();
          }
        });
        tileLayer.addTo(map);

        sandboxPoints.forEach((point) => {
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
            `<strong>${escapeHtml(point.name)}</strong><br/><span>${typeLabel(point.type)} · confidence: ${point.confidence}</span>`,
            { direction: "top", offset: [0, -12], opacity: 0.96 }
          );
          marker.addTo(map);
          markersRef.current[point.id] = marker;
        });

        setMapStatus("ready");
        window.setTimeout(() => map.invalidateSize(), 90);
      } catch {
        if (!disposed) {
          triggerFallback();
        }
      }
    };

    void mountMap();

    return () => {
      disposed = true;
      teardownMap();
    };
  }, [onSelectPoint]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;

    sandboxPoints.forEach((point) => {
      markersRef.current[point.id]?.setIcon(createPointIcon(L, point, point.id === selectedPointId));
    });
  }, [selectedPointId]);

  if (mapStatus === "fallback") {
    return <StaticSandboxMap fallbackReason={fallbackReason} />;
  }

  return (
    <div className={styles.mapStage}>
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.kicker}>大学城候选世界 / Leaflet + OSM</span>
          <strong>真实地图底图承载示意点位，点击点位会联动下方筛选雷达与数据画像</strong>
        </div>
        <span className={styles.sourcePill}>source / synthetic / confidence</span>
      </div>

      <div className={styles.leafletCanvas} aria-label="广州大学城附近 Leaflet MVP 数据沙盘">
        <div ref={mapContainerRef} className={styles.leafletMap} />
        {mapStatus === "loading" ? (
          <div className={styles.leafletStatus}>正在加载 OpenStreetMap 底图...</div>
        ) : null}
        <div className={styles.boundaryBadge}>
          <strong>MVP 数据沙盘</strong>
          <span>非真实平台数据</span>
        </div>
      </div>

      <MapLegend />
    </div>
  );
}

function StaticSandboxMap({ fallbackReason }: { fallbackReason?: string }) {
  return (
    <div className={styles.mapStage}>
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.kicker}>大学城候选世界 / 静态 fallback</span>
          <strong>地图服务不可用时，仍展示候选、标签、步行圈与 MVP 数据边界</strong>
        </div>
        <span className={styles.sourcePill}>source / synthetic / confidence</span>
      </div>

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
            key={point.label}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span className={styles.pointDot} aria-hidden="true" />
            <span className={styles.pointLabel}>
              <strong>{point.label}</strong>
              <small>{point.meta}</small>
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
                <small>{item.note} · {value}%</small>
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
        <InfoChip label="type" value={typeLabel(point.type)} />
        <InfoChip label="source" value={point.source} />
        <InfoChip label="synthetic" value={point.synthetic ? "true / MVP 合成" : "false / 人工样本"} />
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

function DataStats() {
  return (
    <section className={`${styles.controlPanel} ${styles.statsPanel}`} aria-labelledby="data-stats-title">
      <div className={styles.panelTitle}>
        <span>DataStats</span>
        <h3 id="data-stats-title">MVP 候选规模</h3>
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
    html: `<span class="${classNames}"><span class="${styles.leafletPointCore}"></span><span class="${styles.leafletPointText}">${escapeHtml(shortTypeLabel(point.type))}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    tooltipAnchor: [0, -19]
  });
}

function typeLabel(type: SandboxPointType) {
  if (type === "manual_sample") return "manual_sample 餐厅";
  if (type === "synthetic_mvp") return "synthetic_mvp 餐饮点";
  return "weekend POI";
}

function shortTypeLabel(type: SandboxPointType) {
  if (type === "manual_sample") return "人工";
  if (type === "synthetic_mvp") return "合成";
  return "POI";
}

function confidenceLabel(confidence: Confidence) {
  if (confidence === "high") return "high / 人工确认";
  if (confidence === "medium") return "medium / 规则验证";
  return "demo / 场景验证";
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
