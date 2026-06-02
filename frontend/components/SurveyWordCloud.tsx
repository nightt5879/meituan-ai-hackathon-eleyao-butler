"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import surveyInsights from "@/data/survey/wordcloud-insights.json";

type CloudWord = {
  t: string;
  id: string;
  w: 1 | 2 | 3 | 4 | 5;
  pct: number;
  count: number;
  c?: "warn" | "hard";
  sourceCategory: string;
  sourceFile: string;
  sourceLabel: string;
  sourceBreakdown?: Record<string, number>;
  example?: string;
};

type SurveyStat = {
  v: string;
  k: string;
};

type SurveyInsight = {
  title: string;
  value: string;
  detail: string;
};

type SurveySectionRow = {
  label: string;
  display: string;
  count: number;
  pct: number;
  example?: string;
};

type SurveySection = {
  key: string;
  title: string;
  sourceFile: string;
  rows: SurveySectionRow[];
};

type SurveyScenario = {
  key: string;
  title: string;
  icon: string;
  count: number;
  pct: number;
  examples: Array<{ id: string; text: string; phase?: string; sourceLabel?: string }>;
};

type ChartRow = {
  label: string;
  count: number;
  pct: number;
  note?: string;
};

type SurveyPhaseFocus = {
  phase: string;
  sourceLabel: string;
  openTextCount: number;
  topWords: ChartRow[];
  topScenarios: ChartRow[];
};

type SurveyAgeFocus = {
  age: string;
  sampleSize: number;
  openTextCount: number;
  topWords: ChartRow[];
  topScenarios: ChartRow[];
};

type SurveyCharts = {
  topTerms: ChartRow[];
  scenarioDonut: ChartRow[];
  ageDistribution: ChartRow[];
  identityDistribution: ChartRow[];
  appFrequency: ChartRow[];
  aiUsage: ChartRow[];
  sourceOpenText: ChartRow[];
  tangledScenes: ChartRow[];
  painPointBars: ChartRow[];
  phaseFocus: SurveyPhaseFocus[];
  ageFocus: SurveyAgeFocus[];
};

type SurveySource = {
  phase: string;
  sourceLabel: string;
  fileName: string;
  encoding: string;
  sampleSize: number;
  openTextCount: number;
  columnCount: number;
  targetQuestion: string;
};

type SurveyInsights = {
  meta: {
    sampleSize: number;
    openTextCount: number;
    columnCount: number;
    sourceSnapshot: string;
    rawCsv: string;
    sourceEncoding: string;
    targetQuestion: string;
    generatedAt: string;
    importCommand: string;
    note: string;
    sources: SurveySource[];
  };
  hero: {
    eyebrow: string;
    title: string;
    emphasis: string;
    subtitle: string;
  };
  stats: SurveyStat[];
  insightCards: SurveyInsight[];
  words: CloudWord[];
  scenarios: SurveyScenario[];
  charts: SurveyCharts;
  sections: SurveySection[];
  examples: Array<{ id: string; text: string; phase?: string; sourceLabel?: string }>;
};

const SURVEY = surveyInsights as SurveyInsights;
const WORDS = SURVEY.words.slice(0, 64);

function wordKey(word: CloudWord, index: number) {
  return `${word.id}-${index}`;
}

type CloudNode = {
  el: HTMLButtonElement;
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  amp: number;
  sp: number;
};

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function wordClass(word: CloudWord) {
  return `cloud-word${word.c ? ` c-${word.c}` : ""}`;
}

function sourceBreakdownEntries(word: CloudWord) {
  return Object.entries(word.sourceBreakdown || {}).filter(([, count]) => count > 0);
}

function colorClass(index: number) {
  return ["green", "amber", "rose", "blue", "slate"][index % 5];
}

function formatPct(value: number) {
  return `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}%`;
}

function barWidth(row: ChartRow, rows: ChartRow[]) {
  const max = Math.max(1, ...rows.map((item) => item.count));
  return `${Math.max(6, Math.round((row.count / max) * 100))}%`;
}

