"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ThemeNavPicker, ThemePipPicker } from "@/components/SiteThemeProvider";
import { SurveyWordCloud } from "@/components/SurveyWordCloud";
import "./ey-design.css";

const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "";

const quadrants = [
  {
    id: "q1",
    number: "01",
    href: "https://github.com/nightt5879/meituan_prj",
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
    desc: "选题推演、用户研究，到自检评测闭环与多人协同的完整设计。",
    cta: "查看文档",
    icon: "doc"
  },
  {
    id: "q3",
    number: "03",
    href: "#video",
    eyebrow: "VIDEO · 看实机",
    title: "演示视频",
    desc: "小程序实机录屏：偏好确认、冲突识别、推荐生成全流程。",
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

const painPoints = [
  {
    tag: "痛点 01",
    title: "工具很多，缺一个“管事的入口”",
    desc: "美团、点评、地图、微信、小红书来回切，信息都在，却还得自己比较、筛选、协调和拍板。",
    icon: "layers"
  },
  {
    tag: "痛点 02",
    title: "AI 说得像真的，却不一定靠谱",
    desc: "忘预算、忘忌口、路线不现实、信息不足也硬生成。看着漂亮，真去执行就踩坑。",
    icon: "warn"
  },
  {
    tag: "痛点 03",
    title: "多人场景高频，却是现有产品的弱点",
    desc: "难的不是找店，是每个人都有不能违反的限制：不吃辣、赶时间、预算紧，很难有人折中。",
    icon: "users"
  }
];

const innovations = [
  {
    tag: "创新点 01",
    title: "自检评测闭环",
    desc: "生成方案前，先像审计员一样逐项检查预算、忌口、时间、距离、氛围、公平性、可执行性。不合格就自动修正或追问，再输出。",
    icon: "shield"
  },
  {
    tag: "创新点 02",
    title: "多人协同决策",
    desc: "抽取每个人的硬约束与软偏好，明确指出冲突在哪里，生成几个折中方案；用最低个人满意度而不只是平均分来排序。",
    icon: "route"
  }
];

const flowSteps = [
  ["1", "发起任务", "明晚三人，人均≤100，适合聊天"],
  ["2", "成员偏好", "各自补充口味、预算、时间"],
  ["3", "冲突识别", "拆出硬约束与软偏好"],
  ["4", "候选 + 自检", "逐项规则检查"],
  ["5", "最终推荐", "最稳、最公平的一家"],
  ["6", "群聊文案", "一键复制去推进"]
];

const members = [
  { who: "小林（发起人）", say: "想吃辣，但不想吃火锅，太花时间。", soft: ["想吃辣", "不要火锅", "适合聊天"], hard: [] },
  { who: "阿杰", say: "我完全不吃辣，预算最好别超过 80。", soft: [], hard: ["不吃辣", "预算 ≤ 80"] },
  { who: "小周", say: "20:30 前要回宿舍，最好别排队，离学校近一点。", soft: ["不想排队"], hard: ["20:30 前离开", "离学校近"] }
];

const checks = [
  ["预算检查", "通过 · 82≤100", "pass"],
  ["忌口检查", "通过 · 有不辣菜", "pass"],
  ["时间检查", "通过 · 步行 12 分钟", "pass"],
  ["氛围匹配", "通过 · 安静适合聊天", "pass"],
  ["排队风险", "低 · 高峰建议确认", "warn"],
  ["公平性", "通过 · 无人被牺牲", "pass"]
];

const layers = [
  ["L1", "体验层", "微信小程序与 Web 体验并行。Web 版复刻小程序流程，用 demo session 替代 wx.login。"],
  ["L2", "服务层", "Next.js App Router 同时承载作品页、在线体验页面与 API routes。"],
  ["L3", "AI 管家层", "OpenClaw 负责单人推荐与动态追问；不可用时降级到本地推荐，保证评审流程不断。"],
  ["L4", "数据层", "任务、登录 session、周末规划写入服务端 JSON store；浏览器本地保留记忆、收藏与草稿。"]
];

const apiFlows = [
  ["今天吃什么", "POST /api/food/recommend", "OpenClaw 推荐，失败时使用本地候选方案兜底。"],
  ["多人约饭", "POST /api/group-tasks", "生成 invite token，看板按 token 读取与提交成员。"],
  ["周末轻规划", "POST /api/weekend/plans", "服务端路线生成，天气失败时保守 fallback。"],
  ["记忆设置", "localStorage + profile", "Web 端即时生效，后续可接入服务端画像。"]
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
    return () => observer.disconnect();
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
          <a href="#arch" onClick={(event) => handleInternalLink(event, "#arch")}>技术架构</a>
          <a href="#video" onClick={(event) => handleInternalLink(event, "#video")}>演示视频</a>
          <a href="https://github.com/nightt5879/meituan_prj" target="_blank" rel="noreferrer">GitHub</a>
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
        <div className="meta meta-bottom"><span className="pulse" /><span>最终提交作品 · 点任意象限进入</span></div>
      </div>

      <section className="section section--paper" id="design">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">设计与思路 · Design & Thinking</div>
            <h1 className="sec-title">不是“问一句答一句”，<br />是会替你把事办成的管家</h1>
            <p className="sec-lead">围绕年轻人本地生活的高频决策：吃饭、约局、周末、突发，做一个会主动出现、能协调多人、会自检方案的 AI 管家。命题 01：基于 OpenClaw 的全天候私人管家。</p>
          </div>
          <div className="grid3">
            {painPoints.map((item, index) => (
              <div className={`card reveal d${index + 1}`} key={item.title}>
                <div className="ic"><Icon name={item.icon} size={26} /></div>
                <div className="num-tag">{item.tag}</div>
                <h2>{item.title}</h2>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>

          <SurveyWordCloud />

          <div className="persona reveal">
            <div className="avatar"><div><div className="big">小林</div><div className="avatar-note">用户照片占位</div></div></div>
            <div>
              <h2>小林 · 22 岁</h2>
              <div className="persona-meta">大学生 / 研究生 · 住在学校周边</div>
              <p>学习、项目、实习都忙，每天都在“吃什么、去哪、和谁约、怎么安排”的小决策里打转。一个人查店还行，多人约饭就乱了：口味、预算、时间、距离全在打架，最后谁都说“随便”。</p>
              <div className="quotes">
                {["不想随便，但也懒得查", "选择成本太高", "朋友偏好冲突，没人拍板", "怕踩雷：太辣 / 太远 / 排队久"].map((tag) => <span className="taglet t-soft" key={tag}>{tag}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--forest" id="core">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">差异化 · Why Us</div>
            <h2 className="sec-title">让它从“会聊天的助手”<br />升级成“会办事的管家”</h2>
            <p className="sec-lead">两个增强点，把方案从“生成建议”变成“可靠执行”，避开 01 赛道的同质化。</p>
          </div>
          <div className="grid2">
            {innovations.map((item, index) => (
              <div className={`card card--dark reveal d${index + 1}`} key={item.title}>
                <div className="ic"><Icon name={item.icon} size={26} /></div>
                <div className="num-tag">{item.tag}</div>
                <h2>{item.title}</h2>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint" id="demo">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">核心 Demo · 三人周五约饭</div>
            <h2 className="sec-title">从一句需求，<br />到“可以直接发群里的话”</h2>
            <p className="sec-lead">一条完整链路，体现管家如何理解每个人、识别冲突、自检方案，再推进到可执行动作。</p>
          </div>

          <div className="flow reveal">
            {flowSteps.map(([num, title, desc], index) => (
              <div className={`step ${index === 4 ? "accent" : ""}`} key={num}>
                <div className="dot">{num}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>

          <div className="demo-wrap">
            <div className="reveal d1">
              <div className="panel panel-spaced">
                <p className="panel-h">成员偏好</p>
                {members.map((member) => (
                  <div className="member" key={member.who}>
                    <div className="who">{member.who}</div>
                    <div className="say">“{member.say}”</div>
                    <div className="tags">
                      {member.hard.map((tag) => <span className="taglet t-hard" key={tag}>{tag}</span>)}
                      {member.soft.map((tag) => <span className="taglet t-soft" key={tag}>{tag}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <p className="panel-h">冲突识别</p>
                <div className="conflict"><span className="badge-c">高</span><p>口味冲突：小林想吃辣，阿杰完全不吃辣。不吃辣为硬约束，优先保护。</p></div>
                <div className="conflict"><span className="badge-c soft">中</span><p>时间冲突：小周 20:30 前要回，排队久 / 太远的店降权。</p></div>
                <div className="conflict"><span className="badge-c soft">中</span><p>预算冲突：总体人均 100，但阿杰希望不超过 80。</p></div>
              </div>
            </div>

            <div className="reveal d2">
              <div className="rec-card">
                <div className="rh"><span className="name">青禾小馆</span><span className="pin">★ 最终推荐</span></div>
                <div className="info">家常融合菜 · 人均 82 元 · 步行 12 分钟 · 评分 4.7</div>
                <div className="reason">有不辣菜也有可选辣度、不是火锅，照顾阿杰也兼顾小林；步行 12 分钟保证小周准时回去；环境安静，适合坐下来聊天。</div>
                <div className="scores">
                  {[["小林", "82"], ["阿杰", "94"], ["小周", "90"]].map(([name, score]) => <div className="s" key={name}><div className="n2">{name}</div><div className="v">{score}</div></div>)}
                </div>
              </div>
              <div className="panel result-panel">
                <p className="panel-h">方案自检</p>
                <div className="audit">
                  {checks.map(([label, value, type]) => <div className="audit-row" key={label}><span className="lbl">{label}</span><span className={`chk ${type}`}>{value}</span></div>)}
                </div>
                <div className="group-msg">“今晚 7 点青禾小馆怎么样？人均 70-80，步行 10 分钟，有不辣菜，环境也适合聊天。大家可以的话就定这个。”</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--forest" id="arch">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">技术架构 · Architecture</div>
            <h2 className="sec-title">四层协作，<br />一个 Next.js 服务承载</h2>
            <p className="sec-lead">Web 作品页是面向评审的可访问镜像：保持产品能力一致，复用现有后端链路，用浏览器友好的身份、路由与存储承载完整体验。</p>
          </div>
          <div className="layers reveal">
            {layers.map(([ix, title, desc]) => <div className="layer" key={ix}><div className="ix">{ix}</div><h3>{title}</h3><p>{desc}</p></div>)}
          </div>
          <div className="flows reveal d1">
            {apiFlows.map(([name, endpoint, desc]) => <div className="flow-row" key={name}><div className="fn">{name}</div><code>{endpoint}</code><div className="fd">{desc}</div></div>)}
          </div>
        </div>
      </section>

      <section className="section section--paper" id="video">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-eyebrow">演示视频 · Demo Video</div>
            <h2 className="sec-title">小程序实机录屏</h2>
            <p className="sec-lead">完整走一遍“偏好确认 → 冲突识别 → 推荐生成”，证明不是纸面方案，而是真的跑起来了。</p>
          </div>
          <div className="video-frame reveal">
            <span className="vtag">实机录屏</span>
            {demoVideoUrl ? (
              <iframe className="video-embed" src={demoVideoUrl} title="饿了幺 AI 管家演示视频" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            ) : (
              <>
                <div className="play"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg></div>
                <span className="vhint">部署时配置 NEXT_PUBLIC_DEMO_VIDEO_URL 后，这里会嵌入演示视频。</span>
              </>
            )}
          </div>
          <div className="story">
            {[
              ["镜头 01", "偏好确认", "问答收集场景、预算、距离、口味与忌口，缺信息时主动追问。"],
              ["镜头 02", "冲突识别", "管家拆出每个人的硬约束与软偏好，明确指出冲突在哪里。"],
              ["镜头 03", "推荐生成", "候选自检 → 最终推荐 → 一键生成可发群里的邀约文案。"]
            ].map(([num, title, desc], index) => <div className={`shot reveal d${index + 1}`} key={num}><div className="sn">{num}</div><h3>{title}</h3><p>{desc}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section section--forest cta-final" id="cta">
        <div className="container">
          <div className="reveal">
            <div className="sec-eyebrow">在线体验 · Try It Live</div>
            <h2 className="sec-title">不用装微信，<br />浏览器里直接上手</h2>
            <p className="sec-lead">用一个 demo 身份进入，完整体验今天吃什么、多人约饭、周末规划与管家记忆。</p>
            <div className="btns">
              <a className="btn-lg btn-primary" href="/experience">开始在线体验 →</a>
              <a className="btn-lg btn-ghost" href="https://github.com/nightt5879/meituan_prj" target="_blank" rel="noreferrer">查看 GitHub 仓库</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="fbrand"><span className="mini"><Seal size={16} /></span>饿了幺 · 全天候私人管家</div>
        <div>美团 OpenClaw 赛道 · 最终提交作品 · 2026</div>
        <div className="footer-links"><a href="https://github.com/nightt5879/meituan_prj" target="_blank" rel="noreferrer">GitHub</a><a href="#arch" onClick={(event) => handleInternalLink(event, "#arch")}>架构</a><a href="/experience">在线体验</a></div>
      </footer>
    </main>
  );
}
