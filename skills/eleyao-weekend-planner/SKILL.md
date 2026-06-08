# Eleyao Weekend Planner Skill

## Purpose

面向「周边规划」场景，把时间窗、预算、起点、天气、兴趣和体力状态整合成 3 条轻量可执行路线。Skill 的重点是可执行性和自检，而不是生成长篇旅游攻略。

## When To Use

- 用户想规划周末、半天出门、学校周边轻量活动。
- 用户输入预算、起点、心情、同行人、兴趣和自然语言补充。
- 需要结合真实天气和自建 POI/活动数据生成路线。

## Inputs

- `timeWindow`: 周六下午 / 周日上午 / 自定义时间窗。
- `budgetMax`: 预算上限。
- `startArea`: 起点，例如学校东门、学校周边。
- `mood` / `energyLevel`: 心情和体力。
- `companions`: 自己 / 朋友 / 情侣 / 家人。
- `interests`: 咖啡、citywalk、展览、公园、轻食、拍照等。
- `weather`: Open-Meteo 天气摘要和风险标记。
- `poiCandidates`: 自建周边 POI/活动候选。

## Decision Rules

1. 时间窗口、预算、天气、步行强度和返程时间是硬自检项。
2. 下雨、高温或异常天气时，至少一条路线必须明显偏室内或低体力。
3. 只使用后端提供的 POI/活动候选，不编造真实地图或点评数据。
4. 每条路线都要有时间线、预算、交通说明、自检项、风险提示和邀约文案。
5. 天气接口失败时返回保守方案，并标注天气暂不可用。

## Output Contract

只返回 JSON，不返回 Markdown：

```json
{
  "routes": [
    {
      "routeType": "balanced",
      "title": "折中路线",
      "estimatedBudget": 90,
      "estimatedDurationMinutes": 180,
      "walkingIntensity": "low",
      "timeline": [],
      "selfChecks": [],
      "risks": [],
      "inviteText": "要不要一起？"
    }
  ],
  "weatherSummary": "广州番禺当前多云，体感偏热",
  "source": {
    "weather": "open-meteo-real",
    "poi": "self-built-school-area"
  }
}
```

## Implementation Anchors

- API: `POST /api/weekend/plans`
- Planner: `frontend/lib/server/weekendPlanner.ts`
- Route API: `frontend/app/api/weekend/plans/route.ts`
- Mini Program adapter: `mini-program/wechat-miniprogram/services/weekendPlannerAdapter.js`
