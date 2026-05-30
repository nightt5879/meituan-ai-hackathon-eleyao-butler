import { execFile } from "child_process";
import { promisify } from "util";
import type { OpenClawDataContext } from "@/lib/server/openclawDataFeed";
import { buildScopedOpenClawSessionId, shortHash } from "@/lib/server/openclawSession";
import type { Conflict, DinnerTask, Participant, RecommendationResult, RestaurantCandidate } from "@/lib/types";

const execFileAsync = promisify(execFile);

const DEFAULT_PROFILE = "default";
const DEFAULT_AGENT_ID = "main";
const DEFAULT_SESSION_KEY = "meituan-single-food";
const DEFAULT_TIMEOUT_SECONDS = 300;

type OpenClawRecommendationOptions = {
  taskId?: string;
  userId?: string;
  context?: OpenClawDataContext;
};

function numberOr(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArrayOr(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function recordStringNumberOr(value: unknown, participants: Participant[], fallback = 70) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, raw]) => [key, numberOr(raw, fallback)] as const);
    if (entries.length > 0) {
      return Object.fromEntries(entries);
    }
  }

  return Object.fromEntries(participants.map((participant) => [participant.nickname, fallback]));
}

function statusRecordOr(value: unknown, fallbackKeys: string[]) {
  const allowed = ["pass", "fail", "risk"] as const;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, raw]) => [key, enumOr(raw, allowed, "risk")])
    );
  }

  return Object.fromEntries(fallbackKeys.map((key) => [key, "risk" as const]));
}

function extractFirstJsonObject(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue below.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue below.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("OpenClaw response did not contain JSON.");
}

function extractAssistantText(cliJson: unknown) {
  const result = (cliJson as { result?: unknown }).result as { payloads?: Array<{ text?: string }>; meta?: { finalAssistantVisibleText?: string; finalAssistantRawText?: string } } | undefined;
  const payloadText = result?.payloads?.find((payload) => typeof payload.text === "string" && payload.text.trim())?.text;

  return payloadText ?? result?.meta?.finalAssistantVisibleText ?? result?.meta?.finalAssistantRawText ?? "";
}

function normalizeCandidate(raw: unknown, index: number, participants: Participant[]): RestaurantCandidate {
  const candidate = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const audit = candidate.audit && typeof candidate.audit === "object" ? (candidate.audit as Record<string, unknown>) : {};
  const name = stringOr(candidate.name, `候选餐厅 ${index + 1}`);
  const avgPrice = numberOr(candidate.avg_price ?? candidate.estimated_price ?? candidate.price, 60);
  const distanceM = numberOr(candidate.distance_m ?? candidate.distance, 1000);
  const walkMinutes = numberOr(candidate.walk_minutes, Math.max(5, Math.round(distanceM / 80)));

  return {
    restaurant_id: stringOr(candidate.restaurant_id ?? candidate.id, `openclaw_${index + 1}`),
    name,
    category: stringOr(candidate.category, "单人友好餐厅"),
    avg_price: avgPrice,
    distance_m: distanceM,
    walk_minutes: walkMinutes,
    open_time: stringOr(candidate.open_time, "待确认"),
    close_time: stringOr(candidate.close_time, "待确认"),
    supports_spicy: booleanOr(candidate.supports_spicy, true),
    supports_non_spicy: booleanOr(candidate.supports_non_spicy, true),
    is_hotpot: booleanOr(candidate.is_hotpot, false),
    quiet_score: numberOr(candidate.quiet_score, 4),
    chat_friendly: booleanOr(candidate.chat_friendly, true),
    queue_risk: enumOr(candidate.queue_risk, ["low", "medium", "high"] as const, "medium"),
    rating: numberOr(candidate.rating, 4.5),
    member_scores: recordStringNumberOr(candidate.member_scores, participants),
    score: numberOr(candidate.score, Math.max(60, 88 - index * 5)),
    audit: {
      passed: booleanOr(audit.passed, true),
      hard_rules: statusRecordOr(audit.hard_rules, ["budget", "diet", "time", "distance"]),
      soft_checks: statusRecordOr(audit.soft_checks, ["queue", "chat"]),
      llm_explanation: stringOr(audit.llm_explanation, stringOr(candidate.reason, `${name} 基本符合当前约束。`))
    },
    reason: stringOr(candidate.reason, `${name} 符合预算、距离和忌口约束。`),
    tags: stringArrayOr(candidate.tags, ["OpenClaw", "单人友好"])
  };
}

