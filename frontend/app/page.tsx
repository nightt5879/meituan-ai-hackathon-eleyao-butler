const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "";

const entryCards = [
  {
    title: "AI 管家演示视频",
    description: "放置最终小程序录屏，展示从偏好确认到推荐生成的完整体验。",
    href: demoVideoUrl || "#demo-video",
    cta: demoVideoUrl ? "打开视频" : "查看占位"
  },
  {
    title: "GitHub 仓库",
    description: "查看完整源码、issue 推进记录和比赛交付分支。",
    href: "https://github.com/nightt5879/meituan_prj",
    cta: "访问仓库"
  },
  {
    title: "整体设计与架构",
    description: "了解小程序、Web 体验、Next API、OpenClaw 与数据存储的协作关系。",
    href: "/architecture",
    cta: "查看架构"
  },
  {
    title: "在线体验",
    description: "使用 demo 身份在浏览器里完整体验当前 mini-program 的核心功能。",
    href: "/experience",
    cta: "开始体验"
  }
];

const capabilityItems = [
  "今天吃什么：偏好问答、动态追问、推荐卡片、调整反馈、长期记忆",
  "多人约饭：创建任务、成员填写、看板、冲突识别、推荐生成、复制分享",
  "周末轻规划：时间预算表单、路线生成、天气/后端失败降级",
  "AI 管家记忆：忌口、偏好、权限开关、历史记录和收藏"
];

export default function PortfolioHomePage() {
  return (
    <main className="min-h-screen bg-[#f7fbf7] text-[#12342f]">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[1.08fr_0.92fr] md:px-8 md:py-14">
          <div className="flex min-h-[520px] flex-col justify-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Meituan AI Butler Preview</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
              饿了幺 AI 管家
              <span className="block text-emerald-700">最终作品预览网页</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              这是面向比赛评审的可访问版本：保留微信小程序的完整产品能力，同时用 Web demo 身份替代真实微信登录，方便在浏览器直接体验。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800" href="/experience">
                打开在线体验
              </a>
              <a className="rounded-md border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:border-emerald-500" href="/architecture">
                查看架构说明
              </a>
            </div>
            <div className="mt-10 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {capabilityItems.map((item) => (
                <div className="rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-[390px] rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#effff8]">
                <div className="flex items-center justify-between border-b border-emerald-100 bg-white px-5 py-4">
                  <span className="text-sm font-bold text-emerald-900">今天吃什么</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">OpenClaw 已连接</span>
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-md bg-white p-4 text-sm leading-6 shadow-sm">
                    我会结合你的场景、预算、距离和偏好，给你 2-3 个可执行方案。
                  </div>
                  {["法式甜品下午茶", "手作千层蛋糕店", "精品咖啡甜品馆"].map((name, index) => (
                    <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm" key={name}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-lg font-black text-emerald-950">{name}</h3>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{index === 0 ? "首推" : "备选"}</span>
                      </div>
                      <p className="text-sm text-slate-600">人均 {index === 0 ? 68 : index === 1 ? 58 : 72} 元 · {index === 0 ? 650 : index === 1 ? 800 : 950} m · 评分 4.{7 - index}</p>
                      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">管家提醒：高峰期建议提前确认座位和库存。</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8" id="demo-video">
        <div className="grid gap-5 md:grid-cols-4">
          {entryCards.map((card) => (
            <a
              className="group rounded-md border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
              href={card.href}
              key={card.title}
              rel={card.href.startsWith("http") ? "noreferrer" : undefined}
              target={card.href.startsWith("http") ? "_blank" : undefined}
            >
              <h2 className="text-xl font-black text-emerald-950">{card.title}</h2>
              <p className="mt-3 min-h-24 text-sm leading-6 text-slate-600">{card.description}</p>
              <span className="mt-4 inline-flex text-sm font-bold text-emerald-700 group-hover:text-emerald-900">{card.cta}</span>
            </a>
          ))}
        </div>
        {!demoVideoUrl ? (
          <div className="mt-8 rounded-md border border-dashed border-emerald-300 bg-white p-6">
            <h2 className="text-2xl font-black text-emerald-950">演示视频占位</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              部署时配置 <code className="rounded bg-slate-100 px-1 py-0.5">NEXT_PUBLIC_DEMO_VIDEO_URL</code> 后，这里会直接跳转到小程序演示视频。当前可先使用在线体验作为可访问作品链接。
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
