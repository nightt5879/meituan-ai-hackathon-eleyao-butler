# Meituan Next.js API and Web Frontend

这是「饿了幺」的 Next.js API 与 Web 作品站工作区。它同时承载作品展示页、在线体验页、小程序后端接口、OpenClaw 服务端代理、自建结构化本地生活数据层和 fallback 兜底逻辑。

当前三个核心模块都已经接入 AI / OpenClaw / AI 上下文链路：

- `今天吃什么`：通过 `/api/food/recommend` 调用服务端 OpenClaw 推荐链路，结合自建餐厅数据层和用户偏好输出 2-3 个候选。
- `多人约饭`：通过 `/api/group-tasks` 系列接口同步多人状态，支持 AI 辅助偏好理解、冲突识别、推荐生成和服务端自检。
- `周边规划`：通过 `/api/weekend/plans` 结合 Open-Meteo 真实天气、自建 POI/活动数据集和 AI 上下文链路生成路线。

项目不声称使用美团 / 点评 / 地图官方商户库；当前使用的是自建 seed dataset。远端 OpenClaw、天气或后端链路不可用时，会切换到本地 fallback dataset + 规则兜底，保证演示流程不中断。

## OpenClaw 版本与 Skill 对应

线上评审环境实查版本：

- OpenClaw CLI / Gateway: `2026.5.27 (27ae826)`
- profile: `meituan01`
- Gateway: server-side loopback only, `127.0.0.1:19789 / [::1]:19789`
- default agent: `main`
- default model: `deepseek-v4-flash`
- context window: `128000`

仓库内 Skill 包见 [`../skills/README.md`](../skills/README.md)。三个 Skill 与本工作区 API 的对应关系：

| Skill | API | 后端实现入口 |
| --- | --- | --- |
| `eleyao-food-butler` | `POST /api/food/recommend` | `lib/server/openclawFoodRecommendation.ts` |
| `eleyao-group-dining` | `POST /api/group-tasks/:taskId/recommend` | `lib/server/openclawRecommendation.ts` |
| `eleyao-weekend-planner` | `POST /api/weekend/plans` | `lib/server/weekendPlanner.ts` |

OpenClaw CLI 路径、Gateway URL/token、AppSecret 和模型密钥只允许存在于服务端环境变量或 systemd drop-in 中，不能进入前端、小程序或仓库文档。

## 本地安装

```powershell
npm.cmd install
```

## 本地启动

```powershell
npm.cmd run dev
```

默认访问：

- 创建页：`http://localhost:3000/create`
- 默认 demo 看板：`http://localhost:3000/dinner/demo-dinner-001`
- 默认 demo 填写页：`http://localhost:3000/dinner/demo-dinner-001/fill`

## 数据存储位置

默认 JSON 数据文件：

```text
frontend/.data/dinner-tasks.json
```

该目录是运行时数据，已在仓库根 `.gitignore` 中忽略，不应提交。

可以用环境变量覆盖数据文件路径：

```powershell
$env:MEITUAN_STATE_FILE="D:\tmp\meituan-h5\dinner-tasks.json"
npm.cmd run dev
```

如果数据文件不存在，API 会自动初始化一份 `demo-dinner-001` seed 任务，便于本地验证共享状态。

## 初始化 Demo

首次访问任意 task API 时会自动创建默认 demo 数据。也可以在看板页点击“重置 demo 数据”，它会调用：

```text
POST /api/tasks/:taskId/reset
```

并恢复默认小林 / 阿杰 / 小周三人 seed 数据。

## 双浏览器共享验证

1. 在普通浏览器打开 `http://localhost:3000/create` 创建任务。
2. 进入看板后复制“填写链接”。
3. 在 InPrivate / 无痕窗口打开填写链接，提交一个成员偏好。
4. 回到普通浏览器看板，刷新页面，确认成员偏好来自服务端共享状态。
5. 在普通浏览器点击“生成推荐方案”。
6. 在 InPrivate / 无痕窗口打开同一个看板链接，确认能看到同一份推荐结果。
7. 在任一窗口删除成员或新增同昵称成员，刷新另一个窗口，确认旧推荐失效并提示重新生成。

## 普通 Node 服务器部署注意事项

JSON 文件方案适合本地开发、单进程 demo、普通单实例 Node 服务。建议将 `MEITUAN_STATE_FILE` 指向一个可持久化目录，并确保运行用户有读写权限。

如果使用多进程、多副本、容器水平扩容，多个实例同时写同一个 JSON 文件会有一致性风险，应替换为 SQLite、数据库或 KV。

## Vercel Serverless 注意事项

Vercel serverless 不适合用本地 JSON 文件做长期持久化。函数文件系统不是跨实例共享的持久存储，`/tmp` 也只能临时使用。若部署到 Vercel 并需要跨设备长期共享状态，应改用 Vercel KV / Postgres / Blob 或其他外部持久化。