function donutBackground(rows: ChartRow[]) {
  const colors = ["#2f7d5b", "#cf7f28", "#bb2947", "#2f68a3", "#718096"];
  let cursor = 0;
  const parts = rows.map((row, index) => {
    const start = cursor;
    const end = Math.min(100, cursor + row.pct);
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  if (cursor < 100) parts.push(`#e8f4ef ${cursor}% 100%`);
  return `conic-gradient(${parts.join(", ")})`;
}

function ChartBars({ rows, limit = 10 }: { rows: ChartRow[]; limit?: number }) {
  const visibleRows = rows.slice(0, limit);

  return (
    <div className="cd-chart-bars">
      {visibleRows.map((row, index) => (
        <div className={`cd-chart-bar c-${colorClass(index)}`} key={`${row.label}-${index}`}>
          <div className="lbl">
            <span>{row.label}</span>
            <b>{row.count} 条 · {formatPct(row.pct)}</b>
          </div>
          <div className="track">
            <span className="fill" style={{ width: barWidth(row, visibleRows) }} />
          </div>
          {row.note ? <small>{row.note}</small> : null}
        </div>
      ))}
    </div>
  );
}

function DonutChart({ rows }: { rows: ChartRow[] }) {
  return (
    <div className="cd-donut-wrap">
      <div className="cd-donut" style={{ background: donutBackground(rows) }}>
        <span>{rows.reduce((sum, row) => sum + row.count, 0)}</span>
        <small>条文本</small>
      </div>
      <div className="cd-donut-legend">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <i className={`c-${colorClass(index)}`} />
            <span>{row.label}</span>
            <b>{formatPct(row.pct)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SurveyWordCloud() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<CloudWord | null>(WORDS[0] ?? null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const rippleRef = useRef<HTMLSpanElement | null>(null);
  const wordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const nodesRef = useRef<CloudNode[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const topWords = useMemo(() => WORDS.slice().sort((a, b) => b.count - a.count).slice(0, 26), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutIds: number[] = [];

    const layout = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      if (!W || !H) return;

      const cx = W * 0.6;
      const cy = H * 0.53;
      const k = Math.max(0.76, Math.min(1.22, W / 1260));
      const sizes: Record<CloudWord["w"], number> = { 5: 78, 4: 58, 3: 42, 2: 31, 1: 23 };
      const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
      const intro = introRef.current;

      if (intro) {
        const ir = intro.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        placed.push({
          x: ir.left - sr.left + ir.width / 2,
          y: ir.top - sr.top + ir.height / 2,
          w: ir.width + 62,
          h: ir.height + 70
        });
      }

      const nodes: CloudNode[] = [];
      const list = WORDS
        .map((word, index) => ({ word, index }))
        .sort((a, b) => b.word.w - a.word.w || b.word.count - a.word.count);

      list.forEach(({ word, index }) => {
        const el = wordRefs.current[wordKey(word, index)];
        if (!el) return;

        el.classList.remove("show");
        el.style.fontSize = `${(sizes[word.w] * k).toFixed(1)}px`;

        const bw = el.offsetWidth;
        const bh = el.offsetHeight;
        let px = cx;
        let py = cy;
        let found = false;

        for (let t = 0; t < 2600; t += 0.16) {
          const r = 3.05 * t;
          const x = cx + r * Math.cos(t);
          const y = cy + r * Math.sin(t) * 0.66;

          if (x - bw / 2 < 18 || x + bw / 2 > W - 18 || y - bh / 2 < 82 || y + bh / 2 > H - 24) {
            continue;
          }

          const hit = placed.some((q) => (
            Math.abs(x - q.x) < (bw + q.w) / 2 + 10 &&
            Math.abs(y - q.y) < (bh + q.h) / 2 + 8
          ));

          if (!hit) {
            px = x;
            py = y;
            found = true;
            break;
          }
        }

        if (!found) {
          for (let tries = 0; tries < 100; tries += 1) {
            const x = rand(W * 0.18, W * 0.94);
            const y = rand(H * 0.16, H * 0.9);
            const hit = placed.some((q) => (
              Math.abs(x - q.x) < (bw + q.w) / 2 + 8 &&
              Math.abs(y - q.y) < (bh + q.h) / 2 + 7
            ));
            if (!hit) {
              px = x;
              py = y;
              break;
            }
          }
        }

        placed.push({ x: px, y: py, w: bw, h: bh });
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.transform = "translate(-50%,-50%)";

        timeoutIds.push(window.setTimeout(() => el.classList.add("show"), 30 + index * 14));
        nodes.push({
          el,
          hx: px,
          hy: py,
          x: px,
          y: py,
          vx: 0,
          vy: 0,
          ph: rand(0, 6.28),
          amp: rand(4, 10),
          sp: rand(0.38, 0.78)
        });
      });

      nodesRef.current = nodes;
    };

    const tick = (now: number) => {
      const t = now * 0.001;
      const mouse = mouseRef.current;

      nodesRef.current.forEach((node) => {
        const tx = node.hx + Math.sin(t * node.sp + node.ph) * node.amp;
        const ty = node.hy + Math.cos(t * node.sp * 0.9 + node.ph) * node.amp * 0.72;

        node.vx += (tx - node.x) * 0.02;
        node.vy += (ty - node.y) * 0.02;

        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const radius = 190;

          if (distance < radius) {
            const f = 1 - distance / radius;
            const push = f * f * 6.2;
            node.vx += (dx / distance) * push;
            node.vy += (dy / distance) * push;
          }
        }

        node.vx *= 0.88;
        node.vy *= 0.88;
        node.x += node.vx;
        node.y += node.vy;

        const ox = node.x - node.hx;
        const oy = node.y - node.hy;
        const rot = Math.max(-6, Math.min(6, node.vx * 0.72));
        node.el.style.transform = `translate(-50%,-50%) translate(${ox.toFixed(2)}px,${oy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
      });

      frameRef.current = window.requestAnimationFrame(tick);
    };

    const start = () => {
      layout();
      if (!reduceMotion) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const scheduleLayout = (delay = 120) => {
      timeoutIds.push(window.setTimeout(layout, delay));
    };

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    void fontReady.then(start);
    const fallbackTimer = window.setTimeout(start, 240);
    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 220);
    });
    resizeObserver.observe(stage);
    const pageRoot = stage.closest(".ey-page");
    const mutationObserver = new MutationObserver(() => scheduleLayout(140));
    if (pageRoot) mutationObserver.observe(pageRoot, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(resizeTimer);
      timeoutIds.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    mouseRef.current = { x, y, active: true };
    stage.classList.add("touch");
    rippleRef.current?.style.setProperty("transform", `translate(${x}px,${y}px)`);
  }

  function handlePointerLeave() {
    mouseRef.current = { x: -9999, y: -9999, active: false };
    stageRef.current?.classList.remove("touch");
  }

  function openDrawer(word?: CloudWord) {
    if (word) setSelectedWord(word);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <>
      <section className="cloud-section" id="design" aria-labelledby="cloud-title">
        <div
          className="cloud-stage"
          ref={stageRef}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
        >
          <span className="cloud-ripple" ref={rippleRef} />
          {WORDS.map((word, index) => {
            const key = wordKey(word, index);
            return (
            <button
              aria-label={`查看“${word.t}”调研数据`}
              className={wordClass(word)}
              data-w={word.w}
              key={key}
              onClick={() => openDrawer(word)}
              ref={(node) => {
                wordRefs.current[key] = node;
              }}
              type="button"
            >
              <span className="inner">
                <span className="tx">{word.t}</span>
              </span>
            </button>
            );
          })}
        </div>

        <div className="cloud-intro" ref={introRef}>
          <div className="sec-eyebrow">{SURVEY.hero.eyebrow}</div>
          <h2 className="cloud-title" id="cloud-title">
            {SURVEY.hero.title}
            <br />
            <em>{SURVEY.hero.emphasis}</em>
          </h2>
          <p className="cloud-sub">{SURVEY.hero.subtitle}</p>
        </div>

        <button className="cloud-handle" onClick={() => openDrawer()} type="button" aria-label="拉开调研数据">
          <span className="dot" />
          调研数据
        </button>
      </section>

      <div className={`cloud-scrim ${drawerOpen ? "open" : ""}`} onClick={closeDrawer} />
      <aside className={`cloud-drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen} aria-label="开放题词云调研数据">
        <div className="cd-head">
          <div>
            <div className="eyebrow">开放题原文词频 · Survey v1.1 + Phase 2</div>
            <h4>不总结，只看用户自己写下的词</h4>
          </div>
          <button className="cd-close" onClick={closeDrawer} type="button" aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="cd-stats">
          {SURVEY.stats.map((stat) => (
            <div className="cd-stat" key={stat.k}>
              <div className="v">{stat.v}</div>
              <div className="k">{stat.k}</div>
            </div>
          ))}
        </div>

        <div className="cd-body">
          {selectedWord ? (
            <div className="cd-selected">
              <div>
                <span>当前词条</span>
                <strong>{selectedWord.t}</strong>
              </div>
              <p>
                在两阶段开放题中命中 {selectedWord.count} 条，占开放文本 {selectedWord.pct}%。
                这里统计的是原文里直接出现这个词或短语的文本数量，不再把开放回答改写成产品概念。
              </p>
              <div className="cd-breakdown">
                {sourceBreakdownEntries(selectedWord).map(([source, count]) => (
                  <span key={source}>{source}: {count} 条</span>
                ))}
              </div>
              {selectedWord.example ? <blockquote>{selectedWord.example}</blockquote> : null}
            </div>
          ) : null}

          <div className="cd-section-h">数据图表</div>
          <div className="cd-dashboard">
            <div className="cd-chart-card wide">
              <div className="cd-chart-title">
                <strong>开放题原词 Top 20</strong>
                <span>来自两列开放题，按命中文本数排序</span>
              </div>
              <ChartBars rows={SURVEY.charts.topTerms} limit={14} />
            </div>

            <div className="cd-chart-card">
              <div className="cd-chart-title">
                <strong>主场景占比</strong>
                <span>用原词命中后取最高分场景</span>
              </div>
              <DonutChart rows={SURVEY.charts.scenarioDonut} />
            </div>

            <div className="cd-chart-card">
              <div className="cd-chart-title">
                <strong>年龄分布</strong>
                <span>两阶段有效样本合并</span>
              </div>
              <ChartBars rows={SURVEY.charts.ageDistribution} limit={8} />
            </div>

            <div className="cd-chart-card">
              <div className="cd-chart-title">
                <strong>身份分布</strong>
                <span>学生与工作人群样本结构</span>
              </div>
              <ChartBars rows={SURVEY.charts.identityDistribution} limit={8} />
            </div>

            <div className="cd-chart-card">
              <div className="cd-chart-title">
                <strong>本地生活 App 使用频率</strong>
                <span>判断用户是否高频遇到本地决策</span>
              </div>
              <ChartBars rows={SURVEY.charts.appFrequency} limit={8} />
            </div>

            <div className="cd-chart-card">
              <div className="cd-chart-title">
                <strong>决策痛点</strong>
                <span>问卷选择题，不混入均值/方差列</span>
              </div>
              <ChartBars rows={SURVEY.charts.painPointBars} limit={8} />
            </div>
          </div>

          <div className="cd-section-h">阶段与人群差异</div>
          <div className="cd-focus-grid">
            {SURVEY.charts.phaseFocus.map((item) => (
              <div className="cd-focus-card" key={`${item.phase}-${item.sourceLabel}`}>
                <div className="cd-focus-head">
                  <strong>{item.phase} · {item.sourceLabel}</strong>
                  <span>{item.openTextCount} 条开放文本</span>
                </div>
                <div className="cd-chip-row">
                  {item.topWords.slice(0, 8).map((row) => (
                    <span key={row.label}>{row.label}<b>{row.count}</b></span>
                  ))}
                </div>
                <ChartBars rows={item.topScenarios} limit={4} />
              </div>
            ))}
          </div>

          <div className="cd-age-grid">
            {SURVEY.charts.ageFocus.slice(0, 6).map((item) => (
              <div className="cd-age-card" key={item.age}>
                <div>
                  <strong>{item.age}</strong>
                  <span>{item.sampleSize} 份样本 / {item.openTextCount} 条文本</span>
                </div>
                <p>{item.topScenarios[0]?.label ?? "其他需求"}最集中，原词高频：{item.topWords.slice(0, 4).map((word) => word.label).join("、")}</p>
              </div>
            ))}
          </div>

          <div className="cd-section-h">关键洞察</div>
          <div className="cd-insights">
            {SURVEY.insightCards.map((item) => (
              <div className="cd-insight" key={item.title}>
                <div className="value">{item.value}</div>
                <h5>{item.title}</h5>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="cd-section-h">典型原始回答</div>
          <div className="cd-examples">
            {SURVEY.examples.slice(0, 10).map((item, index) => (
              <blockquote className="cd-example" key={`${item.id}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{item.text}</p>
                  {item.phase || item.sourceLabel ? (
                    <cite>{[item.phase, item.sourceLabel].filter(Boolean).join(" · ")}</cite>
                  ) : null}
                </div>
              </blockquote>
            ))}
          </div>

          <div className="cd-section-h">原词频权重明细</div>
          <div className="cd-legend">
            <span><i style={{ background: "var(--ey-emerald)" }} />普通高频词</span>
            <span><i style={{ background: "var(--ey-amber)" }} />预算 / 距离 / 时间 / 执行项</span>
            <span><i style={{ background: "var(--ey-rose)" }} />多人 / 忌口 / 风险项</span>
          </div>
          <div className="cd-bars">
            {topWords.map((word, index) => (
              <div
                className={`cd-bar${word.c ? ` c-${word.c}` : ""}${selectedWord?.id === word.id ? " active" : ""}`}
                key={wordKey(word, index)}
                onClick={() => setSelectedWord(word)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedWord(word);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="lbl">
                  <span className="t">{word.t}<small>{word.example || word.sourceCategory}</small></span>
                  <span className="n">{word.count} 条</span>
                </div>
                <div className="track">
                  <span className="fill" style={{ width: drawerOpen ? `${Math.min(100, Math.max(7, word.pct * 2.6))}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>

          <div className="cd-section-h">来源表预览</div>
          <div className="cd-source-grid">
            {SURVEY.sections.map((section) => (
              <div className="cd-source" key={section.key}>
                <div className="cd-source-title">
                  <strong>{section.title}</strong>
                  <code>{section.sourceFile}</code>
                </div>
                {section.rows.slice(0, 8).map((row, index) => (
                  <div className="cd-source-row" key={`${section.key}-${row.display}-${index}`}>
                    <span>{row.display}</span>
                    <b>{row.count} 条</b>
                    <i>{row.pct}%</i>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="cd-section-h">导入记录</div>
          <div className="cd-imports">
            {SURVEY.meta.sources.map((source) => (
              <div className="cd-import" key={source.fileName}>
                <strong>{source.phase} · {source.sourceLabel}</strong>
                <span>{source.openTextCount} 条开放文本 / {source.sampleSize} 份有效问卷</span>
                <code>{source.fileName}</code>
                <p>{source.targetQuestion}</p>
              </div>
            ))}
          </div>

          <div className="cd-note">
            数据源：<code>{SURVEY.meta.rawCsv}</code>，编码：<code>{SURVEY.meta.sourceEncoding}</code>。
            <div className="cd-command">{SURVEY.meta.importCommand}</div>
            {SURVEY.meta.note}
          </div>
        </div>
      </aside>
    </>
  );
}
