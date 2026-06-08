# OpenClaw 版本与 Skill 包说明

本文记录「饿了幺」当前线上评审环境的 OpenClaw 版本、服务端接入方式和仓库内 Skill 包结构。所有信息均为非敏感说明，不包含 token、AppSecret、模型密钥或服务器私有路径。

## 版本信息

服务器实查结果：

| 项目 | 值 |
| --- | --- |
| OpenClaw CLI / Gateway | `2026.5.27 (27ae826)` |
| profile | `meituan01` |
| Gateway | server-side loopback only: `127.0.0.1:19789` / `[::1]:19789` |
| default agent | `main` |
| default model | `deepseek-v4-flash` |
| context window | `128000` |

## 接入边界

- OpenClaw CLI / Gateway 只在服务器端运行。
- 小程序和 Web 只访问后端 HTTPS API，不保存 OpenClaw token、AppSecret 或模型密钥。
- 远端 OpenClaw、天气或外部链路不可用时，后端会进入 fallback dataset + 规则兜底，并由前端显式展示降级状态。
- 项目不声称使用美团、点评或地图官方商户库；当前演示数据来自自建结构化本地生活数据集。

## Skill 包结构

Skill 包入口：[`../skills/README.md`](../skills/README.md)

| Skill | 文件 | 说明 |
| --- | --- | --- |
| 今天吃什么 | [`../skills/eleyao-food-butler/SKILL.md`](../skills/eleyao-food-butler/SKILL.md) | 单人吃饭追问、餐厅推荐、偏好记忆 |
| 多人约饭 | [`../skills/eleyao-group-dining/SKILL.md`](../skills/eleyao-group-dining/SKILL.md) | 成员偏好汇总、冲突识别、公平性推荐 |
| 周边规划 | [`../skills/eleyao-weekend-planner/SKILL.md`](../skills/eleyao-weekend-planner/SKILL.md) | 天气、预算、时间窗和 POI 路线规划 |

## 代码落点

- `frontend/lib/server/openclawFoodRecommendation.ts`
- `frontend/lib/server/openclawRecommendation.ts`
- `frontend/lib/server/weekendPlanner.ts`
- `frontend/lib/server/openclawFoodStatus.ts`
- `mini-program/wechat-miniprogram/services/`
