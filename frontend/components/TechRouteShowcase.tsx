"use client";

import { useMemo, useState } from "react";
import { techRouteData, type TechRouteFunction, type TechRouteNode, type TechRouteStageKey } from "@/lib/techRoute";

type TechRouteDirection = "A" | "B" | "C";
type TechRouteFuncId = (typeof techRouteData.funcs)[number]["id"];
type OpenNode = { stageIndex: number; nodeIndex: number } | null;

const directions: Array<{ d: TechRouteDirection; t: string }> = [
  { d: "A", t: "链路泳道" },
  { d: "B", t: "能力矩阵" },
  { d: "C", t: "节点图" }
];

function SmallIcon({ name }: { name: TechRouteFunction["icon"] | "arrow" | "diff" | "safe" | "tech" | "go" }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "route") return <svg {...common}><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8" /></svg>;
  if (name === "arrow" || name === "go") return <svg {...common} strokeWidth="2"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "diff") return <svg {...common}><path d="M12 2v20" /><path d="M2 12h20" /><circle cx="12" cy="12" r="4" /></svg>;
  if (name === "tech") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "safe") return <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
  return <svg {...common}><path d="M3 11.5h18" /><path d="M4 11.5a8 8 0 0 0 16 0" /><path d="M9.5 4.2c-.7 1 .7 1.8 0 2.8M14 3.4c-.8 1.1.8 1.9 0 3" /></svg>;
}

const stageBadges: Record<TechRouteStageKey, string> = {
  in: "INPUT → STRUCTURED",
  proc: "RULES + OPENCLAW",
  out: "CHECKED → PLAN"
};

const stageDetailMeta: Record<TechRouteStageKey, { focus: string; input: string; output: string; trust: string }> = {
  in: {
    focus: "把口头需求落成可检查字段",
    input: "自然语言、成员偏好、历史记忆",
    output: "预算、距离、忌口、时间等结构化条件",
    trust: "先明确条件，再进入推荐，避免后面凭感觉补理由。"
  },
  proc: {
    focus: "在候选池里保护硬约束并排序",
    input: "结构化条件、本地候选池、OpenClaw 理解结果",
    output: "过滤后的候选、排序依据、自检风险",
    trust: "规则和数据层先把不能踩的雷守住，OpenClaw 负责理解与生成增强。"
  },
  out: {
    focus: "把结果变成能执行的方案",
    input: "通过自检的候选、理由链和风险提示",
    output: "推荐方案、解释文案、可分享结果",
    trust: "输出同时带上命中的约束与风险边界，不把静态案例说成实时平台数据。"
  }
};

function defaultOpenNode(func: TechRouteFunction): OpenNode {
  const procIndex = func.stages.findIndex((stage) => stage.key === "proc");
  return { stageIndex: procIndex >= 0 ? procIndex : 0, nodeIndex: 0 };
}

function currentNode(func: TechRouteFunction, openNode: OpenNode): { node: TechRouteNode; stageKey: TechRouteStageKey; stageTitle: string; stageSub: string; mark: string } | null {
  if (!openNode) return null;
  const stage = func.stages[openNode.stageIndex];
  const node = stage?.nodes[openNode.nodeIndex];
  if (!stage || !node) return null;
  return { node, stageKey: stage.key, stageTitle: stage.title, stageSub: stage.sub, mark: `${openNode.stageIndex + 1}.${openNode.nodeIndex + 1}` };
}

function FuncHead({ func }: { func: TechRouteFunction }) {
  return (
    <>
      <div className="tr-fhead">
        <div className="no">{func.no}</div>
        <div className="ft">
          <h3>{func.name} <span className="tag">· {func.tagline}</span></h3>
          <div className="tr-flow-tags" aria-label="链路能力标签">
            <span>Web demo session</span>
            <span>本地候选池</span>
            <span>规则自检</span>
          </div>
        </div>
      </div>
      <p className="tr-oneliner">{func.oneLiner}</p>
    </>
  );
}

