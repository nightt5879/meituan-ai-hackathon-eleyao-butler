export type TechRouteStageKey = "in" | "proc" | "out";

export type TechRouteNode = {
  t: string;
  desc: string;
  detail: string;
};

export type TechRouteStage = {
  key: TechRouteStageKey;
  title: string;
  sub: string;
  nodes: TechRouteNode[];
};

export type TechRouteField = {
  name: string;
  note: string;
  items: string[];
};

export type TechRouteFeature = {
  kind: "diff" | "safe" | "tech";
  title: string;
  body: string;
};

export type TechRouteFunction = {
  id: "food" | "group" | "weekend";
  no: string;
  name: string;
  tagline: string;
  icon: "bowl" | "users" | "route";
  api: string[];
  oneLiner: string;
  stages: TechRouteStage[];
  fields: TechRouteField[];
  features: TechRouteFeature[];
  formula?: {
    main: string;
    rule: string;
  };
  fallback: {
    trigger: string;
    action: string;
  };
  differentiator: string;
};

export const techRouteData = {
  funcs: [
    {
      id: "food",
      no: "01",
      name: "今天吃什么",
      tagline: "单人即时推荐 · 接云端 OpenClaw",
      icon: "bowl",
      api: ["POST /api/food/recommend"],
      oneLiner: "一句「不知道吃什么」，管家先把缺的关键信息问清楚，再调云端 OpenClaw 给出带理由的推荐；网关不可用时立刻本地兜底，评审流程不断。",
      stages: [
        {
          key: "in",
          title: "理解需求",
          sub: "INPUT",
          nodes: [
            { t: "场景", desc: "午饭 / 晚饭 / 夜宵", detail: "不同时段对应不同营业、口味和预算基线。" },
            { t: "预算 · 距离", desc: "人均上限、步行可达范围", detail: "作为后续硬过滤条件，明显超限候选直接排除。" },
            { t: "口味 · 忌口", desc: "想吃什么、不能吃什么", detail: "忌口、过敏、不吃辣等属于硬约束，优先保护。" },
            { t: "历史偏好", desc: "记忆带入，越用越懂", detail: "从个人记忆读取常点、避雷和主题风格，减少重复追问。" }
          ]
        },
        {
          key: "proc",
          title: "OpenClaw 推荐",
          sub: "PROCESS",
          nodes: [
            { t: "动态追问", desc: "信息不足先补关键问题", detail: "缺场景、预算、忌口时，先问最影响结果的一项，不硬生成。" },
            { t: "OpenClaw Gateway", desc: "WebSocket 调云端管家", detail: "后端代理调用 OpenClaw Gateway，token 只在服务端，前端和小程序不接触密钥。" },
            { t: "候选压缩", desc: "轻量候选表交给 AI 决策", detail: "服务端只做去重、多样性和基础可执行性整理，最终选择仍由 OpenClaw 完成。" },
            { t: "自检过滤", desc: "预算 / 忌口 / 距离逐项检查", detail: "推荐前后都检查硬约束，不合格则重筛或提示风险。" }
          ]
        },
        {
          key: "out",
          title: "给出推荐",
          sub: "OUTPUT",
          nodes: [
            { t: "推荐 + 理由", desc: "为什么是这一家", detail: "说明满足了预算、口味、距离的哪几条，而不是只丢店名。" },
            { t: "管家提醒", desc: "把执行风险说清楚", detail: "对排队、营业、库存等不可实时确认项只给风险提醒，不假装已确认。" },
            { t: "写入记忆", desc: "更新个人偏好", detail: "本次选择和反馈回写记忆，影响下一次推荐。" }
          ]
        }
      ],
      fields: [
        { name: "后端配置", note: "密钥只在服务端", items: ["OPENCLAW_GATEWAY_URL", "OPENCLAW_GATEWAY_TOKEN", "session: food-recommendation", "timeout 90000ms"] },
        { name: "小程序 / Web 端", note: "不泄露密钥", items: ["只配置 foodRecommendApiBaseUrl", "origin 指向同源后端", "状态和进度由服务端返回", "本地 fallback 可离线兜底"] },
        { name: "候选输入", note: "AI 最终决策", items: ["场景 / 预算 / 距离 / 忌口", "12 个轻量候选", "店名 / 品类 / 价格 / 标签", "why / warning 由 AI 输出"] }
      ],
      features: [
        { kind: "diff", title: "主动追问，而非一次答案", body: "普通 AI 问一句答一句；管家信息不足时先补最关键的一问，再给推荐。" },
        { kind: "safe", title: "密钥只放后端", body: "Gateway token 只在服务端环境变量，小程序和 Web 只配置 origin，凭证永不下发。" },
        { kind: "tech", title: "失败本地兜底", body: "OpenClaw 不可用时降级到本地候选推荐，保证现场 demo 不断流。" }
      ],
      fallback: { trigger: "OpenClaw Gateway 超时 / 不可用", action: "降级到本地 mock 候选推荐，保留可执行方案与风险提示。" },
      differentiator: "别的 AI 一次答完就完事；我们先把缺的关键信息问清楚，再给带理由的那一个。"
    },
    {
      id: "group",
      no: "02",
      name: "多人约饭",
      tagline: "多人协同决策 · 群体约饭",
      icon: "users",
      api: ["POST /api/group-tasks", "POST /api/group-tasks/:id/participants", "POST /api/group-tasks/:id/recommend"],
      oneLiner: "发起人建任务、成员各填偏好，管家把每个人拆成硬约束与软偏好，显式指出冲突，用最低满意度而非平均分选出最稳的一家，再生成能直接发群里的话。",
      stages: [
        {
          key: "in",
          title: "收集偏好",
          sub: "INPUT",
          nodes: [
            { t: "发起任务", desc: "人数 / 预算 / 地点 / 时间", detail: "rawRequest 自然语言加结构化字段，生成可分享任务。" },
            { t: "成员填偏好", desc: "rawPreference + manualFields", detail: "budgetMax、spicyPreference、leaveBefore 等跨设备各自提交。" },
            { t: "AI 填朋友偏好", desc: "5 人以内辅助补齐", detail: "适合单人演示多人场景；超过 5 人提示改为真实成员填写。" }
          ]
        },
        {
          key: "proc",
          title: "协调决策",
          sub: "PROCESS",
          nodes: [
            { t: "抽取约束", desc: "硬约束 vs 软偏好", detail: "不吃辣、预算上限、几点前离开、过敏为硬约束；想吃辣、想安静用于排序。" },
            { t: "冲突识别", desc: "口味 / 时间 / 预算", detail: "显式列出冲突在哪里，让人感觉 AI 理解了局面，而非随机推荐。" },
            { t: "候选生成", desc: "2-3 个策略不同方案", detail: "最公平折中、最省时稳妥、最有新鲜感，各自说明牺牲了什么。" },
            { t: "自检评测", desc: "七项逐条检查", detail: "预算、时间、距离、忌口、氛围、公平性、可执行性逐条过，不合格则重排或追问。" },
            { t: "公平性排序", desc: "看最低满意度", detail: "避免两个人满意、一个人完全不能接受的平均分陷阱。" }
          ]
        },
        {
          key: "out",
          title: "推进执行",
          sub: "OUTPUT",
          nodes: [
            { t: "最终推荐", desc: "满意度分布 + 理由", detail: "给出成员各自满意度，以及为什么是它、淘汰了谁。" },
            { t: "方案自检", desc: "逐项通过 / 风险", detail: "预算、忌口、时间、氛围、排队、公平性逐项检查。" },
            { t: "群聊文案", desc: "一键复制去推进", detail: "把推荐变成推动大家做决定的一段话。" }
          ]
        }
      ],
      fields: [
        { name: "成员输入", note: "自然语言 + 结构化", items: ["rawPreference", "budgetMax", "spicyPreference", "leaveBefore"] },
        { name: "餐厅字段", note: "支撑多人约束判断", items: ["人均 / 距离 / 步行时间", "营业时间 / 口味标签", "安静程度 / 适合人数", "排队风险 / 评分"] },
        { name: "约束分流", note: "决定优先级", items: ["硬约束 → 不可违反 / 淘汰", "软偏好 → 尽量满足 / 排序"] }
      ],
      features: [
        { kind: "diff", title: "服务整个小团体", body: "不默认只服务发起人，而是让几个人都能接受，这是现有产品的弱点。" },
        { kind: "diff", title: "冲突显式拆解", body: "口味、时间、预算冲突摆上台面，让用户感到被理解，而不是被随机推荐。" },
        { kind: "tech", title: "最低满意度排序", body: "不只看平均分，避免两人满意、一人完全不能接受的平均分陷阱。" },
        { kind: "safe", title: "token 安全 + 跨设备共享", body: "返回明文 inviteToken，服务端只存哈希；JSON store 支持跨设备同看。" }
      ],
      formula: { main: "方案总分 = 平均满意度 × 0.7 + 最低个人满意度 × 0.3", rule: "违反任一成员硬约束 → 方案直接淘汰" },
      fallback: { trigger: "成员变动或 OpenClaw 不可用", action: "旧推荐失效并提示重新生成，或退回本地可解释推荐。" },
      differentiator: "众口难调，难的不是找店，而是每个人都有不能违反的限制。我们把冲突摊开，再选一个谁都不难受的。"
    },
    {
      id: "weekend",
      no: "03",
      name: "周末轻规划",
      tagline: "心情 → 路线 · 接真实天气",
      icon: "route",
      api: ["POST /api/weekend/plans", "GET /api/weekend/plans/:planId"],
      oneLiner: "给时间、预算、心情和同行人，管家接真实天气，生成 3 条策略不同的路线；每条都带时间线、预算、自检项和风险提示，天气拿不到也有保守兜底。",
      stages: [
        {
          key: "in",
          title: "描述周末",
          sub: "INPUT",
          nodes: [
            { t: "时间 · 预算", desc: "timeWindow / budgetMax", detail: "如周六下午 3 小时、人均 120 内，作为路线时长和花费边界。" },
            { t: "心情 · 体力", desc: "mood / energyLevel", detail: "想轻松还是想出片，决定路线节奏和活动强度。" },
            { t: "同行 · 兴趣", desc: "companions / interests[]", detail: "朋友、咖啡、citywalk、拍照等用于筛选 POI 和活动组合。" }
          ]
        },
        {
          key: "proc",
          title: "生成路线",
          sub: "PROCESS",
          nodes: [
            { t: "天气接入", desc: "Open-Meteo 实时", detail: "真实天气决定室内 / 室外和雨天备选方案。" },
            { t: "POI 筛选", desc: "学校周边 mock 活动", detail: "按预算、距离、兴趣、体力筛出可组合地点和活动。" },
            { t: "3 条路线 + 自检", desc: "策略各不同", detail: "每条逐项自检预算、时长、天气适配，并附风险提示。" }
          ]
        },
        {
          key: "out",
          title: "可落地路线",
          sub: "OUTPUT",
          nodes: [
            { t: "routes[3]", desc: "时间线 + 预算 + 时长", detail: "每条含地点活动、交通说明、自检项、风险提示和邀约文案。" },
            { t: "planId 可分享", desc: "朋友同看一份", detail: "GET /api/weekend/plans/:planId，分享后协同确认。" }
          ]
        }
      ],
      fields: [
        { name: "请求字段", note: "描述你的周末", items: ["timeWindow / budgetMax", "startArea / mood", "energyLevel / companions", "interests[] / rawText"] },
        { name: "单条路线", note: "每条都可落地", items: ["时间线 / 预计预算 / 预计时长", "地点活动 / 交通说明", "自检项 / 风险提示", "邀约文案"] },
        { name: "返回结构", note: "可追踪、可分享", items: ["planId", "weather", "routes[3]", "source"] }
      ],
      features: [
        { kind: "diff", title: "接真实天气", body: "Open-Meteo 实时天气驱动，不是凭空写攻略；雨天自动调室内方案。" },
        { kind: "tech", title: "天气失败保守兜底", body: "接口挂掉时标记 unavailable 并生成保守路线，流程不中断。" },
        { kind: "diff", title: "一次 3 条策略路线", body: "轻松、紧凑、出片各一条，每条说明牺牲了什么，用户自己挑。" }
      ],
      fallback: { trigger: "天气接口失败", action: "标记 unavailable，生成 3 条保守路线兜底，流程不断。" },
      differentiator: "想出去但懒得做攻略。我们看天气、按心情，直接给三条能落地的路线，不只是一堆链接。"
    }
  ] satisfies TechRouteFunction[],
  selfcheck: {
    title: "自检评测闭环",
    sub: "把命题 02 的评测思想嵌进管家每一次回答",
    intro: "管家不是生成完直接输出，而是先像审计员一样逐项检查，不合格就自动修正或追问，再输出。",
    checks: [
      { k: "预算检查", look: "是否超过个人 / 成员预算上限", act: "重新筛选低价方案" },
      { k: "时间检查", look: "结束时间、营业时间、路程是否来得及", act: "换更近或更快的方案" },
      { k: "距离检查", look: "是否过远、是否绕路", act: "换更近的店或重排路线" },
      { k: "口味 / 忌口", look: "是否违反不吃辣、过敏等硬约束", act: "直接淘汰该候选" },
      { k: "氛围检查", look: "是否适合聊天、约会、团建", act: "对不匹配场景降权" },
      { k: "公平性检查", look: "是否明显牺牲某一成员", act: "重新生成更公平折中" },
      { k: "可执行性", look: "排队风险、关门风险、路线是否合理", act: "输出风险提示或备选" }
    ],
    loop: [
      { phase: "计划前", t: "判断信息是否足够", d: "不足则主动追问最关键问题" },
      { phase: "计划中", t: "检查方案是否满足约束", d: "不合格则重排或淘汰候选" },
      { phase: "计划后", t: "根据反馈更新记忆", d: "不满意写入记忆，下次避开" },
      { phase: "下一次", t: "基于记忆生成更好方案", d: "个人与小团体偏好持续积累" }
    ]
  },
  compare: [
    { dim: "回应方式", normal: "问一句，答一句", us: "信息不足先追问，再给带理由的推荐" },
    { dim: "服务对象", normal: "默认服务一个人", us: "协调整个小团体的硬约束与软偏好" },
    { dim: "可靠性", normal: "信息不足也硬生成", us: "自检不合格就修正或追问，再输出" },
    { dim: "选择成本", normal: "给一大堆选项", us: "把选项变少，并说明为什么这样选" },
    { dim: "可执行", normal: "看着漂亮，执行踩坑", us: "预算、忌口、时间逐项检查过才给" }
  ]
} as const;
