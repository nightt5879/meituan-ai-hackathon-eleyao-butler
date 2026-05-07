"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { InfoRow } from "@/components/InfoRow";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { demoTaskId } from "@/lib/mockData";
import { detectMockConflicts } from "@/lib/mockFunctions";
import { getParticipantsForBoard, getRecommendationState, getStoredTask, saveRecommendationState } from "@/lib/storage";
import type { Conflict, DinnerTask, Participant, RestaurantCandidate, TaskStatus } from "@/lib/types";

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

const statusTone: Record<TaskStatus, "green" | "yellow" | "red" | "gray"> = {
  waiting_preferences: "gray",
  ready_to_recommend: "yellow",
  recommending: "yellow",
  done: "green",
  failed: "red"
};

const statusText: Record<TaskStatus, string> = {
  waiting_preferences: "等待填写",
  ready_to_recommend: "可以生成",
  recommending: "生成中",
  done: "已生成",
  failed: "生成失败"
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

function ConstraintList({
  participants,
  kind
}: {
  participants: Participant[];
  kind: "hard_constraints" | "soft_preferences";
}) {
  const rows = participants.flatMap((participant) =>
    participant.extracted_constraints[kind].map((item) => ({
      key: `${participant.participant_id}-${kind}-${item}`,
      nickname: participant.nickname,
      item
    }))
  );

  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-stone-500">暂无明显{kind === "hard_constraints" ? "硬约束" : "软偏好"}。</p>;
  }

  return (
    <ul className="space-y-1 text-sm leading-6">
      {rows.map((row) => (
        <li key={row.key}>
          {row.nickname}：{row.item}
        </li>
      ))}
    </ul>
  );
}

