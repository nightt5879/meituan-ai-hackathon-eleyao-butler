"use client";

import styles from "./GroupDecisionMechanismSection.module.css";

type CandidateStatus = "PASS" | "RISK" | "REJECT" | "PICK";
type AuditStatus = "PASS" | "NOTICE";
type IconName = "chat" | "split" | "check" | "gauge" | "lineage";

const chatMessages = [
  { speaker: "小林", text: "吃啥都行，但别火锅。", tone: "soft" },
  { speaker: "阿杰", text: "我不吃辣。", tone: "hard" },
  { speaker: "小周", text: "我 20:30 前要回宿舍。", tone: "hard" },
  { speaker: "小林", text: "人均 100 内吧。", tone: "hard" },
  { speaker: "阿杰", text: "别太远。", tone: "soft" },
  { speaker: "小周", text: "排队太久就算了。", tone: "soft" },
  { speaker: "群聊停顿", text: "所以到底吃啥？", tone: "stuck" }
];

const extractionTags = ["口味", "预算", "时间", "距离", "氛围", "排队"];

const hardConstraints = [
  "阿杰不吃辣",
  "小周 20:30 前回宿舍",
  "人均 ≤ 100"
];

const softPreferences = [
  "小林不想火锅",
  "想坐下聊天",
  "尽量别太远",
  "排队别太久"
];

const conflictItems = [
  ["口味冲突", "重辣湘菜 vs 不吃辣"],
  ["场景冲突", "火锅热闹，但不适合当前偏好"],
  ["时间冲突", "远距离或高排队会影响 20:30 前返回"],
  ["公平性冲突", "不能牺牲某个人的硬约束"]
];

const candidateItems: Array<{ status: CandidateStatus; name: string; reason: string }> = [
  { status: "RISK", name: "重辣湘菜", reason: "命中“有特色”，但踩中不吃辣，降权或驳回。" },
  { status: "RISK", name: "火锅", reason: "适合多人，但小林不想火锅，降低优先级。" },
  { status: "REJECT", name: "远距离餐厅", reason: "可能好吃，但时间风险高，直接驳回。" },
  { status: "PICK", name: "青禾小馆", reason: "不辣可选、近、预算内、适合聊天，进入推荐。" }
];

const decisionReasons = [
  "有不辣菜，满足阿杰“不吃辣”",
  "不是火锅，避开小林偏好冲突",
  "距离学校近，小周 20:30 前回宿舍更稳",
  "人均约 80 多，预算控制在 100 内",
  "氛围适合坐下聊天"
];

const rejectedCandidates = [
  "重辣湘菜：踩中不吃辣",
  "火锅：违背“不想火锅”的偏好",
  "远距离餐厅：时间风险过高",
  "高排队店：影响返回时间"
];

const auditItems: Array<{ label: string; status: AuditStatus; detail: string }> = [
  { label: "预算", status: "PASS", detail: "人均可控，未超过上限。" },
  { label: "忌口", status: "PASS", detail: "有不辣可选。" },
  { label: "时间", status: "PASS", detail: "距离近，20:30 前可返回。" },
  { label: "距离", status: "PASS", detail: "学校附近，低出行负担。" },
  { label: "氛围", status: "PASS", detail: "适合坐下聊天。" },
  { label: "公平性", status: "PASS", detail: "没有成员硬约束被牺牲。" },
  { label: "风险", status: "NOTICE", detail: "晚高峰建议提前确认排队情况。" }
];

const lineageItems = [
  { source: "阿杰“不吃辣”", reason: "有不辣菜" },
  { source: "小林“不想火锅”", reason: "不是火锅" },
  { source: "小周“20:30 前回宿舍”", reason: "步行近" },
  { source: "发起需求“适合聊天”", reason: "适合聊天" },
  { source: "预算“≤100”", reason: "人均可控" },
  { source: "“排队太久就算了”", reason: "低排队风险" }
];

const candidateStatusClass: Record<CandidateStatus, string> = {
  PASS: styles.statusPass,
  RISK: styles.statusRisk,
  REJECT: styles.statusReject,
  PICK: styles.statusPick
};

