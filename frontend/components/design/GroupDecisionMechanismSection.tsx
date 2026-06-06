"use client";

import { useState } from "react";
import styles from "./GroupDecisionMechanismSection.module.css";

type IconName = "launch" | "form" | "memory" | "search" | "check" | "refresh" | "send" | "spark";
type StatusTone = "idle" | "safe" | "picked" | "notice" | "reject" | "pass" | "keep";
type SectionKind = "chips" | "rows" | "checks";
type ColumnAccent = "user" | "butler" | "output";

type ChatLine = {
  speaker: string;
  text: string;
  tone?: "normal" | "pause" | "system";
};

type PanelSection = {
  title: string;
  items: string[];
  kind?: SectionKind;
};

type DecisionItem = {
  name: string;
  verdict: string;
  reason: string;
  tone: StatusTone;
};

type ResultBlock = {
  version: string;
  name: string;
  status: string;
  tone: StatusTone;
  summary: string;
  reasons: string[];
  messageLabel?: string;
  message?: string;
};

type PanelContent = {
  eyebrow: string;
  title: string;
  body?: string;
  status?: string;
  statusTone?: StatusTone;
  markers?: string[];
  chat?: ChatLine[];
  sections?: PanelSection[];
  decisions?: DecisionItem[];
  result?: ResultBlock;
  message?: {
    label: string;
    text: string;
  };
  action?: string;
  footer?: string;
  empty?: boolean;
};

type WorkflowStep = {
  label: string;
  short: string;
  icon: IconName;
  summary: string;
  left: PanelContent;
  middle: PanelContent;
  right: PanelContent;
};

const toneClassMap: Record<StatusTone, string> = {
  idle: styles.toneIdle,
  safe: styles.toneSafe,
  picked: styles.tonePicked,
  notice: styles.toneNotice,
  reject: styles.toneReject,
  pass: styles.tonePass,
  keep: styles.toneKeep
};

const columnClassMap: Record<ColumnAccent, string> = {
  user: styles.userColumn,
  butler: styles.butlerColumn,
  output: styles.outputColumn
};