function Pipeline({ func, openNode, onOpen }: { func: TechRouteFunction; openNode: OpenNode; onOpen: (node: OpenNode) => void }) {
  return (
    <div className="tr-lane-map" aria-label={`${func.name} 技术链路泳道`}>
      <div className="tr-lane-ribbon" aria-hidden="true">
        <span>输入约束</span>
        <SmallIcon name="arrow" />
        <span>处理链路</span>
        <SmallIcon name="arrow" />
        <span>输出方案</span>
        <SmallIcon name="arrow" />
        <span>自检兜底</span>
      </div>
      <div className="tr-pipe">
        {func.stages.map((stage, stageIndex) => (
          <div className="tr-pipe-part" key={stage.key}>
            <div className={`tr-col k-${stage.key}`}>
              <div className="tr-col-head">
                <span className="ct">{stage.title}</span>
                <span className="cs">{stage.sub}</span>
              </div>
              <div className="tr-node-stack">
                {stage.nodes.map((node, nodeIndex) => {
                  const on = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
                  return (
                    <button
                      aria-pressed={on}
                      className={`tr-node ${on ? "on" : ""}`}
                      key={node.t}
                      type="button"
                      onClick={() => onOpen({ stageIndex, nodeIndex })}
                    >
                      <span className="tr-node-top">
                        <span className="nm">{String(nodeIndex + 1).padStart(2, "0")}</span>
                        <span className="nb">{stageBadges[stage.key]}</span>
                      </span>
                      <span className="nt">{node.t}</span>
                      <span className="nd">{node.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {stageIndex < func.stages.length - 1 ? <div className="tr-arrow"><SmallIcon name="arrow" /></div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeGraph({ func, openNode, onOpen }: { func: TechRouteFunction; openNode: OpenNode; onOpen: (node: OpenNode) => void }) {
  return (
    <div className="tr-graph">
      {func.stages.map((stage, stageIndex) => (
        <div className="tr-graph-part" key={stage.key}>
          <div className="tr-gstage">
            <div className="tr-gstage-label">{stage.sub} · {stage.title}</div>
            <div className="tr-gcol-inner">
              {stage.nodes.map((node, nodeIndex) => {
                const on = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
                return (
                  <button
                    aria-pressed={on}
                    className={`tr-gnode ${on ? "on" : ""}`}
                    key={node.t}
                    type="button"
                    onClick={() => onOpen({ stageIndex, nodeIndex })}
                  >
                    <div className="gt">{node.t}</div>
                    <div className="gd">{node.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tr-gconn"><SmallIcon name="arrow" /></div>
        </div>
      ))}
      <div className="tr-gstage tr-gstage--fallback">
        <div className="tr-gstage-label">兜底分支 · FALLBACK</div>
        <div className="tr-gcol-inner">
          <div className="tr-gnode branch">
            <div className="gt">{func.fallback.trigger}</div>
            <div className="gd">→ {func.fallback.action}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeDetail({ func, openNode }: { func: TechRouteFunction; openNode: OpenNode }) {
  const detail = currentNode(func, openNode) ?? currentNode(func, defaultOpenNode(func));
  const meta = detail ? stageDetailMeta[detail.stageKey] : null;
  return (
    <div className={`tr-detail ${detail ? "open" : ""}`}>
      <div className="inner">
        {detail && meta ? (
          <>
            <div className="di-mark">{detail.mark}</div>
            <div className="tr-detail-body">
              <div className="tr-detail-kicker">
                <span>{detail.stageSub} · {detail.stageTitle}</span>
                <span>{func.name}</span>
              </div>
              <div className="dstage">{detail.node.t}</div>
              <div className="dt">{detail.node.desc}</div>
              <div className="dd">{detail.node.detail}</div>
              <div className="tr-detail-grid">
                <div>
                  <span>处理什么</span>
                  <strong>{meta.focus}</strong>
                </div>
                <div>
                  <span>输入</span>
                  <strong>{meta.input}</strong>
                </div>
                <div>
                  <span>输出</span>
                  <strong>{meta.output}</strong>
                </div>
                <div>
                  <span>可信作用</span>
                  <strong>{meta.trust}</strong>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RouteSupportStrip({ func }: { func: TechRouteFunction }) {
  const promptFeature = func.features.find((feature) => feature.kind === "diff");
  return (
    <div className="tr-support-strip" aria-label={`${func.name} 追问与兜底说明`}>
      <div className="tr-support-card">
        <span className="tr-support-label">产品能力</span>
        <strong>{promptFeature?.title ?? "信息不足先追问"}</strong>
        <p>{promptFeature?.body ?? "信息不足时先追问，再推荐；不是硬生成一个看似合理的答案。"}</p>
      </div>
      <div className="tr-support-card">
        <span className="tr-support-label">工程兜底</span>
        <strong>密钥留在服务端，前端只接收结构化结果</strong>
        <p>OpenClaw 或外部能力不可用时，降级到本地候选池，保证 demo 不断流。</p>
      </div>
      <div className="tr-fallback-strip">
        <span>OpenClaw / 外部能力不可用</span>
        <SmallIcon name="arrow" />
        <span>本地候选池兜底</span>
        <SmallIcon name="arrow" />
        <span>保留可执行方案和风险提示</span>
      </div>
      <div className="tr-support-current">当前场景：{func.fallback.trigger} → {func.fallback.action}</div>
    </div>
  );
}

function Matrix({ activeId, onSelect }: { activeId: TechRouteFuncId; onSelect: (id: TechRouteFuncId) => void }) {
  const cell = (func: TechRouteFunction, key: "in" | "proc" | "out") => {
    const stage = func.stages.find((item) => item.key === key);
    return (
      <ul className="tr-cell-list">
        {stage?.nodes.map((node) => <li key={node.t}>{node.t}</li>)}
      </ul>
    );
  };

  return (
    <div className="tr-matrix-wrap">
      <table className="tr-matrix">
        <thead>
          <tr>
            <th>功能</th>
            <th>场景入口</th>
            <th>输入</th>
            <th>核心处理</th>
            <th>输出</th>
            <th>兜底</th>
            <th>不同点</th>
          </tr>
        </thead>
        <tbody>
          {techRouteData.funcs.map((func) => (
            <tr className={func.id === activeId ? "tr-mx-row--active" : ""} key={func.id}>
              <td className="tr-mx-fn">
                <button type="button" onClick={() => onSelect(func.id)}>
                  <div className="mn"><span className="mno">{func.no}</span>{func.name}</div>
                  <div className="mt">{func.tagline}</div>
                  <span className="tr-mx-pill">Web demo</span>
                </button>
              </td>
              <td className="tr-mx-entry">{func.oneLiner}</td>
              <td>{cell(func, "in")}</td>
              <td>{cell(func, "proc")}</td>
              <td>{cell(func, "out")}</td>
              <td className="tr-mx-fb"><span className="trg">{func.fallback.trigger}</span><br />→ <span className="act">{func.fallback.action}</span></td>
              <td className="tr-mx-diff">{func.differentiator}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TechRouteSelfCheck() {
  return (
    <>
      <div className="tr-check-grid">
        {techRouteData.selfcheck.checks.map((check) => {
          const hard = /忌口|口味/.test(check.k);
          return (
            <div className={`tr-check ${hard ? "hard" : ""}`} key={check.k}>
              <div className="ck">
                <span className="dot" />
                <span className="ttl">{check.k}</span>
                <span className="lk">{check.look}</span>
              </div>
              <div className="act"><span className="arr">→</span><span className="at">{check.act}</span></div>
            </div>
          );
        })}
      </div>
      <div className="tr-loop">
        {techRouteData.selfcheck.loop.map((item) => (
          <div className="lp" key={item.phase}>
            <div className="lph">{item.phase}</div>
            <div className="lpt">{item.t}</div>
            <div className="lpd">{item.d}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TechRouteCompare() {
  return (
    <div className="tr-compare">
      <div className="tr-cmp-row head"><div /><div className="h-normal">普通 AI 助手</div><div className="h-us">饿了幺管家</div></div>
      {techRouteData.compare.map((row) => (
        <div className="tr-cmp-row" key={row.dim}>
          <div className="tr-cmp-dim">{row.dim}</div>
          <div className="tr-cmp-normal">{row.normal}</div>
          <div className="tr-cmp-us">{row.us}</div>
        </div>
      ))}
    </div>
  );
}

export function TechRouteShowcase() {
  const [direction, setDirection] = useState<TechRouteDirection>("A");
  const [funcId, setFuncId] = useState<TechRouteFuncId>("food");
  const [openNode, setOpenNode] = useState<OpenNode>(() => defaultOpenNode(techRouteData.funcs[0]));

  const activeFunc = useMemo(() => techRouteData.funcs.find((func) => func.id === funcId) ?? techRouteData.funcs[0], [funcId]);

  function selectFunc(next: TechRouteFuncId) {
    const nextFunc = techRouteData.funcs.find((func) => func.id === next) ?? techRouteData.funcs[0];
    setFuncId(next);
    setOpenNode(defaultOpenNode(nextFunc));
  }

  function changeDirection(next: TechRouteDirection) {
    setDirection(next);
    setOpenNode(next === "B" ? null : defaultOpenNode(activeFunc));
  }

  return (
    <div className="tech-route">
      <div className="tr-overview reveal d1">
        {techRouteData.funcs.map((func) => (
          <button className="tr-ov-card" key={func.id} type="button" onClick={() => selectFunc(func.id)}>
            <div className="ono">FUNCTION {func.no}</div>
            <div className="oicon"><SmallIcon name={func.icon} /></div>
            <h4>{func.name}</h4>
            <div className="ot">{func.tagline}</div>
            <span className="ogo">看技术路线 <SmallIcon name="go" /></span>
          </button>
        ))}
        <div className="tr-ov-inner">
          <div className="il">贯穿三大功能 · 两大内功</div>
          <div className="it"><span className="d" />自检评测闭环</div>
          <div className="ii">输出前逐项审计，不合格就修正或追问</div>
          <div className="it"><span className="d" />记忆更新</div>
          <div className="ii">反馈写入个人 / 小团体偏好，越用越懂</div>
        </div>
      </div>

      <div className="reveal d1">
        <div className="tr-toolbar" aria-label="技术路线控制区">
          <div className="tr-control-group tr-control-view">
            <span className="tr-control-label">展示方式</span>
            <div className="tr-seg tr-dirs">
              {directions.map((item) => (
                <button className={direction === item.d ? "on" : ""} key={item.d} type="button" onClick={() => changeDirection(item.d)}>
                  {item.t}
                </button>
              ))}
            </div>
          </div>
          <div className="tr-control-group tr-control-scenario">
            <span className="tr-control-label">业务场景</span>
            <div className="tr-seg tr-funcs">
              {techRouteData.funcs.map((func) => (
                <button className={func.id === funcId ? "on" : ""} key={func.id} type="button" onClick={() => selectFunc(func.id)}>
                  {func.name}
                </button>
              ))}
            </div>
          </div>
          <span className="tr-toolbar-note">{direction === "B" ? "矩阵横向对比三条链路，业务场景用于聚焦当前行" : "点击节点查看输入、输出与可信作用"}</span>
        </div>

        <div id="trStageWrap">
          <div className="tr-stage">
            {direction === "B" ? (
              <Matrix activeId={funcId} onSelect={selectFunc} />
            ) : (
              <>
                <FuncHead func={activeFunc} />
                {direction === "A" ? (
                  <div className="tr-lane-workspace">
                    <Pipeline func={activeFunc} openNode={openNode} onOpen={setOpenNode} />
                    <NodeDetail func={activeFunc} openNode={openNode} />
                  </div>
                ) : (
                  <>
                    <NodeGraph func={activeFunc} openNode={openNode} onOpen={setOpenNode} />
                    <NodeDetail func={activeFunc} openNode={openNode} />
                  </>
                )}
                <RouteSupportStrip func={activeFunc} />
              </>
            )}
          </div>
        </div>
      </div>

      <section className="tr-compare-section reveal d2" aria-labelledby="tr-compare-title">
        <div className="tr-compare-head">
          <div className="sec-eyebrow">设计与思路 · 差异化对比</div>
          <h2 className="sec-title tr-compare-title" id="tr-compare-title">为什么这不是一个普通 AI 助手？</h2>
          <p className="sec-lead tr-compare-lead">
            普通 AI 助手往往停在“问一句、答一句”；饿了幺把预算、忌口、距离、时间和群体偏好纳入流程，先收敛条件，再输出可执行方案。
          </p>
        </div>
        <TechRouteCompare />
      </section>
    </div>
  );
}
