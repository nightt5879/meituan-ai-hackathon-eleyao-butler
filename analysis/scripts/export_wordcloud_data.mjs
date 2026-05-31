import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const rawDir = path.join(repoRoot, "data", "raw");
const targetPath = path.join(repoRoot, "frontend", "data", "survey", "wordcloud-insights.json");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

const sourceConfigs = [
  {
    phase: "第一阶段",
    sourceLabel: "痛点经历",
    fileName: "问卷数据v1.1.csv",
    questionNeedles: ["做本地生活决策很累", "请用 1-2 句话描述这件事"]
  },
  {
    phase: "第二阶段",
    sourceLabel: "AI 期待场景",
    fileName: "第二阶段问卷数据.csv",
    questionNeedles: ["请用一句话描述", "最希望 AI 本地生活管家", "具体场景"]
  }
];

const outputPath = path.resolve(repoRoot, args.output || targetPath);

function decodeFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const candidates = [
    ["utf-8", new TextDecoder("utf-8", { fatal: true })],
    ["gb18030", new TextDecoder("gb18030")]
  ];

  for (const [encoding, decoder] of candidates) {
    try {
      const text = decoder.decode(buffer).replace(/^\uFEFF/, "");
      if (!text.includes("\uFFFD")) {
        return { text, encoding };
      }
    } catch {
      // Try the next encoding.
    }
  }

  return {
    text: new TextDecoder("gb18030").decode(buffer).replace(/^\uFEFF/, ""),
    encoding: "gb18030"
  };
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cellValue) => String(cellValue).trim()));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isMetadataRow(row) {
  return normalizeText(row[0]) === "作答ID";
}

function cleanOpenText(value) {
  const text = normalizeText(value);
  if (!text || text === "Q" || text === "作答ID") return "";
  return text;
}

function findQuestionIndex(header, config) {
  const index = header.findIndex((column) => (
    config.questionNeedles.every((needle) => normalizeText(column).includes(needle))
  ));

  if (index >= 0) return index;

  throw new Error(
    `Could not find target question for ${config.phase}: ${config.questionNeedles.join(" / ")}`
  );
}

