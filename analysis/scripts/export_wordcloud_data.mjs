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
    questionNeedles: ["做本地生活决策很累", "请用 1-2 句话描述这件事"],
    identityNeedles: ["你的身份是"],
    ageNeedles: ["请选择你的年龄段"],
    aiUsageNeedles: ["使用 AI 工具"],
    appFrequencyNeedles: ["本地生活类 App 的频率"],
    tangledNeedles: ["在哪类本地生活选择中最容易纠结"]
  },
  {
    phase: "第二阶段",
    sourceLabel: "AI 期待场景",
    fileName: "第二阶段问卷数据.csv",
    questionNeedles: ["请用一句话描述", "最希望 AI 本地生活管家", "具体场景"],
    identityNeedles: ["目前的身份"],
    ageNeedles: ["请选择你的年龄段"],
    aiUsageNeedles: ["使用 AI 工具"],
    appFrequencyNeedles: ["本地生活类 App 的频率"],
    tangledNeedles: ["在哪类本地生活选择中最容易纠结"]
  }
];

const directTerms = [
  "朋友", "约饭", "聚餐", "多人", "群聊", "同学", "室友", "同事", "家人", "老婆", "孩子", "情侣",
  "吃饭", "今天吃什么", "吃什么", "晚饭", "午饭", "早餐", "夜宵", "外卖", "餐厅", "饭店", "店铺", "美食",
  "火锅", "烧烤", "炒菜", "粉面", "简餐", "咖啡", "奶茶", "甜品", "清淡", "重口", "不吃辣", "忌口", "香菜", "口味",
  "周末", "规划", "去哪玩", "出门", "出行", "路线", "行程", "旅行", "短途游", "景点", "活动", "公园", "逛街", "citywalk",
  "预算", "人均", "价格", "优惠", "团购", "距离", "附近", "太远", "交通", "停车", "排队", "等位", "预约", "营业", "打烊",
  "时间", "临时", "备选", "兜底", "天气", "下雨", "高温", "选择困难", "纠结", "比较", "对比", "筛选", "推荐", "评分", "评价", "评论", "攻略",
  "小红书", "美团", "大众点评", "地图", "App", "信息太多", "真实", "踩雷", "省心", "快速", "直接", "方案", "理由", "解释", "记住", "偏好",
  "提醒", "主动", "应急", "药店", "医院", "维修", "酒店", "学校", "宿舍", "附近", "安静", "聊天", "座位", "浪费时间"
];

const ignoredTextValues = new Set(["", "Q", "作答ID", "undefined", "null"]);

const toneTerms = {
  warn: new Set(["预算", "人均", "价格", "优惠", "团购", "距离", "附近", "太远", "交通", "停车", "排队", "等位", "预约", "营业", "打烊", "时间", "天气", "下雨", "高温"]),
  hard: new Set(["朋友", "约饭", "聚餐", "多人", "群聊", "不吃辣", "忌口", "香菜", "选择困难", "纠结", "踩雷", "应急", "药店", "医院", "维修"])
};

const scenarioRules = [
  {
    key: "solo_food",
    title: "今天吃什么",
    icon: "饭",
    terms: ["吃饭", "今天吃什么", "吃什么", "晚饭", "午饭", "早餐", "夜宵", "外卖", "餐厅", "饭店", "火锅", "烧烤", "粉面", "简餐", "奶茶", "甜品"]
  },
  {
    key: "group_dining",
    title: "多人约饭",
    icon: "约",
    terms: ["朋友", "约饭", "聚餐", "多人", "群聊", "同学", "室友", "同事", "家人", "老婆", "情侣", "口味", "忌口", "不吃辣"]
  },
  {
    key: "weekend_plan",
    title: "周末规划",
    icon: "周",
    terms: ["周末", "规划", "去哪玩", "出门", "出行", "路线", "行程", "旅行", "短途游", "景点", "活动", "公园", "逛街", "citywalk"]
  },
  {
    key: "execution_check",
    title: "执行自检",
    icon: "验",
    terms: ["预算", "人均", "距离", "交通", "停车", "排队", "等位", "预约", "营业", "打烊", "时间", "临时", "备选", "兜底", "天气", "下雨", "高温", "踩雷", "应急"]
  }
];

