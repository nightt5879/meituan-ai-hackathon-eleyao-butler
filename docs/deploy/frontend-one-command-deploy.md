# 前端一键更新与部署

对应 issue: https://github.com/nightt5879/meituan_prj/issues/113

这个脚本用于服务器上更新仓库、构建 `frontend`，并只重启当前 `frontend` 目录对应的 Next 服务。

## 隐私原则

仓库内不记录个人服务器绝对路径、用户名、私有目录名或密钥。脚本默认使用相对仓库路径：

- 仓库根目录：由脚本所在位置自动推导。
- 前端目录：默认 `<repo>/frontend`。
- 日志和 pid：默认 `<repo>/.deploy-state/`，该目录不会进入 git。
- 服务器自定义路径：只通过环境变量传入，不写入仓库。

## 推荐用法

在服务器仓库根目录执行：

```bash
bash scripts/deploy-frontend.sh
```

如果服务器需要真实状态目录、OpenClaw profile、token 等私有配置，可以在仓库根目录创建 `.deploy.env`。这个文件已被 git ignore，不会提交：

```bash
MEITUAN_DEPLOY_STATE_DIR=<server-state-dir>
MEITUAN_RUNTIME_DIR=<server-state-dir>
MEITUAN_STATE_FILE=$MEITUAN_RUNTIME_DIR/dinner-tasks.json
MEITUAN_AUTH_STATE_FILE=$MEITUAN_RUNTIME_DIR/wechat-auth-sessions.json
MEITUAN_USER_PROFILE_STATE_FILE=$MEITUAN_RUNTIME_DIR/user-profiles.json
MEITUAN_WEEKEND_STATE_FILE=$MEITUAN_RUNTIME_DIR/weekend-plans.json
MEITUAN_OPENCLAW_FEED_AUDIT_FILE=$MEITUAN_RUNTIME_DIR/openclaw-feed-audit.json
OPENCLAW_PROFILE=<openclaw-profile>
OPENCLAW_CLI_PATH=<openclaw-cli-path>
# OPENCLAW_GATEWAY_TOKEN=<server-only-token>
```

默认行为：

1. 确认当前分支是 `main`。
2. 执行 `git fetch` + `git pull --ff-only origin main`。
3. 进入 `frontend`。
4. 执行 `npm ci`。
5. 执行 `npm run build`。
6. 只停止 cwd 等于当前 `frontend` 目录的旧 `npm run start` / `next start` / `next-server` 进程。
7. 使用 `nohup npm run start` 后台启动。
8. 写入日志和 pid 到 `.deploy-state/`。

## 常用环境变量

```bash
# 默认 main；如果服务器工作区部署其他分支，可覆盖
DEPLOY_BRANCH=main bash scripts/deploy-frontend.sh

# 已经手动拉过代码时跳过 git pull
SKIP_GIT_PULL=1 bash scripts/deploy-frontend.sh

# 跳过 npm ci，只构建和重启
INSTALL_DEPS=0 bash scripts/deploy-frontend.sh

# 使用仓库外的稳定状态目录，避免日志和 pid 放在代码目录
MEITUAN_DEPLOY_STATE_DIR="<server-state-dir>" bash scripts/deploy-frontend.sh

# 单独指定日志文件
MEITUAN_DEPLOY_LOG_FILE="<server-state-dir>/frontend-3001.log" bash scripts/deploy-frontend.sh
```

## 服务运行态数据

Next 服务读取的业务状态文件也应通过环境变量配置，示例只使用占位路径：

```bash
export MEITUAN_RUNTIME_DIR="<server-state-dir>"
export MEITUAN_STATE_FILE="$MEITUAN_RUNTIME_DIR/dinner-tasks.json"
export MEITUAN_AUTH_STATE_FILE="$MEITUAN_RUNTIME_DIR/wechat-auth-sessions.json"
export MEITUAN_USER_PROFILE_STATE_FILE="$MEITUAN_RUNTIME_DIR/user-profiles.json"
export MEITUAN_WEEKEND_STATE_FILE="$MEITUAN_RUNTIME_DIR/weekend-plans.json"
export MEITUAN_OPENCLAW_FEED_AUDIT_FILE="$MEITUAN_RUNTIME_DIR/openclaw-feed-audit.json"
```

OpenClaw CLI 也不要写死个人路径；优先放到服务器 PATH，或只在服务器环境里设置：

```bash
export OPENCLAW_CLI_PATH="$(command -v openclaw)"
```

## 验证

部署完成后可以在 `frontend` 目录运行：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn
```

查看启动日志：

```bash
tail -f .deploy-state/frontend-3001.log
```
