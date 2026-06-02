"use client";

import styles from "./DataSandboxSection.module.css";

type PointKind = "manual" | "synthetic" | "poi";
type LegendTone = PointKind | "walk" | "rain" | "lowBudget";

const mapPoints: Array<{
  label: string;
  kind: PointKind;
  x: number;
  y: number;
  meta: string;
}> = [
  { label: "南门轻食样本", kind: "manual", x: 22, y: 61, meta: "manual_sample · 不辣可选" },
  { label: "西区粉面样本", kind: "manual", x: 34, y: 70, meta: "manual_sample · 距离近" },
  { label: "湖边聊天餐厅", kind: "manual", x: 52, y: 47, meta: "manual_sample · 适合聊天" },
  { label: "东门预算餐饮点", kind: "synthetic", x: 73, y: 58, meta: "synthetic_mvp · 低预算" },
  { label: "宿舍夜宵候选", kind: "synthetic", x: 62, y: 75, meta: "synthetic_mvp · 排队低风险" },
  { label: "雨天室内备选", kind: "synthetic", x: 79, y: 32, meta: "synthetic_mvp · 雨天友好" },
  { label: "周末展馆 POI", kind: "poi", x: 42, y: 24, meta: "weekend POI · 路线模板节点" },
  { label: "创意市集 POI", kind: "poi", x: 86, y: 68, meta: "weekend POI · 半日路线" }
];

const legendItems: Array<{ label: string; tone: LegendTone }> = [
  { label: "manual_sample 餐厅", tone: "manual" },
  { label: "synthetic_mvp 餐饮点", tone: "synthetic" },
  { label: "weekend POI", tone: "poi" },
  { label: "步行友好范围", tone: "walk" },
  { label: "雨天备选区", tone: "rain" },
  { label: "低预算友好区", tone: "lowBudget" }
];

const radarDimensions = [
  { label: "预算友好", value: 86, note: "低预算" },
  { label: "不辣可选", value: 78, note: "忌口约束" },
  { label: "适合聊天", value: 72, note: "氛围标签" },
  { label: "距离友好", value: 82, note: "步行圈" },
  { label: "雨天友好", value: 68, note: "备选区" },
  { label: "排队低风险", value: 74, note: "风险标签" }
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
  return (
    <section className={styles.section} aria-labelledby="data-sandbox-title">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Data Sandbox / MVP 数据边界</p>
        <h2 id="data-sandbox-title">我们为大学城搭了一个可解释的本地生活沙盘</h2>
        <p className={styles.subtitle}>
          让 AI 管家的建议落在具体候选、地点、标签和约束上，而不是凭空生成一段“看起来合理”的话。
        </p>
      </div>

      <SandboxMap />

      <div className={styles.controlDeck}>
        <FilterRadar />
        <DataStats />
        <BoundaryNote />
      </div>
    </section>
  );
}

function SandboxMap() {
  return (
    <div className={styles.mapStage}>
      <div className={styles.stageHeader}>
        <div>
          <span className={styles.kicker}>大学城候选世界</span>
          <strong>餐饮点、POI、步行圈与场景约束共同进入推荐逻辑</strong>
        </div>
        <span className={styles.sourcePill}>source / synthetic / confidence</span>
      </div>

      <div className={styles.mapCanvas} aria-label="抽象大学城本地生活数据沙盘">
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

        {mapPoints.map((point) => (
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

      <ul className={styles.legend} aria-label="地图图例">
        {legendItems.map((item) => (
          <li key={item.label}>
            <span className={`${styles.legendMarker} ${styles[item.tone]}`} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterRadar() {
  return (
    <section className={`${styles.controlPanel} ${styles.radarPanel}`} aria-labelledby="filter-radar-title">
      <div className={styles.panelTitle}>
        <span>FilterRadar</span>
        <h3 id="filter-radar-title">筛选雷达 / 维度条</h3>
      </div>
      <div className={styles.radarList}>
        {radarDimensions.map((item) => (
          <div className={styles.radarItem} key={item.label}>
            <div className={styles.radarMeta}>
              <span>{item.label}</span>
              <small>{item.note}</small>
            </div>
            <div className={styles.barTrack} aria-label={`${item.label} ${item.value}%`}>
              <span className={styles.barFill} style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
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

function BoundaryNote() {
  return (
    <section className={`${styles.controlPanel} ${styles.boundaryPanel}`} aria-labelledby="boundary-note-title">
      <div className={styles.panelTitle}>
        <span>BoundaryNote</span>
        <h3 id="boundary-note-title">边界声明</h3>
      </div>
      <div className={styles.tagCloud} aria-label="场景标签">
        {sceneTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <p className={styles.boundaryText}>
        当前沙盘用于 Hackathon MVP 的推荐与路线逻辑验证，不代表真实美团 / 点评评分、销量、库存、排队时间或平台认证数据。
      </p>
    </section>
  );
}

export default DataSandboxSection;
