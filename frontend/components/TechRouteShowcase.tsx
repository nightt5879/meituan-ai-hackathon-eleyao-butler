"use client";

import { useMemo, useState } from "react";
import { techRouteData, type TechRouteFunction, type TechRouteNode } from "@/lib/techRoute";

type TechRouteDirection = "A" | "B" | "C";
type TechRouteFuncId = (typeof techRouteData.funcs)[number]["id"];
type OpenNode = { stageIndex: number; nodeIndex: number } | null;

const directionOptions: Array<{ id: TechRouteDirection; title: string; sub: string }> = [
  { id: "A", title: "链路泳道", sub: "输入 → 处理 → 输出" },
  { id: "B", title: "能力矩阵", sub: "三大功能横向对比" },
  { id: "C", title: "节点图", sub: "核心依赖关系" }
];

const featureTone: Record<TechRouteFunction["features"][number]["kind"], string> = {
  diff: "差异",
  safe: "安全",
  tech: "工程"
};

function SmallIcon({ name }: { name: TechRouteFunction["icon"] | "check" | "loop" | "matrix" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (name === "users") {
    return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  }
  if (name === "route") {
    return <svg {...common}><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M9 18c5.5 0 9-3.5 9-9" /><path d="M6 15V6" /></svg>;
  }
  if (name === "check") {
    return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  }
  if (name === "loop") {
    return <svg {...common}><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
  }
  if (name === "matrix") {
    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M4 16h16M10 4v16M16 4v16" /></svg>;
  }
  return <svg {...common}><path d="M3 11.5h18" /><path d="M4 11.5a8 8 0 0 0 16 0" /><path d="M9.5 4.2c-.7 1 .7 1.8 0 2.8M14 3.4c-.8 1.1.8 1.9 0 3" /></svg>;
}

function NodeDetail({ activeFunc, openNode }: { activeFunc: TechRouteFunction; openNode: OpenNode }) {
  if (!openNode) {
    return (
      <div className="tr-detail tr-detail--empty">
        <span>点击链路节点</span>
        <p>查看该节点在真实链路里的输入、处理职责和输出边界。</p>
      </div>
    );
  }

  const stage = activeFunc.stages[openNode.stageIndex];
  const node = stage.nodes[openNode.nodeIndex];
  return (
    <div className="tr-detail">
      <span>{stage.title} · {node.t}</span>
      <h4>{node.desc}</h4>
      <p>{node.detail}</p>
    </div>
  );
}

function TechPipeline({ activeFunc, openNode, onOpen }: { activeFunc: TechRouteFunction; openNode: OpenNode; onOpen: (node: OpenNode) => void }) {
  return (
    <div className="tr-pipe" aria-label={`${activeFunc.name} 技术链路`}>
      {activeFunc.stages.map((stage, stageIndex) => (
        <div className={`tr-col tr-col--${stage.key}`} key={stage.key}>
          <div className="tr-col-head">
            <span>{stage.sub}</span>
            <h4>{stage.title}</h4>
          </div>
          <div className="tr-node-stack">
            {stage.nodes.map((node, nodeIndex) => {
              const active = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
              return (
                <button
                  className={`tr-node ${active ? "active" : ""}`}
                  key={`${stage.key}-${node.t}`}
                  type="button"
                  onClick={() => onOpen({ stageIndex, nodeIndex })}
                >
                  <strong>{node.t}</strong>
                  <span>{node.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TechGraph({ activeFunc, openNode, onOpen }: { activeFunc: TechRouteFunction; openNode: OpenNode; onOpen: (node: OpenNode) => void }) {
  const nodes = activeFunc.stages.flatMap((stage, stageIndex) => stage.nodes.map((node, nodeIndex) => ({ stage, stageIndex, node, nodeIndex })));

  return (
    <div className="tr-graph" aria-label={`${activeFunc.name} 节点图`}>
      <div className="tr-graph-center">
        <SmallIcon name={activeFunc.icon} />
        <strong>{activeFunc.name}</strong>
        <span>{activeFunc.tagline}</span>
      </div>
      <div className="tr-graph-grid">
        {nodes.map(({ stage, stageIndex, node, nodeIndex }) => {
          const active = openNode?.stageIndex === stageIndex && openNode.nodeIndex === nodeIndex;
          return (
            <button
              className={`tr-gnode tr-gnode--${stage.key} ${active ? "active" : ""}`}
              key={`${stage.key}-${node.t}`}
              type="button"
              onClick={() => onOpen({ stageIndex, nodeIndex })}
            >
              <span>{stage.sub}</span>
              <strong>{node.t}</strong>
              <em>{node.desc}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TechMatrix({ onSelect }: { onSelect: (id: TechRouteFuncId) => void }) {
  return (
    <div className="tr-matrix-wrap">
      <table className="tr-matrix">
        <thead>
          <tr>
            <th>功能</th>
            <th>入口 API</th>
            <th>关键输入</th>
            <th>AI 决策点</th>
            <th>兜底机制</th>
          </tr>
        </thead>
        <tbody>
          {techRouteData.funcs.map((func) => (
            <tr key={func.id}>
              <td>
                <button className="tr-matrix-func" type="button" onClick={() => onSelect(func.id)}>
                  <span>{func.no}</span>
                  <strong>{func.name}</strong>
                  <em>{func.tagline}</em>
                </button>
              </td>
              <td>{func.api.map((api) => <code key={api}>{api}</code>)}</td>
              <td>{func.stages[0].nodes.map((node) => <span key={node.t}>{node.t}</span>)}</td>
              <td>{func.stages[1].nodes.map((node) => <span key={node.t}>{node.t}</span>)}</td>
              <td>{func.fallback.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TechFields({ func }: { func: TechRouteFunction }) {
  return (
    <div className="tr-fields">
      {func.fields.map((field) => (
        <div className="tr-field" key={field.name}>
          <div>
            <strong>{field.name}</strong>
            <span>{field.note}</span>
          </div>
          <ul>
            {field.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TechExtras({ func }: { func: TechRouteFunction }) {
  return (
    <div className="tr-extras">
      <div className="tr-feature-grid">
        {func.features.map((feature) => (
          <article className={`tr-feature tr-feature--${feature.kind}`} key={feature.title}>
            <span>{featureTone[feature.kind]}</span>
            <h4>{feature.title}</h4>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
      {func.formula ? (
        <div className="tr-formula">
          <span>公平性公式</span>
          <strong>{func.formula.main}</strong>
          <p>{func.formula.rule}</p>
        </div>
      ) : null}
      <div className="tr-fallback">
        <span>兜底触发：{func.fallback.trigger}</span>
        <strong>{func.fallback.action}</strong>
      </div>
      <div className="tr-diffline">{func.differentiator}</div>
    </div>
  );
}

function SelfCheckPanel() {
  return (
    <div className="tr-selfcheck">
      <div className="tr-panel-head">
        <SmallIcon name="check" />
        <div>
          <span>贯穿全局</span>
          <h3>{techRouteData.selfcheck.title}</h3>
          <p>{techRouteData.selfcheck.sub}</p>
        </div>
      </div>
      <p className="tr-panel-intro">{techRouteData.selfcheck.intro}</p>
      <div className="tr-check-grid">
        {techRouteData.selfcheck.checks.map((check) => (
          <article key={check.k}>
            <strong>{check.k}</strong>
            <span>看：{check.look}</span>
            <em>做：{check.act}</em>
          </article>
        ))}
      </div>
      <div className="tr-loop">
        {techRouteData.selfcheck.loop.map((item, index) => (
          <div className="tr-loop-step" key={item.phase}>
            <span>{index + 1}</span>
            <strong>{item.phase} · {item.t}</strong>
            <p>{item.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparePanel() {
  return (
    <div className="tr-compare-panel">
      <div className="tr-panel-head">
        <SmallIcon name="matrix" />
        <div>
          <span>差异对比</span>
          <h3>普通 AI vs 饿了幺</h3>
          <p>强调不是套壳问答，而是面向本地生活决策的管家工作流。</p>
        </div>
      </div>
      <div className="tr-compare">
        {techRouteData.compare.map((row) => (
          <div className="tr-compare-row" key={row.dim}>
            <strong>{row.dim}</strong>
            <span>{row.normal}</span>
            <em>{row.us}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TechRouteShowcase() {
  const [direction, setDirection] = useState<TechRouteDirection>("A");
  const [funcId, setFuncId] = useState<TechRouteFuncId>("food");
  const [openNode, setOpenNode] = useState<OpenNode>({ stageIndex: 1, nodeIndex: 0 });

  const activeFunc = useMemo(() => techRouteData.funcs.find((func) => func.id === funcId) ?? techRouteData.funcs[0], [funcId]);

  const selectFunction = (nextId: TechRouteFuncId) => {
    setFuncId(nextId);
    setOpenNode({ stageIndex: 1, nodeIndex: 0 });
    if (direction === "B") {
      setDirection("A");
    }
  };

  return (
    <div className="tech-route">
      <div className="tr-overview reveal d1">
        {techRouteData.funcs.map((func) => (
          <button
            className={`tr-card ${func.id === funcId ? "active" : ""}`}
            key={func.id}
            type="button"
            onClick={() => selectFunction(func.id)}
          >
            <span className="tr-no">{func.no}</span>
            <div className="tr-card-icon"><SmallIcon name={func.icon} /></div>
            <h3>{func.name}</h3>
            <p>{func.tagline}</p>
            <em>{func.oneLiner}</em>
          </button>
        ))}
      </div>

      <div className="tr-toolbar reveal d2">
        <div className="tr-segments" aria-label="技术路线视图">
          {directionOptions.map((option) => (
            <button
              className={option.id === direction ? "active" : ""}
              key={option.id}
              type="button"
              onClick={() => {
                setDirection(option.id);
                setOpenNode({ stageIndex: 1, nodeIndex: 0 });
              }}
            >
              <strong>{option.title}</strong>
              <span>{option.sub}</span>
            </button>
          ))}
        </div>
        <div className="tr-current">
          <span>{activeFunc.no}</span>
          <strong>{activeFunc.name}</strong>
          <em>{activeFunc.api[0]}</em>
        </div>
      </div>

      <div className="tr-stage reveal d3">
        {direction === "B" ? (
          <TechMatrix onSelect={selectFunction} />
        ) : (
          <>
            <div className="tr-headline">
              <div className="tr-head-icon"><SmallIcon name={activeFunc.icon} /></div>
              <div>
                <span>{activeFunc.tagline}</span>
                <h3>{activeFunc.name}</h3>
                <p>{activeFunc.oneLiner}</p>
              </div>
            </div>
            {direction === "A" ? (
              <TechPipeline activeFunc={activeFunc} openNode={openNode} onOpen={setOpenNode} />
            ) : (
              <TechGraph activeFunc={activeFunc} openNode={openNode} onOpen={setOpenNode} />
            )}
            <NodeDetail activeFunc={activeFunc} openNode={openNode} />
            <TechFields func={activeFunc} />
            <TechExtras func={activeFunc} />
          </>
        )}
      </div>

      <div className="tr-bottom reveal d4">
        <SelfCheckPanel />
        <ComparePanel />
      </div>
    </div>
  );
}
