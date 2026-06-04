"use client";

import { useEffect, useMemo, useState } from "react";
import { techRouteData, type TechRouteFunction, type TechRouteNode } from "@/lib/techRoute";

type TechRouteDirection = "A" | "B" | "C";
type TechRouteFuncId = (typeof techRouteData.funcs)[number]["id"];
type OpenNode = { stageIndex: number; nodeIndex: number } | null;

const directions: Array<{ d: TechRouteDirection; k: string; t: string }> = [
  { d: "A", k: "A", t: "链路泳道" },
  { d: "B", k: "B", t: "能力矩阵" },
  { d: "C", k: "C", t: "节点图" }
];

function SmallIcon({ name }: { name: TechRouteFunction["icon"] | "arrow" | "diff" | "safe" | "tech" | "go" | "play" }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "route") return <svg {...common}><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8" /></svg>;
  if (name === "arrow" || name === "go") return <svg {...common} strokeWidth="2"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "diff") return <svg {...common}><path d="M12 2v20" /><path d="M2 12h20" /><circle cx="12" cy="12" r="4" /></svg>;
  if (name === "tech") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "safe") return <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
  if (name === "play") return <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><polygon points="6 4 20 12 6 20" /></svg>;
  return <svg {...common}><path d="M3 11.5h18" /><path d="M4 11.5a8 8 0 0 0 16 0" /><path d="M9.5 4.2c-.7 1 .7 1.8 0 2.8M14 3.4c-.8 1.1.8 1.9 0 3" /></svg>;
}

function currentNode(func: TechRouteFunction, openNode: OpenNode): { node: TechRouteNode; stageTitle: string; mark: string } | null {
  if (!openNode) return null;
  const stage = func.stages[openNode.stageIndex];
  const node = stage?.nodes[openNode.nodeIndex];
  if (!stage || !node) return null;
  return { node, stageTitle: stage.title, mark: `${openNode.stageIndex + 1}.${openNode.nodeIndex + 1}` };
}

function FuncHead({ func }: { func: TechRouteFunction }) {
  return (
    <>
      <div className="tr-fhead">
        <div className="no">{func.no}</div>
        <div className="ft">
          <h3>{func.name} <span className="tag">· {func.tagline}</span></h3>
          <div className="api">
            {func.api.map((api) => <code key={api}>{api}</code>)}
          </div>
        </div>
      </div>
      <p className="tr-oneliner">{func.oneLiner}</p>
    </>
  );
}

function Pipeline({ func, openNode, flashKey, onOpen }: { func: TechRouteFunction; openNode: OpenNode; flashKey: string; onOpen: (node: OpenNode) => void }) {
  return (
    <div className="tr-pipe">
      {func.stages.map((stage, stageIndex) => (
        <div className="tr-pipe-part" key={stage.key}>
          <div className={`tr-col k-${stage.key}`}>
            <div className="tr-col-head">
              <span className="ct">{stage.title}</span>
              <span className="cs">{stage.sub}</span>
            </div>
            {stage.nodes.map((node, nodeIndex) => {
              const key = `${stageIndex}-${nodeIndex}`;
              const on = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
              return (
                <button
                  className={`tr-node ${on ? "on" : ""} ${flashKey === key ? "flash" : ""}`}
                  key={node.t}
                  type="button"
                  onClick={() => onOpen(on ? null : { stageIndex, nodeIndex })}
                >
                  <span className="nt">{node.t}</span>
                  <span className="nd">{node.desc}</span>
                </button>
              );
            })}
          </div>
          {stageIndex < func.stages.length - 1 ? <div className="tr-arrow"><SmallIcon name="arrow" /></div> : null}
        </div>
      ))}
    </div>
  );
}

