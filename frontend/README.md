# Meituan H5 MVP Frontend

这是多人约饭 H5 MVP 的 Next.js 前端。当前阶段使用 Next.js API routes 和服务端 JSON 文件保存共享状态，仍然只使用 mock 餐厅数据和规则版 mock Agent。

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

如果数据文件不存在，API 会自动用 `frontend/lib/mockData.ts` 初始化 `demo-dinner-001`。

## 初始化 Demo

首次访问任意 task API 时会自动创建默认 demo 数据。也可以在看板页点击“重置 demo 数据”，它会调用：

```text
POST /api/tasks/:taskId/reset
```

并恢复默认小林 / 阿杰 / 小周三人 mock 数据。

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

## 当前边界

- 多人约饭 H5 仍不接真实 OpenClaw；小程序单人约饭通过 `/api/food/recommend` 接云端 OpenClaw Gateway。
- 不接美团 / 大众点评 / 地图等外部 API。
- 不注册或配置云数据库。
- 多人 H5 推荐仍复用 `frontend/lib/mockFunctions.ts` 的规则版 mock Agent。

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
groupDiningApiBaseUrl: 'https://your-backend.example.com'
```

## 小程序单人约饭 OpenClaw 配置

`POST /api/food/recommend` 是微信小程序「今天吃什么」接 OpenClaw 的后端代理接口。这个接口不提供后端 mock provider；正常路径必须调用云端 OpenClaw Gateway。

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
foodRecommendApiBaseUrl: 'https://your-backend.example.com'
```

OpenClaw Gateway token 只放后端环境变量，不能写进小程序。