export default function DinnerBoardPage() {
  const timerRef = useRef<number | null>(null);
  const [task, setTask] = useState<DinnerTask>(() => getStoredTask());
  const [participants, setParticipants] = useState<Participant[]>(() => getParticipantsForBoard());
  const [conflicts, setConflicts] = useState<Conflict[]>(() =>
    detectMockConflicts(getParticipantsForBoard(), getStoredTask().global_constraints.budget_max)
  );
  const [status, setStatus] = useState<TaskStatus>("ready_to_recommend");
  const [showResults, setShowResults] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [groupCopied, setGroupCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/dinner/${demoTaskId}/fill`;
    }

    return `${window.location.origin}/dinner/${demoTaskId}/fill`;
  }, []);

  useEffect(() => {
    const loadedTask = getStoredTask();
    const loadedParticipants = getParticipantsForBoard();
    const recommendationState = getRecommendationState();

    setTask(loadedTask);
    setParticipants(loadedParticipants);
    setConflicts(detectMockConflicts(loadedParticipants, loadedTask.global_constraints.budget_max));
    setStatus(recommendationState.status);
    setShowResults(recommendationState.hasGenerated && recommendationState.status === "done");

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function handleGenerate() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setStatus("recommending");
    setShowResults(false);
    saveRecommendationState({ status: "recommending", hasGenerated: false });

    timerRef.current = window.setTimeout(() => {
      setStatus("done");
      setShowResults(true);
      saveRecommendationState({ status: "done", hasGenerated: true });
    }, 950);
  }

  async function copyGroupMessage() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(task.group_message);
      setGroupCopied(true);
      window.setTimeout(() => setGroupCopied(false), 1600);
    }
  }

  async function copyShareLink() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1600);
    }
  }

  return (
    <Shell
      eyebrow={task.task_id}
      title="任务看板与推荐结果"
      subtitle="本页只运行前端 mock functions：先收集偏好，再点击生成推荐方案。"
    >
      <div className="space-y-4">
        <Card title="任务信息">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge tone={statusTone[status]}>{statusText[status]}</StatusBadge>
            <StatusBadge tone="yellow">{task.dinner_time}</StatusBadge>
          </div>
          <div className="space-y-1">
            <InfoRow label="标题" value={task.title} />
            <InfoRow label="需求" value={task.raw_request} />
            <InfoRow label="地点" value={task.location_text} />
            <InfoRow label="人数" value={`${participants.length} / ${task.expected_people_count}`} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <button
              className="rounded-lg border border-line bg-white px-3 py-3 text-sm font-bold text-ink active:scale-[0.99]"
              type="button"
              onClick={copyShareLink}
            >
              {shareCopied ? "已复制" : "复制填写链接"}
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
            {participants.map((participant) => (
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-3" key={participant.participant_id}>
                <p className="font-bold text-ink">{participant.nickname}</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{participant.raw_preference}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="硬约束 / 软偏好">
          <div className="space-y-3">
            <div className="rounded-lg bg-red-50 p-3 text-red-900">
              <p className="mb-2 text-sm font-bold text-red-700">硬约束</p>
              <ConstraintList kind="hard_constraints" participants={participants} />
            </div>

            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">
              <p className="mb-2 text-sm font-bold text-emerald-700">软偏好</p>
              <ConstraintList kind="soft_preferences" participants={participants} />
              <ul className="mt-2 space-y-1 text-sm leading-6">
                {task.global_constraints.atmosphere.map((item) => (
                  <li key={item}>全局：{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="冲突识别">
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <div className="rounded-lg border border-stone-100 p-3" key={conflict.description}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-bold leading-6 text-ink">{conflict.description}</p>
                  <StatusBadge tone={severityTone[conflict.severity]}>{conflict.severity}</StatusBadge>
                </div>
                <p className="text-sm leading-6 text-stone-600">{conflict.resolution_strategy}</p>
              </div>
            ))}
          </div>
        </Card>

        <button
          className="w-full rounded-lg bg-ink px-4 py-3 text-base font-bold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-400"
          type="button"
          disabled={status === "recommending"}
          onClick={handleGenerate}
        >
          {status === "recommending" ? "生成中..." : showResults ? "重新生成推荐方案" : "生成推荐方案"}
        </button>

        {status === "recommending" ? (
          <Card>
            <div className="rounded-lg bg-yellow-50 p-3 text-sm font-medium leading-6 text-yellow-900">
              Agent 正在串联 mock 积木：餐厅检索、满意度打分、硬规则自检、群聊文案生成。
            </div>
          </Card>
        ) : null}

        {showResults ? (
          <>
            <Card title="候选餐厅">
              <div className="space-y-3">
                {task.candidates.map((candidate) => (
                  <CandidateCard candidate={candidate} key={candidate.restaurant_id} />
                ))}
              </div>
            </Card>

            <Card title="自检结果">
              <div className="space-y-4">
                {task.candidates.map((candidate) => (
                  <div className="rounded-lg border border-stone-100 p-3" key={candidate.restaurant_id}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="font-bold leading-6 text-ink">{candidate.name}</h3>
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
                <p className="text-xl font-bold leading-7 text-emerald-800">{task.final_choice.name}</p>
                <p className="mt-2 text-sm leading-6 text-emerald-950">{task.final_choice.reason}</p>
              </div>
              <div className="mt-3 space-y-2">
                {task.final_choice.risks.map((risk) => (
                  <p className="rounded-lg bg-yellow-50 px-3 py-2 text-sm leading-6 text-yellow-900" key={risk}>
                    {risk}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm text-stone-600">备选：{task.final_choice.backup}</p>
            </Card>

            <Card title="群聊邀约文案">
              <p className="rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-700">{task.group_message}</p>
              <button
                className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-base font-bold text-ink active:scale-[0.99]"
                type="button"
                onClick={copyGroupMessage}
              >
                {groupCopied ? "已复制" : "一键复制"}
              </button>
            </Card>

            <Card title="普通 AI vs 自检 Agent">
              <div className="grid gap-3">
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-bold text-red-700">普通 AI 可能会推荐</p>
                  <p className="text-sm leading-6 text-red-950">{task.normal_ai_message}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="mb-2 text-sm font-bold text-emerald-700">我们的 Agent 推荐</p>
                  <p className="text-sm leading-6 text-emerald-950">
                    {task.final_choice.name}：硬规则和软检查分层展示，先保护不可违反约束，再做满意度和公平性排序。
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
