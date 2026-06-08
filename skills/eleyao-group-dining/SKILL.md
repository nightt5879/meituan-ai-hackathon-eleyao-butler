---
name: eleyao-group-dining
description: Use when coordinating group dining preferences, detecting conflicts, ranking shared restaurant candidates, and producing group-chat-ready recommendation copy.
---

# Eleyao Group Dining Skill

## Purpose

面向「多人约饭」场景，把发起人的任务、成员偏好和冲突整理成公平、可执行的聚餐推荐。Skill 关注多人协同，而不是单纯平均每个人的喜好。

## When To Use

- 用户创建多人约饭任务，并分享给朋友填写偏好。
- 成员提交预算、忌口、辣度、离开时间、距离或聊天氛围要求。
- 看板需要识别冲突、生成候选方案、输出群聊文案。

## Inputs

- `task`: 发起人、人数、时间、地点、原始需求。
- `participants`: 成员列表，每人包含 `nickname`、自然语言偏好、手填字段和 clientId。
- `conflicts`: 后端初步识别的冲突。
- `candidateRestaurants`: 自建结构化餐厅候选。
- `inviteTokenVerified`: 后端校验后的任务访问状态。

## Decision Rules

1. 任何成员的硬约束都不能被静默覆盖：预算上限、忌口、过敏、离开时间优先。
2. 同名成员不能直接覆盖；同一 `clientId` 才是同一设备的更新。
3. 推荐排序同时看平均满意度和最低个人满意度，避免牺牲某个成员。
4. 需要显式写出冲突如何处理，例如“不辣优先，辣味作为可选蘸料”。
5. 推荐结果必须包含可复制到微信群的邀约文案。

## Output Contract

只返回 JSON，不返回 Markdown：

```json
{
  "candidates": [
    {
      "name": "餐厅名",
      "averageBudget": 70,
      "distanceText": "1.2 公里",
      "matchedParticipants": ["阿杰", "小林"],
      "tradeoff": "不辣优先，保留可选辣味",
      "riskTip": "排队可能超过 15 分钟"
    }
  ],
  "finalChoice": "首推餐厅",
  "groupMessage": "可复制到微信群的文案",
  "normalAiMessage": "看板内说明"
}
```

## Implementation Anchors

- API: `POST /api/group-tasks/:taskId/recommend`
- Server adapter: `frontend/lib/server/openclawRecommendation.ts`
- Task store and conflict logic: `frontend/lib/server/taskStore.ts` and shared group-dining rule helpers
- Mini Program adapter: `mini-program/wechat-miniprogram/services/groupDiningAdapter.js`

## Companion Files

- Metadata: `skill.json`
- Prompt template: `prompt.md`
- Input schema: `input.schema.json`
- Output schema: `output.schema.json`
- Examples: `examples/request.json`, `examples/response.json`
