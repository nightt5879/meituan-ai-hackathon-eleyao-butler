# 自有域名全量迁移

对应 issue: https://github.com/nightt5879/meituan_prj/issues/97

正式入口统一为：

```text
https://meituan-ai-hackathon.cn
```

## 目标通路

```text
Browser / Mini Program
  -> https://meituan-ai-hackathon.cn
  -> Nginx :443
  -> 127.0.0.1:3001 Next.js
  -> /api/demo/session      账号/session
  -> /api/user/profile      profile/记忆壳
  -> /api/restaurants/rank  今天吃什么基础信息流
  -> /api/food/status       OpenClaw 状态
  -> /api/food/recommend    二阶段 OpenClaw 推荐
  -> /api/group-tasks       多人约饭
  -> /api/weekend/plans     周末规划
```

客户端和小程序只访问同一个 HTTPS origin；OpenClaw Gateway 只由 Next 服务端访问，不直接暴露公网。

## DNS

在域名服务商添加：

```text
A     @      <服务器公网 IP>
A     www    <服务器公网 IP>
```

## Nginx

```nginx
server {
    listen 80;
    server_name meituan-ai-hackathon.cn www.meituan-ai-hackathon.cn;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

```bash
sudo certbot --nginx -d meituan-ai-hackathon.cn -d www.meituan-ai-hackathon.cn
```

## Next 服务环境变量

```bash
export MEITUAN_RUNTIME_DIR="<server-state-dir>"
export MEITUAN_STATE_FILE="$MEITUAN_RUNTIME_DIR/dinner-tasks.json"
export MEITUAN_AUTH_STATE_FILE="$MEITUAN_RUNTIME_DIR/wechat-auth-sessions.json"
export MEITUAN_USER_PROFILE_STATE_FILE="$MEITUAN_RUNTIME_DIR/user-profiles.json"
export MEITUAN_WEEKEND_STATE_FILE="$MEITUAN_RUNTIME_DIR/weekend-plans.json"
export MEITUAN_REMOTE_API_BASE_URL=https://meituan-ai-hackathon.cn

export OPENCLAW_GATEWAY_URL=ws://127.0.0.1:19789
export OPENCLAW_PROFILE=<openclaw-profile>
export OPENCLAW_AGENT_ID=main
export OPENCLAW_CHAT_SESSION_ID=meituan-single-food
export OPENCLAW_CHAT_SESSION_KEY=meituan-single-food
```

## 小程序配置

代码默认后端已经切到：

```text
https://meituan-ai-hackathon.cn
```

微信小程序后台需要把 request 合法域名加入：

```text
https://meituan-ai-hackathon.cn
```

## 验证

```bash
curl -I https://meituan-ai-hackathon.cn/
curl -I https://meituan-ai-hackathon.cn/experience
curl -i https://meituan-ai-hackathon.cn/api/health
curl -i https://meituan-ai-hackathon.cn/api/food/status
```

默认信息流 smoke test：

```bash
cd <repo>/frontend
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn
```

二阶段 OpenClaw 推荐：

```bash
npm run verify:server-flow -- --base-url https://meituan-ai-hackathon.cn --include-openclaw-recommend
```

## 验收标准

- `https://meituan-ai-hackathon.cn/` 能打开作品首页。
- `https://meituan-ai-hackathon.cn/experience` 能打开在线体验。
- `https://meituan-ai-hackathon.cn/api/health` 返回 200。
- `https://meituan-ai-hackathon.cn/api/food/status` 显示 OpenClaw Gateway 可达。
- `verify:server-flow -- --base-url https://meituan-ai-hackathon.cn` 默认全 PASS。
- 最终提交作品链接使用新域名。
