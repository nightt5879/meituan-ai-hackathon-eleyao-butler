"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { InfoRow } from "@/components/InfoRow";
import { Shell } from "@/components/Shell";
import { demoTaskId } from "@/lib/mockData";
import { getStoredTask, saveStoredTask } from "@/lib/storage";

export default function CreatePage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("小林");
  const [rawRequest, setRawRequest] = useState("明晚三个人想在学校附近吃饭，人均 100 以内，适合聊天，别太吵。");
  const [locationText, setLocationText] = useState("学校附近");
  const [peopleCount, setPeopleCount] = useState(3);
  const [dinnerTime, setDinnerTime] = useState("明晚 18:30");
  const [copied, setCopied] = useState(false);

  const sharePath = `/dinner/${demoTaskId}/fill`;
  const boardPath = `/dinner/${demoTaskId}`;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return sharePath;
    }

    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);

  useEffect(() => {
    const task = getStoredTask();
    setCreatorName(task.creator_name);
    setRawRequest(task.raw_request);
    setLocationText(task.location_text);
    setPeopleCount(task.expected_people_count);
    setDinnerTime(task.dinner_time);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveStoredTask({
      creator_name: creatorName,
      raw_request: rawRequest,
      location_text: locationText,
      expected_people_count: peopleCount,
      dinner_time: dinnerTime
    });
    router.push(boardPath);
  }

  async function copyShareLink() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <Shell
      eyebrow="frontend mock loop"
      title="创建多人约饭任务"
      subtitle="填写后会保存到本机 localStorage，并进入固定 demo 看板。"
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

            <button className="w-full rounded-lg bg-ink px-4 py-3 text-base font-bold text-white active:scale-[0.99]" type="submit">
              创建 demo 任务
            </button>
          </div>
        </Card>
      </form>

      <Card className="mt-4" eyebrow="固定 demo 链接" title="分享给成员填写">
        <div className="space-y-1">
          <InfoRow label="任务 ID" value={demoTaskId} />
          <InfoRow label="填写链接" value={<span className="break-all">{shareUrl}</span>} />
        </div>
        <button
          className="mt-4 w-full rounded-lg border border-line bg-white px-4 py-3 text-base font-bold text-ink active:scale-[0.99]"
          type="button"
          onClick={copyShareLink}
        >
          {copied ? "已复制" : "复制分享链接"}
        </button>
      </Card>
    </Shell>
  );
}
