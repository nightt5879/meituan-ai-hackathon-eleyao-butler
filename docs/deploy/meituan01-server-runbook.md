# meituan01 服务器部署验证 Runbook

用于把 PR #95 分支部署到已有服务器域名，并验证 issue #96 的账号、记忆和三功能信息流。

已知线上入口：

- 公网域名：`https://meituan-ai-hackathon.cn`
- Nginx 反代：`127.0.0.1:3001`
- 历史生产工作目录：`/home/nightt/.openclaw/workspace-meituan01/meituan_prj_main/frontend`
- 当前验证分支：`nightt5879/issue-94-web-single-experience`

## 1. 进入线上工作目录

```bash
cd /home/nightt/.openclaw/workspace-meituan01/meituan_prj_main
git status --short --branch
git remote -v
```

如果工作区有未保存修改，先停下来确认，不要直接覆盖。

## 2. 拉取并切到验证分支

```bash
git fetch origin --prune
git switch nightt5879/issue-94-web-single-experience || git switch -c nightt5879/issue-94-web-single-experience origin/nightt5879/issue-94-web-single-experience
git pull --ff-only
```

## 3. 准备稳定数据目录

```bash
mkdir -p /home/nightt/.openclaw/workspace-meituan01/meituan_prj_state
```

建议启动 Next 服务时带上这些环境变量：

```bash
export MEITUAN_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/dinner-tasks.json
export MEITUAN_AUTH_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/wechat-auth-sessions.json
export MEITUAN_USER_PROFILE_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/user-profiles.json
export MEITUAN_WEEKEND_STATE_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/weekend-plans.json
export MEITUAN_OPENCLAW_FEED_AUDIT_FILE=/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/openclaw-feed-audit.json
export MEITUAN_REMOTE_API_BASE_URL=https://meituan-ai-hackathon.cn
```

OpenClaw 环境变量沿用服务器现有配置。不要把 token 写进仓库：

```bash
export OPENCLAW_GATEWAY_URL=ws://127.0.0.1:19789
export OPENCLAW_PROFILE=meituan01
export OPENCLAW_AGENT_ID=main
export OPENCLAW_CHAT_SESSION_ID=meituan-single-food
export OPENCLAW_CHAT_SESSION_KEY=meituan-single-food
export OPENCLAW_DATA_FEED_TIMEOUT_MS=20000
# export OPENCLAW_GATEWAY_TOKEN=服务器现有 token
```

## 4. 安装并构建

```bash
cd /home/nightt/.openclaw/workspace-meituan01/meituan_prj_main/frontend
npm ci
npm run build
```

## 5. 重启线上 Next 服务

先确认当前 3001 进程：

```bash
ps -ef | grep -E 'next start|next-server|npm run start' | grep -v grep
ss -lntp | grep ':3001' || true
```

如果当前服务就是这个目录启动的，先按上面命令确认 3001 监听进程 PID，再停止旧进程并后台启动新服务。示例：

```bash
kill <3001监听进程PID>
nohup npm run start >/home/nightt/.openclaw/workspace-meituan01/meituan_prj_state/next-start.log 2>&1 &
sleep 3
curl -i http://127.0.0.1:3001/api/health
curl -i https://meituan-ai-hackathon.cn/api/health
```

如果你用 pm2/systemd 管理服务，改为用对应方式 restart，关键是保留第 3 步的环境变量。

## 6. 验证默认信息流

默认验证不会调用 `/api/food/recommend` 正式递交 OpenClaw 推荐：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn
```

预期全部 PASS，最后显示：

```text
All server flow checks passed for https://meituan-ai-hackathon.cn
```

这代表以下链路已在同一个线上域名下跑通：

- health
- food ping/status
- demo session
- user profile read/init
- 今天吃什么餐厅排序信息流
- 多人约饭创建、提交、推荐
- 周末规划生成

## 7. 二阶段递交 OpenClaw 推荐

确认默认信息流 PASS 后，再显式递交一次 OpenClaw 推荐：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn --include-openclaw-recommend
```

如果这一步失败，但第 6 步通过，说明账号、记忆和三功能主链路已经通，问题集中在 OpenClaw 推荐生成阶段。

## 8. 验证三条业务通路喂给 OpenClaw

如果要确认不只是单人推荐，而是单人、多人、周末三条数据通路都能把服务端上下文提交给 OpenClaw，执行：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn --include-openclaw-feed
```

预期输出里会看到：

- `food OpenClaw context`：单人推荐 prompt 已包含画像和当前决策上下文。
- `group OpenClaw context`：多人约饭 prompt 已包含任务、成员偏好和冲突上下文。
- `weekend OpenClaw context`：周末规划生成后已向 OpenClaw 投递路线、天气和规划来源上下文。

服务端诊断字段只返回 `traceId`、`sessionRef`、`contextBlocks` 和提交状态，不返回 openid、session token、服务器路径或密钥。默认审计文件为 `.data/openclaw-feed-audit.json`；线上建议通过 `MEITUAN_OPENCLAW_FEED_AUDIT_FILE` 指到稳定状态目录。