const painOptionHints = [
  "信息太多", "多个 App", "多个APP", "反复切换", "预算", "距离", "时间", "评分", "评价", "真假", "口味", "忌口", "朋友", "意见", "临时", "变化", "重新查"
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

function cleanOpenText(value) {
  const text = normalizeText(value);
  if (ignoredTextValues.has(text)) return "";
  if (/^[\d\s.,，。!?！？-]+$/.test(text)) return "";
  if (text.length < 3) return "";
  return text;
}

function cleanChoiceLabel(value) {
  return normalizeText(value)
    .replace(/^[A-Z]\.\s*/, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .replace(/(\d+)\s*岁/g, "$1岁")
    .replace(/已工作\s*/g, "已工作")
    .replace(/(\d+)\s*年/g, "$1年")
    .replace(/每周\s*/g, "每周")
    .replace(/\s*次/g, "次")
    .replace(/\s+/g, "");
}

function isMetadataRow(row) {
  return normalizeText(row[0]) === "作答ID";
}

function findQuestionIndex(header, needles, required = true) {
  const index = header.findIndex((column) => (
    needles.every((needle) => normalizeText(column).includes(needle))
  ));

  if (index >= 0) return index;
  if (!required) return -1;
  throw new Error(`Could not find question: ${needles.join(" / ")}`);
}

function pct(count, total) {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function makeId(label) {
  return Buffer.from(label).toString("hex").slice(0, 24);
}

function wordWeight(count, maxCount) {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio >= 0.72) return 5;
  if (ratio >= 0.48) return 4;
  if (ratio >= 0.28) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

function toneForTerm(term) {
  if (toneTerms.warn.has(term)) return "warn";
  if (toneTerms.hard.has(term)) return "hard";
  return undefined;
}

function hasTerm(text, term) {
  if (term === "App") return /\bapp\b/i.test(text);
  if (term === "citywalk") return /city\s*walk|citywalk/i.test(text);
  return text.includes(term);
}

function isSelectedCell(value) {
  const text = normalizeText(value);
  if (!text) return false;
  if (["Q", "0", "否", "无", "未选择", "undefined", "null"].includes(text)) return false;
  return true;
}

function splitMultiValue(value) {
  const text = normalizeText(value);
  if (!text || ignoredTextValues.has(text)) return [];
  return text
    .split(/[;；,，、|/]+|\s{2,}/g)
    .map((item) => cleanChoiceLabel(item))
    .filter((item) => item && !ignoredTextValues.has(item));
}

function simplifyHeaderOption(header) {
  const text = normalizeText(header);
  const option = text.includes("-") ? text.split("-").pop() : text;
  return cleanChoiceLabel(option)
    .replace(/^[A-Z]\.\s*/, "")
    .replace(/^其他[:：]?\s*/, "其他");
}

function countMapToRows(map, total, limit = 12) {
  return Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: pct(count, total)
    }));
}

function addCount(map, key, by = 1) {
  const label = normalizeText(key);
  if (!label || ignoredTextValues.has(label)) return;
  map.set(label, (map.get(label) || 0) + by);
}

function buildTermHits(responses, sourceLabels) {
  const maxCount = Math.max(
    1,
    ...directTerms.map((term) => responses.filter((item) => hasTerm(item.text, term)).length)
  );

  return directTerms
    .map((term) => {
      const matches = responses.filter((item) => hasTerm(item.text, term));
      const sourceBreakdown = Object.fromEntries(
        sourceLabels.map((sourceLabel) => [
          sourceLabel,
          matches.filter((item) => item.sourceLabel === sourceLabel).length
        ])
      );

      return {
        t: term,
        id: makeId(term),
        w: wordWeight(matches.length, maxCount),
        pct: pct(matches.length, responses.length),
        count: matches.length,
        c: toneForTerm(term),
        sourceCategory: "开放题原文词频",
        sourceFile: "data/raw/问卷数据v1.1.csv + data/raw/第二阶段问卷数据.csv",
        sourceLabel: "两阶段开放题原文",
        sourceBreakdown,
        example: matches[0]?.text || ""
      };
    })
    .filter((word) => word.count > 0)
    .sort((a, b) => b.count - a.count || b.pct - a.pct || a.t.localeCompare(b.t, "zh-Hans-CN"));
}

