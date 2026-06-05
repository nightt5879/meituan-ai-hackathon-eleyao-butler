"use client";

import styles from "./GroupDecisionMechanismSection.module.css";

type CandidateTone = "reject" | "risk" | "pick";
type AuditTone = "pass" | "notice";
type ChatTone = "soft" | "hard" | "stuck";
type IconName = "chat" | "shield" | "send";

const chatMessages: Array<{ speaker: string; text: string; tone: ChatTone }> = [
  { speaker: "小林", text: "吃啥都行，但别火锅。", tone: "soft" },
  { speaker: "阿杰", text: "我不吃辣。", tone: "hard" },
  { speaker: "小周", text: "我 20:30 前要回宿舍。", tone: "hard" },
  { speaker: "小林", text: "人均 100 内吧。", tone: "hard" },
  { speaker: "阿杰", text: "别太远。", tone: "soft" },
  { speaker: "小周", text: "排队太久就算了。", tone: "soft" },
  { speaker: "群聊停顿", text: "所以到底吃啥？", tone: "stuck" }
];

const hardConstraints = [
  "阿杰不吃辣",
  "小周 20:30 前要回宿舍",
  "人均不超过 100"
];

const softPreferences = [
  "小林不想火锅",
  "想坐下聊天",
  "别太远",
  "排队别太久"
];

const candidateChecks: Array<{ name: string; result: string; reason: string; tone: CandidateTone }> = [
  { name: "重辣湘菜", result: "驳回", reason: "踩中“阿杰不吃辣”", tone: "reject" },
  { name: "火锅", result: "降权", reason: "小林明确不想火锅", tone: "risk" },
  { name: "远距离餐厅", result: "驳回", reason: "回宿舍时间风险高", tone: "reject" },
  { name: "青禾小馆", result: "采纳", reason: "不辣可选、预算内、距离近、适合聊天", tone: "pick" }
];

const decisionReasons = [
  "有不辣菜，照顾阿杰",
  "不是火锅，避开小林偏好冲突",
  "离学校近，小周 20:30 前能回",
  "人均约 80 多，没有超预算",
  "适合坐下聊天"
];

const auditItems: Array<{ label: string; status: "PASS" | "NOTICE"; tone: AuditTone }> = [
  { label: "预算", status: "PASS", tone: "pass" },
  { label: "忌口", status: "PASS", tone: "pass" },
  { label: "时间", status: "PASS", tone: "pass" },
  { label: "距离", status: "PASS", tone: "pass" },
  { label: "公平性", status: "PASS", tone: "pass" },
  { label: "排队风险", status: "NOTICE", tone: "notice" }
];

const reasonSources = [
  { reason: "有不辣菜", source: "阿杰“不吃辣”" },
  { reason: "不是火锅", source: "小林“不想火锅”" },
  { reason: "步行近", source: "小周“20:30 前回宿舍”" },
  { reason: "人均可控", source: "预算 ≤100" },
  { reason: "适合聊天", source: "发起需求" }
];

function TrustIcon({ name, size = 22 }: { name: IconName; size?: number }) {
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

  if (name === "chat") {
    return <svg {...common}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v5A3.5 3.5 0 0 1 16.5 14H11l-4.5 4v-4A3.5 3.5 0 0 1 4 10.5z" /><path d="M8 7h8" /><path d="M8 10h5" /></svg>;
  }

  if (name === "shield") {
    return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }

  return <svg {...common}><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4Z" /></svg>;
}