function NodeGraph({ func, openNode, flashKey, onOpen }: { func: TechRouteFunction; openNode: OpenNode; flashKey: string; onOpen: (node: OpenNode) => void }) {
  return (
    <div className="tr-graph">
      {func.stages.map((stage, stageIndex) => (
        <div className="tr-graph-part" key={stage.key}>
          <div className="tr-gstage">
            <div className="tr-gstage-label">{stage.sub} · {stage.title}</div>
            <div className="tr-gcol-inner">
              {stage.nodes.map((node, nodeIndex) => {
                const key = `${stageIndex}-${nodeIndex}`;
                const on = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
                return (
                  <button
                    className={`tr-gnode ${on ? "on" : ""} ${flashKey === key ? "flash" : ""}`}
                    key={node.t}
                    type="button"
                    onClick={() => onOpen(on ? null : { stageIndex, nodeIndex })}
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
  const detail = currentNode(func, openNode);
  return (
    <div className={`tr-detail ${detail ? "open" : ""}`}>
      <div className="inner">
        {detail ? (
          <>
            <div className="di-mark">{detail.mark}</div>
            <div>
              <div className="dstage">{detail.stageTitle} · {detail.node.t}</div>
              <div className="dt">{detail.node.desc}</div>
              <div className="dd">{detail.node.detail}</div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FieldCards({ func }: { func: TechRouteFunction }) {
  return (
    <div className="tr-feats tr-fields">
      {func.fields.map((field) => (
        <div className="tr-feat field" key={field.name}>
          <div className="kk">{field.name}{field.note ? ` · ${field.note}` : ""}</div>
          <ul className="tr-cell-list">
            {field.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FeatureCards({ func }: { func: TechRouteFunction }) {
  return (
    <>
      <div className="tr-feats">
        {func.features.map((feature) => {
          const label = feature.kind === "diff" ? "不同点" : feature.kind === "tech" ? "技术" : "安全";
          return (
            <div className={`tr-feat k-${feature.kind}`} key={feature.title}>
              <div className="ico"><SmallIcon name={feature.kind} /></div>
              <div className="kk">{label}</div>
              <div className="ft">{feature.title}</div>
              <div className="fb">{feature.body}</div>
            </div>
          );
        })}
      </div>
      <div className="tr-extras">
        <div className="tr-diffline">
          <span className="ql">“</span>
          <span className="qt"><span className="qk">一句话讲清不同</span>{func.differentiator}</span>
        </div>
        {func.formula ? (
          <div className="tr-formula">
            <div className="fbox">
              <div className="fl">公平性评分</div>
              <div className="fv">{func.formula.main}</div>
            </div>
            <div className="fbox rule">
              <div className="fl">硬约束规则</div>
              <div className="fv">{func.formula.rule}</div>
            </div>
          </div>
        ) : null}
        <div className="tr-fbk">
          <span className="lab">兜底</span>
          <span className="trg">{func.fallback.trigger}</span>
          <span className="arr">→</span>
          <span className="act">{func.fallback.action}</span>
        </div>
      </div>
    </>
  );
}

function Matrix({ onSelect }: { onSelect: (id: TechRouteFuncId) => void }) {
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
            <th>入口链路</th>
            <th>输入</th>
            <th>核心处理</th>
            <th>输出</th>
            <th>兜底</th>
            <th>不同点</th>
          </tr>
        </thead>
        <tbody>
          {techRouteData.funcs.map((func) => (
            <tr key={func.id}>
              <td className="tr-mx-fn">
                <button type="button" onClick={() => onSelect(func.id)}>
                  <div className="mn"><span className="mno">{func.no}</span>{func.name}</div>
                  <div className="mt">{func.tagline}</div>
                  <code>{func.api[0]}</code>
                </button>
              </td>
              <td>
                <ul className="tr-cell-list">
                  {func.api.map((api) => <li className="mono" key={api}>{api}</li>)}
                </ul>
              </td>
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
  const [openNode, setOpenNode] = useState<OpenNode>(null);
  const [running, setRunning] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);

  const activeFunc = useMemo(() => techRouteData.funcs.find((func) => func.id === funcId) ?? techRouteData.funcs[0], [funcId]);
  const flatNodes = useMemo(() => activeFunc.stages.flatMap((stage, stageIndex) => stage.nodes.map((_, nodeIndex) => ({ stageIndex, nodeIndex }))), [activeFunc]);
  const currentPlayNode = running ? flatNodes[Math.min(playIndex, flatNodes.length - 1)] : null;
  const flashKey = currentPlayNode ? `${currentPlayNode.stageIndex}-${currentPlayNode.nodeIndex}` : "";

  useEffect(() => {
    if (!running) return;
    if (!currentPlayNode) {
      setRunning(false);
      return;
    }
    setOpenNode(currentPlayNode);
    const timer = window.setTimeout(() => {
      if (playIndex >= flatNodes.length - 1) {
        setRunning(false);
        setPlayIndex(0);
      } else {
        setPlayIndex((value) => value + 1);
      }
    }, 950);
    return () => window.clearTimeout(timer);
  }, [running, currentPlayNode, playIndex, flatNodes.length]);

  function selectFunc(next: TechRouteFuncId) {
    setRunning(false);
    setFuncId(next);
    setOpenNode(null);
    if (direction === "B") setDirection("A");
  }

  function changeDirection(next: TechRouteDirection) {
    setRunning(false);
    setDirection(next);
    setOpenNode(null);
  }

  function runFlow() {
    if (running) {
      setRunning(false);
      setOpenNode(null);
      return;
    }
    setDirection("A");
    setPlayIndex(0);
    setRunning(true);
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
        <div className="tr-toolbar">
          <span className="tr-tl-label">排版方向</span>
          <div className="tr-seg tr-dirs">
            {directions.map((item) => (
              <button className={direction === item.d ? "on" : ""} key={item.d} type="button" onClick={() => changeDirection(item.d)}>
                <span className="k">{item.k}</span>{item.t}
              </button>
            ))}
          </div>
          <div className="tr-seg tr-funcs" hidden={direction === "B"}>
            {techRouteData.funcs.map((func) => (
              <button className={func.id === funcId ? "on" : ""} key={func.id} type="button" onClick={() => selectFunc(func.id)}>
                <span className="k">{func.no}</span>{func.name}
              </button>
            ))}
          </div>
          <span className="tr-spacer" />
          <button className={`tr-play ${running ? "running" : ""}`} hidden={direction !== "A"} type="button" onClick={runFlow}>
            <SmallIcon name="play" />跑一遍流程
          </button>
        </div>

        <div id="trStageWrap">
          <div className="tr-stage">
            {direction === "B" ? (
              <Matrix onSelect={selectFunc} />
            ) : (
              <>
                <FuncHead func={activeFunc} />
                {direction === "A" ? (
                  <Pipeline func={activeFunc} openNode={openNode} flashKey={flashKey} onOpen={setOpenNode} />
                ) : (
                  <NodeGraph func={activeFunc} openNode={openNode} flashKey={flashKey} onOpen={setOpenNode} />
                )}
                <NodeDetail func={activeFunc} openNode={openNode} />
                <FieldCards func={activeFunc} />
                <FeatureCards func={activeFunc} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="tr-compare-block reveal d2">
        <div className="sec-eyebrow">设计与思路 · 差异化对比</div>
        <p className="sec-lead">不是套壳聊天，而是会追问、会协调、会自检、会兜底的本地生活管家工作流。</p>
        <TechRouteCompare />
      </div>
    </div>
  );
}