function normalizeRecommendation(raw: unknown, task: DinnerTask, participants: Participant[]): RecommendationResult {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawCandidates = Array.isArray(source.candidates)
    ? source.candidates
    : Array.isArray(source.recommendations)
      ? source.recommendations
      : [];
  const candidates = rawCandidates.slice(0, 3).map((candidate, index) => normalizeCandidate(candidate, index, participants));

  if (candidates.length < 2) {
    throw new Error("OpenClaw must return at least 2 candidates.");
  }

  const finalRaw = source.final_choice && typeof source.final_choice === "object" ? (source.final_choice as Record<string, unknown>) : {};
  const selected = candidates.find((candidate) => candidate.restaurant_id === finalRaw.restaurant_id || candidate.name === finalRaw.name) ?? candidates[0];
  const backup = candidates.find((candidate) => candidate.restaurant_id !== selected.restaurant_id) ?? candidates[1];

  return {
    candidates,
    final_choice: {
      restaurant_id: selected.restaurant_id,
      name: selected.name,
      reason: stringOr(finalRaw.reason, selected.reason),
      risks: stringArrayOr(finalRaw.risks, ["到店前建议确认营业时间、排队和实际菜品。"]),
      backup: stringOr(finalRaw.backup, backup.name)
    },
    group_message: stringOr(source.group_message, `推荐去「${selected.name}」。人均约 ${selected.avg_price} 元，距离约 ${selected.distance_m} 米，${selected.reason}`),
    normal_ai_message: stringOr(source.normal_ai_message, `OpenClaw 已根据 ${task.location_text}、预算和成员偏好生成推荐。`)
  };
}

function buildPrompt(task: DinnerTask, participants: Participant[], conflicts: Conflict[], context?: OpenClawDataContext) {
  const mockRestaurantData = [
    {
      restaurant_id: "mock_qingtang_noodle",
      name: "一碗清汤面·家常小馆",
      category: "面食/家常菜",
      avg_price: 58,
      distance_m: 650,
      walk_minutes: 9,
      queue_risk: "low",
      chat_friendly: true,
      supports_non_spicy: true
    },
    {
      restaurant_id: "mock_steamed_bowl",
      name: "蒸鲜小碗菜",
      category: "小碗菜/简餐",
      avg_price: 72,
      distance_m: 850,
      walk_minutes: 12,
      queue_risk: "medium",
      chat_friendly: true,
      supports_non_spicy: true
    },
    {
      restaurant_id: "mock_light_congee",
      name: "轻食粥铺",
      category: "粥/轻食",
      avg_price: 49,
      distance_m: 520,
      walk_minutes: 7,
      queue_risk: "low",
      chat_friendly: true,
      supports_non_spicy: true
    }
  ];

  const slots = {
    openclawContext: context ? buildContextEnvelope(context) : undefined,
    task: {
      task_id: task.task_id,
      title: task.title,
      creator_name: task.creator_name,
      raw_request: task.raw_request,
      location_text: task.location_text,
      expected_people_count: task.expected_people_count,
      dinner_time: task.dinner_time,
      global_constraints: task.global_constraints
    },
    participants: participants.map((participant) => ({
      nickname: participant.nickname,
      raw_preference: participant.raw_preference,
      manual_fields: participant.manual_fields,
      extracted_constraints: participant.extracted_constraints
    })),
    conflicts,
    candidate_restaurant_data: mockRestaurantData
  };

  return `系统角色：你是“饿了幺”多人约饭推荐 Agent。\n\n边界和硬规则：\n- 不能假装访问真实美团、大众点评、地图、商家库存或实时排队数据。\n- 不能说已经预订、下单、联系商家、锁座或确认营业。\n- 你只能基于输入里的 task、participants、conflicts、candidate/mock restaurant data 做保守推荐。\n- 必须只返回 JSON；不要 Markdown；不要 JSON 以外的解释。\n- 必须优先满足预算、忌口、时间、距离等硬约束；无法确认时标记为 risk，不要说成已确认。\n- 必须返回 3 个候选餐厅，final_choice 必须来自 candidates。\n- group_message 要像可以直接复制到微信群的一段话。\n\n输入：\n- task：约饭任务和全局约束。\n- participants：成员偏好和手工填写约束。\n- conflicts：约束冲突。\n- candidate/mock restaurant data：候选/模拟餐厅数据。\n\n输出 JSON schema：\n{\n  "candidates": [\n    {\n      "restaurant_id": "string",\n      "name": "string",\n      "category": "string",\n      "avg_price": 50,\n      "distance_m": 800,\n      "walk_minutes": 10,\n      "open_time": "待确认",\n      "close_time": "待确认",\n      "supports_spicy": true,\n      "supports_non_spicy": true,\n      "is_hotpot": false,\n      "quiet_score": 4,\n      "chat_friendly": true,\n      "queue_risk": "low|medium|high",\n      "rating": 4.5,\n      "member_scores": { "成员名": 80 },\n      "score": 85,\n      "audit": {\n        "passed": true,\n        "hard_rules": {\n          "budget": "pass|fail|risk",\n          "diet": "pass|fail|risk",\n          "time": "pass|fail|risk",\n          "distance": "pass|fail|risk"\n        },\n        "soft_checks": {\n          "queue": "pass|fail|risk",\n          "chat": "pass|fail|risk"\n        },\n        "llm_explanation": "逐项说明预算、忌口、时间、距离、排队、聊天环境的判断"\n      },\n      "reason": "具体说明为什么适合这一组人",\n      "tags": ["预算友好", "不辣可选", "适合聊天"]\n    }\n  ],\n  "final_choice": { "restaurant_id": "必须来自 candidates", "name": "必须来自 candidates", "reason": "string", "risks": ["string"], "backup": "候补餐厅名" },\n  "group_message": "可直接复制到微信群的一段自然中文，说明推荐哪家、预算、距离、不辣/聊天/排队等关键点和需要到店前确认的风险",\n  "normal_ai_message": "简短说明你如何检查了预算、忌口、时间、距离等硬约束"\n}\n\nslots/preferences JSON：\n${JSON.stringify(slots, null, 2)}`;
}