function classifyScenario(text) {
  const scored = scenarioRules.map((scenario) => ({
    scenario,
    score: scenario.terms.reduce((sum, term) => sum + (hasTerm(text, term) ? 1 : 0), 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].scenario : null;
}

function collectExamples(responses, predicate, limit = 4) {
  const result = [];
  const seen = new Set();

  for (const item of responses) {
    if (!predicate(item)) continue;
    const key = item.text;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: item.id,
      text: item.text,
      phase: item.phase,
      sourceLabel: item.sourceLabel
    });
    if (result.length >= limit) break;
  }

  return result;
}

function findPainColumns(header) {
  return header
    .map((column, index) => ({ column: normalizeText(column), index }))
    .filter(({ column }) => {
      if (!column.includes("你在做本地生活决策时，通常会遇到哪些问题？-")) return false;
      if (column.includes("方差") || column.includes("均值") || column.endsWith("-文本")) return false;
      return painOptionHints.some((hint) => column.includes(hint));
    });
}

function loadSource(config) {
  const filePath = path.join(rawDir, config.fileName);
  const { text, encoding } = decodeFile(filePath);
  const rows = parseCsv(text);
  const header = rows[0] || [];
  const targetIndex = findQuestionIndex(header, config.questionNeedles);
  const identityIndex = findQuestionIndex(header, config.identityNeedles, false);
  const ageIndex = findQuestionIndex(header, config.ageNeedles, false);
  const aiUsageIndex = findQuestionIndex(header, config.aiUsageNeedles, false);
  const appFrequencyIndex = findQuestionIndex(header, config.appFrequencyNeedles, false);
  const tangledIndex = findQuestionIndex(header, config.tangledNeedles, false);
  const painColumns = findPainColumns(header);
  const dataRows = rows.slice(1).filter((row) => !isMetadataRow(row));

  const records = dataRows.map((row, index) => {
    const openText = cleanOpenText(row[targetIndex]);
    return {
      id: `${config.phase}-${normalizeText(row[0]) || `row_${index + 1}`}`,
      phase: config.phase,
      sourceLabel: config.sourceLabel,
      sourceFile: `data/raw/${config.fileName}`,
      question: normalizeText(header[targetIndex]),
      text: openText,
      identity: identityIndex >= 0 ? cleanChoiceLabel(row[identityIndex]) : "",
      age: ageIndex >= 0 ? cleanChoiceLabel(row[ageIndex]) : "",
      aiUsage: aiUsageIndex >= 0 ? cleanChoiceLabel(row[aiUsageIndex]) : "",
      appFrequency: appFrequencyIndex >= 0 ? cleanChoiceLabel(row[appFrequencyIndex]) : "",
      tangledScenes: tangledIndex >= 0 ? splitMultiValue(row[tangledIndex]) : [],
      painPoints: painColumns
        .filter(({ index: columnIndex }) => isSelectedCell(row[columnIndex]))
        .map(({ column }) => simplifyHeaderOption(column))
    };
  });

  return {
    ...config,
    encoding,
    columnCount: header.length,
    sampleSize: dataRows.length,
    openTextCount: records.filter((row) => row.text).length,
    targetQuestion: normalizeText(header[targetIndex]),
    records,
    responses: records.filter((row) => row.text)
  };
}

function buildScenarioRows(responses) {
  const scenarioCounts = new Map();
  const scenarioExamples = new Map();

  for (const item of responses) {
    const scenario = classifyScenario(item.text);
    const key = scenario?.key || "other";
    const title = scenario?.title || "其他需求";
    addCount(scenarioCounts, title);
    if (!scenarioExamples.has(title)) scenarioExamples.set(title, []);
    const examples = scenarioExamples.get(title);
    if (examples.length < 4) {
      examples.push({
        id: item.id,
        text: item.text,
        phase: item.phase,
        sourceLabel: item.sourceLabel
      });
    }
  }

  return Array.from(scenarioCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => {
      const scenario = scenarioRules.find((item) => item.title === title);
      return {
        key: scenario?.key || "other",
        title,
        icon: scenario?.icon || "其",
        count,
        pct: pct(count, responses.length),
        examples: scenarioExamples.get(title) || []
      };
    });
}

function buildDistribution(records, key, limit = 10) {
  const map = new Map();
  for (const record of records) {
    const value = normalizeText(record[key]);
    if (value && !ignoredTextValues.has(value)) addCount(map, value);
  }
  return countMapToRows(map, records.length, limit);
}

function buildMultiDistribution(records, key, limit = 12) {
  const map = new Map();
  for (const record of records) {
    for (const item of record[key] || []) addCount(map, item);
  }
  return countMapToRows(map, records.length, limit);
}

function topWordsForResponses(words, responses, limit = 8) {
  return words
    .map((word) => {
      const count = responses.filter((item) => hasTerm(item.text, word.t)).length;
      return { label: word.t, count, pct: pct(count, responses.length) };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-Hans-CN"))
    .slice(0, limit);
}

function topScenariosForResponses(responses, limit = 4) {
  const map = new Map();
  for (const item of responses) {
    const scenario = classifyScenario(item.text);
    addCount(map, scenario?.title || "其他需求");
  }
  return countMapToRows(map, responses.length, limit);
}

function buildPhaseFocus(sources, words) {
  return sources.map((source) => ({
    phase: source.phase,
    sourceLabel: source.sourceLabel,
    openTextCount: source.openTextCount,
    topWords: topWordsForResponses(words, source.responses, 8),
    topScenarios: topScenariosForResponses(source.responses, 4)
  }));
}

function buildAgeFocus(records, responses, words) {
  const ages = Array.from(new Set(records.map((record) => record.age).filter(Boolean)));
  return ages
    .map((age) => {
      const sampleRecords = records.filter((record) => record.age === age);
      const sampleResponses = responses.filter((response) => response.age === age);
      return {
        age,
        sampleSize: sampleRecords.length,
        openTextCount: sampleResponses.length,
        topWords: topWordsForResponses(words, sampleResponses, 5),
        topScenarios: topScenariosForResponses(sampleResponses, 4)
      };
    })
    .filter((item) => item.sampleSize > 0)
    .sort((a, b) => b.sampleSize - a.sampleSize);
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
      key: "source_columns",
      title: "开放题来源列",
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
      key: "scenario_primary",
      title: "开放题主场景分布",
      sourceFile: "由原文词命中后取最高分场景",
      rows: scenarios.map((scenario) => ({
        label: scenario.title,
        display: scenario.title,
        count: scenario.count,
        pct: scenario.pct,
        example: scenario.examples[0]?.text || ""
      }))
    },
    {
      key: "direct_words",
      title: "原文高频词",
      sourceFile: "严格来自两列开放题文本",
      rows: words.slice(0, 18).map((word) => ({
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
const records = sources.flatMap((source) => source.records);
const responses = sources.flatMap((source) => source.responses);
const sourceLabels = sources.map((source) => source.sourceLabel);
const words = buildTermHits(responses, sourceLabels);
const scenarios = buildScenarioRows(responses);
const totalSampleSize = sources.reduce((sum, source) => sum + source.sampleSize, 0);
const totalColumns = sources.reduce((sum, source) => sum + source.columnCount, 0);

const topScenario = scenarios[0];
const groupScenario = scenarios.find((scenario) => scenario.key === "group_dining");
const weekendScenario = scenarios.find((scenario) => scenario.key === "weekend_plan");
const soloScenario = scenarios.find((scenario) => scenario.key === "solo_food");
const executionScenario = scenarios.find((scenario) => scenario.key === "execution_check");

const examples = uniqueExamples(
  [
    ...words.slice(0, 12).map((word) => ({
      id: word.id,
      text: word.example,
      phase: "原词命中样例",
      sourceLabel: word.t
    })),
    ...scenarios.flatMap((scenario) => scenario.examples),
    ...responses
  ],
  12
);

const charts = {
  topTerms: words.slice(0, 20).map((word) => ({
    label: word.t,
    count: word.count,
    pct: word.pct,
    note: word.example
  })),
  scenarioDonut: scenarios.map((scenario) => ({
    label: scenario.title,
    count: scenario.count,
    pct: scenario.pct,
    note: scenario.examples[0]?.text || ""
  })),
  ageDistribution: buildDistribution(records, "age", 8),
  identityDistribution: buildDistribution(records, "identity", 8),
  appFrequency: buildDistribution(records, "appFrequency", 8),
  aiUsage: buildDistribution(records, "aiUsage", 8),
  sourceOpenText: sources.map((source) => ({
    label: `${source.phase} · ${source.sourceLabel}`,
    count: source.openTextCount,
    pct: pct(source.openTextCount, responses.length),
    note: source.targetQuestion
  })),
  tangledScenes: buildMultiDistribution(records, "tangledScenes", 12),
  painPointBars: buildMultiDistribution(records, "painPoints", 12),
  phaseFocus: buildPhaseFocus(sources, words),
  ageFocus: buildAgeFocus(records, responses, words)
};

const payload = {
  meta: {
    sampleSize: totalSampleSize,
    openTextCount: responses.length,
    columnCount: totalColumns,
    sourceSnapshot: "survey-v1.1 + phase-2",
    rawCsv: sources.map((source) => `data/raw/${source.fileName}`).join(" + "),
    sourceEncoding: Array.from(new Set(sources.map((source) => source.encoding))).join(" + "),
    targetQuestion: sources.map((source) => `${source.phase}: ${source.targetQuestion}`).join(" / "),
    generatedAt: new Date().toISOString(),
    importCommand: "npm run build:survey-wordcloud",
    note: "词云只统计两列开放题原文里的词/短语命中，不再使用语义总结标签；每个词条的权重表示有多少条开放文本直接出现该词。",
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
    emphasis: "是没人帮你把需求拍板",
    subtitle: `${totalSampleSize} 份有效问卷，合并 ${responses.length} 条开放题文本。词云严格来自“做本地生活决策很累”的经历和“希望 AI 帮到什么场景”的原文高频词。`
  },
  stats: [
    { v: `${totalSampleSize}`, k: "有效问卷" },
    { v: `${responses.length}`, k: "开放文本" },
    { v: `${words.length}`, k: "原文词条" },
    { v: `${sources.length}`, k: "调研阶段" }
  ],
  insightCards: [
    {
      title: "词云不是总结，是原词命中",
      value: `${words[0]?.t ?? "原词"} · ${words[0]?.count ?? 0}`,
      detail: `最高频词来自开放题原文，命中 ${words[0]?.count ?? 0} 条文本。它代表用户自己写下的表达，不是产品侧归纳后的概念。`
    },
    {
      title: "三个功能入口都有问卷支撑",
      value: `${soloScenario?.count ?? 0}/${groupScenario?.count ?? 0}/${weekendScenario?.count ?? 0}`,
      detail: `今天吃什么、多人约饭、周末规划分别在开放题里有直接语料；这也是首页三个入口继续保留的依据。`
    },
    {
      title: "执行自检仍是可信度来源",
      value: `${executionScenario?.count ?? 0} 条`,
      detail: "预算、距离、时间、排队、营业、天气、备选等词频说明用户要的不是聊天，而是能执行的方案。"
    },
    {
      title: "主场景分布可继续迭代",
      value: `${topScenario?.title ?? "主场景"}`,
      detail: "后续第二批数据更新后，只要替换 CSV 并运行导入命令，词频和图表会一起刷新。"
    }
  ],
  words,
  scenarios,
  charts,
  sections: buildSections(words, scenarios, sources, responses.length),
  examples,
  source: {
    files: sources.map((source) => `data/raw/${source.fileName}`),
    analyzer: "analysis/scripts/export_wordcloud_data.mjs",
    method: "direct-open-text-term-frequency-v3"
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${path.relative(repoRoot, outputPath)} with ${words.length} direct terms from ${responses.length} open-text responses across ${sources.length} sources.`
);
