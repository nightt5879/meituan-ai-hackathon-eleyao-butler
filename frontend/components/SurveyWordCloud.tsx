"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type SurveyWord = {
  text: string;
  weight: 1 | 2 | 3 | 4 | 5;
  percent: number;
  tone?: "warn" | "hard";
};

const surveyWords: SurveyWord[] = [
  { text: "都说随便", weight: 5, percent: 72 },
  { text: "没人定地方", weight: 5, percent: 65 },
  { text: "众口难调", weight: 4, percent: 58 },
  { text: "时间凑不齐", weight: 4, percent: 55, tone: "warn" },
  { text: "选择困难", weight: 4, percent: 52 },
  { text: "没人拍板", weight: 4, percent: 50 },
  { text: "临时放鸽子", weight: 4, percent: 47, tone: "hard" },
  { text: "排队太久", weight: 3, percent: 44, tone: "warn" },
  { text: "有人不吃辣", weight: 3, percent: 41, tone: "hard" },
  { text: "太远懒得去", weight: 3, percent: 40, tone: "warn" },
  { text: "找店花时间", weight: 3, percent: 39, tone: "warn" },
  { text: "预算难开口", weight: 3, percent: 38 },
  { text: "群里没人回", weight: 3, percent: 36 },
  { text: "怕踩雷", weight: 3, percent: 34 },
  { text: "AA 算账麻烦", weight: 2, percent: 31 },
  { text: "等人迟到", weight: 2, percent: 30, tone: "warn" },
  { text: "改来改去", weight: 2, percent: 29 },
  { text: "忌口太多", weight: 2, percent: 27, tone: "hard" },
  { text: "人多难协调", weight: 2, percent: 26 },
  { text: "想去的店没位", weight: 2, percent: 24, tone: "warn" },
  { text: "谁付钱尴尬", weight: 2, percent: 22 },
  { text: "减肥又想吃", weight: 1, percent: 18 }
];

const surveyStats = [
  { value: "128", label: "mock 问卷" },
  { value: "3.2", label: "人均提及" },
  { value: "22", label: "归类标签" }
];

