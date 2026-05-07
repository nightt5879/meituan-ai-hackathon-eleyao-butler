"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Shell } from "@/components/Shell";
import { demoTaskId } from "@/lib/mockData";
import { getParticipantsForBoard, getStoredTask, saveStoredParticipant } from "@/lib/storage";
import type { DinnerTask, Participant } from "@/lib/types";

export default function FillPage() {
  const [task, setTask] = useState<DinnerTask>(() => getStoredTask());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [nickname, setNickname] = useState("我");
  const [preference, setPreference] = useState("我完全不吃辣，预算 80 内。");
  const [budgetMax, setBudgetMax] = useState("80");
  const [spicyPreference, setSpicyPreference] = useState<"spicy" | "no_spicy" | "any">("no_spicy");
  const [leaveBefore, setLeaveBefore] = useState("20:30");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setTask(getStoredTask());
    setParticipants(getParticipantsForBoard());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextParticipants = saveStoredParticipant({
      nickname,
      raw_preference: preference,
      manual_fields: {
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        spicy_preference: spicyPreference,
        leave_before: leaveBefore || undefined
      }
    });
    setParticipants(nextParticipants);
    setSubmitted(true);
  }

  return (
    <Shell
      eyebrow={demoTaskId}
      title="填写我的约饭偏好"
      subtitle="提交后会写入 localStorage，看板页会立即读取新增或更新后的成员偏好。"
    >
      <Card title={task.title}>
        <p className="text-sm leading-6 text-stone-600">{task.raw_request}</p>
        <div className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-900">
          已收集 {participants.length || task.participants.length} / {task.expected_people_count} 人
        </div>
      </Card>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">昵称</span>
              <input
                className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">自然语言偏好</span>
              <textarea
                className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-3 text-base leading-6 outline-none focus:border-yellow-400"
                value={preference}
                onChange={(event) => setPreference(event.target.value)}
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">预算上限</span>
                <input
                  className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                  inputMode="numeric"
                  value={budgetMax}
                  onChange={(event) => setBudgetMax(event.target.value)}
                  placeholder="80"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">最晚离开</span>
                <input
                  className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                  type="time"
                  value={leaveBefore}
                  onChange={(event) => setLeaveBefore(event.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">是否吃辣</span>
              <select
                className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                value={spicyPreference}
                onChange={(event) => setSpicyPreference(event.target.value as "spicy" | "no_spicy" | "any")}
              >
                <option value="spicy">能吃辣</option>
                <option value="no_spicy">不吃辣</option>
                <option value="any">无所谓</option>
              </select>
            </label>

            <button className="w-full rounded-lg bg-ink px-4 py-3 text-base font-bold text-white active:scale-[0.99]" type="submit">
              提交偏好
            </button>
          </div>
        </Card>
      </form>

      {submitted ? (
        <Card className="mt-4" eyebrow="已提交" title={`${nickname || "我"} 的偏好已记录`}>
          <p className="text-sm leading-6 text-stone-600">{preference}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map((participant) => (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700" key={participant.participant_id}>
                {participant.nickname}
              </span>
            ))}
          </div>
          <Link
            className="mt-4 block rounded-lg bg-brand px-4 py-3 text-center text-base font-bold text-ink active:scale-[0.99]"
            href={`/dinner/${demoTaskId}`}
          >
            查看任务看板
          </Link>
        </Card>
      ) : null}
    </Shell>
  );
}
