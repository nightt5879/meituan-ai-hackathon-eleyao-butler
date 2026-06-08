\# 饿了幺 微信小程序前端 MVP



\## 1. 项目简介



「饿了幺」是一个 AI 本地生活决策助手的微信小程序前端 MVP，也是作品的主要移动端入口。



当前版本已经通过同一个后端 origin 接入 AI / OpenClaw / AI 上下文链路，覆盖三个核心场景：



- `今天吃什么`：问答收集偏好 → 后端 OpenClaw 推荐 → 返回 2-3 个候选 → 保存偏好记忆。
- `多人约饭`：创建任务 → 分享成员填写链接 → 后端同步状态 → AI 辅助理解偏好、识别冲突并生成推荐。
- `周边规划`：输入时间、预算、起点和兴趣 → 后端结合真实天气、自建 POI/活动数据集和 AI 上下文链路生成路线。



\## 2. 当前阶段目标



本阶段重点完成：



\- 微信小程序基础页面结构

\- 微信登录 / demo 身份初始化

\- 首页三个入口

\- 「今天吃什么」完整问答链路

\- OpenClaw / AI 状态展示

\- 自建餐厅数据集推荐卡片

\- 本地偏好记忆

\- OpenClaw 接入状态与后端 fallback 提示



当前不声称使用美团 / 点评 / 地图官方商户库；演示数据来自自建结构化本地生活数据集。远端 OpenClaw、后端服务或外部链路不可用时，会切换到本地 fallback dataset + 简单规则兜底，保证流程可跑通、状态可追踪。

## 1.1 OpenClaw 版本与 Skill 包

线上评审环境使用 OpenClaw CLI / Gateway `2026.5.27 (27ae826)`，服务端 profile 为 `meituan01`，Gateway 只在服务器本机 loopback 监听。小程序端只配置统一 HTTPS 后端 origin，不保存 OpenClaw token、AppSecret 或模型密钥。

三个小程序入口对应仓库内三个 OpenClaw Skill：

- 今天吃什么：[`../../skills/eleyao-food-butler/SKILL.md`](../../skills/eleyao-food-butler/SKILL.md)
- 多人约饭：[`../../skills/eleyao-group-dining/SKILL.md`](../../skills/eleyao-group-dining/SKILL.md)
- 周边规划：[`../../skills/eleyao-weekend-planner/SKILL.md`](../../skills/eleyao-weekend-planner/SKILL.md)

这些 Skill 不是只放 `SKILL.md`，还包含 manifest、prompt、输入/输出 schema 和示例；已 clone 本仓库时可用下面命令安装到 OpenClaw skills root：

```bash
node ../../skills/install-eleyao-skills.mjs --target ~/.openclaw/skills --force
```



\## 3. 如何运行项目



\### 3.1 环境要求



需要安装：



\- 微信开发者工具

\- Git

\- 可选：VS Code 或其他代码编辑器



\### 3.2 打开项目



1\. 打开微信开发者工具。

2\. 选择「导入项目」。

3\. 项目目录选择当前仓库下的小程序目录：



```text

<repo-root>\mini-program\wechat-miniprogram
```

## 4. OpenClaw 单人约饭接入

「今天吃什么」单人流程会优先请求后端：

```text
POST /api/food/recommend
```

配置方式：

- 在 `app.js` 的 `globalData.foodRecommendApiBaseUrl` 中填写 Next.js 后端地址，例如 `https://meituan-ai-hackathon.cn`。
- 本字段留空时，小程序不会请求远端，只能使用本地 fallback 结果；正式演示建议配置统一 HTTPS 后端。
- OpenClaw Gateway URL、token、模型 key 只允许配置在后端环境变量中，不能写入小程序。

失败降级：

- 后端不可用、OpenClaw 超时、返回结构不合法时，小程序会显示本地 fallback 推荐。
- 页面会提示「远端推荐暂不可用，已先用本地推荐。」。
