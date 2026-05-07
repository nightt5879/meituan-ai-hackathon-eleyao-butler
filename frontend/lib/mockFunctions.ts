import type { Conflict, Participant, ParticipantInput, StoredTaskFields } from "./types";

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function buildMockTitle(task: StoredTaskFields) {
  const time = task.dinner_time.trim() || "今晚";
  const location = task.location_text.trim() || "附近";
  const people = Number.isFinite(task.expected_people_count) && task.expected_people_count > 0 ? task.expected_people_count : 3;

  return `${time}${people}人${location}约饭`;
}

export function extractBudgetMax(rawRequest: string, fallback = 100) {
  const match = rawRequest.match(/(?:人均|预算|每人)?\s*(\d{2,3})\s*(?:以内|以下|内|元)?/);

  return match ? Number(match[1]) : fallback;
}

export function extractParticipantConstraints(input: ParticipantInput): Participant["extracted_constraints"] {
  const raw = input.raw_preference;
  const hardConstraints: string[] = [];
  const softPreferences: string[] = [];
  const spicyPreference = input.manual_fields.spicy_preference;

  if (spicyPreference === "no_spicy" || includesAny(raw, ["不吃辣", "不能吃辣", "完全不吃辣"])) {
    hardConstraints.push("不吃辣");
  }

  if (input.manual_fields.leave_before) {
    hardConstraints.push(`${input.manual_fields.leave_before} 前离开或回去`);
  }

  if (spicyPreference === "spicy" || (includesAny(raw, ["想吃辣", "能吃辣", "吃辣"]) && spicyPreference !== "no_spicy")) {
    softPreferences.push("想吃辣");
  }

  if (includesAny(raw, ["不想吃火锅", "不想火锅", "别火锅"])) {
    softPreferences.push("不想火锅");
  }

  if (input.manual_fields.budget_max) {
    softPreferences.push(`预算最好不超过 ${input.manual_fields.budget_max} 元`);
  }

  if (includesAny(raw, ["别排队", "不排队", "不用排队", "少排队"])) {
    softPreferences.push("排队风险低");
  }

  if (includesAny(raw, ["近一点", "离学校近", "别太远", "附近"])) {
    softPreferences.push("离学校近");
  }

  if (includesAny(raw, ["聊天", "安静", "别太吵", "不要太吵"])) {
    softPreferences.push("适合聊天、安静");
  }

  return {
    hard_constraints: Array.from(new Set(hardConstraints)),
    soft_preferences: Array.from(new Set(softPreferences))
  };
}

export function buildMockParticipant(input: ParticipantInput, existingId?: string): Participant {
  const nickname = input.nickname.trim() || "我";

  return {
    participant_id: existingId ?? `p_local_${encodeURIComponent(nickname)}`,
    nickname,
    raw_preference: input.raw_preference.trim(),
    manual_fields: input.manual_fields,
    extracted_constraints: extractParticipantConstraints({ ...input, nickname })
  };
}

export function detectMockConflicts(participants: Participant[], budgetMax: number): Conflict[] {
  const conflicts: Conflict[] = [];
  const spicyNames = participants
    .filter((participant) => participant.extracted_constraints.soft_preferences.includes("想吃辣"))
    .map((participant) => participant.nickname);
  const noSpicyNames = participants
    .filter((participant) => participant.extracted_constraints.hard_constraints.includes("不吃辣"))
    .map((participant) => participant.nickname);
  const lowerBudgetParticipants = participants.filter((participant) => {
    const budget = participant.manual_fields.budget_max;
    return Boolean(budget && budget < budgetMax);
  });
  const deadlineParticipants = participants.filter((participant) => participant.manual_fields.leave_before);

  if (spicyNames.length > 0 && noSpicyNames.length > 0) {
    conflicts.push({
      type: "taste",
      severity: "high",
      description: `${spicyNames.join("、")}想吃辣，但${noSpicyNames.join("、")}不吃辣。`,
      resolution_strategy: "优先保护不吃辣硬约束，选择可选辣度或同时有辣/不辣菜的餐厅。"
    });
  }

  if (lowerBudgetParticipants.length > 0) {
    const lowestBudget = Math.min(...lowerBudgetParticipants.map((participant) => participant.manual_fields.budget_max ?? budgetMax));
    conflicts.push({
      type: "budget",
      severity: "medium",
      description: `总体预算约人均 ${budgetMax}，但有人更希望控制在 ${lowestBudget} 元以内。`,
      resolution_strategy: "首推尽量靠近最低个人预算，超过总体预算的方案只作为失败对照。"
    });
  }

  if (deadlineParticipants.length > 0) {
    conflicts.push({
      type: "time",
      severity: "high",
      description: `${deadlineParticipants.map((participant) => participant.nickname).join("、")}有最晚离开时间，不能选择太远或排队太久的店。`,
      resolution_strategy: "优先选择步行 15 分钟内、排队风险 low、营业时间覆盖晚餐的餐厅。"
    });
  }

  if (conflicts.length === 0) {
    conflicts.push({
      type: "atmosphere",
      severity: "low",
      description: "当前没有明显硬冲突，主要需要在氛围、距离和预算之间做排序。",
      resolution_strategy: "保留 2-3 个候选方案，优先选择综合满意度和最低满意度都更高的餐厅。"
    });
  }

  return conflicts;
}
