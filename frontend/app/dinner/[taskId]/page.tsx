"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { InfoRow } from "@/components/InfoRow";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { demoTask, demoTaskId } from "@/lib/mockData";
import type { RestaurantCandidate } from "@/lib/types";

const auditLabels: Record<string, string> = {
  budget_check: "预算检查",
  diet_check: "忌口检查",
  time_check: "时间检查",
  open_hours_check: "营业时间",
  atmosphere_check: "氛围匹配",
  queue_check: "排队风险",
  fairness_check: "公平性"
};

const severityTone = {
  high: "red",
  medium: "yellow",
  low: "gray"
} as const;

const queueText = {
  low: "低",
  medium: "中",
  high: "高"
};

const auditTone = {
  pass: "green",
  risk: "yellow",
  fail: "red"
} as const;

const auditText = {
  pass: "通过",
  risk: "有风险",
  fail: "不通过"
};

function AuditList({ checks }: { checks: RestaurantCandidate["audit"]["hard_rules"] }) {
  return (
    <div className="space-y-2">
      {Object.entries(checks).map(([key, value]) => (
        <div className="flex items-center justify-between gap-3" key={key}>
          <span className="text-sm text-stone-600">{auditLabels[key] ?? key}</span>
          <StatusBadge tone={auditTone[value]}>{auditText[value]}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: RestaurantCandidate }) {
  return (
    <Card className="shadow-none" title={candidate.name}>
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusBadge tone={candidate.audit.passed ? "green" : "red"}>
          自检{candidate.audit.passed ? "通过" : "失败"}
        </StatusBadge>
        <StatusBadge tone="gray">{candidate.category}</StatusBadge>
        <StatusBadge tone="yellow">总分 {candidate.score}</StatusBadge>
      </div>

      <div className="space-y-1">
        <InfoRow label="人均" value={`${candidate.avg_price} 元`} />
        <InfoRow label="距离" value={`${candidate.distance_m}m / 步行 ${candidate.walk_minutes} 分钟`} />
        <InfoRow label="营业" value={`${candidate.open_time}-${candidate.close_time}`} />
        <InfoRow label="辣度" value={candidate.supports_spicy ? "可选辣度" : "无辣味亮点"} />
        <InfoRow label="不辣选项" value={candidate.supports_non_spicy ? "有" : "无"} />
        <InfoRow label="安静度" value={`${candidate.quiet_score}/5`} />
        <InfoRow label="排队风险" value={queueText[candidate.queue_risk]} />
      </div>

      <div className="mt-3">
        <p className="mb-2 text-sm font-semibold text-ink">成员满意度</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(candidate.member_scores).map(([name, score]) => (
            <div className="rounded-lg bg-stone-50 px-2 py-2 text-center" key={name}>
              <p className="text-xs text-stone-500">{name}</p>
              <p className="text-base font-bold text-ink">{score}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-stone-600">{candidate.reason}</p>
    </Card>
  );
}

export default function DinnerBoardPage() {
  const [showResults, setShowResults] = useState(true);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/dinner/${demoTaskId}/fill`;
    }

    return `${window.location.origin}/dinner/${demoTaskId}/fill`;
  }, []);

  async function copyGroupMessage() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(demoTask.group_message);
    }
  }

  async function copyShareLink() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
  }

  return (
    <Shell
      eyebrow={demoTask.task_id}
      title="任务看板与推荐结果"
      subtitle="D0-D3 阶段使用固定 mock 数据展示完整链路，不依赖后端、数据库或真实 API。"
    >
      <div className="space-y-4">
        <Card title="任务信息">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge tone="green">done</StatusBadge>
            <StatusBadge tone="yellow">{demoTask.dinner_time}</StatusBadge>
          </div>
          <div className="space-y-1">
            <InfoRow label="标题" value={demoTask.title} />
            <InfoRow label="需求" value={demoTask.raw_request} />
            <InfoRow label="地点" value={demoTask.location_text} />
            <InfoRow label="人数" value={`${demoTask.participants.length} / ${demoTask.expected_people_count}`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="rounded-lg border border-line bg-white px-3 py-3 text-sm font-bold text-ink active:scale-[0.99]"
              type="button"
              onClick={copyShareLink}
            >
              复制填写链接
            </button>
            <Link
              className="rounded-lg bg-brand px-3 py-3 text-center text-sm font-bold text-ink active:scale-[0.99]"
              href={`/dinner/${demoTaskId}/fill`}
            >
              去填写页
            </Link>
          </div>
        </Card>

        <Card title="成员偏好">
          <div className="space-y-3">
            {demoTask.participants.map((participant) => (
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-3" key={participant.participant_id}>
                <p className="font-bold text-ink">{participant.nickname}</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{participant.raw_preference}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="硬约束 / 软偏好">
          <div className="space-y-3">
            <div className="rounded-lg bg-red-50 p-3">
              <p className="mb-2 text-sm font-bold text-red-700">硬约束</p>
              <ul className="space-y-1 text-sm leading-6 text-red-900">
                {demoTask.participants.flatMap((participant) =>
                  participant.extracted_constraints.hard_constraints.map((constraint) => (
                    <li key={`${participant.nickname}-${constraint}`}>
                      {participant.nickname}：{constraint}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="mb-2 text-sm font-bold text-emerald-700">软偏好</p>
              <ul className="space-y-1 text-sm leading-6 text-emerald-900">
                {demoTask.participants.flatMap((participant) =>
                  participant.extracted_constraints.soft_preferences.map((preference) => (
                    <li key={`${participant.nickname}-${preference}`}>
                      {participant.nickname}：{preference}
                    </li>
                  ))
                )}
                {demoTask.global_constraints.atmosphere.map((item) => (
                  <li key={item}>全局：{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="冲突识别">
          <div className="space-y-3">
            {demoTask.conflicts.map((conflict) => (
              <div className="rounded-lg border border-stone-100 p-3" key={conflict.description}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-bold text-ink">{conflict.description}</p>
                  <StatusBadge tone={severityTone[conflict.severity]}>{conflict.severity}</StatusBadge>
                </div>
                <p className="text-sm leading-6 text-stone-600">{conflict.resolution_strategy}</p>
              </div>
            ))}
          </div>
        </Card>

        <button
          className="w-full rounded-lg bg-ink px-4 py-3 text-base font-bold text-white active:scale-[0.99]"
          type="button"
          onClick={() => setShowResults(true)}
        >
          生成推荐方案
        </button>

        {showResults ? (
          <>
            <Card title="候选餐厅">
              <div className="space-y-3">
                {demoTask.candidates.map((candidate) => (
                  <CandidateCard candidate={candidate} key={candidate.restaurant_id} />
                ))}
              </div>
            </Card>

            <Card title="自检结果">
              <div className="space-y-4">
                {demoTask.candidates.map((candidate) => (
                  <div className="rounded-lg border border-stone-100 p-3" key={candidate.restaurant_id}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-bold text-ink">{candidate.name}</h3>
                      <StatusBadge tone={candidate.audit.passed ? "green" : "red"}>
                        {candidate.audit.passed ? "可推荐" : "淘汰"}
                      </StatusBadge>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="mb-2 text-sm font-bold text-ink">硬规则检查</p>
                        <AuditList checks={candidate.audit.hard_rules} />
                      </div>
                      <div className="rounded-lg bg-stone-50 p-3">
                        <p className="mb-2 text-sm font-bold text-ink">软检查</p>
                        <AuditList checks={candidate.audit.soft_checks} />
                      </div>
                      <div className="rounded-lg bg-yellow-50 p-3">
                        <p className="mb-1 text-sm font-bold text-yellow-900">LLM 解释</p>
                        <p className="text-sm leading-6 text-yellow-950">{candidate.audit.llm_explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="最终推荐">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xl font-bold text-emerald-800">{demoTask.final_choice.name}</p>
                <p className="mt-2 text-sm leading-6 text-emerald-950">{demoTask.final_choice.reason}</p>
              </div>
              <div className="mt-3 space-y-2">
                {demoTask.final_choice.risks.map((risk) => (
                  <p className="rounded-lg bg-yellow-50 px-3 py-2 text-sm leading-6 text-yellow-900" key={risk}>
                    {risk}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm text-stone-600">备选：{demoTask.final_choice.backup}</p>
            </Card>

            <Card title="群聊邀约文案">
              <p className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-700">{demoTask.group_message}</p>
              <button
                className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-base font-bold text-ink active:scale-[0.99]"
                type="button"
                onClick={copyGroupMessage}
              >
                一键复制
              </button>
            </Card>

            <Card title="普通 AI vs 自检 Agent">
              <div className="grid gap-3">
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-bold text-red-700">普通 AI 可能会推荐</p>
                  <p className="text-sm leading-6 text-red-950">{demoTask.normal_ai_message}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="mb-2 text-sm font-bold text-emerald-700">我们的 Agent 推荐</p>
                  <p className="text-sm leading-6 text-emerald-950">
                    {demoTask.final_choice.name}：硬规则和软检查分层展示，先保护不可违反约束，再做满意度和公平性排序。
                  </p>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </Shell>
  );
}