const auditStatusClass: Record<AuditStatus, string> = {
  PASS: styles.statusPass,
  NOTICE: styles.statusNotice
};

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

  if (name === "split") {
    return <svg {...common}><path d="M12 3v5" /><path d="M6 21v-5a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v5" /><path d="M6 16H3" /><path d="M18 16h3" /><path d="M9 3h6" /></svg>;
  }

  if (name === "check") {
    return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  }

  if (name === "gauge") {
    return <svg {...common}><path d="M4 14a8 8 0 1 1 16 0" /><path d="M12 14l4-5" /><path d="M5 19h14" /><path d="M8 19v-2" /><path d="M16 19v-2" /></svg>;
  }

  return <svg {...common}><circle cx="12" cy="12" r="3.2" /><path d="M12 4v4.8" /><path d="M12 15.2V20" /><path d="m4.8 7 4.1 2.4" /><path d="m15.1 14.6 4.1 2.4" /><path d="m19.2 7-4.1 2.4" /><path d="m8.9 14.6-4.1 2.4" /></svg>;
}

function StatusPill({ status, kind = "candidate" }: { status: CandidateStatus | AuditStatus; kind?: "candidate" | "audit" }) {
  const label = status === "PASS" ? "PASS 通过" : status === "NOTICE" ? "NOTICE 提醒" : status === "RISK" ? "RISK 降权" : status === "REJECT" ? "REJECT 驳回" : "PICK 推荐";
  const statusClass = kind === "audit" ? auditStatusClass[status as AuditStatus] : candidateStatusClass[status as CandidateStatus];

  return (
    <span className={`${styles.status} ${statusClass}`}>
      <span className={styles.statusMark}>{status === "NOTICE" ? "!" : status === "REJECT" ? "×" : "✓"}</span>
      {label}
    </span>
  );
}