function buildContextEnvelope(context: OpenClawDataContext) {
  return {
    schemaVersion: context.schemaVersion,
    traceId: context.traceId,
    scene: context.scene,
    createdAt: context.createdAt,
    user: context.user,
    profile: context.profile,
    contextBlocks: context.contextBlocks,
    privacy: context.privacy
  };
}

export async function generateOpenClawRecommendation(
  task: DinnerTask,
  participants: Participant[],
  conflicts: Conflict[],
  options: OpenClawRecommendationOptions = {}
): Promise<RecommendationResult> {
  const profile = process.env.OPENCLAW_PROFILE?.trim() || DEFAULT_PROFILE;
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || DEFAULT_AGENT_ID;
  const userPart = options.userId ? `user-${shortHash(options.userId, 12)}` : undefined;
  const sessionKey = buildScopedOpenClawSessionId(DEFAULT_SESSION_KEY, ["group", userPart, options.taskId || task.task_id]);
  const timeoutSeconds = numberOr(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS);
  const openclawBin = process.env.OPENCLAW_BIN?.trim() || "openclaw";
  const prompt = buildPrompt(task, participants, conflicts, options.context);

  const { stdout, stderr } = await execFileAsync(
    openclawBin,
    ["--profile", profile, "agent", "--agent", agentId, "--session-id", sessionKey, "--message", prompt, "--json", "--timeout", String(timeoutSeconds)],
    {
      timeout: Math.max(timeoutSeconds + 30, 60) * 1000,
      maxBuffer: 1024 * 1024 * 8,
      env: {
        ...process.env,
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin"
      }
    }
  );

  const cliJson = extractFirstJsonObject(stdout);
  const text = extractAssistantText(cliJson);

  if (!text.trim()) {
    throw new Error(`OpenClaw returned an empty assistant response.${stderr ? ` stderr: ${stderr.slice(0, 500)}` : ""}`);
  }

  const recommendationJson = extractFirstJsonObject(text);
  return normalizeRecommendation(recommendationJson, task, participants);
}
