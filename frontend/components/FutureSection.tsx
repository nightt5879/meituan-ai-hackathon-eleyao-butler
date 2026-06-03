"use client";

type GateType = "api" | "time" | "proof";

type FutureDirection = {
  num: string;
  title: string;
  desc: string;
  tech: string;
  gate: GateType;
  icon: IconName;
  featured?: boolean;
};

type IconName = "data" | "bag" | "memory" | "mic" | "compass" | "check" | "clock" | "users" | "plug";

const gateLabel: Record<GateType, string> = {
  api: "官方接口",
  time: "开发时间",
  proof: "长期验证"
};

const gateLegend: Array<{ type: GateType; label: string }> = [
  { type: "api", label: "美团官方数据接口" },
  { type: "proof", label: "真实用户长期验证" },
  { type: "time", label: "更多工程开发时间" }
];

const futureDirections: FutureDirection[] = [
  {
    num: "未来 · 01",
    title: "接入真实门店与排队状态",
    desc: "把模拟餐厅库换成真实门店、营业时间、排队、菜单与距离数据，让推荐不止合理，还能现在就去。",
    tech: "Meituan API · POI · queue",
    gate: "api",
    icon: "data",
    featured: true
  },
  {
    num: "未来 · 02",
    title: "从推荐，走到下单与订位",
    desc: "选中方案后继续推进到订位、拼单、下单或群内确认，把“建议”变成真正办完的一件事。",
    tech: "transaction · fulfillment",
    gate: "api",
    icon: "bag"
  },
  {
    num: "未来 · 03",
    title: "越用越懂你的长期记忆",
    desc: "把每次选择、收藏、拒绝和临时偏好沉淀成用户画像，跨吃饭、约饭、周末规划复用。",
    tech: "memory · profile graph",
    gate: "proof",
    icon: "memory"
  },
  {
    num: "未来 · 04",
    title: "语音、图片和菜单都能输入",
    desc: "一句话、拍菜单、发截图都能成为任务入口，管家先理解上下文，再决定要不要追问。",
    tech: "ASR · vision · context",
    gate: "time",
    icon: "mic"
  },
  {
    num: "未来 · 05",
    title: "不只吃饭，扩展成本地生活管家",
    desc: "把“理解多人约束 + 方案自检”的能力迁移到约会、出行、运动、看展和临时周末计划。",
    tech: "scenario templates",
    gate: "time",
    icon: "compass"
  },
  {
    num: "未来 · 06",
    title: "评测闭环变成产品内监控",
    desc: "把预算、距离、忌口、时间、天气和公平性检查做成持续监控，发现推荐跑偏就自动降级或追问。",
    tech: "audit loop · eval traces",
    gate: "proof",
    icon: "check"
  }
];

function FutureIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  } as const;

  if (name === "data") return <svg {...common}><path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>;
  if (name === "bag") return <svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
  if (name === "memory") return <svg {...common}><path d="M12 3a5 5 0 0 0-5 5v1.2A4.6 4.6 0 0 0 8.2 18H10" /><path d="M12 3a5 5 0 0 1 5 5v1.2A4.6 4.6 0 0 1 15.8 18H14" /><path d="M9 9h6" /><path d="M8 13h8" /><path d="M12 18v3" /></svg>;
  if (name === "mic") return <svg {...common}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></svg>;
  if (name === "compass") return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="m16 8-2.2 5.8L8 16l2.2-5.8Z" /></svg>;
  if (name === "check") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.4" /><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" /></svg>;
  return <svg {...common}><path d="M9 8V3" /><path d="M15 8V3" /><path d="M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0Z" /><path d="M12 16v5" /></svg>;
}

function GatePill({ type }: { type: GateType }) {
  const icon: IconName = type === "api" ? "plug" : type === "proof" ? "users" : "clock";

  return (
    <span className={`future-gate future-gate--${type}`}>
      <FutureIcon name={icon} size={12} />
      {gateLabel[type]}
    </span>
  );
}

export function FutureSection() {
  return (
    <section className="section section--forest sec-future" id="future" data-screen-label="未来功能开发">
      <div className="container">
        <div className="future-top">
          <div className="future-head reveal">
            <div className="sec-eyebrow">设计与思路 · 未来展望</div>
            <h2 className="sec-title">不是没想到，<br />而是还差真实接入</h2>
            <p className="sec-lead">现在版本先证明“管家链路能跑通”。下一步要把它从 demo 推到产品，需要补齐官方数据、长期记忆、交易履约和更完整的评测闭环。</p>
          </div>

          <aside className="future-legend reveal d1" aria-label="未来功能暂未落地原因">
            <div className="future-legend-title">暂未落地，主要卡在</div>
            <ul>
              {gateLegend.map((item) => (
                <li key={item.type}>
                  <span className={`future-legend-icon future-legend-icon--${item.type}`}>
                    <FutureIcon name={item.type === "api" ? "plug" : item.type === "proof" ? "users" : "clock"} size={13} />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="grid3 future-grid">
          {futureDirections.map((item, index) => (
            <article className={`card card--dark future-card ${item.featured ? "future-card--featured" : ""} reveal d${(index % 3) + 1}`} key={item.num}>
              <div className="ic"><FutureIcon name={item.icon} size={24} /></div>
              <div className="num-tag">{item.num}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="future-card-foot">
                <code><span className="dot" />{item.tech}</code>
                <GatePill type={item.gate} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