## 数据与 AI 边界

- 三个小程序核心模块都通过后端 AI / OpenClaw / AI 上下文链路工作；Web 在线体验复用同一套 API 能力展示评审流程。
- 不接美团 / 大众点评 / 地图等外部商户 API，也不声称当前数据代表真实平台评分、销量、排队或库存。
- 不注册或配置云数据库。
- 自建餐厅/POI 数据层用于 Hackathon MVP 的可执行性验证；远端不可用时，fallback 会基于这份数据和简单规则给出保守结果。

## 小程序多人约饭后端 API

小程序多人约饭第一版不走 H5 页面，只复用当前 Next.js API 运行环境和 JSON 文件存储。创建任务会返回明文 `inviteToken`，服务端只保存 `sha256(inviteToken)`；读取、提交成员和生成推荐都必须带 token。

核心接口：

```text
GET  /api/health
POST /api/group-tasks
GET  /api/group-tasks/:taskId?inviteToken=...
POST /api/group-tasks/:taskId/participants
POST /api/group-tasks/:taskId/recommend
```

最小 curl 验收：

```powershell
$base="http://localhost:3000"
$task=Invoke-RestMethod "$base/api/group-tasks" -Method POST -ContentType "application/json" -Body (@{
  creatorName="小幺"
  rawRequest="周六晚上 5 个人聚餐，人均 80 内，适合聊天"
  locationText="学校东门"
  expectedPeopleCount=5
  dinnerTime="周六 18:30"
} | ConvertTo-Json)

$body=@{
  inviteToken=$task.inviteToken
  clientId="local_device_id"
  nickname="阿杰"
  rawPreference="我完全不吃辣，预算最好 80 内"
  manualFields=@{ budgetMax=80; spicyPreference="no_spicy"; leaveBefore="20:30" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod "$base/api/group-tasks/$($task.taskId)/participants" -Method POST -ContentType "application/json" -Body $body
Invoke-RestMethod "$base/api/group-tasks/$($task.taskId)/recommend" -Method POST -ContentType "application/json" -Body (@{ inviteToken=$task.inviteToken } | ConvertTo-Json)
```

小程序端配置后端 origin：

```js
groupDiningApiBaseUrl: 'https://meituan-ai-hackathon.cn'
```

## 小程序单人约饭 OpenClaw 配置

`POST /api/food/recommend` 是微信小程序「今天吃什么」接 OpenClaw 的后端代理接口。正常路径会调用云端 OpenClaw Gateway；若远端超时或响应不可用，接口会返回清晰的降级状态，前端可切换到本地 fallback 结果。

本地启动前配置：

```powershell
$env:OPENCLAW_GATEWAY_URL="wss://your-openclaw-gateway.example.com"
$env:OPENCLAW_GATEWAY_TOKEN="your-gateway-token"
npm.cmd run dev
```

可选变量：

```powershell
$env:OPENCLAW_GATEWAY_TIMEOUT_MS="30000"
$env:OPENCLAW_CHAT_SESSION_ID="food-recommendation"
$env:OPENCLAW_CHAT_SESSION_KEY="food-recommendation"
$env:OPENCLAW_AGENT_ID="agent-id"
```

小程序端只配置后端 origin，例如在 `mini-program/wechat-miniprogram/app.js` 里设置：

```js
foodRecommendApiBaseUrl: 'https://meituan-ai-hackathon.cn'
```

OpenClaw Gateway token 只放后端环境变量，不能写进小程序。

## 小程序周末轻规划 API

后端提供小程序周末轻规划接口，不走 H5 页面，不接真实地图/点评商户库。天气使用 Open-Meteo 广州番禺坐标，地点和活动来自学校周边自建结构化 POI/活动数据集，并会把用户条件、天气和路线候选写入 AI 上下文链路。

```text
POST /api/weekend/plans
GET  /api/weekend/plans/:planId
```

请求示例：

```json
{
  "timeWindow": "周六下午 3 小时",
  "budgetMax": 120,
  "startArea": "学校东门",
  "mood": "想轻松一点",
  "energyLevel": "中等",
  "companions": "朋友",
  "interests": ["咖啡", "citywalk", "拍照"],
  "rawText": "想在学校附近走走，不要太赶"
}
```

返回包含 `planId`、`weather`、`routes[3]` 和 `source`。每条路线包含时间线、预计预算、预计时长、地点/活动、交通说明、自检项、风险提示和邀约文案。

天气失败时返回 `weather.status = "unavailable"`、`weather.fallback = true`、`source.weather = "fallback-conservative"`，并仍生成 3 条保守路线。

本地可用环境变量：

```powershell
$env:MEITUAN_WEEKEND_STATE_FILE="D:\tmp\meituan\weekend-plans.json"
$env:MEITUAN_WEEKEND_WEATHER_DISABLED="1"
```
