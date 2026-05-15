"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { InfoRow } from "@/components/InfoRow";
import { Shell } from "@/components/Shell";
import { createTask, type CreateTaskResponse } from "@/lib/apiClient";
import { demoTask } from "@/lib/mockData";

export default function CreatePage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState(demoTask.creator_name);
  const [rawRequest, setRawRequest] = useState(demoTask.raw_request);
  const [locationText, setLocationText] = useState(demoTask.location_text);
  const [peopleCount, setPeopleCount] = useState(demoTask.expected_people_count);
  const [dinnerTime, setDinnerTime] = useState(demoTask.dinner_time);
  const [createdTask, setCreatedTask] = useState<CreateTaskResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await createTask({
        creator_name: creatorName,
        raw_request: rawRequest,
        location_text: locationText,
        expected_people_count: peopleCount,
        dinner_time: dinnerTime
      });
      setCreatedTask(result);
      router.push(`/dinner/${result.task_id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "创建任务失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShareLink() {
    if (navigator.clipboard && createdTask) {
      await navigator.clipboard.writeText(createdTask.fill_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <Shell
      eyebrow="shared backend mock loop"
      title="创建多人约饭任务"
      subtitle="填写后会保存到服务端共享状态，并进入对应任务看板。"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">发起人昵称</span>
              <input
                className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                value={creatorName}
                onChange={(event) => setCreatorName(event.target.value)}
                placeholder="默认为我"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">原始需求</span>
              <textarea
                className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-3 text-base leading-6 outline-none focus:border-yellow-400"
                value={rawRequest}
                onChange={(event) => setRawRequest(event.target.value)}
                required
                placeholder="比如：明晚三个人学校附近吃饭..."
              />
            </label>

            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">地点</span>
                <input
                  className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                  value={locationText}
                  onChange={(event) => setLocationText(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">预计人数</span>
                <input
                  className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                  min={1}
                  type="number"
                  value={peopleCount}
                  onChange={(event) => setPeopleCount(Number(event.target.value))}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">约饭时间</span>
              <input
                className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-yellow-400"
                value={dinnerTime}
                onChange={(event) => setDinnerTime(event.target.value)}
              />
            </label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

            <button
              className="w-full rounded-lg bg-ink px-4 py-3 text-base font-bold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-400"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "创建中..." : "创建 demo 任务"}
            </button>
          </div>
        </Card>
      </form>

      <Card className="mt-4" eyebrow="共享任务链接" title="分享给成员填写">
        {createdTask ? (
          <div className="space-y-1">
            <InfoRow label="任务 ID" value={createdTask.task_id} />
            <InfoRow label="填写链接" value={<span className="break-all">{createdTask.fill_url}</span>} />
          </div>
        ) : (
          <p className="text-sm leading-6 text-stone-600">创建成功后会进入看板，看板里可以复制当前任务的填写链接。</p>
        )}
        <button
          className="mt-4 w-full rounded-lg border border-line bg-white px-4 py-3 text-base font-bold text-ink active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
          type="button"
          onClick={copyShareLink}
          disabled={!createdTask}
        >
          {copied ? "已复制" : "复制分享链接"}
        </button>
      </Card>
    </Shell>
  );
}
