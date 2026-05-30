# 服务器完整信息流部署验证

对应 issue: https://github.com/nightt5879/meituan_prj/issues/96

## 结论先行

历史临时域名不是整体 ping 不通；正式入口迁移后以 `https://meituan-ai-hackathon.cn` 为准。当前已确认：

- `GET /api/food/ping` 能返回 200。
- `GET /api/food/status` 能返回 `backend.ok=true`，并能看到 OpenClaw Gateway 可达。
- 本地 Web 预览如果直接调用远端推荐接口，会因为 session token 不是远端同域生成而 401。

所以服务器侧要验证的是“同一个线上 Next 服务”是否同时承载账号、记忆和三个功能，而不是用本地 token 去打远端推荐接口。

## 需要部署到服务器的能力

- Web 入口：`/`、`/experience`
- 账号/session：`POST /api/demo/session`
- 画像/记忆壳：`GET /api/user/profile`、`POST /api/user/profile/init`
- 今天吃什么信息流：
  - 默认 smoke test 只验证 `/api/restaurants/rank`
  - 需要递交 OpenClaw 时再显式验证 `/api/food/recommend`
- 多人约饭：`/api/group-tasks`
- 周末轻规划：`/api/weekend/plans`
- OpenClaw 状态：`/api/food/ping`、`/api/food/status`

## 建议服务器环境变量

将运行态 JSON store 指到稳定目录，避免写在临时目录或被重新部署清掉：

```bash
export MEITUAN_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/dinner-tasks.json
export MEITUAN_AUTH_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/wechat-auth-sessions.json
export MEITUAN_USER_PROFILE_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/user-profiles.json
export MEITUAN_WEEKEND_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/weekend-plans.json
export MEITUAN_OPENCLAW_FEED_AUDIT_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/openclaw-feed-audit.json
```

OpenClaw 相关配置保持在服务端：

```bash
export OPENCLAW_GATEWAY_URL=ws://127.0.0.1:19789
export OPENCLAW_PROFILE=meituan01
export OPENCLAW_AGENT_ID=main
export OPENCLAW_CHAT_SESSION_ID=meituan-single-food
export OPENCLAW_CHAT_SESSION_KEY=meituan-single-food
export OPENCLAW_GATEWAY_TIMEOUT_MS=130000
export OPENCLAW_DATA_FEED_TIMEOUT_MS=130000
```

如果使用 Gateway token，也只放在服务端环境变量里：

```bash
export OPENCLAW_GATEWAY_TOKEN=...
```

## 部署后验证

服务器 pull/build/restart 之后，在 `frontend` 目录执行：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn
```

默认验证内容：

1. `/api/health`
2. `/api/food/ping`
3. `/api/food/status`
4. `/api/demo/session`
5. `/api/user/profile`
6. `/api/user/profile/init`
7. `/api/restaurants/rank`
8. 多人约饭创建、提交参与者、生成推荐
9. 周末规划生成

默认不会调用 `/api/food/recommend`，也就是不会正式递交 OpenClaw 生成推荐。

需要二阶段验证 OpenClaw 推荐时，再显式加开关：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn --include-openclaw-recommend
```

需要验证三条业务数据通路都能喂给 OpenClaw 时，使用更完整的开关：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn --include-openclaw-feed
```

这个模式会验证：

1. 单人「今天吃什么」推荐 prompt 带上 `user_profile`、`food_preferences`、`food_decision_sheet` 和当前请求上下文。
2. 多人约饭推荐 prompt 带上 `group_task`、`participants`、`conflicts` 和候选餐厅上下文。
3. 周末规划生成后向 OpenClaw 投递 `weekend_request`、`weather_context`、`route_candidates` 和规划来源上下文。

接口响应只暴露 `traceId`、`sessionRef`、`contextBlocks`、`status` 等诊断字段，不暴露 openid、session token、服务器路径或真实密钥。服务端会额外写入 `.data/openclaw-feed-audit.json`，可通过 `MEITUAN_OPENCLAW_FEED_AUDIT_FILE` 覆盖路径。

本地没有 OpenClaw Gateway 时，可以只做非 OpenClaw dry run：

```bash
npm run verify:server-flow -- --base-url http://127.0.0.1:3002 --skip-openclaw-status
```

## 预期现象

- 如果服务器还没有部署包含 `/api/demo/session` 的版本，smoke test 会在 `demo account session` 失败，这是预期信号。
- 如果 `/api/food/status` 里 CLI status 超时，但 `gatewayReachable=true`，第一阶段可视为 Gateway 联通。
- 如果默认 smoke test 全部 PASS，说明账号、记忆壳、三功能信息流已经在同一个服务器域名下跑通。