function StoryHeader({ icon, step, kicker, title, body }: { icon: IconName; step: string; kicker: string; title: string; body: string }) {
  return (
    <div className={styles.storyHeader}>
      <div className={styles.stepBadge}>
        <span>{step}</span>
        <TrustIcon name={icon} size={20} />
      </div>
      <div>
        <div className={styles.storyKicker}>{kicker}</div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

function CandidateBadge({ tone, label }: { tone: CandidateTone; label: string }) {
  const toneClass = tone === "pick" ? styles.badgePick : tone === "risk" ? styles.badgeRisk : styles.badgeReject;

  return (
    <span className={`${styles.candidateBadge} ${toneClass}`}>
      <span>{tone === "pick" ? "✓" : tone === "risk" ? "!" : "×"}</span>
      {label}
    </span>
  );
}

function AuditBadge({ item }: { item: (typeof auditItems)[number] }) {
  return (
    <span className={`${styles.auditBadge} ${item.tone === "notice" ? styles.auditNotice : styles.auditPass}`}>
      <span>{item.tone === "notice" ? "!" : "✓"}</span>
      {item.label} {item.status}
    </span>
  );
}

export function GroupDecisionMechanismSection() {
  return (
    <section className={`section section--paper ${styles.section}`} id="mechanism-trust" data-screen-label="机制可信与推荐可信">
      <div className="container">
        <div className={`sec-head reveal ${styles.head}`}>
          <div className="sec-eyebrow">设计与思路 · 机制可信</div>
          <h2 className={`sec-title ${styles.title}`}>把“随便”和“都可以”，翻译成一份能发群里的决定</h2>
          <p className={`sec-lead ${styles.lead}`}>
            多人约饭最难的不是找店，而是每个人都有条件，却没人愿意拍板。饿了幺先保护不能牺牲的条件，再比较候选、做自检，最后输出一条可以直接发到群里的方案。
          </p>
        </div>

        <div className={`${styles.caseNote} reveal d1`}>
          <span>示例化解释视图</span>
          <p>这是用于展示机制的静态案例：OpenClaw 负责理解与生成增强，规则和数据层负责约束、自检与 fallback，不代表真实算法实时可视化。</p>
        </div>

        <div className={styles.storyRail} aria-label="从群聊混乱到可执行方案的三段故事">
          <article className={`${styles.storyBlock} ${styles.chatStory} reveal d1`}>
            <StoryHeader
              icon="chat"
              step="1"
              kicker="第一段 · 生活里的卡点"
              title="大家都说随便，但每个人都有不能踩的雷"
              body="这不是没有需求，而是需求散在群聊里：有人有忌口，有人有时间限制，有人担心预算、距离和排队。"
            />

            <div className={styles.chatScene}>
              <div className={styles.chatWindow} aria-label="多人约饭群聊示例">
                <div className={styles.chatTopbar}>
                  <span>明晚吃饭小群</span>
                  <b>7 条新消息</b>
                </div>
                {chatMessages.map((message, index) => (
                  <div
                    className={`${styles.chatBubble} ${message.tone === "hard" ? styles.toneHard : message.tone === "stuck" ? styles.toneStuck : styles.toneSoft}`}
                    key={`${message.speaker}-${index}`}
                  >
                    <span>{message.speaker}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>

              <aside className={styles.peopleSummary} aria-label="群聊里隐藏的条件">
                <div className={styles.summaryEyebrow}>群聊翻译成人话</div>
                <h4>“随便”背后其实有 3 类条件</h4>
                <div className={styles.summaryGrid}>
                  <span>忌口</span>
                  <p>阿杰不吃辣，不能被牺牲。</p>
                  <span>时间</span>
                  <p>小周要在 20:30 前回宿舍。</p>
                  <span>体验</span>
                  <p>预算、距离、排队和聊天氛围都要兼顾。</p>
                </div>
              </aside>
            </div>
          </article>

          <article className={`${styles.storyBlock} ${styles.translateStory} reveal d2`}>
            <StoryHeader
              icon="shield"
              step="2"
              kicker="第二段 · 先分清轻重"
              title="先保护不能牺牲的条件，再尽量照顾偏好"
              body="饿了幺不急着给店名，而是先把聊天翻译成“不能踩”和“尽量满足”，再拿候选餐厅逐个判定。"
            />

            <div className={styles.translationGrid}>
              <section className={`${styles.conditionPanel} ${styles.mustPanel}`}>
                <div className={styles.panelLabel}>不能踩的雷</div>
                <ul>
                  {hardConstraints.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>

              <section className={`${styles.conditionPanel} ${styles.preferPanel}`}>
                <div className={styles.panelLabel}>尽量满足的偏好</div>
                <ul>
                  {softPreferences.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>

              <section className={styles.candidatePanel}>
                <div className={styles.panelLabel}>候选判定</div>
                <div className={styles.candidateList}>
                  {candidateChecks.map((item) => (
                    <div className={`${styles.candidateRow} ${item.tone === "pick" ? styles.candidatePicked : ""}`} key={item.name}>
                      <CandidateBadge tone={item.tone} label={item.result} />
                      <strong>{item.name}</strong>
                      <p>{item.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </article>

          <article className={`${styles.storyBlock} ${styles.finalStory} reveal d3`}>
            <StoryHeader
              icon="send"
              step="3"
              kicker="第三段 · 变成可执行决定"
              title="最后不是给一堆选择，而是给一条能发出去的方案"
              body="推荐不是事后包装：理由来自用户约束、候选标签和自检结果，最后汇成一条群里能直接确认的消息。"
            />

            <div className={styles.decisionCard}>
              <div className={styles.pickHeader}>
                <div>
                  <span>推荐结果</span>
                  <strong>青禾小馆</strong>
                </div>
                <b>可执行方案</b>
              </div>

              <div className={styles.decisionBody}>
                <section className={styles.reasonPanel}>
                  <h4>为什么定它</h4>
                  <ul>
                    {decisionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </section>

                <section className={styles.messagePanel}>
                  <div className={styles.messageLabel}>可直接发群</div>
                  <p>要不明晚就定青禾小馆？人均大概 80 多，有不辣菜，离学校近，也比较适合聊天。我们 18:30 出发，小周 20:30 前回宿舍也来得及。</p>
                </section>
              </div>

              <div className={styles.auditStrip} aria-label="轻量自检结果">
                {auditItems.map((item) => <AuditBadge item={item} key={item.label} />)}
              </div>

              <div className={styles.sourceBlock}>
                <div className={styles.sourceTitle}>理由来源</div>
                <div className={styles.sourceList}>
                  {reasonSources.map((item) => (
                    <span className={styles.sourceChip} key={`${item.reason}-${item.source}`}>
                      <strong>{item.reason}</strong>
                      <i>←</i>
                      {item.source}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