type CloudNode = {
  element: HTMLButtonElement;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  amplitude: number;
  speed: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function toneClass(tone?: SurveyWord["tone"]) {
  if (tone === "warn") return "is-warn";
  if (tone === "hard") return "is-hard";
  return "is-main";
}

function fontSizeFor(weight: SurveyWord["weight"]) {
  const sizes: Record<SurveyWord["weight"], number> = {
    5: 48,
    4: 36,
    3: 27,
    2: 20,
    1: 16
  };
  return sizes[weight];
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
  const topWords = useMemo(() => surveyWords.slice().sort((a, b) => b.percent - a.percent).slice(0, 14), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const layout = () => {
      const rect = stage.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (!width || !height) return;

      const centerX = width * 0.58;
      const centerY = height * 0.52;
      const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
      const intro = introRef.current;

      if (intro) {
        const introRect = intro.getBoundingClientRect();
        placed.push({
          x: introRect.left - rect.left + introRect.width / 2,
          y: introRect.top - rect.top + introRect.height / 2,
          w: introRect.width + 58,
          h: introRect.height + 54
        });
      }

      const scale = Math.max(0.78, Math.min(1.14, width / 980));
      const nodes: CloudNode[] = [];
      const sorted = surveyWords.slice().sort((a, b) => b.weight - a.weight || b.percent - a.percent);

      sorted.forEach((word, index) => {
        const element = wordRefs.current[word.text];
        if (!element) return;

        element.style.fontSize = `${(fontSizeFor(word.weight) * scale).toFixed(1)}px`;
        const boxWidth = element.offsetWidth;
        const boxHeight = element.offsetHeight;
        let x = centerX;
        let y = centerY;

        for (let t = 0; t < 1400; t += 0.22) {
          const radius = 3.8 * t;
          const candidateX = centerX + radius * Math.cos(t);
          const candidateY = centerY + radius * Math.sin(t) * 0.62;

          if (
            candidateX - boxWidth / 2 < 18 ||
            candidateX + boxWidth / 2 > width - 18 ||
            candidateY - boxHeight / 2 < 34 ||
            candidateY + boxHeight / 2 > height - 28
          ) {
            continue;
          }

          const overlaps = placed.some((item) => (
            Math.abs(candidateX - item.x) < (boxWidth + item.w) / 2 + 12 &&
            Math.abs(candidateY - item.y) < (boxHeight + item.h) / 2 + 9
          ));

          if (!overlaps) {
            x = candidateX;
            y = candidateY;
            break;
          }
        }

        placed.push({ x, y, w: boxWidth, h: boxHeight });
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        window.setTimeout(() => element.classList.add("is-visible"), 50 + index * 22);

        nodes.push({
          element,
          homeX: x,
          homeY: y,
          x,
          y,
          vx: 0,
          vy: 0,
          phase: randomBetween(0, Math.PI * 2),
          amplitude: randomBetween(4, 10),
          speed: randomBetween(0.42, 0.82)
        });
      });

      nodesRef.current = nodes;
    };

    const tick = (timestamp: number) => {
      const seconds = timestamp * 0.001;
      const mouse = mouseRef.current;

      nodesRef.current.forEach((node) => {
        const targetX = node.homeX + Math.sin(seconds * node.speed + node.phase) * node.amplitude;
        const targetY = node.homeY + Math.cos(seconds * node.speed * 0.9 + node.phase) * node.amplitude * 0.78;

        node.vx += (targetX - node.x) * 0.022;
        node.vy += (targetY - node.y) * 0.022;

        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const radius = 178;

          if (distance < radius) {
            const force = 1 - distance / radius;
            const push = force * force * 6;
            node.vx += (dx / distance) * push;
            node.vy += (dy / distance) * push;
          }
        }

        node.vx *= 0.88;
        node.vy *= 0.88;
        node.x += node.vx;
        node.y += node.vy;

        const offsetX = node.x - node.homeX;
        const offsetY = node.y - node.homeY;
        const rotation = Math.max(-7, Math.min(7, node.vx * 0.8));
        node.element.style.transform = `translate(-50%,-50%) translate(${offsetX.toFixed(2)}px,${offsetY.toFixed(2)}px) rotate(${rotation.toFixed(2)}deg)`;
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
    const fallbackTimer = window.setTimeout(start, 260);
    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 180);
    });
    resizeObserver.observe(stage);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(resizeTimer);
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
    rippleRef.current?.style.setProperty("transform", `translate(${x}px, ${y}px)`);
    stage.classList.add("is-touching");
  }

  function handlePointerLeave() {
    mouseRef.current = { x: -9999, y: -9999, active: false };
    stageRef.current?.classList.remove("is-touching");
  }

  return (
    <>
      <section className="survey-cloud-section reveal" aria-labelledby="survey-cloud-title">
        <div
          className="survey-cloud-stage"
          ref={stageRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <span className="survey-cloud-ripple" ref={rippleRef} />
          {surveyWords.map((word) => (
            <button
              aria-label={`查看“${word.text}”调研数据`}
              className={`survey-cloud-word ${toneClass(word.tone)}`}
              data-weight={word.weight}
              key={word.text}
              onClick={() => setDrawerOpen(true)}
              ref={(node) => { wordRefs.current[word.text] = node; }}
              type="button"
            >
              <span>{word.text}</span>
            </button>
          ))}
        </div>

        <div className="survey-cloud-intro" ref={introRef}>
          <div className="sec-eyebrow">用户调研 · Mock Word Cloud</div>
          <h2 className="survey-cloud-title" id="survey-cloud-title">
            约饭最烦的，<br />到底是哪件事？
          </h2>
          <p className="survey-cloud-sub">
            先用 mock 高频词模拟开放问卷结果。字越大表示越多人提到；颜色区分协调决策、时间距离和硬约束忌口。
          </p>
        </div>

        <button className="survey-cloud-handle" onClick={() => setDrawerOpen(true)} type="button">
          <span className="dot" />
          调研数据
        </button>
      </section>

      <div className={`survey-cloud-scrim ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`survey-cloud-drawer ${drawerOpen ? "is-open" : ""}`} aria-hidden={!drawerOpen} aria-label="用户调研数据预览">
        <div className="survey-drawer-head">
          <div>
            <div className="sec-eyebrow">开放题汇总 · Survey Preview</div>
            <h3>约饭最烦的 14 件事</h3>
          </div>
          <button className="survey-drawer-close" onClick={() => setDrawerOpen(false)} type="button" aria-label="关闭调研数据">
            ×
          </button>
        </div>

        <div className="survey-drawer-stats">
          {surveyStats.map((item) => (
            <div className="survey-drawer-stat" key={item.label}>
              <div className="value">{item.value}</div>
              <div className="label">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="survey-drawer-body">
          <div className="survey-drawer-section-title">被提到最多的烦恼</div>
          <div className="survey-drawer-legend">
            <span><i className="main" />协调 / 决策</span>
            <span><i className="warn" />时间 / 距离</span>
            <span><i className="hard" />硬约束 / 忌口</span>
          </div>

          <div className="survey-bars">
            {topWords.map((word) => (
              <div className={`survey-bar ${toneClass(word.tone)}`} key={word.text}>
                <div className="survey-bar-label">
                  <span>{word.text}</span>
                  <strong>{word.percent}%</strong>
                </div>
                <div className="survey-bar-track">
                  <span style={{ width: drawerOpen ? `${word.percent}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>

          <div className="survey-drawer-note">
            这里暂时是 mock 数据。后续把真实问卷或本地分析工具产出的词频结果替换到同一份数据结构，词云和条形图会同步更新。
          </div>
        </div>
      </aside>
    </>
  );
}