function SectionKicker({ icon, eyebrow, title }: { icon: IconName; eyebrow: string; title: string }) {
  return (
    <div className={styles.kicker}>
      <span className={styles.kickerIcon}><TrustIcon name={icon} size={19} /></span>
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

export function GroupDecisionMechanismSection() {
  const leftLineage = lineageItems.slice(0, 3);
  const rightLineage = lineageItems.slice(3);

  return (
    <section className={`section section--paper ${styles.section}`} id="mechanism-trust" data-screen-label="机制可信与推荐可信">
      <div className="container">
        <div className={`sec-head reveal ${styles.head}`}>
          <div className="sec-eyebrow">设计与思路 · 机制可信</div>
          <h2 className={`sec-title ${styles.title}`}>把群聊里的“随便”，拆成一份可执行决策</h2>
          <p className={`sec-lead ${styles.lead}`}>
            多人约饭的问题不是信息少，而是预算、忌口、时间、距离和氛围散落在对话里。饿了幺把这些自然语言拆成硬约束和软偏好，再经过冲突识别、自检与解释，输出一份可以直接发到群里的方案。
          </p>
        </div>

        <div className={`${styles.note} reveal d1`}>
          <span>示例化解释视图</span>
          <p>OpenClaw 负责理解与生成增强，规则和数据层负责约束、自检与 fallback；这里展示的是 MVP 决策链路，不是实时算法可视化。</p>
        </div>

        <div className={styles.stack}>
          <div className={`${styles.chaosGrid} reveal d1`}>
            <article className={styles.chatCard}>
              <SectionKicker icon="chat" eyebrow="01 · 群聊废墟" title="信息都说了，但没人能拍板" />
              <div className={styles.chatWindow} aria-label="多人约饭群聊示例">
                {chatMessages.map((message, index) => (
                  <div className={`${styles.chatBubble} ${styles[`tone${message.tone}`]}`} key={`${message.speaker}-${index}`}>
                    <span>{message.speaker}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <aside className={styles.chaosInsight}>
              <div className={styles.insightNumber}>01</div>
              <h3>群聊里的问题不是信息少，而是约束散、冲突隐、没人拍板。</h3>
              <p>所以饿了幺先不急着“推荐一家”，而是把每个人的底线、偏好和风险拆出来，让后面的方案可以被检查、被解释、被发到群里执行。</p>
              <div className={styles.insightTags}>
                <span>硬约束</span>
                <span>软偏好</span>
                <span>候选冲突</span>
                <span>群聊文案</span>
              </div>
            </aside>
          </div>

          <article className={`${styles.labCard} reveal d2`}>
            <SectionKicker icon="split" eyebrow="02 · 冲突解剖台" title="把自然语言变成可处理结构" />
            <div className={styles.flowTrack} aria-label="约饭信息处理流程">
              <div className={styles.flowStep}>
                <span className={styles.stepNo}>A</span>
                <h4>原始输入</h4>
                <p>多人群聊里的自然语言、补充条件和迟疑表达。</p>
              </div>

              <div className={styles.flowStep}>
                <span className={styles.stepNo}>B</span>
                <h4>信息抽取</h4>
                <div className={styles.chipGrid}>
                  {extractionTags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </div>

              <div className={`${styles.flowStep} ${styles.wideStep}`}>
                <span className={styles.stepNo}>C</span>
                <h4>约束分类</h4>
                <div className={styles.constraintGrid}>
                  <div>
                    <strong>硬约束</strong>
                    {hardConstraints.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <div>
                    <strong>软偏好</strong>
                    {softPreferences.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>
              </div>

              <div className={`${styles.flowStep} ${styles.wideStep}`}>
                <span className={styles.stepNo}>D</span>
                <h4>冲突识别</h4>
                <div className={styles.conflictList}>
                  {conflictItems.map(([label, detail]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <p>{detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${styles.flowStep} ${styles.wideStep}`}>
                <span className={styles.stepNo}>E</span>
                <h4>候选融合</h4>
                <div className={styles.candidateList}>
                  {candidateItems.map((item) => (
                    <div className={styles.candidate} key={item.name}>
                      <StatusPill status={item.status} />
                      <strong>{item.name}</strong>
                      <p>{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <div className={`${styles.verdictGrid} reveal d3`}>
            <article className={styles.verdictCard}>
              <SectionKicker icon="check" eyebrow="03 · 约饭决策单" title="把推荐变成可执行方案" />
              <div className={styles.restaurantPick}>
                <span>推荐结果</span>
                <strong>青禾小馆</strong>
                <p>不辣可选、近、预算内、适合聊天。</p>
              </div>

              <div className={styles.verdictBlocks}>
                <div>
                  <h4>采纳理由</h4>
                  <ul>
                    {decisionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>驳回候选</h4>
                  <ul>
                    {rejectedCandidates.map((candidate) => <li key={candidate}>{candidate}</li>)}
                  </ul>
                </div>
              </div>

              <div className={styles.copyBox}>
                <span>可复制群聊文案</span>
                <p>要不明晚就定青禾小馆？人均大概 80 多，有不辣菜，离学校近，也比较适合聊天。我们 18:30 出发，小周 20:30 前回宿舍也来得及。</p>
              </div>
            </article>

            <article className={styles.auditCard}>
              <SectionKicker icon="gauge" eyebrow="04 · 自检仪表盘" title="推荐先过自检，再生成理由" />
              <div className={styles.auditGrid}>
                {auditItems.map((item) => (
                  <div className={styles.auditItem} key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <StatusPill status={item.status} kind="audit" />
                  </div>
                ))}
              </div>
              <p className={styles.auditFootnote}>不承诺实时排队判断，MVP 只把排队作为风险项提醒，并保留人工确认空间。</p>
            </article>
          </div>

          <article className={`${styles.lineageCard} reveal d4`}>
            <div className={styles.lineageHead}>
              <SectionKicker icon="lineage" eyebrow="05 · 推荐理由血缘图" title="理由来自约束、标签和自检结果" />
              <p>推荐理由不是事后包装，而是从用户约束、候选标签和自检结果中生成。</p>
            </div>

            <div className={styles.lineageGraph} aria-label="青禾小馆推荐理由血缘图">
              <div className={`${styles.lineageSide} ${styles.lineageLeft}`}>
                {leftLineage.map((item) => (
                  <div className={styles.lineageItem} key={item.source}>
                    <span>{item.source}</span>
                    <strong>{item.reason}</strong>
                  </div>
                ))}
              </div>

              <div className={styles.lineageCenter}>
                <span>中心节点</span>
                <strong>青禾小馆</strong>
                <p>解释链路汇总</p>
              </div>

              <div className={`${styles.lineageSide} ${styles.lineageRight}`}>
                {rightLineage.map((item) => (
                  <div className={styles.lineageItem} key={item.source}>
                    <span>{item.source}</span>
                    <strong>{item.reason}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
