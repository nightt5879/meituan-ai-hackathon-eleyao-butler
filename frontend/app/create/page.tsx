"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { InfoRow } from "@/components/InfoRow";
import { Shell } from "@/components/Shell";
import { demoTaskId } from "@/lib/mockData";

export default function CreatePage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("小林");
  const [rawRequest, setRawRequest] = useState("明晚三个人想在学校附近吃饭，人均 100 以内，适合聊天，别太吵。");
  const [locationText, setLocationText] = useState("学校附近");
  const [peopleCount, setPeopleCount] = useState(3);
  const [dinnerTime, setDinnerTime] = useState("明晚 18:30");
  const [created, setCreated] = useState(false);

  const sharePath = `/dinner/${demoTaskId}/fill`;
  const boardPath = `/dinner/${demoTaskId}`;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return sharePath;
    }

    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(true);
  }

  async function copyShareLink() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
  }

  return (
    <Shell
      eyebrow="D0-D3 mock demo"
      title="创建多人约饭任务"
      subtitle="先用固定 demo task 跑通创建、分享、填写、看板和推荐展示。"
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

            <div className="grid grid-cols-2 gap-3">
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

      {created ? (
        <Card className="mt-4" eyebrow="创建成功" title="明晚三人学校附近约饭">
          <div className="space-y-1">
            <InfoRow label="任务 ID" value={demoTaskId} />
            <InfoRow label="发起人" value={creatorName || "我"} />
            <InfoRow label="地点" value={locationText || "学校附近"} />
            <InfoRow label="人数" value={`${peopleCount || 3} 人`} />
            <InfoRow label="分享链接" value={<span className="break-all">{shareUrl}</span>} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="rounded-lg border border-line bg-white px-3 py-3 text-sm font-bold text-ink active:scale-[0.99]"
              type="button"
              onClick={copyShareLink}
            >
              复制链接
            </button>
            <button
              className="rounded-lg bg-brand px-3 py-3 text-sm font-bold text-ink active:scale-[0.99]"
              type="button"
              onClick={() => router.push(boardPath)}
            >
              进入看板
            </button>
          </div>
        </Card>
      ) : null}
    </Shell>
  );
}
