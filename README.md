# meituan_prj

## OpenClaw single-person food recommendation

The WeChat mini-program single-person food flow now calls the Next.js backend first:

```text
mini-program -> POST /api/food/recommend -> OpenClaw Gateway WebSocket
```

Backend environment variables:

```powershell
$env:OPENCLAW_GATEWAY_URL="wss://your-openclaw-gateway.example.com"
$env:OPENCLAW_GATEWAY_TOKEN="your-gateway-token"
# Optional:
$env:OPENCLAW_GATEWAY_TIMEOUT_MS="30000"
$env:OPENCLAW_CHAT_SESSION_ID="food-recommendation"
$env:OPENCLAW_CHAT_SESSION_KEY="food-recommendation"
$env:OPENCLAW_AGENT_ID="agent-id"
```

Mini-program configuration:

- Set `App.globalData.foodRecommendApiBaseUrl` in `mini-program/wechat-miniprogram/app.js` to the deployed Next.js backend origin.
- Keep it empty to use only the local mock fallback.
- Do not put any OpenClaw key or Gateway token in the mini-program.
