"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import surveyInsights from "@/data/survey/wordcloud-insights.json";

type CloudWord = {
  t: string;
  w: 1 | 2 | 3 | 4 | 5;
  pct: number;
  count: number;
  c?: "warn" | "hard";
  sourceCategory: string;
  sourceFile: string;
  sourceLabel: string;
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

type SurveyInsights = {
  meta: {
    sampleSize: number;
    columnCount: number;
    sourceSnapshot: string;
    rawCsv: string;
    sourceMetrics: string;
    note: string;
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
  sections: SurveySection[];
};

const SURVEY = surveyInsights as SurveyInsights;
const WORDS = SURVEY.words;

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

export function SurveyWordCloud() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<CloudWord | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const rippleRef = useRef<HTMLSpanElement | null>(null);
  const wordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const nodesRef = useRef<CloudNode[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const topWords = useMemo(() => WORDS.slice().sort((a, b) => b.pct - a.pct).slice(0, 18), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutIds: number[] = [];

    const layout = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      if (!W || !H) return;

      const cx = W / 2;
      const cy = H / 2;
      const k = Math.max(0.78, Math.min(1.22, W / 940));
      const sizes: Record<CloudWord["w"], number> = { 5: 50, 4: 37, 3: 28, 2: 20, 1: 16 };
      const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
      const intro = introRef.current;

      if (intro) {
        const ir = intro.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        placed.push({
          x: ir.left - sr.left + ir.width / 2,
          y: ir.top - sr.top + ir.height / 2,
          w: ir.width + 48,
          h: ir.height + 48
        });
      }

      const nodes: CloudNode[] = [];
      const list = WORDS.slice().sort((a, b) => b.w - a.w);

      list.forEach((word, index) => {
        const el = wordRefs.current[word.t];
        if (!el) return;

        el.classList.remove("show");
        el.style.fontSize = `${(sizes[word.w] * k).toFixed(1)}px`;

        const bw = el.offsetWidth;
        const bh = el.offsetHeight;
        let px = cx;
        let py = cy;

        for (let t = 0; t < 1400; t += 0.22) {
          const r = 3.6 * t;
          const x = cx + r * Math.cos(t);
          const y = cy + r * Math.sin(t) * 0.6;

          if (x - bw / 2 < 12 || x + bw / 2 > W - 12 || y - bh / 2 < 74 || y + bh / 2 > H - 16) {
            continue;
          }

          const hit = placed.some((q) => (
            Math.abs(x - q.x) < (bw + q.w) / 2 + 10 &&
            Math.abs(y - q.y) < (bh + q.h) / 2 + 8
          ));

          if (!hit) {
            px = x;
            py = y;
            break;
          }
        }

        placed.push({ x: px, y: py, w: bw, h: bh });
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.transform = "translate(-50%,-50%)";

        timeoutIds.push(window.setTimeout(() => el.classList.add("show"), 40 + index * 26));
        nodes.push({
          el,
          hx: px,
          hy: py,
          x: px,
          y: py,
          vx: 0,
          vy: 0,
          ph: rand(0, 6.28),
          amp: rand(5, 11),
          sp: rand(0.45, 0.85)
        });
      });

      nodesRef.current = nodes;
    };

    const tick = (now: number) => {
      const t = now * 0.001;
      const mouse = mouseRef.current;

      nodesRef.current.forEach((node) => {
        const tx = node.hx + Math.sin(t * node.sp + node.ph) * node.amp;
        const ty = node.hy + Math.cos(t * node.sp * 0.9 + node.ph) * node.amp * 0.78;

        node.vx += (tx - node.x) * 0.02;
        node.vy += (ty - node.y) * 0.02;

        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const radius = 185;

          if (distance < radius) {
            const f = 1 - distance / radius;
            const push = f * f * 6.4;
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
        const rot = Math.max(-7, Math.min(7, node.vx * 0.8));
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

    const onViewportChange = () => scheduleLayout(120);
    window.addEventListener("hashchange", onViewportChange);
    window.addEventListener("scroll", onViewportChange, { passive: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(resizeTimer);
      timeoutIds.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("hashchange", onViewportChange);
      window.removeEventListener("scroll", onViewportChange);
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
          {WORDS.map((word) => (
            <button
              aria-label={`查看“${word.t}”调研数据`}
              className={wordClass(word)}
              data-w={word.w}
              key={word.t}
              onClick={() => openDrawer(word)}
              ref={(node) => {
                wordRefs.current[word.t] = node;
              }}
              type="button"
            >
              <span className="inner">
                <span className="tx">{word.t}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="cloud-intro" ref={introRef}>
          <div className="sec-eyebrow">{SURVEY.hero.eyebrow}</div>
          <h2 className="cloud-title" id="cloud-title">
            {SURVEY.hero.title}<br /><em>{SURVEY.hero.emphasis}</em>
          </h2>
          <p className="cloud-sub">
            {SURVEY.hero.subtitle}
          </p>
        </div>

        <button className="cloud-handle" onClick={() => openDrawer()} type="button" aria-label="拉开调研数据">
          <span className="dot" />
          调研数据
        </button>
      </section>

      <div className={`cloud-scrim ${drawerOpen ? "open" : ""}`} onClick={closeDrawer} />
      <aside className={`cloud-drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen} aria-label="约饭调研数据">
        <div className="cd-head">
          <div>
            <div className="eyebrow">真实问卷汇总 · Survey Insights</div>
            <h4>词云来自哪几张表</h4>
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
                来源：{selectedWord.sourceCategory}，原始选项「{selectedWord.sourceLabel}」；
                {selectedWord.count} 人 / {selectedWord.pct}% 提到。
              </p>
              {selectedWord.example ? <blockquote>{selectedWord.example}</blockquote> : null}
            </div>
          ) : null}

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

          <div className="cd-section-h">词云权重</div>
          <div className="cd-legend">
            <span><i style={{ background: "var(--ey-emerald)" }} />协调 / 决策</span>
            <span><i style={{ background: "var(--ey-amber)" }} />时间 / 距离</span>
            <span><i style={{ background: "var(--ey-rose)" }} />硬约束 / 忌口</span>
          </div>
          <div className="cd-bars">
            {topWords.map((word) => (
              <div
                className={`cd-bar${word.c ? ` c-${word.c}` : ""}${selectedWord?.t === word.t ? " active" : ""}`}
                key={word.t}
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
                  <span className="t">{word.t}<small>{word.sourceCategory}</small></span>
                  <span className="n">{word.pct}%</span>
                </div>
                <div className="track">
                  <span className="fill" style={{ width: drawerOpen ? `${word.pct}%` : 0 }} />
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
                {section.rows.slice(0, 5).map((row) => (
                  <div className="cd-source-row" key={`${section.key}-${row.display}`}>
                    <span>{row.display}</span>
                    <b>{row.count} 人</b>
                    <i>{row.pct}%</i>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="cd-note">
            数据源：<code>{SURVEY.meta.rawCsv}</code> 经分析脚本生成聚合表，再由
            <code>analysis/scripts/export_wordcloud_data.mjs</code> 导出到前端。{SURVEY.meta.note}
          </div>
        </div>
      </aside>
    </>
  );
}
