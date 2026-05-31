"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type CloudWord = {
  t: string;
  w: 1 | 2 | 3 | 4 | 5;
  pct: number;
  c?: "warn" | "hard";
};

const WORDS: CloudWord[] = [
  { t: '都说"随便"', w: 5, pct: 72 },
  { t: "没人定地方", w: 5, pct: 65 },
  { t: "众口难调", w: 4, pct: 58 },
  { t: "没人拍板", w: 4, pct: 50 },
  { t: "选择困难", w: 4, pct: 52 },
  { t: "时间凑不齐", w: 4, pct: 55, c: "warn" },
  { t: "临时放鸽子", w: 4, pct: 47, c: "hard" },
  { t: "有人不吃辣", w: 3, pct: 41, c: "hard" },
  { t: "排队太久", w: 3, pct: 44, c: "warn" },
  { t: "太远懒得去", w: 3, pct: 40, c: "warn" },
  { t: "找店花时间", w: 3, pct: 39, c: "warn" },
  { t: "预算难开口", w: 3, pct: 38 },
  { t: "怕踩雷", w: 3, pct: 34 },
  { t: "群里没人回", w: 3, pct: 36 },
  { t: "AA算账麻烦", w: 2, pct: 31 },
  { t: "等人迟到", w: 2, pct: 30, c: "warn" },
  { t: "改来改去", w: 2, pct: 29 },
  { t: "忌口太多", w: 2, pct: 27, c: "hard" },
  { t: "人多难协调", w: 2, pct: 26 },
  { t: "想去的店没位", w: 2, pct: 24, c: "warn" },
  { t: "谁付钱尴尬", w: 2, pct: 22 },
  { t: "减肥又想吃", w: 1, pct: 18 }
];

const STATS = [
  { v: "128", k: "有效问卷" },
  { v: "3.2", k: "人均提到 / 条" },
  { v: "22", k: "归类标签" }
];

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const rippleRef = useRef<HTMLSpanElement | null>(null);
  const wordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const nodesRef = useRef<CloudNode[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const topWords = useMemo(() => WORDS.slice().sort((a, b) => b.pct - a.pct).slice(0, 14), []);

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

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    void fontReady.then(start);
    const fallbackTimer = window.setTimeout(start, 240);
    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 220);
    });
    resizeObserver.observe(stage);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(resizeTimer);
      timeoutIds.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
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

  function openDrawer() {
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
              onClick={openDrawer}
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
          <div className="sec-eyebrow">设计与思路 · 用户调研</div>
          <h2 className="cloud-title" id="cloud-title">
            约饭，最让你烦的<br />是<em>哪件事</em>？
          </h2>
          <p className="cloud-sub">
            128 份开放问卷里，大家自己写下的原话。字越大 = 越多人提到；鼠标滑过水面，把它们推开。
          </p>
        </div>

        <button className="cloud-handle" onClick={openDrawer} type="button" aria-label="拉开调研数据">
          <span className="dot" />
          调研数据
        </button>
      </section>

      <div className={`cloud-scrim ${drawerOpen ? "open" : ""}`} onClick={closeDrawer} />
      <aside className={`cloud-drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen} aria-label="约饭调研数据">
        <div className="cd-head">
          <div>
            <div className="eyebrow">开放题汇总 · Survey Insights</div>
            <h4>约饭最烦的 14 件事</h4>
          </div>
          <button className="cd-close" onClick={closeDrawer} type="button" aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="cd-stats">
          {STATS.map((stat) => (
            <div className="cd-stat" key={stat.k}>
              <div className="v">{stat.v}</div>
              <div className="k">{stat.k}</div>
            </div>
          ))}
        </div>

        <div className="cd-body">
          <div className="cd-section-h">被提到最多的烦恼</div>
          <div className="cd-legend">
            <span><i style={{ background: "var(--ey-emerald)" }} />协调 / 决策</span>
            <span><i style={{ background: "var(--ey-amber)" }} />时间 / 距离</span>
            <span><i style={{ background: "var(--ey-rose)" }} />硬约束 / 忌口</span>
          </div>
          <div>
            {topWords.map((word) => (
              <div className={`cd-bar${word.c ? ` c-${word.c}` : ""}`} key={word.t}>
                <div className="lbl">
                  <span className="t">{word.t}</span>
                  <span className="n">{word.pct}%</span>
                </div>
                <div className="track">
                  <span className="fill" style={{ width: drawerOpen ? `${word.pct}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="cd-note">
            把真实问卷的标签与占比替换进同一份 <code>WORDS</code> 数据结构即可，词云与图表会自动同步。
          </div>
        </div>
      </aside>
    </>
  );
}
