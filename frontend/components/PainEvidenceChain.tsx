"use client";

import { useState } from "react";

type PainEvidence = {
  id: string;
  title: string;
  titleLines: string[];
  logic: string[];
  action: string;
  feature: string;
  description: string[];
};

const painEvidenceCards: PainEvidence[] = [
  {
    id: "01",
    title: "信息太多，不知道怎么选",
    titleLines: ["信息太多", "不知道怎么选"],
    logic: ["信息过载", "多 App 切换", "决策疲劳"],
    action: "会追问",
    feature: "今天吃什么",
    description: ["问预算、距离、口味、忌口", "压缩成 2-3 个可执行方案"]
  },
  {
    id: "02",
    title: "和朋友意见不统一",
    titleLines: ["和朋友", "意见不统一"],
    logic: ["口味冲突", "预算不同", "距离不一", "群聊低效"],
    action: "会协调",
    feature: "发起约饭",
    description: ["收集多人偏好，识别冲突", "生成 2-3 个折中方案"]
  },
  {
    id: "03",
    title: "推荐看起来不错，但实际去不了",
    titleLines: ["推荐看起来不错", "但实际去不了"],
    logic: ["太远", "超预算", "已打烊", "排队久"],
    action: "会自检",
    feature: "方案检查",
    description: ["推荐前检查预算、距离", "营业时间与排队风险"]
  },
  {
    id: "04",
    title: "临时计划变化，需要重新查很多信息",
    titleLines: ["临时计划变化", "需要重新查很多信息"],
    logic: ["计划失效", "时间变化", "需要 Plan B"],
    action: "会兜底",
    feature: "替代方案",
    description: ["原方案不可执行时", "快速换成可行备选"]
  },
  {
    id: "05",
    title: "每次都要重复说偏好",
    titleLines: ["每次都要", "重复说偏好"],
    logic: ["重复输入", "偏好稳定", "用户可控"],
    action: "会记忆",
    feature: "偏好档案",
    description: ["记住低敏偏好", "支持查看、修改、删除"]
  }
];

function TarotOrnaments() {
  return (
    <span className="pc-ornaments" aria-hidden="true">
      <span className="pc-tarot-frame" />
      <span className="pc-moon" />
      <span className="pc-star pc-star--left" />
      <span className="pc-star pc-star--right" />
      <span className="pc-star pc-star--low" />
      <span className="pc-vine pc-vine--tl"><i /><i /><i /></span>
      <span className="pc-vine pc-vine--tr"><i /><i /><i /></span>
      <span className="pc-vine pc-vine--bl"><i /><i /><i /></span>
      <span className="pc-vine pc-vine--br"><i /><i /><i /></span>
      <span className="pc-sun" />
    </span>
  );
}

export function PainEvidenceChain() {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(() => new Set());

  function toggleCard(id: string) {
    setFlippedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="pc reveal">
      <div className="pc-head">
        <h2 className="pc-title">从痛点到功能的证据卡</h2>
        <p className="pc-sub">点击一张痛点卡，翻到背面查看对应的 AI 管家动作与产品功能。</p>
        <p className="pc-motto">不是更多选择，而是更少纠结</p>
      </div>

      <div className="pc-deck-scroll">
        <div className="pc-deck" aria-label="从痛点到功能的证据卡">
          {painEvidenceCards.map((item) => {
            const isFlipped = flippedIds.has(item.id);
            return (
              <button
                type="button"
                className={`pc-card pc-card--${item.id} ${isFlipped ? "is-flipped" : ""}`}
                key={item.id}
                aria-label={`痛点 ${item.id}：${item.title}。${isFlipped ? "当前展示解决方式，点击翻回痛点" : "点击查看解决方式"}`}
                aria-pressed={isFlipped}
                onClick={() => toggleCard(item.id)}
              >
                <span className="pc-card-inner">
                  <span className="pc-face pc-card-front">
                    <TarotOrnaments />
                    <span className="pc-card-content">
                      <span className="pc-card-number">痛点 {item.id}</span>
                      <span className="pc-card-title">
                        {item.titleLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </span>
                      <span className="pc-card-logic">
                        <span className="pc-card-label">逻辑链</span>
                        <span className="pc-keywords">
                          {item.logic.map((keyword) => (
                            <span className="pc-keyword" key={keyword}>{keyword}</span>
                          ))}
                        </span>
                      </span>
                      <span className="pc-card-hint">点击查看解决方式 <i>→</i></span>
                    </span>
                  </span>

                  <span className="pc-face pc-card-back">
                    <TarotOrnaments />
                    <span className="pc-card-content">
                      <span className="pc-back-section">
                        <span className="pc-card-label">管家动作</span>
                        <span className="pc-action-badge">{item.action}</span>
                      </span>
                      <span className="pc-back-section">
                        <span className="pc-card-label">产品功能</span>
                        <span className="pc-feature-badge">{item.feature}</span>
                      </span>
                      <span className="pc-solution">
                        <span className="pc-card-label">解决方式</span>
                        {item.description.map((line) => (
                          <span className="pc-solution-line" key={line}>{line}</span>
                        ))}
                      </span>
                      <span className="pc-card-hint pc-card-hint--back"><i>←</i> 翻回痛点</span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
