import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const outputRoot = path.join(repoRoot, "analysis", "outputs", "2026-05-08");
const tablesDir = path.join(outputRoot, "tables");
const metricsPath = path.join(outputRoot, "report_metrics.json");
const targetPath = path.join(repoRoot, "frontend", "data", "survey", "wordcloud-insights.json");

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
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

  const [rawHeader = [], ...body] = rows;
  const header = rawHeader.map((key) => key.replace(/^\uFEFF/, ""));
  return body
    .filter((item) => item.some(Boolean))
    .map((item) => Object.fromEntries(header.map((key, index) => [key, item[index] ?? ""])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(tablesDir, name), "utf8"));
}

function pct(row) {
  return Number(row.pct ?? row.pct_of_responses ?? 0);
}

function weight(value) {
  if (value >= 55) return 5;
  if (value >= 40) return 4;
  if (value >= 24) return 3;
  if (value >= 14) return 2;
  return 1;
}

function tone(label) {
  if (/忌口|过敏|不吃|真假|踩雷|硬约束/.test(label)) return "hard";
  if (/时间|距离|排队|预算|营业|路线|临时|预约|周末/.test(label)) return "warn";
  return undefined;
}

const sources = [
  {
    key: "decisionPainPoints",
    title: "本地决策痛点",
    file: "decision_pain_points_overall.csv",
    label: {
      "餐厅 / 活动评价真假难辨": "评价真假难辨",
      "信息太多，不知道怎么选": "信息太多",
      "需要在多个 App 之间反复切换": "多 App 切换",
      "不知道营业时间、排队情况是否合适": "营业/排队不确定",
      "不知道是否符合预算": "预算不确定",
      "不知道路线是否顺路": "路线不顺路",
      "临时计划变化后，需要重新查很多信息": "临时变更重查",
      "和朋友意见不统一，很难协调": "朋友意见不统一"
    }
  },
  {
    key: "groupConflicts",
    title: "多人约饭冲突",
    file: "group_conflict_types_overall.csv",
    label: {
      "口味不同": "口味不同",
      "时间不一致": "时间不一致",
      "距离远近不同": "距离远近不同",
      "预算不同": "预算不同",
      "有人忌口 / 过敏 / 不吃某类食物": "忌口/过敏",
      "有人想尝新，有人想吃熟悉的店": "尝新 vs 熟店",
      "大家都不想做决定": "都不想做决定",
      "有人想安静聊天，有人想热闹": "安静/热闹冲突"
    }
  },
  {
    key: "openTextThemes",
    title: "开放题主题",
    file: "open_text_theme_counts.csv",
    label: {
      "不知道吃什么/选店困难": "不知道吃什么",
      "多人约饭/意见冲突": "多人意见冲突",
      "路线/距离/时间安排": "路线/时间安排",
      "信息过载/多 App 切换": "信息过载",
      "执行不确定/约束检查": "执行不确定",
      "突发/兜底需求": "突发兜底"
    }
  },
  {
    key: "desiredAiTasks",
    title: "期待 AI 做的事",
    file: "desired_ai_tasks_overall.csv",
    label: {
      "根据预算、口味、距离、评分等推荐餐厅": "按预算口味推荐",
      "想不到吃什么/玩什么时，帮我找灵感": "找灵感",
      "帮我规划周末活动 / 短途游 / citywalk": "周末规划",
      "帮我和朋友协调约饭 / 聚会地点，根据多人偏好提供建议": "协调约饭地点",
      "帮我留意限时优惠 / 抢购 / 演出预约": "优惠/预约提醒",
      "根据天气、时间等实时调整我已经定好的方案": "实时调整方案",
      "突发情况帮我兜底，例如找 24h 药店、医院、维修等": "突发兜底"
    }
  }
];

const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const sections = sources.map((source) => {
  const rows = readCsv(source.file)
    .map((row) => ({
      label: row.option ?? row.theme ?? "",
      display: source.label[row.option ?? row.theme ?? ""] ?? "",
      count: Number(row.count ?? 0),
      pct: pct(row),
      example: row.example || "",
      sourceColumn: row.source_column || ""
    }))
    .filter((row) => row.display && !/未填写|其他/.test(row.label))
    .sort((a, b) => b.pct - a.pct);

  return {
    key: source.key,
    title: source.title,
    sourceFile: `analysis/outputs/2026-05-08/tables/${source.file}`,
    rows
  };
});

const wordMap = new Map();
sections.forEach((section) => {
  section.rows.forEach((row) => {
    const existing = wordMap.get(row.display);
    const item = {
      t: row.display,
      w: weight(row.pct),
      pct: row.pct,
      count: row.count,
      c: tone(row.display),
      sourceCategory: section.title,
      sourceFile: section.sourceFile,
      sourceLabel: row.label,
      example: row.example
    };

    if (!existing || item.pct > existing.pct) {
      wordMap.set(row.display, item);
    }
  });
});

const words = Array.from(wordMap.values())
  .sort((a, b) => b.pct - a.pct || b.count - a.count)
  .slice(0, 28);

const topPain = sections[0].rows[0];
const topConflict = sections[1].rows[0];
const topOpen = sections[2].rows[0];
const topAi = sections[3].rows[0];

const payload = {
  meta: {
    sampleSize: metrics.sample_size,
    columnCount: metrics.column_count,
    sourceSnapshot: "2026-05-08",
    rawCsv: "data/raw/问卷数据v1.1.csv",
    sourceMetrics: "analysis/outputs/2026-05-08/report_metrics.json",
    note: "词云由聚合统计表派生，不展示原始答卷明细。"
  },
  hero: {
    eyebrow: "设计与思路 · 真实调研",
    title: "约饭，最让你烦的不是选店",
    emphasis: "是没人拍板",
    subtitle: `${metrics.sample_size} 份有效问卷、${metrics.column_count} 个原始字段，词条来自本地决策痛点、多人约饭冲突、开放题主题和 AI 需求统计；字越大，代表被更多人提到。`
  },
  stats: [
    { v: String(metrics.sample_size), k: "有效样本" },
    { v: String(metrics.column_count), k: "原始字段" },
    { v: `${topPain.pct}%`, k: topPain.display },
    { v: `${topConflict.pct}%`, k: topConflict.display }
  ],
  insightCards: [
    {
      title: "选店不是终点，可信信息才是入口",
      value: `${topPain.pct}%`,
      detail: `${topPain.count} 人选择“${topPain.label}”，高于单纯预算、路线等执行问题。`
    },
    {
      title: "多人约饭的核心冲突先是口味",
      value: `${topConflict.pct}%`,
      detail: `${topConflict.count} 人提到“${topConflict.label}”，因此推荐链路必须先保护忌口和硬约束。`
    },
    {
      title: "开放题反复指向“选不出来”",
      value: `${topOpen.pct}%`,
      detail: `${topOpen.count} 份回答被归入“${topOpen.label}”，说明用户需要的是能收敛决策的管家。`
    },
    {
      title: "用户期待 AI 直接给可执行餐厅方案",
      value: `${topAi.pct}%`,
      detail: `${topAi.count} 人选择“${topAi.label}”，支撑先做吃饭、约饭、周末规划三个场景。`
    }
  ],
  words,
  sections
};

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(repoRoot, targetPath)} with ${words.length} words.`);
