"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ThemeNavPicker, ThemePipPicker } from "@/components/SiteThemeProvider";
import { SurveyWordCloud } from "@/components/SurveyWordCloud";
import { TechRouteSelfCheck, TechRouteShowcase } from "@/components/TechRouteShowcase";
import { PainEvidenceChain } from "@/components/PainEvidenceChain";
import { FutureSection } from "@/components/FutureSection";
import { GroupDecisionMechanismSection } from "@/components/design/GroupDecisionMechanismSection";
import "./ey-design.css";
import "./tech-route.css";
import "./pain-chain.css";
import "./future-section.css";

const DataSandboxSection = dynamic(
  () =>
    import("@/components/design/DataSandboxSection/DataSandboxSection").then(
      (mod) => mod.DataSandboxSection
    ),
  { ssr: false }
);

const quadrants = [
  {
    id: "q1",
    number: "01",
    href: "https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler",
    eyebrow: "CODE · 看代码",
    title: "GitHub 仓库",
    desc: "完整源码、issue 推进记录与比赛交付分支，工程过程全公开。",
    cta: "访问仓库",
    external: true,
    icon: "code"
  },
  {
    id: "q2",
    number: "02",
    href: "#design",
    eyebrow: "DESIGN · 读方案",
    title: "设计与思路",
    desc: "从调研证据、痛点拆解，到技术路线、系统架构与未来展望。",
    cta: "查看文档",
    icon: "doc"
  },
  {
    id: "q3",
    number: "03",
    href: "#video",
    eyebrow: "VIDEO · 看实机",
    title: "演示视频",
    desc: "小程序实机录屏：偏好权重确认、冲突识别、推荐生成全流程。",
    cta: "播放视频",
    icon: "play"
  },
  {
    id: "q4",
    number: "04",
    href: "/experience",
    eyebrow: "LIVE · 去上手",
    title: "在线体验",
    desc: "浏览器内直接体验核心功能，无需微信登录，评审即点即用。",
    cta: "开始体验",
    icon: "spark",
    primary: true
  }
];

const architectureLayers = [
  ["L1", "体验层", "微信小程序与 Web 体验并行。Web 版复刻小程序流程，用 demo session 替代 wx.login。"],
  ["L2", "服务层", "Next.js App Router 同时承载作品页、在线体验页面与 API routes。"],
  ["L3", "AI 管家层", "OpenClaw 负责单人推荐与动态追问；不可用时降级到本地推荐，保证评审流程不断。"],
  ["L4", "数据层", "任务、登录 session、周边规划写入服务端 JSON store；浏览器本地保留记忆、收藏与草稿。"]
];

const realDeviceVideos = [
  {
    label: "实机 01",
    title: "今天吃什么",
    src: "/videos/food-real-device.mp4",
    desc: "从场景、预算、距离和口味偏好出发，展示 AI 管家生成 2-3 个餐厅推荐，并在 OpenClaw 不稳定时保留本地兜底。"
  },
  {
    label: "实机 02",
    title: "多人约饭",
    src: "/videos/group-real-device.mp4",
    desc: "展示发起约饭、成员填写偏好、后端同步状态、冲突识别和生成推荐方案的完整小程序链路。"
  },
  {
    label: "实机 03",
    title: "周边规划",
    src: "/videos/nearby-real-device.mp4",
    desc: "输入出行时间、预算、起点和兴趣后，结合真实天气与周边 mock POI 生成路线、自检项和风险提示。"
  }
];

function Icon({ name, size = 28 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (name === "code") return <svg {...common}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="13.5" y1="4" x2="10.5" y2="20" /></svg>;
  if (name === "doc") return <svg {...common}><path d="M9 2.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6.5 2.5z" /><path d="M14 2.5V7h4.5" /><line x1="8.5" y1="12" x2="15.5" y2="12" /><line x1="8.5" y1="16" x2="13" y2="16" /></svg>;
  if (name === "play") return <svg {...common}><rect x="2.5" y="4.5" width="19" height="15" rx="3" /><polygon points="10 9 15 12 10 15" fill="currentColor" stroke="none" /></svg>;
  if (name === "spark") return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>;
  if (name === "warn") return <svg {...common}><path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "route") return <svg {...common}><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>;
  return <svg {...common}><path d="M3 11.5h18" /><path d="M4 11.5a8 8 0 0 0 16 0" /><path d="M9.5 4.2c-.7 1 .7 1.8 0 2.8M14 3.4c-.8 1.1.8 1.9 0 3" /></svg>;
}