const workflowSteps: WorkflowStep[] = [
  {
    label: "发起约饭",
    short: "把群聊入口接住",
    icon: "launch",
    summary: "先把“都可以 / 随便”的口头争论，变成一张能收集偏好的约饭卡。",
    left: {
      eyebrow: "群聊入口",
      title: "今晚三人晚饭偏好收集中",
      status: "已填写 0/3",
      statusTone: "idle",
      markers: ["群聊发起", "偏好卡生成"],
      chat: [
        { speaker: "A", text: "今晚吃啥都可以，别太折腾。" },
        { speaker: "B", text: "我都行，但不吃海鲜。" },
        { speaker: "C", text: "别辣，20:30 前要回宿舍。" },
        { speaker: "群聊停顿", text: "所以到底去哪？", tone: "pause" }
      ],
      sections: [
        {
          title: "小程序卡片",
          items: ["今晚三人晚饭偏好收集中", "已填写 0/3", "成员点开各自填写"],
          kind: "checks"
        }
      ],
      action: "填写我的偏好",
      footer: "先把讨论入口收拢，避免继续在群里空转。"
    },
    middle: {
      eyebrow: "管家状态",
      title: "等待成员填写",
      status: "收集中",
      statusTone: "idle",
      body: "先不急着推荐餐厅，而是把散在群里的忌口、时间、距离和预算收回来。",
      markers: ["等待输入", "不先编答案"],
      sections: [
        {
          title: "这一阶段解决",
          items: ["不让一个人替全群拍脑袋", "把口头争论转成结构化偏好", "后续每次判断都有来源"],
          kind: "rows"
        }
      ],
      footer: "下一步：成员逐个填写本次偏好。"
    },
    right: {
      eyebrow: "输出结果",
      title: "方案还未生成",
      status: "等待输入",
      statusTone: "idle",
      body: "偏好没有收齐前，右侧只显示占位态，避免 AI 先编一个看似合理的答案。",
      markers: ["暂不推荐", "等待 3/3"],
      sections: [
        {
          title: "此时不会做",
          items: ["不会随机给一家店", "不会牺牲未填写成员", "不会生成没有来源的理由"],
          kind: "checks"
        }
      ],
      footer: "收齐偏好后才进入候选召回。",
      empty: true
    }
  },
  {
    label: "3/3 填写偏好",
    short: "把条件收齐",
    icon: "form",
    summary: "成员各自填完后，系统开始把人话翻译成可判断的输入。",
    left: {
      eyebrow: "成员偏好",
      title: "3/3 已填写",
      status: "完成",
      statusTone: "pass",
      markers: ["A 已填", "B 已填", "C 已填"],
      sections: [
        {
          title: "本次成员输入",
          items: ["A：附近、快点决定", "B：不吃海鲜", "C：不吃辣"],
          kind: "checks"
        },
        {
          title: "共同条件",
          items: ["人均不超过 100", "20:30 前回宿舍", "学校附近优先"],
          kind: "chips"
        }
      ],
      footer: "“随便”被拆成了可执行的条件。"
    },
    middle: {
      eyebrow: "输入整理",
      title: "从聊天里抽出能判断的条件",
      status: "已整理",
      statusTone: "pass",
      markers: ["硬约束", "软偏好"],
      sections: [
        {
          title: "结构化输入",
          items: ["人数：3 人", "预算：≤100", "时间：20:30 前回宿舍", "距离：学校附近"],
          kind: "checks"
        },
        {
          title: "待保护条件",
          items: ["忌口不能踩", "预算不能超", "返回时间要稳"],
          kind: "chips"
        }
      ],
      footer: "这里是示例化工作流，不展示真实算法分数。"
    },
    right: {
      eyebrow: "下一步",
      title: "偏好已收集，准备召回候选",
      status: "可召回",
      statusTone: "safe",
      body: "现在可以开始找店，但必须先保护忌口、预算和时间这些不能牺牲的条件。",
      markers: ["输入完整", "准备找店"],
      sections: [
        {
          title: "进入召回前",
          items: ["确认人数和预算", "锁定学校附近", "保留忌口雷区"],
          kind: "checks"
        }
      ],
      footer: "下一步：用这些条件圈出候选池。"
    }
  },
  {
    label: "记忆确认",
    short: "少问一点",
    icon: "memory",
    summary: "常用饭搭子可以复用低敏偏好，但本次仍然允许成员修改。",
    left: {
      eyebrow: "管家记忆",
      title: "检测到常用饭搭子 A、B、C",
      status: "待确认",
      statusTone: "notice",
      markers: ["低敏偏好", "本次可改"],
      sections: [
        {
          title: "可复用",
          items: ["B 不吃海鲜", "C 不吃辣", "学校附近更方便"],
          kind: "chips"
        },
        {
          title: "本次控制",
          items: ["记住这个小队", "本次可修改", "不想沿用时可以关闭"],
          kind: "checks"
        }
      ],
      action: "使用管家记忆",
      footer: "记忆只减少重复填写，不替用户做决定。"
    },
    middle: {
      eyebrow: "记忆合并",
      title: "沿用旧条件，也接住新反馈",
      status: "已确认",
      statusTone: "pass",
      markers: ["沿用", "新增"],
      sections: [
        {
          title: "这次沿用",
          items: ["B 不吃海鲜", "C 不吃辣", "学校附近优先"],
          kind: "checks"
        },
        {
          title: "本次新增",
          items: ["更有特色一点", "别太远", "少排队"],
          kind: "chips"
        }
      ],
      footer: "新反馈会覆盖本次排序，但不改历史偏好。"
    },
    right: {
      eyebrow: "输出状态",
      title: "记忆已确认",
      status: "低敏偏好",
      statusTone: "safe",
      body: "用户授权后记住低敏偏好，下次约同一个小队时少问一点，但本次仍以成员确认后的条件为准。",
      markers: ["授权后可用", "本次优先"],
      sections: [
        {
          title: "对展示的价值",
          items: ["少问重复问题", "保留成员控制权", "推荐理由可追溯"],
          kind: "checks"
        }
      ],
      footer: "下一步：带着确认后的条件召回候选。"
    }
  },
  {
    label: "候选召回",
    short: "先找可吃的",
    icon: "search",
    summary: "先按硬约束圈出可吃范围，再让软偏好参与排序。",
    left: {
      eyebrow: "召回条件",
      title: "不是直接问 AI 猜一家",
      status: "候选池",
      statusTone: "safe",
      markers: ["硬约束优先", "候选可调整"],
      sections: [
        {
          title: "本次召回 chips",
          items: ["三人晚饭", "学校附近", "预算 ≤100", "避开海鲜", "不吃辣"],
          kind: "chips"
        },
        {
          title: "先排除",
          items: ["海鲜主打", "重辣口味", "远距离高风险"],
          kind: "checks"
        }
      ],
      footer: "召回先求可吃，再求更想去。"
    },
    middle: {
      eyebrow: "候选池处理",
      title: "先保护硬约束，再按偏好排序",
      status: "筛选中",
      statusTone: "safe",
      markers: ["保护", "排序", "保留反馈"],
      sections: [
        {
          title: "处理顺序",
          items: ["先保护硬约束", "再按软偏好排序", "过滤明显冲突候选", "保留可调整候选"],
          kind: "checks"
        },
        {
          title: "可被反馈调整",
          items: ["更有特色", "更近一点", "更安静一点"],
          kind: "chips"
        }
      ],
      footer: "这是一张机制展示，不是实时算法可视化。"
    },
    right: {
      eyebrow: "第一版推荐",
      title: "先给一个安全方案",
      markers: ["第一版", "安全但普通"],
      result: {
        version: "第一版",
        name: "港式茶餐厅",
        status: "安全但普通",
        tone: "safe",
        summary: "不辣、可避海鲜、预算内，能吃，但不一定让大家有兴趣立刻出发。",
        reasons: ["不辣选择比较稳", "海鲜不是主打", "人均在预算内"]
      },
      footer: "如果成员觉得普通，可以保留硬约束后换一批。"
    }
  },
  {
    label: "冲突自检",
    short: "看有没有踩雷",
    icon: "check",
    summary: "候选不是越多越好，关键是把不能踩的雷先排掉。",
    left: {
      eyebrow: "候选判定",
      title: "每个候选都要过一遍雷区",
      markers: ["驳回 3", "保留 1"],
      decisions: [
        { name: "重辣湘菜", verdict: "驳回", reason: "踩中 C 不吃辣", tone: "reject" },
        { name: "海鲜寿司", verdict: "驳回", reason: "踩中 B 不吃海鲜", tone: "reject" },
        { name: "远距离餐厅", verdict: "驳回", reason: "回宿舍时间风险高", tone: "reject" },
        { name: "港式茶餐厅", verdict: "保留", reason: "安全，但记忆点一般", tone: "keep" }
      ],
      footer: "驳回不是失败，而是在保护成员底线。"
    },
    middle: {
      eyebrow: "条件分层",
      title: "不能踩的雷优先级最高",
      markers: ["硬约束", "软偏好"],
      sections: [
        {
          title: "不能踩的雷",
          items: ["B 不吃海鲜", "C 不吃辣", "不要超预算"],
          kind: "checks"
        },
        {
          title: "尽量满足",
          items: ["更有特色一点", "适合聊天", "别太远", "少排队"],
          kind: "chips"
        }
      ],
      footer: "先保底线，再追求更好体验。"
    },
    right: {
      eyebrow: "自检结论",
      title: "第一版能吃，但不够有记忆点",
      status: "可继续调整",
      statusTone: "notice",
      body: "硬约束都保住了，但 B 觉得普通。管家不需要重新问一遍所有条件，可以在保留雷区的前提下继续换一批。",
      markers: ["能吃", "不够想去"],
      sections: [
        {
          title: "保留不变",
          items: ["避开海鲜", "不吃辣", "预算 ≤100", "学校附近"],
          kind: "chips"
        },
        {
          title: "轻量自检",
          items: ["预算 PASS", "忌口 PASS", "时间 PASS", "距离 PASS", "公平性 PASS", "排队风险 NOTICE"],
          kind: "chips"
        }
      ],
      footer: "下一步：带着反馈重排候选。"
    }
  },
  {
    label: "换一批",
    short: "带着反馈再跑",
    icon: "refresh",
    summary: "“换一批”不是清空重来，而是在保留硬约束的基础上调整软偏好。",
    left: {
      eyebrow: "用户反馈",
      title: "这家可以，但想更有特色一点",
      status: "换一批",
      statusTone: "notice",
      markers: ["不清空", "只调软偏好"],
      sections: [
        {
          title: "本次反馈",
          items: ["更有特色一点", "更近一点", "继续避开海鲜和辣味"],
          kind: "chips"
        },
        {
          title: "继续保留",
          items: ["B 不吃海鲜", "C 不吃辣", "预算 ≤100"],
          kind: "checks"
        }
      ],
      footer: "用户只说变化点，不需要重填一遍。"
    },
    middle: {
      eyebrow: "管家动作",
      title: "保留雷区，只调整偏好排序",
      status: "重新排序",
      statusTone: "safe",
      markers: ["保留硬约束", "吸收反馈"],
      sections: [
        {
          title: "动作链路",
          items: ["保留硬约束", "用反馈调整软偏好", "重新排序候选", "不重新问一遍所有条件"],
          kind: "checks"
        },
        {
          title: "排序更偏向",
          items: ["更有特色", "距离可控", "适合聊天"],
          kind: "chips"
        }
      ],
      footer: "同一组约束继续跑，体验更像管家。"
    },
    right: {
      eyebrow: "第二版推荐",
      title: "换一批后更像能定下来的答案",
      markers: ["换一批后", "采纳"],
      result: {
        version: "换一批后",
        name: "椰子鸡小馆",
        status: "采纳",
        tone: "picked",
        summary: "清淡不辣、可避海鲜、更有特色、预算内，距离也可控。",
        reasons: ["清淡不辣，照顾 C", "可以避开海鲜，照顾 B", "比第一版更有特色", "人均约 45，预算内"]
      },
      footer: "第二版承担视觉高潮：从“能吃”变成“就这家”。"
    }
  },
  {
    label: "群聊文案",
    short: "直接发回群里",
    icon: "send",
    summary: "最后不是丢一堆选择，而是生成一条能发回群里的约饭方案。",
    left: {
      eyebrow: "消息预览",
      title: "生成群聊消息",
      status: "可发送",
      statusTone: "picked",
      markers: ["结果", "理由", "时间"],
      message: {
        label: "群聊预览",
        text: "椰子鸡小馆看起来更合适：避开海鲜、不辣，预算和距离也稳。"
      },
      sections: [
        {
          title: "消息包含",
          items: ["定哪家", "为什么适合", "几点出发", "谁的条件被照顾到"],
          kind: "chips"
        }
      ],
      footer: "从推荐结果收束成一条可执行消息。"
    },
    middle: {
      eyebrow: "解释来源",
      title: "推荐理由不是事后包装",
      status: "有来源",
      statusTone: "pass",
      body: "文案里的每一句理由，都来自成员偏好、候选标签、反馈调整和自检结果。",
      markers: ["偏好来源", "候选标签", "自检结果"],
      sections: [
        {
          title: "来源链路",
          items: ["可避海鲜 ← B 不吃海鲜", "不辣可选 ← C 不吃辣", "人均可控 ← 预算 ≤100", "更有特色 ← 换一批反馈", "可复用 ← 管家记忆"],
          kind: "chips"
        }
      ],
      footer: "解释视图用于展示机制，不声称实时算法可视化。"
    },
    right: {
      eyebrow: "可直接发群",
      title: "这家就行",
      markers: ["最终方案", "可发送"],
      result: {
        version: "最终方案",
        name: "椰子鸡小馆",
        status: "采纳",
        tone: "picked",
        summary: "把推荐结果、关键理由和出发时间压成一条群聊消息。",
        reasons: ["可避开海鲜", "有不辣选择", "人均约 45", "18:30 出发更稳"],
        messageLabel: "可直接发群文案",
        message: "要不今晚就定椰子鸡小馆？人均大概 45，可以避开海鲜，也有不辣选择。我们 18:30 出发，C 不吃辣也没问题。"
      },
      footer: "最后给的是可执行决定，不是一串候选列表。"
    }
  }
];

