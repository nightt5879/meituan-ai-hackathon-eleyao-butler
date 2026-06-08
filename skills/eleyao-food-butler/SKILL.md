# Eleyao Food Butler Skill

## Purpose

面向「今天吃什么」场景，把用户的自然语言和按钮选择收敛成可执行的餐厅推荐。Skill 负责理解场景、抽取硬约束、筛掉明显不合适的候选，并输出 2-3 个带理由和风险提示的推荐。

## When To Use

- 用户问「今天吃什么」「附近吃什么」「预算 60 内吃点热乎的」。
- 用户给出场景、预算、距离、忌口、口味或临时状态。
- 需要在餐厅候选池中生成推荐，并解释为什么符合当前偏好。

## Inputs

- `scene`: 早餐 / 午餐 / 晚餐 / 夜宵 / 工作日快餐 / 周末放松吃。
- `budgetText` or `budgetMax`: 预算文本或数值。
- `distanceText` or `distanceMeters`: 距离偏好。
- `tasteText`: 口味、辣度、忌口、想吃/不想吃。
- `rawText`: 用户自然语言补充。
- `memory`: 可选的长期偏好和最近选择。
- `candidateRestaurants`: 后端提供的自建结构化餐厅候选。

## Decision Rules

1. 先处理硬约束：预算、距离、忌口、过敏、明确不想吃的品类。
2. 再处理软偏好：热乎、清淡、快一点、适合聊天、想换口味。
3. 候选不足时不要编造真实商家；返回可解释的保守选择或让后端 fallback。
4. 推荐理由必须具体到「匹配了什么字段」，不能只写“适合你”。
5. 输出前自检预算、距离、口味、排队风险和执行难度。

## Output Contract

只返回 JSON，不返回 Markdown：

```json
{
  "recommendations": [
    {
      "name": "店名",
      "category": "粉面/简餐/轻食",
      "budgetText": "人均 45 元",
      "distanceText": "约 800 米",
      "matchedTagsText": "不辣、热乎、60 元内",
      "reason": "为什么推荐",
      "riskTip": "可能的风险或提醒"
    }
  ],
  "finalChoice": "首推店名",
  "normalAiMessage": "给用户看的简短说明"
}
```

## Implementation Anchors

- API: `POST /api/food/recommend`
- Server adapter: `frontend/lib/server/openclawFoodRecommendation.ts`
- Candidate data: `frontend/data/restaurant/`
- Mini Program adapter: `mini-program/wechat-miniprogram/services/foodAiAdapter.js`