function Seal({ size = 32 }: { size?: number }) {
  return <Icon name="bowl" size={size} />;
}

export default function PortfolioHomePage() {
  const [siteOpen, setSiteOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".ey-page .topnav");
    const setPad = () => document.documentElement.style.setProperty("scroll-padding-top", `${nav?.offsetHeight || 72}px`);
    setPad();
    window.addEventListener("resize", setPad);
    return () => {
      window.removeEventListener("resize", setPad);
      document.documentElement.style.removeProperty("scroll-padding-top");
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#top") return;

    setSiteOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
  }, []);

  useEffect(() => {
    const revealed = Array.from(document.querySelectorAll<HTMLElement>(".ey-page .reveal"));
    if (!siteOpen) {
      revealed.forEach((item) => item.classList.remove("in"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.14 });
    revealed.forEach((item) => observer.observe(item));

    const revealHashTarget = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;
      if (target.classList.contains("reveal")) target.classList.add("in");
      target.querySelectorAll<HTMLElement>(".reveal").forEach((item) => item.classList.add("in"));
    };

    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
    return () => {
      window.removeEventListener("hashchange", revealHashTarget);
      observer.disconnect();
    };
  }, [siteOpen]);

  useEffect(() => {
    const hub = hubRef.current;
    if (!hub) return;

    let target = { x: 0, y: 0, rx: 0, ry: 0, s: 1 };
    const current = { x: 0, y: 0, rx: 0, ry: 0, s: 1 };
    const spots: Record<string, typeof target> = {
      q1: { x: -26, y: -20, ry: -7, rx: 7, s: 0.93 },
      q2: { x: 26, y: -20, ry: 7, rx: 7, s: 0.93 },
      q3: { x: -26, y: 20, ry: -7, rx: -7, s: 0.93 },
      q4: { x: 26, y: 20, ry: 7, rx: -7, s: 0.93 }
    };
    const home = () => { target = { x: 0, y: 0, rx: 0, ry: 0, s: 1 }; };
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    let leaveTimer = 0;
    let frame = 0;

    const quads = Array.from(document.querySelectorAll<HTMLElement>(".ey-page .quad"));
    const cleanups = quads.map((quad) => {
      const key = quad.classList.contains("q1") ? "q1" : quad.classList.contains("q2") ? "q2" : quad.classList.contains("q3") ? "q3" : "q4";
      const onMove = (event: PointerEvent) => {
        const rect = quad.getBoundingClientRect();
        quad.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        quad.style.setProperty("--my", `${event.clientY - rect.top}px`);
      };
      const onEnter = () => {
        window.clearTimeout(leaveTimer);
        target = { ...spots[key] };
      };
      const onLeave = () => {
        window.clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(home, 60);
      };
      quad.addEventListener("pointermove", onMove);
      quad.addEventListener("pointerenter", onEnter);
      quad.addEventListener("pointerleave", onLeave);
      return () => {
        quad.removeEventListener("pointermove", onMove);
        quad.removeEventListener("pointerenter", onEnter);
        quad.removeEventListener("pointerleave", onLeave);
      };
    });

    const tick = () => {
      current.x = lerp(current.x, target.x, 0.14);
      current.y = lerp(current.y, target.y, 0.14);
      current.rx = lerp(current.rx, target.rx, 0.14);
      current.ry = lerp(current.ry, target.ry, 0.14);
      current.s = lerp(current.s, target.s, 0.16);
      hub.style.transform = `translate(-50%,-50%) translate3d(${current.x.toFixed(2)}px,${current.y.toFixed(2)}px,0) rotateX(${current.rx.toFixed(2)}deg) rotateY(${current.ry.toFixed(2)}deg) scale(${current.s.toFixed(3)})`;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("blur", home);
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      window.clearTimeout(leaveTimer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("blur", home);
    };
  }, []);

  function enterSite(hash?: string) {
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    setSiteOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (hash) document.querySelector(hash)?.scrollIntoView({ behavior, block: "start" });
        else window.scrollTo({ top: 0, behavior });
      });
    });
  }

  function returnToStage(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "auto" });
    setSiteOpen(false);
  }

  function handleInternalLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    enterSite(href);
  }

  return (
    <main className={`ey ey-page ${siteOpen ? "in-site" : ""}`}>
      <header className={`topnav ${siteOpen ? "show" : ""}`} id="topnav">
        <a className="brand" href="#top" onClick={returnToStage}>
          <span className="mini"><Seal size={18} /></span>
          饿了幺
        </a>
        <nav aria-label="作品站导航">
          <a href="#design" onClick={(event) => handleInternalLink(event, "#design")}>设计与思路</a>
          <a href="#route" onClick={(event) => handleInternalLink(event, "#route")}>技术路线</a>
          <a href="#future" onClick={(event) => handleInternalLink(event, "#future")}>未来展望</a>
          <a href="#video" onClick={(event) => handleInternalLink(event, "#video")}>演示视频</a>
          <a href="https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="nav-right">
          <ThemeNavPicker />
          <a className="nav-cta" href="/experience">开始体验 →</a>
        </div>
      </header>

      <div className={`stage ${siteOpen ? "gone" : ""}`} id="top" aria-hidden={siteOpen}>
        <div className="grid">
          {quadrants.map((item) => (
            <a
              className={`quad ${item.id}`}
              data-screen-label={item.title}
              href={item.href}
              key={item.id}
              onClick={item.href.startsWith("#") ? (event) => handleInternalLink(event, item.href) : undefined}
              rel={item.external ? "noreferrer" : undefined}
              target={item.external ? "_blank" : undefined}
            >
              <span className="num">{item.number}</span>
              <span className="content">
                <span className="ico"><Icon name={item.icon} size={30} /></span>
                <span className="eyebrow2">{item.eyebrow}</span>
                <span className="quad-title">{item.title}</span>
                <span className="quad-desc">{item.desc}</span>
                {item.primary ? <span className="tag-primary"><span className="dot" />主入口</span> : null}
                <span className="enter">{item.cta} <i>→</i></span>
              </span>
            </a>
          ))}
        </div>

        <div className="hub" ref={hubRef}>
          <span className="halo" />
          <div className="core">
            <div className="seal"><Seal size={32} /></div>
            <div className="name">饿了幺</div>
            <div className="role">作品导览</div>
          </div>
        </div>

        <div className="hero-toprow">
          <div className="toppill"><span>美团 OpenClaw</span><span className="sep">·</span><span>全天候私人管家赛道</span></div>
          <ThemePipPicker />
        </div>
        <div className="meta meta-bottom"><span className="pulse" /><span>最终提交作品 · 点任意象限进入 · 电脑端体验更佳</span></div>
      </div>

      <SurveyWordCloud />

      <section className="section section--paper design-pain-section" id="pain">
        <div className="pain-constellation" aria-hidden="true">
          <svg viewBox="0 0 430 250" role="presentation">
            <g className="pain-constellation__glow">
              <circle cx="342" cy="52" r="38" />
              <circle cx="218" cy="119" r="25" />
              <circle cx="391" cy="182" r="29" />
            </g>
            <g className="pain-constellation__lines">
              <path d="M78 74 151 40 218 119 297 88 342 52 391 182 314 205 247 169 174 202" />
              <path d="M218 119 247 169 314 205" />
              <path d="M151 40 109 144 174 202" />
            </g>
            <g className="pain-constellation__stars">
              <circle cx="78" cy="74" r="3.4" />
              <circle cx="151" cy="40" r="4.6" />
              <circle cx="218" cy="119" r="3.8" />
              <circle cx="297" cy="88" r="3" />
              <circle cx="342" cy="52" r="5.2" />
              <circle cx="391" cy="182" r="4.1" />
              <circle cx="314" cy="205" r="3.1" />
              <circle cx="247" cy="169" r="3.6" />
              <circle cx="174" cy="202" r="2.8" />
              <circle cx="109" cy="144" r="3.3" />
            </g>
            <g className="pain-constellation__specks">
              <circle cx="52" cy="123" r="1.8" />
              <circle cx="126" cy="92" r="1.4" />
              <circle cx="184" cy="67" r="1.7" />
              <circle cx="266" cy="46" r="1.5" />
              <circle cx="371" cy="105" r="1.9" />
              <circle cx="351" cy="160" r="1.3" />
              <circle cx="282" cy="225" r="1.6" />
              <circle cx="202" cy="230" r="1.4" />
            </g>
          </svg>
        </div>
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">设计与思路 · 核心痛点</div>
            <h2 className="sec-title">真实调研之后，<br />我们发现用户累在这五个瞬间</h2>
            <p className="sec-lead">不是选择少，而是筛选、协调、验证、变更和重复输入都要自己来。</p>
          </div>
          <PainEvidenceChain />
        </div>
      </section>

      <GroupDecisionMechanismSection />
      <DataSandboxSection />

      <section className="section section--paper" id="route">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">设计与思路 · 技术路线</div>
            <h2 className="sec-title">三个功能，<br />一条会自检的执行链路</h2>
            <p className="sec-lead">把每个功能拆成稳定的 输入 → 处理 → 输出：先收集约束，再结合本地候选池、OpenClaw 理解与规则自检，最后给出可执行方案和兜底边界。三种框架视图可切换看，点任意节点展开细节。</p>
          </div>
          <TechRouteShowcase />
        </div>
      </section>

      <section className="section section--paper arch-section" id="arch">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">设计与思路 · 技术架构</div>
            <h2 className="sec-title">四层协作，<br />一个 Next.js 服务承载</h2>
            <p className="sec-lead">Web 作品页是面向评审的可访问镜像：保持产品能力一致，复用现有后端链路，用浏览器友好的身份、路由与存储承载完整体验。</p>
          </div>
          <div className="layers reveal">
            {architectureLayers.map(([ix, title, desc]) => <div className="layer" key={ix}><div className="ix">{ix}</div><h3>{title}</h3><p>{desc}</p></div>)}
          </div>
          <div className="arch-selfcheck reveal d1">
            <div className="sec-eyebrow" style={{ marginBottom: 8 }}>设计与思路 · 自检评测闭环</div>
            <p className="sec-lead" style={{ margin: "0 0 24px", maxWidth: "56ch" }}>把命题 02 的评测思想嵌进管家每一次回答：输出前先逐项审计，不合格就修正或追问。七项检查 × 对应动作，构成「计划前—计划中—计划后—下一次」的闭环。</p>
            <TechRouteSelfCheck />
          </div>
        </div>
      </section>

      <FutureSection />

      <section className="section section--paper" id="video">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">演示视频 · Demo Video</div>
            <h2 className="sec-title">小程序实机录屏</h2>
            <p className="sec-lead">三段真机录屏分别覆盖单人吃饭、多人约饭和周边规划，证明核心场景不是纸面方案，而是真的能在小程序里跑起来。</p>
          </div>
          <div className="video-grid reveal">
            {realDeviceVideos.map((video, index) => (
              <article className={`video-card reveal d${index + 1}`} key={video.src}>
                <div className="video-frame">
                  <span className="vtag">{video.label}</span>
                  <video className="video-embed" controls playsInline preload="metadata" src={video.src}>
                    你的浏览器不支持直接播放该实机录屏。
                  </video>
                </div>
                <div className="video-copy">
                  <div className="sn">{video.label}</div>
                  <h3>{video.title}</h3>
                  <p>{video.desc}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="story">
            {[
              ["能力 01", "单人偏好收敛", "把“想吃什么”拆成场景、预算、距离、口味和忌口，给出可执行餐厅方案。"],
              ["能力 02", "多人状态同步", "成员通过同一任务链接提交偏好，后端保存共享状态并识别约束冲突。"],
              ["能力 03", "天气与路线自检", "周边规划会结合天气、预算、时间窗口和步行强度，给出风险提示与备选路线。"]
            ].map(([num, title, desc], index) => <div className={`shot reveal d${index + 1}`} key={num}><div className="sn">{num}</div><h3>{title}</h3><p>{desc}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section section--forest cta-final" id="cta">
        <div className="container">
          <div className="reveal">
            <div className="sec-eyebrow">在线体验 · Try It Live</div>
            <h2 className="sec-title">不用装微信，<br />浏览器里直接上手</h2>
            <p className="sec-lead">用一个 demo 身份进入，完整体验今天吃什么、多人约饭、周边规划与管家记忆。</p>
            <div className="btns">
              <a className="btn-lg btn-primary" href="/experience">开始在线体验 →</a>
              <a className="btn-lg btn-ghost" href="https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler" target="_blank" rel="noreferrer">查看 GitHub 仓库</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="fbrand"><span className="mini"><Seal size={16} /></span>饿了幺 · 全天候私人管家</div>
        <div>美团 OpenClaw 赛道 · 最终提交作品 · 2026</div>
        <div className="footer-links"><a href="https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler" target="_blank" rel="noreferrer">GitHub</a><a href="#route" onClick={(event) => handleInternalLink(event, "#route")}>技术路线</a><a href="/experience">在线体验</a></div>
      </footer>
    </main>
  );
}