function WorkflowIcon({ name, size = 20 }: { name: IconName; size?: number }) {
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

  if (name === "launch") return <svg {...common}><path d="M5 12h10" /><path d="m11 6 6 6-6 6" /><path d="M4 4h6" /><path d="M4 20h6" /></svg>;
  if (name === "form") return <svg {...common}><path d="M8 6h10" /><path d="M8 12h10" /><path d="M8 18h7" /><path d="m3 6 1 1 2-2" /><path d="m3 12 1 1 2-2" /><path d="m3 18 1 1 2-2" /></svg>;
  if (name === "memory") return <svg {...common}><path d="M12 3a5 5 0 0 0-5 5v1.2A4.6 4.6 0 0 0 8.2 18H10" /><path d="M12 3a5 5 0 0 1 5 5v1.2A4.6 4.6 0 0 1 15.8 18H14" /><path d="M9 9h6" /><path d="M8 13h8" /><path d="M12 18v3" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /><path d="M8 10h5" /></svg>;
  if (name === "check") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M21 12a9 9 0 0 1-15.5 6.2" /><path d="M3 12A9 9 0 0 1 18.5 5.8" /><path d="M18 3v4h-4" /><path d="M6 21v-4h4" /></svg>;
  if (name === "send") return <svg {...common}><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4Z" /></svg>;
  return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;
}

