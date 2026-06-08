# 饿了幺 OpenClaw Skills

本目录把「饿了幺」三个本地生活策略打包成可读、可复用、可一键安装的 OpenClaw Skill 交付件。每个 Skill 都包含独立的 `SKILL.md`、元数据、prompt 模板、输入/输出 schema 和示例，描述触发场景、输入契约、决策流程、自检规则、输出结构和对应的仓库实现位置。完整版本说明也同步在 [`../docs/openclaw-version-and-skills.md`](../docs/openclaw-version-and-skills.md)。

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

## 一键安装

OpenClaw 的 skill 加载方式是扫描 skills root 下包含 `SKILL.md` 的子目录。默认建议安装到 `~/.openclaw/skills`；如果你的 OpenClaw profile 使用了自定义 `skills.load.extraDirs`，把 `--target` 指向对应目录即可。

已 clone 本仓库时：

```bash
node skills/install-eleyao-skills.mjs --target ~/.openclaw/skills --force
```

Windows PowerShell：

```powershell
node skills/install-eleyao-skills.mjs --target "$HOME\.openclaw\skills" --force
```

也可以先只校验不复制：

```bash
node skills/install-eleyao-skills.mjs --dry-run
```

从 GitHub 临时拉取并安装：

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/nightt5879/meituan-ai-hackathon-eleyao-butler/main/skills/install-from-github.sh)"
```

PowerShell：

```powershell
$tmp = Join-Path $env:TEMP "install-eleyao-skills.ps1"; Invoke-WebRequest "https://raw.githubusercontent.com/nightt5879/meituan-ai-hackathon-eleyao-butler/main/skills/install-from-github.ps1" -OutFile $tmp; powershell -ExecutionPolicy Bypass -File $tmp
```

## Skill 包

| Skill | 目录 | 对应功能 | 线上链路 |
| --- | --- | --- | --- |
| 今天吃什么 | [`eleyao-food-butler/`](eleyao-food-butler/) | 单人吃饭追问、餐厅推荐、偏好记忆 | `POST /api/food/recommend` |
| 多人约饭 | [`eleyao-group-dining/`](eleyao-group-dining/) | 多人偏好汇总、冲突识别、公平性推荐 | `POST /api/group-tasks/:taskId/recommend` |
| 周边规划 | [`eleyao-weekend-planner/`](eleyao-weekend-planner/) | 天气、预算、时间窗和 POI 路线规划 | `POST /api/weekend/plans` |

这些 Skill 是项目级交付说明与 Agent 行为约束，不包含真实用户个人信息；偏好、问卷和餐厅/POI 示例均来自用户显式输入或自建结构化本地生活数据集。

## 包结构

```text
skills/
├─ eleyao-skills.manifest.json      # 三份 Skill 的机器可读索引
├─ install-eleyao-skills.mjs        # 本地安装/校验脚本
├─ install-from-github.sh           # Linux/macOS 一键拉取安装
├─ install-from-github.ps1          # Windows PowerShell 一键拉取安装
├─ eleyao-food-butler/
│  ├─ SKILL.md
│  ├─ skill.json
│  ├─ prompt.md
│  ├─ input.schema.json
│  ├─ output.schema.json
│  └─ examples/
├─ eleyao-group-dining/
└─ eleyao-weekend-planner/
```

## 使用方式

1. 阅读对应 `SKILL.md`，确认输入字段和输出结构。
2. 运行安装脚本，或将 Skill 目录复制/引用到 OpenClaw 的 skill/profile 配置中。
3. 让后端 API 负责拼装用户输入、候选数据、天气或多人偏好，再把结构化上下文交给 OpenClaw。
4. OpenClaw 不可用、超时或返回结构不合法时，后端进入 fallback dataset + 规则兜底，前端必须显式展示降级状态。

## 与代码实现的对应关系

- 单人吃饭：`frontend/lib/server/openclawFoodRecommendation.ts`
- 多人约饭：`frontend/lib/server/openclawRecommendation.ts`、`frontend/lib/server/taskStore.ts`
- 周边规划：`frontend/lib/server/weekendPlanner.ts`、`frontend/app/api/weekend/plans/route.ts`
- OpenClaw 状态探测：`frontend/lib/server/openclawFoodStatus.ts`
- 小程序 adapter：`mini-program/wechat-miniprogram/services/`
