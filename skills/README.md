# 饿了幺 OpenClaw Skills

本目录把「饿了幺」三个本地生活策略打包成可读、可复用的 OpenClaw Skill 交付件。每个 Skill 都包含独立的 `SKILL.md`，描述触发场景、输入契约、决策流程、自检规则、输出结构和对应的仓库实现位置。完整版本说明也同步在 [`../docs/openclaw-version-and-skills.md`](../docs/openclaw-version-and-skills.md)。

## OpenClaw 版本

当前线上评审环境使用的 OpenClaw 信息来自服务器实查：

| 项目 | 值 |
| --- | --- |
| OpenClaw CLI / Gateway | `2026.5.27 (27ae826)` |
| profile | `meituan01` |
| Gateway | server-side loopback only: `127.0.0.1:19789` / `[::1]:19789` |
| default agent | `main` |
| default model | `deepseek-v4-flash` |
| context window | `128000` |

安全边界：Gateway token、AppSecret、模型密钥和服务器私有路径不进入仓库，也不会写入小程序端。小程序和 Web 只访问后端 HTTPS API。

## Skill 包

| Skill | 目录 | 对应功能 | 线上链路 |
| --- | --- | --- | --- |
| 今天吃什么 | [`eleyao-food-butler/`](eleyao-food-butler/) | 单人吃饭追问、餐厅推荐、偏好记忆 | `POST /api/food/recommend` |
| 多人约饭 | [`eleyao-group-dining/`](eleyao-group-dining/) | 多人偏好汇总、冲突识别、公平性推荐 | `POST /api/group-tasks/:taskId/recommend` |
| 周边规划 | [`eleyao-weekend-planner/`](eleyao-weekend-planner/) | 天气、预算、时间窗和 POI 路线规划 | `POST /api/weekend/plans` |

这些 Skill 是项目级交付说明与 Agent 行为约束，不包含真实用户个人信息；偏好、问卷和餐厅/POI 示例均来自用户显式输入或自建结构化本地生活数据集。

## 使用方式

1. 阅读对应 `SKILL.md`，确认输入字段和输出结构。
2. 将 Skill 目录复制或引用到 OpenClaw 的 skill/profile 配置中。
3. 让后端 API 负责拼装用户输入、候选数据、天气或多人偏好，再把结构化上下文交给 OpenClaw。
4. OpenClaw 不可用、超时或返回结构不合法时，后端进入 fallback dataset + 规则兜底，前端必须显式展示降级状态。

## 与代码实现的对应关系

- 单人吃饭：`frontend/lib/server/openclawFoodRecommendation.ts`
- 多人约饭：`frontend/lib/server/openclawRecommendation.ts`、`frontend/lib/mockFunctions.ts`
- 周边规划：`frontend/lib/server/weekendPlanner.ts`、`frontend/app/api/weekend/plans/route.ts`
- OpenClaw 状态探测：`frontend/lib/server/openclawFoodStatus.ts`
- 小程序 adapter：`mini-program/wechat-miniprogram/services/`