function renderSections(sections?: PanelSection[]) {
  if (!sections?.length) return null;

  return (
    <div className={styles.panelSections}>
      {sections.map((section) => (
        <div className={styles.panelSection} key={section.title}>
          <h5>{section.title}</h5>
          {section.kind === "chips" ? (
            <div className={styles.chipGrid}>
              {section.items.map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : (
            <ul className={section.kind === "checks" ? styles.checkList : styles.infoList}>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function WorkbenchColumn({ panel, role, accent }: { panel: PanelContent; role: string; accent: ColumnAccent }) {
  return (
    <section className={`${styles.workColumn} ${columnClassMap[accent]}`} aria-label={role}>
      <div className={styles.columnLabel}>{role}</div>
      <article className={`${styles.panelCard} ${panel.empty ? styles.panelEmpty : ""}`}>
        <div className={styles.panelIntro}>
          <div className={styles.panelTop}>
            <span>{panel.eyebrow}</span>
            {panel.status ? <b className={panel.statusTone ? toneClassMap[panel.statusTone] : ""}>{panel.status}</b> : null}
          </div>
          <h4>{panel.title}</h4>
          {panel.body ? <p className={styles.panelBody}>{panel.body}</p> : null}
          {panel.markers?.length ? (
            <div className={styles.markerStrip}>
              {panel.markers.map((marker) => <span key={marker}>{marker}</span>)}
            </div>
          ) : null}
        </div>

        <div className={styles.panelMain}>
          {panel.chat ? (
            <div className={styles.chatStack}>
              {panel.chat.map((line) => (
                <p className={`${styles.chatBubble} ${line.tone === "pause" ? styles.chatPause : ""} ${line.tone === "system" ? styles.chatSystem : ""}`} key={`${line.speaker}-${line.text}`}>
                  <span>{line.speaker}</span>
                  {line.text}
                </p>
              ))}
            </div>
          ) : null}

          {renderSections(panel.sections)}

          {panel.decisions ? (
            <div className={styles.decisionList}>
              {panel.decisions.map((item) => (
                <div className={styles.decisionItem} key={item.name}>
                  <span className={`${styles.verdict} ${toneClassMap[item.tone]}`}>{item.verdict}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {panel.message ? (
            <div className={styles.messagePreview}>
              <span>{panel.message.label}</span>
              <p>{panel.message.text}</p>
            </div>
          ) : null}

          {panel.result ? <ResultCard result={panel.result} /> : null}
        </div>

        {(panel.action || panel.footer) ? (
          <div className={styles.panelBottom}>
            {panel.action ? <span className={styles.mockButton}>{panel.action}</span> : null}
            {panel.footer ? <p className={styles.panelFooter}>{panel.footer}</p> : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function ResultCard({ result }: { result: ResultBlock }) {
  return (
    <div className={`${styles.resultCard} ${toneClassMap[result.tone]}`}>
      <div className={styles.resultTop}>
        <span>{result.version}</span>
        <b>{result.status}</b>
      </div>
      <h5>{result.name}</h5>
      <p>{result.summary}</p>
      <ul>
        {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {result.message ? (
        <div className={styles.groupMessage}>
          <span>{result.messageLabel}</span>
          <p>{result.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export function GroupDecisionMechanismSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = workflowSteps[activeIndex] ?? workflowSteps[0];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === workflowSteps.length - 1;

  const goToStep = (index: number) => {
    setActiveIndex(Math.max(0, Math.min(index, workflowSteps.length - 1)));
  };

  return (
    <section className={`section section--paper ${styles.section}`} id="mechanism-trust" data-screen-label="多人约饭流程工作台">
      <div className="container">
        <div className={`sec-head reveal ${styles.head}`}>
          <div className="sec-eyebrow">设计与思路 · 机制可信</div>
          <h2 className={`sec-title ${styles.title}`}>不是只给推荐，而是把一次多人约饭真正跑完</h2>
          <p className={`sec-lead ${styles.lead}`}>
            多人约饭不是缺餐厅，而是缺一个能收集偏好、保护硬约束、根据反馈继续调整，并把方案发回群聊的管家流程。
          </p>
        </div>

        <div className={`${styles.flowShell} reveal d1`}>
          <div className={styles.flowMeta}>
            <span>示例化工作流</span>
            <strong>{String(activeIndex + 1).padStart(2, "0")} / 07</strong>
          </div>
          <div className={styles.flowRail} role="tablist" aria-label="多人约饭流程步骤">
            {workflowSteps.map((step, index) => {
              const isActive = activeIndex === index;
              const isDone = activeIndex > index;

              return (
                <button
                  aria-current={isActive ? "step" : undefined}
                  aria-controls="group-decision-workbench"
                  className={`${styles.flowStep} ${isActive ? styles.flowStepActive : ""} ${isDone ? styles.flowStepDone : ""}`}
                  key={step.label}
                  onClick={() => goToStep(index)}
                  type="button"
                >
                  <span className={styles.flowStepIcon}><WorkflowIcon name={step.icon} size={17} /></span>
                  <span className={styles.flowStepText}>
                    <b>{index + 1}</b>
                    <strong>{step.label}</strong>
                    <small>{step.short}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.flowControls}>
            <button disabled={isFirst} onClick={() => goToStep(activeIndex - 1)} type="button">上一步</button>
            <button disabled={isLast} onClick={() => goToStep(activeIndex + 1)} type="button">下一步</button>
          </div>
        </div>

        <div className={`${styles.workbench} reveal d2`} id="group-decision-workbench">
          <div className={styles.workbenchTop}>
            <div>
              <span>当前步骤 {activeIndex + 1}</span>
              <h3>{activeStep.label}</h3>
            </div>
            <p>{activeStep.summary}</p>
          </div>
          <div className={styles.workbenchGrid}>
            <WorkbenchColumn accent="user" panel={activeStep.left} role="用户侧 / 小程序侧" />
            <WorkbenchColumn accent="butler" panel={activeStep.middle} role="管家处理流" />
            <WorkbenchColumn accent="output" panel={activeStep.right} role="输出结果" />
          </div>
        </div>

      </div>
    </section>
  );
}
