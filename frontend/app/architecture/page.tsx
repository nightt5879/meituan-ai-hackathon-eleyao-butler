const layers = [
  {
    name: "体验层",
    detail: "微信小程序与 Web 体验并行。Web 版复刻小程序流程，用 demo session 替代 wx.login。"
  },
  {
    name: "服务层",
    detail: "Next.js App Router 同时承载作品页、在线体验页面和 API routes。"
  },
  {
    name: "AI 管家层",
    detail: "OpenClaw 负责单人推荐和动态追问；不可用时 Web 体验降级到本地推荐，保证评审流程不断。"
  },
  {
    name: "数据层",
    detail: "任务、登录 session、周末规划写入服务端 JSON store；浏览器本地保留记忆、收藏和草稿。"
  }
];

const flows = [
  ["Demo 登录", "POST /api/demo/session", "派生稳定 demo userId，返回 Bearer token"],
  ["今天吃什么", "POST /api/food/recommend", "OpenClaw 推荐，失败时使用本地候选方案"],
  ["多人约饭", "POST /api/group-tasks", "创建 invite token，看板按 token 读取和提交成员"],
  ["周末轻规划", "POST /api/weekend/plans", "服务端路线生成，天气失败时保守 fallback"],
  ["记忆设置", "localStorage + profile 预留", "Web 端即时生效，后续可接入服务端画像"]
];

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen bg-[#f8faf9] text-[#12342f]">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <a className="text-sm font-bold text-emerald-700" href="/">返回作品首页</a>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight md:text-5xl">整体设计与架构</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
            Web 作品页不是小程序的替代品，而是面向评审的可访问镜像：保持产品能力一致，复用现有后端链路，同时用浏览器友好的身份、路由和存储方式承载完整体验。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="grid gap-5 md:grid-cols-4">
          {layers.map((layer) => (
            <div className="rounded-md border border-emerald-100 bg-white p-5 shadow-sm" key={layer.name}>
              <h2 className="text-xl font-black text-emerald-950">{layer.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{layer.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-md border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-emerald-950">核心链路</h2>
            <div className="mt-5 space-y-3">
              {flows.map(([name, api, detail]) => (
                <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-4 md:grid-cols-[150px_220px_1fr]" key={name}>
                  <div className="font-bold text-emerald-950">{name}</div>
                  <code className="text-sm text-emerald-800">{api}</code>
                  <div className="text-sm leading-6 text-slate-600">{detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-emerald-950">用户研究依据</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              项目围绕“多人约饭/聚会”这类高频但容易纠结的决策场景展开，AI 管家负责收集偏好、解释取舍并生成可执行方案。
            </p>
            <img
              alt="多人约饭核心链路用户研究图"
              className="mt-5 w-full rounded-md border border-slate-100"
              src="/assets/group-dining-funnel.png"
            />
          </div>
        </div>

        <div className="mt-10 rounded-md border border-emerald-100 bg-emerald-950 p-6 text-white shadow-sm">
          <h2 className="text-2xl font-black">部署说明</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-emerald-50">
            服务器只需要运行一个 Next.js Node 服务。Nginx 反代到 `127.0.0.1:3001`，OpenClaw 与 JSON store 路径通过服务端环境变量配置。评审访问的公开链接指向 `/`，在线体验入口为 `/experience`。
          </p>
        </div>
      </section>
    </main>
  );
}