function pct(count, total) {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function wordWeight(count, maxCount) {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio >= 0.72) return 5;
  if (ratio >= 0.48) return 4;
  if (ratio >= 0.28) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

function tone(id) {
  if (/(budget|time|distance|queue|route|weekend|plan|weather|execution|check|reservation|parking|open_hours|traffic)/.test(id)) {
    return "warn";
  }
  if (/(diet|conflict|no_decider|fake|temporary|constraints|privacy|risk|emergency)/.test(id)) {
    return "hard";
  }
  return undefined;
}

const phraseRules = [
  { id: "what_to_eat", label: "不知道吃什么", patterns: [/不知道吃什么/, /吃什么/, /饭点.*不知道/, /午饭|晚饭|早餐|夜宵/] },
  { id: "restaurant_recommend", label: "想要直接推荐餐厅", patterns: [/推荐.*餐厅/, /推荐.*店/, /找.*餐厅/, /附近.*餐厅/, /店铺|饭店|餐馆/] },
  { id: "group_dining", label: "多人约饭要协调", patterns: [/多人约饭|多人聚会|聚餐/, /朋友.*约饭/, /大家.*意见/, /协调.*偏好/, /群里|群聊/] },
  { id: "weekend_plan", label: "周末规划需要省心", patterns: [/周末/, /出去玩/, /短途游/, /citywalk/i, /半日|一日/, /活动规划|规划活动/] },
  { id: "execution_check", label: "先检查能不能执行", patterns: [/执行不了/, /可执行/, /检查.*方案/, /是否营业|超预算|太远|排队/, /看起来.*实际/] },
  { id: "budget", label: "预算难开口", patterns: [/预算/, /人均/, /价格/, /太贵/, /消费/, /钱/, /性价比/] },
  { id: "taste", label: "口味偏好要被照顾", patterns: [/口味/, /想吃/, /不吃辣|吃辣|辣/, /忌口/, /香菜/, /过敏/, /清淡|重口/] },
  { id: "distance", label: "距离太远", patterns: [/距离/, /太远/, /不想去那么远/, /附近/, /一公里|公里/, /路线.*远/] },
  { id: "time", label: "时间凑不齐", patterns: [/时间/, /约不上/, /凑不齐/, /下班|下课/, /临时/, /来不及/] },
  { id: "queue", label: "排队太久", patterns: [/排队/, /等位/, /等.*久/, /人太多/] },
  { id: "no_decider", label: "没人拍板", patterns: [/没人.*(拍板|决定|拿主意)/, /都说[\"“]?随便/, /不想.*决定/, /谁都不.*决定/] },
  { id: "choice_overload", label: "选择困难", patterns: [/选择困难/, /选不出来/, /纠结/, /犹豫/, /挑来挑去/] },
  { id: "app_switch", label: "多个 App 来回切", patterns: [/软件.*切换/, /App.*切换/i, /平台.*切换/, /美团.*点评.*地图/, /小红书.*美团/] },
  { id: "compare_many", label: "反复对比", patterns: [/反复对比/, /对比/, /比较/, /翻了.*家/, /看了.*家/, /看.*评论/] },
  { id: "too_much_info", label: "信息太多越看越乱", patterns: [/信息.*(太多|很多|杂)/, /看.*眼花/, /攻略.*太多/, /不知道信哪个/] },
  { id: "fake_review", label: "评价真假难辨", patterns: [/评价.*(真假|不真实|刷)/, /评分.*不准/, /推荐.*不靠谱/, /踩雷/] },
  { id: "rating_compare", label: "评分口碑要比", patterns: [/评分/, /口碑/, /风评/, /评论/, /评价/] },
  { id: "route_plan", label: "路线安排很累", patterns: [/路线/, /行程/, /怎么去/, /目的地附近/, /交通/, /顺路/] },
  { id: "weather", label: "天气会打乱计划", patterns: [/天气/, /下雨/, /太热/, /高温/, /晴雨/] },
  { id: "reservation", label: "想去的店没位", patterns: [/没位/, /没座/, /预约/, /预订/, /订位/, /满座/] },
  { id: "open_hours", label: "营业状态不确定", patterns: [/营业/, /开门/, /闭店/, /关门/, /几点开/, /几点关/, /打烊/] },
  { id: "parking", label: "停车也麻烦", patterns: [/停车/, /车位/, /开车/] },
  { id: "coupon", label: "优惠抢购也想管", patterns: [/优惠/, /团购/, /券/, /抢购/, /演出预约|预约演出/] },
  { id: "emergency", label: "突发情况要兜底", patterns: [/突发/, /应急/, /24h|24小时/, /药店|医院|维修|牙医|挂号/] },
  { id: "fallback_plan", label: "需要备选方案", patterns: [/备选/, /替代方案/, /重新安排/, /方案.*不满足/, /快速重新/] },
  { id: "memory", label: "希望记住偏好", patterns: [/记住/, /长期偏好/, /常去区域/, /个人偏好/, /喜欢.*不喜欢/] },
  { id: "privacy", label: "隐私和客观性顾虑", patterns: [/隐私/, /客观/, /商家不客观/, /推荐不准确/, /太复杂/] },
  { id: "quick_options", label: "要 2-3 个可选方案", patterns: [/2-3|两三个|三个/, /方案/, /候选/, /给.*推荐/] },
  { id: "direct_answer", label: "别只聊天要给结论", patterns: [/直接/, /结论/, /不要.*聊天/, /无法真正执行/, /只是聊天/] },
  { id: "inspiration", label: "没灵感时给方向", patterns: [/灵感/, /不知道玩什么/, /玩什么/, /去哪玩/, /去哪儿/] },
  { id: "food_delivery", label: "外卖也纠结", patterns: [/外卖/, /点份外卖/, /点外卖/] },
  { id: "quiet_env", label: "想要安静聊天", patterns: [/安静/, /聊天/, /别太吵|不要太吵/, /环境/] },
  { id: "group_explain", label: "要解释照顾了谁", patterns: [/照顾.*偏好/, /牺牲.*条件/, /解释.*理由/, /达成一致/] },
  { id: "vote", label: "群里投票更快", patterns: [/投票/, /选项/, /群里快速决定/] },
  { id: "school_area", label: "学校周边高频", patterns: [/学校/, /宿舍/, /同学/, /校园/] },
  { id: "waste_time", label: "找店花时间", patterns: [/浪费时间/, /花了.*时间/, /花了很久/, /半个多小时/, /几个小时/, /耗时/] },
  { id: "save_effort", label: "想省心省力", patterns: [/省心/, /省事/, /省力/, /懒得/, /不想自己/, /麻烦/, /快速/, /快点/] },
  { id: "nearby_play", label: "附近去哪玩", patterns: [/附近.*玩/, /周边.*玩/, /去哪玩/, /去哪里玩/, /去哪儿/, /附近游玩/] },
  { id: "all_in_one", label: "吃喝玩路线要一体化", patterns: [/景点.*吃饭/, /吃饭.*路线/, /游玩.*美食/, /顺便.*吃饭/, /吃喝玩/, /一条路线/] },
  { id: "chat_window", label: "希望入口顺手", patterns: [/聊天窗口/, /小程序/, /App/, /入口/, /直接使用/, /群聊中/] },
  { id: "reminder", label: "主动提醒别错过", patterns: [/提醒/, /出门/, /该吃饭/, /该订酒店/, /主动/, /跟进/] },
  { id: "preference_collection", label: "先收集大家偏好", patterns: [/收集.*口味/, /收集.*预算/, /整理.*偏好/, /大家.*位置/, /大家.*需求/] },
  { id: "location_compromise", label: "折中地点更公平", patterns: [/折中地点/, /中间位置/, /位置.*推荐/, /位置/, /住得散/] },
  { id: "candidate_sort", label: "筛选排序要清楚", patterns: [/排序/, /筛选/, /评分.*距离/, /预算.*距离/, /综合.*推荐/] },
  { id: "reasoning", label: "要说明推荐理由", patterns: [/理由/, /为什么/, /解释/, /照顾了谁/, /牺牲了什么/] },
  { id: "local_activity", label: "本地活动也想覆盖", patterns: [/本地生活/, /本地活动/, /商场/, /公园/, /活动/, /景点/] },
  { id: "not_implemented", label: "计划容易落空", patterns: [/没去成/, /落空/, /放鸽子/, /取消/, /最后没有去成/, /计划.*变/] },
  { id: "blogger_recommend", label: "攻略和博主也要参考", patterns: [/博主/, /小红书/, /攻略/, /推荐想去/] },
  { id: "healthy_food", label: "健康减脂也要算", patterns: [/减肥/, /健康/, /低卡/, /清淡/] },
  { id: "after_work", label: "下班下课马上要答案", patterns: [/下班/, /下课/, /晚上/, /饭点/] },
  { id: "family_friends", label: "家人朋友场景混在一起", patterns: [/家人/, /老婆/, /同事/, /室友/, /朋友/] },
  { id: "travel_booking", label: "酒店旅行也会纠结", patterns: [/酒店/, /旅游/, /旅行/, /订酒店/] }
];

const scenarioRules = [
  {
    key: "solo_food",
    title: "今天吃什么",
    icon: "食",
    patterns: [/吃什么|午饭|晚饭|早餐|夜宵|外卖|餐厅|饭店|餐馆|粉面|简餐/]
  },
  {
    key: "group_dining",
    title: "多人约饭",
    icon: "约",
    patterns: [/多人|约饭|聚餐|聚会|朋友|室友|同学|大家|群里|群聊|口味|忌口|意见/]
  },
  {
    key: "weekend_plan",
    title: "周末规划",
    icon: "周",
    patterns: [/周末|短途游|citywalk|活动规划|出去玩|路线|行程|天气|半日|一日|附近玩/]
  },
  {
    key: "execution_risk",
    title: "执行自检",
    icon: "验",
    patterns: [/预算|距离|排队|营业|打烊|预约|停车|天气|执行不了|踩雷|备选|应急|突发/]
  }
];

function matchesRule(text, rule) {
  return rule.patterns.some((pattern) => pattern.test(text));
}

function collectExamples(responses, rule, limit = 3) {
  const matches = responses.filter((item) => matchesRule(item.text, rule));
  const picked = [];
  const seenSources = new Set();

  for (const item of matches) {
    if (!seenSources.has(item.sourceLabel)) {
      picked.push(item);
      seenSources.add(item.sourceLabel);
    }
    if (picked.length >= limit) break;
  }

  for (const item of matches) {
    if (picked.includes(item)) continue;
    picked.push(item);
    if (picked.length >= limit) break;
  }

  return picked.map((item) => ({
    id: item.id,
    text: item.text,
    phase: item.phase,
    sourceLabel: item.sourceLabel
  }));
}

function loadSource(config) {
  const filePath = path.join(rawDir, config.fileName);
  const { text, encoding } = decodeFile(filePath);
  const rows = parseCsv(text);
  const header = rows[0] || [];
  const targetIndex = findQuestionIndex(header, config);
  const dataRows = rows.slice(1).filter((row) => !isMetadataRow(row));
  const responses = dataRows
    .map((row, index) => {
      const openText = cleanOpenText(row[targetIndex]);
      return {
        id: `${config.phase}-${normalizeText(row[0]) || `row_${index + 1}`}`,
        phase: config.phase,
        sourceLabel: config.sourceLabel,
        sourceFile: `data/raw/${config.fileName}`,
        question: normalizeText(header[targetIndex]),
        text: openText
      };
    })
    .filter((row) => row.text);

  return {
    ...config,
    encoding,
    columnCount: header.length,
    sampleSize: dataRows.length,
    openTextCount: responses.length,
    targetQuestion: normalizeText(header[targetIndex]),
    responses
  };
}

function buildWords(responses, sources) {
  const maxCount = Math.max(
    1,
    ...phraseRules.map((rule) => responses.filter((item) => matchesRule(item.text, rule)).length)
  );

  return phraseRules
    .map((rule) => {
      const matches = responses.filter((item) => matchesRule(item.text, rule));
      const sourceBreakdown = Object.fromEntries(
        sources.map((source) => [
          source.sourceLabel,
          matches.filter((item) => item.sourceLabel === source.sourceLabel).length
        ])
      );

      return {
        t: rule.label,
        id: rule.id,
        w: wordWeight(matches.length, maxCount),
        pct: pct(matches.length, responses.length),
        count: matches.length,
        c: tone(rule.id),
        sourceCategory: "融合开放题需求语料",
        sourceFile: sources.map((source) => `data/raw/${source.fileName}`).join(" + "),
        sourceLabel: "痛点经历 + AI 期待场景",
        sourceBreakdown,
        example: collectExamples(responses, rule, 1)[0]?.text || ""
      };
    })
    .filter((word) => word.count > 0)
    .sort((a, b) => b.count - a.count || b.pct - a.pct);
}

function buildScenarios(responses) {
  return scenarioRules
    .map((rule) => {
      const matches = responses.filter((item) => matchesRule(item.text, rule));
      return {
        key: rule.key,
        title: rule.title,
        icon: rule.icon,
        count: matches.length,
        pct: pct(matches.length, responses.length),
        examples: collectExamples(responses, rule, 4)
      };
    })
    .sort((a, b) => b.count - a.count);
}

function uniqueExamples(items, limit) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = normalizeText(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

function buildSections(words, scenarios, sources, totalResponses) {
  return [
    {
      key: "sources",
      title: "合并语料来源",
      sourceFile: sources.map((source) => `data/raw/${source.fileName}`).join(" + "),
      rows: sources.map((source) => ({
        label: source.targetQuestion,
        display: `${source.phase} · ${source.sourceLabel}`,
        count: source.openTextCount,
        pct: pct(source.openTextCount, totalResponses),
        example: source.targetQuestion
      }))
    },
    {
      key: "scenarios",
      title: "产品场景归因",
      sourceFile: "融合开放题文本",
      rows: scenarios.map((scenario) => ({
        label: scenario.title,
        display: scenario.title,
        count: scenario.count,
        pct: scenario.pct,
        example: scenario.examples[0]?.text || ""
      }))
    },
    {
      key: "words",
      title: "高频需求词条",
      sourceFile: "规则词表归并",
      rows: words.slice(0, 16).map((word) => ({
        label: word.sourceLabel,
        display: word.t,
        count: word.count,
        pct: word.pct,
        example: word.example
      }))
    }
  ];
}

const sources = sourceConfigs.map(loadSource);
const responses = sources.flatMap((source) => source.responses);
const words = buildWords(responses, sources);
const scenarios = buildScenarios(responses);
const totalSampleSize = sources.reduce((sum, source) => sum + source.sampleSize, 0);
const totalColumns = sources.reduce((sum, source) => sum + source.columnCount, 0);

const examples = uniqueExamples(
  [
    ...scenarios.flatMap((scenario) => scenario.examples),
    ...words.slice(0, 12).map((word) => ({
      id: word.id,
      text: word.example,
      phase: "词条样例",
      sourceLabel: word.t
    })),
    ...responses
  ],
  10
);

const topScenario = scenarios[0];
const groupScenario = scenarios.find((scenario) => scenario.key === "group_dining");
const weekendScenario = scenarios.find((scenario) => scenario.key === "weekend_plan");
const executionScenario = scenarios.find((scenario) => scenario.key === "execution_risk");

const payload = {
  meta: {
    sampleSize: totalSampleSize,
    openTextCount: responses.length,
    columnCount: totalColumns,
    sourceSnapshot: "v1.1 + phase2",
    rawCsv: sources.map((source) => `data/raw/${source.fileName}`).join(" + "),
    sourceEncoding: Array.from(new Set(sources.map((source) => source.encoding))).join(" + "),
    targetQuestion: sources.map((source) => `${source.phase}: ${source.targetQuestion}`).join(" / "),
    generatedAt: new Date().toISOString(),
    importCommand: "npm run build:survey-wordcloud",
    note: "词云融合第一阶段痛点经历和第二阶段 AI 期待场景；高频词使用规则词表归并同义表达，不展示完整个人答卷。",
    sources: sources.map((source) => ({
      phase: source.phase,
      sourceLabel: source.sourceLabel,
      fileName: `data/raw/${source.fileName}`,
      encoding: source.encoding,
      sampleSize: source.sampleSize,
      openTextCount: source.openTextCount,
      columnCount: source.columnCount,
      targetQuestion: source.targetQuestion
    }))
  },
  hero: {
    eyebrow: "设计与思路 · 真实调研",
    title: "本地生活最累的，不是没选择",
    emphasis: "是没人把需求收敛成方案",
    subtitle: `${totalSampleSize} 份有效问卷，合并第一阶段痛点经历和第二阶段 AI 期待场景；高频需求集中在今天吃什么、多人约饭、周末规划，以及预算/距离/排队/营业的执行自检。`
  },
  stats: [
    { v: `${totalSampleSize}`, k: "有效问卷" },
    { v: `${responses.length}`, k: "开放文本" },
    { v: `${words.length}`, k: "归并词条" },
    { v: `${sources.length}`, k: "调研阶段" }
  ],
  insightCards: [
    {
      title: "不是缺信息，是缺收敛",
      value: `${topScenario?.pct ?? 0}%`,
      detail: `${topScenario?.title ?? "核心场景"}相关表达最多。用户不是只要列表，而是要从预算、口味、距离和时间里快速收敛。`
    },
    {
      title: "三条功能线都有直接语料",
      value: `${groupScenario?.count ?? 0} / ${weekendScenario?.count ?? 0}`,
      detail: `多人约饭和周末规划都在开放题中高频出现，可以作为“今天吃什么”之外的第二、第三入口。`
    },
    {
      title: "执行自检决定可信度",
      value: `${executionScenario?.pct ?? 0}%`,
      detail: "预算、距离、排队、营业、天气和备选方案共同构成兜底要求，适合沉淀成每个推荐结果的自检模块。"
    }
  ],
  words,
  scenarios,
  sections: buildSections(words, scenarios, sources, responses.length),
  examples,
  source: {
    files: sources.map((source) => `data/raw/${source.fileName}`),
    analyzer: "analysis/scripts/export_wordcloud_data.mjs",
    method: "regex-phrase-rule-merge-v2"
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${path.relative(repoRoot, outputPath)} with ${words.length} words from ${responses.length} open-text responses across ${sources.length} sources.`
);
