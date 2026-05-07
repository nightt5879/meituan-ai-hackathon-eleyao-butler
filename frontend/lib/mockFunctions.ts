import { mockRestaurants } from "./mockData";
import type {
  Conflict,
  DinnerTask,
  MockRestaurant,
  Participant,
  ParticipantInput,
  RecommendationResult,
  RestaurantCandidate,
  StoredTaskFields
} from "./types";

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function queueLabel(queueRisk: MockRestaurant["queue_risk"]) {
  return queueRisk === "low" ? "低" : queueRisk === "medium" ? "中" : "高";
}

function lowestPersonalBudget(participants: Participant[], fallback: number) {
  const budgets = participants
    .map((participant) => participant.manual_fields.budget_max)
    .filter((budget): budget is number => typeof budget === "number" && Number.isFinite(budget) && budget > 0);

  return budgets.length > 0 ? Math.min(...budgets) : fallback;
}

function hasNoSpicyHard(participant: Participant) {
  return participant.extracted_constraints.hard_constraints.some((item) => item.includes("不吃辣"));
}

function wantsLowQueue(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.some((item) => item.includes("排队"));
}

function wantsNear(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.some((item) => item.includes("近"));
}

function wantsQuiet(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.some((item) => item.includes("聊天") || item.includes("安静"));
}

function wantsSpicy(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.includes("想吃辣");
}

function dislikesHotpot(participant: Participant) {
  return participant.extracted_constraints.soft_preferences.some((item) => item.includes("火锅"));
}

export function buildMockTitle(task: StoredTaskFields) {
  const time = task.dinner_time.trim() || "今晚";
  const location = task.location_text.trim() || "附近";
  const people = Number.isFinite(task.expected_people_count) && task.expected_people_count > 0 ? task.expected_people_count : 3;

  return `${time}${people}人${location}约饭`;
}

export function extractBudgetMax(rawRequest: string, fallback = 100) {
  const match = rawRequest.match(
    /(?:人均|预算|每人|别超过|不超过|控制在|低于|少于)\s*(\d{2,3})|(\d{2,3})\s*(?:以内|以下|内|元)/
  );

  return match ? Number(match[1] ?? match[2]) : fallback;
}

export function extractParticipantConstraints(input: ParticipantInput): Participant["extracted_constraints"] {
  const raw = input.raw_preference;
  const hardConstraints: string[] = [];
  const softPreferences: string[] = [];
  const spicyPreference = input.manual_fields.spicy_preference;
  const parsedBudget = input.manual_fields.budget_max ?? extractBudgetMax(raw, 0);

  if (spicyPreference === "no_spicy" || includesAny(raw, ["不吃辣", "不能吃辣", "完全不吃辣", "不要辣"])) {
    hardConstraints.push("不吃辣");
  }

  if (input.manual_fields.leave_before) {
    hardConstraints.push(`${input.manual_fields.leave_before} 前离开或回去`);
  }

  if (spicyPreference === "spicy" || (includesAny(raw, ["想吃辣", "能吃辣", "吃辣", "辣一点"]) && spicyPreference !== "no_spicy")) {
    softPreferences.push("想吃辣");
  }

  if (includesAny(raw, ["不想吃火锅", "不想火锅", "别火锅"])) {
    softPreferences.push("不想火锅");
  }

  if (parsedBudget > 0) {
    softPreferences.push(`预算最好不超过 ${parsedBudget} 元`);
  }

  if (includesAny(raw, ["别排队", "不排队", "不用排队", "少排队", "不要排队"])) {
    softPreferences.push("排队风险低");
  }

  if (includesAny(raw, ["近一点", "离学校近", "别太远", "附近", "近点"])) {
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
  const parsedBudget = input.manual_fields.budget_max ?? extractBudgetMax(input.raw_preference, 0);
  const manual_fields = {
    ...input.manual_fields,
    budget_max: parsedBudget > 0 ? parsedBudget : input.manual_fields.budget_max
  };

  return {
    participant_id: existingId ?? `p_local_${encodeURIComponent(nickname)}`,
    nickname,
    raw_preference: input.raw_preference.trim(),
    manual_fields,
    extracted_constraints: extractParticipantConstraints({ ...input, nickname, manual_fields })
  };
}

export function extractConstraints(participants: Participant[]) {
  return participants.map((participant) =>
    buildMockParticipant(
      {
        nickname: participant.nickname,
        raw_preference: participant.raw_preference,
        manual_fields: participant.manual_fields
      },
      participant.participant_id
    )
  );
}

export function detectConflicts(participants: Participant[], budgetMax: number): Conflict[] {
  const conflicts: Conflict[] = [];
  const spicyNames = participants.filter(wantsSpicy).map((participant) => participant.nickname);
  const noSpicyNames = participants.filter(hasNoSpicyHard).map((participant) => participant.nickname);
  const lowerBudgetParticipants = participants.filter((participant) => {
    const budget = participant.manual_fields.budget_max;
    return Boolean(budget && budget < budgetMax);
  });
  const deadlineParticipants = participants.filter((participant) => participant.manual_fields.leave_before);
  const lowQueueNames = participants.filter(wantsLowQueue).map((participant) => participant.nickname);

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
      description: `总体预算约人均 ${budgetMax}，但${lowerBudgetParticipants
        .map((participant) => participant.nickname)
        .join("、")}更希望控制在 ${lowestBudget} 元以内。`,
      resolution_strategy: "首推尽量靠近最低个人预算，超过总体预算的方案只作为失败对照。"
    });
  }

  if (deadlineParticipants.length > 0 || lowQueueNames.length > 0) {
    const names = Array.from(new Set([...deadlineParticipants.map((participant) => participant.nickname), ...lowQueueNames])).join("、");
    conflicts.push({
      type: "time",
      severity: "high",
      description: `${names}对时间或排队更敏感，不能选择太远或排队太久的店。`,
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

export const detectMockConflicts = detectConflicts;

export function searchRestaurants(task: DinnerTask, participants: Participant[]) {
  const budgetMax = task.global_constraints.budget_max;
  const hasDeadline = participants.some((participant) => participant.manual_fields.leave_before);
  const wantsNearby = participants.some(wantsNear);

  return mockRestaurants
    .filter((restaurant) => restaurant.avg_price <= budgetMax + 25)
    .filter((restaurant) => (!hasDeadline ? true : restaurant.walk_minutes <= 32))
    .filter((restaurant) => (!wantsNearby ? true : restaurant.walk_minutes <= 30))
    .sort((a, b) => {
      const aDistancePenalty = Math.abs(a.avg_price - budgetMax) + a.walk_minutes * 1.5;
      const bDistancePenalty = Math.abs(b.avg_price - budgetMax) + b.walk_minutes * 1.5;
      return aDistancePenalty - bDistancePenalty;
    });
}

function scoreForMember(restaurant: MockRestaurant, participant: Participant) {
  let score = 50;
  const budgetMax = participant.manual_fields.budget_max;

  if (hasNoSpicyHard(participant)) {
    score += restaurant.supports_non_spicy ? 20 : -38;
  }

  if (wantsSpicy(participant)) {
    score += restaurant.supports_spicy ? 15 : -10;
  }

  if (budgetMax) {
    score += restaurant.avg_price <= budgetMax ? 15 : -Math.min(25, Math.ceil((restaurant.avg_price - budgetMax) / 2));
  }

  if (participant.manual_fields.leave_before) {
    score += restaurant.walk_minutes <= 15 && restaurant.queue_risk !== "high" ? 12 : -16;
  }

  if (wantsLowQueue(participant)) {
    score += restaurant.queue_risk === "low" ? 10 : restaurant.queue_risk === "medium" ? -8 : -22;
  }

  if (wantsNear(participant)) {
    score += restaurant.walk_minutes <= 15 ? 8 : restaurant.walk_minutes <= 20 ? 2 : -12;
  }

  if (wantsQuiet(participant)) {
    score += restaurant.quiet_score >= 4 && restaurant.chat_friendly ? 10 : restaurant.quiet_score >= 3.5 ? 2 : -12;
  }

  if (dislikesHotpot(participant) && restaurant.is_hotpot) {
    score -= 15;
  }

  score += restaurant.rating >= 4.6 ? 4 : 0;

  return clampScore(score);
}

export function auditPlan(restaurant: MockRestaurant, participants: Participant[], task: DinnerTask, memberScores: Record<string, number>) {
  const budgetMax = task.global_constraints.budget_max;
  const personalBudget = lowestPersonalBudget(participants, budgetMax);
  const hasNoSpicy = participants.some(hasNoSpicyHard);
  const hasDeadline = participants.some((participant) => participant.manual_fields.leave_before);
  const minScore = Math.min(...Object.values(memberScores));
  const hardRules: RestaurantCandidate["audit"]["hard_rules"] = {
    budget_check: restaurant.avg_price > budgetMax ? "fail" : restaurant.avg_price > personalBudget ? "risk" : "pass",
    diet_check: hasNoSpicy && !restaurant.supports_non_spicy ? "fail" : "pass",
    time_check: hasDeadline && (restaurant.walk_minutes > 20 || restaurant.queue_risk === "high") ? "fail" : "pass",
    open_hours_check: "pass"
  };
  const softChecks: RestaurantCandidate["audit"]["soft_checks"] = {
    atmosphere_check: restaurant.quiet_score >= 4 && restaurant.chat_friendly ? "pass" : restaurant.quiet_score >= 3.5 ? "risk" : "fail",
    queue_check: restaurant.queue_risk === "low" ? "pass" : restaurant.queue_risk === "medium" ? "risk" : "fail",
    fairness_check: minScore >= 75 ? "pass" : minScore >= 60 ? "risk" : "fail"
  };
  const passed = !Object.values(hardRules).includes("fail");
  const spicyPeople = participants.filter(wantsSpicy).map((participant) => participant.nickname);
  const noSpicyPeople = participants.filter(hasNoSpicyHard).map((participant) => participant.nickname);
  const budgetPeople = participants.filter((participant) => participant.manual_fields.budget_max).map((participant) => participant.nickname);
  const explanationParts = [
    `${restaurant.name} 人均 ${restaurant.avg_price} 元、步行 ${restaurant.walk_minutes} 分钟、排队风险${queueLabel(restaurant.queue_risk)}。`,
    spicyPeople.length > 0
      ? restaurant.supports_spicy
        ? `可照顾${spicyPeople.join("、")}想吃辣的偏好。`
        : `对${spicyPeople.join("、")}想吃辣的满足较弱。`
      : "",
    noSpicyPeople.length > 0
      ? restaurant.supports_non_spicy
        ? `同时有不辣选项，保护${noSpicyPeople.join("、")}的不吃辣硬约束。`
        : `缺少不辣选项，会违反${noSpicyPeople.join("、")}的忌口硬约束。`
      : "",
    budgetPeople.length > 0 ? `个人预算最低约 ${personalBudget} 元，本方案预算检查为${hardRules.budget_check === "pass" ? "通过" : hardRules.budget_check === "risk" ? "有风险" : "失败"}。` : "",
    `最低成员满意度 ${minScore}，公平性检查为${softChecks.fairness_check === "pass" ? "通过" : softChecks.fairness_check === "risk" ? "有风险" : "失败"}。`
  ].filter(Boolean);

  return {
    passed,
    hard_rules: hardRules,
    soft_checks: softChecks,
    llm_explanation: explanationParts.join("")
  };
}

export function scoreCandidates(restaurants: MockRestaurant[], participants: Participant[], task: DinnerTask): RestaurantCandidate[] {
  return restaurants
    .map((restaurant) => {
      const memberScores = Object.fromEntries(participants.map((participant) => [participant.nickname, scoreForMember(restaurant, participant)]));
      const audit = auditPlan(restaurant, participants, task, memberScores);
      const scores = Object.values(memberScores);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);
      const minScore = scores.length > 0 ? Math.min(...scores) : 50;
      const executableScore = audit.passed ? 90 : 35;
      const totalScore = clampScore(averageScore * 0.6 + minScore * 0.3 + executableScore * 0.1);
      const reason = `规则评分：平均满意度 ${Math.round(averageScore)}，最低满意度 ${minScore}，硬规则${audit.passed ? "无失败项" : "存在失败项"}。`;

      return {
        ...restaurant,
        member_scores: memberScores,
        score: totalScore,
        audit,
        reason
      };
    })
    .sort((a, b) => {
      if (a.audit.passed !== b.audit.passed) {
        return a.audit.passed ? -1 : 1;
      }

      return b.score - a.score;
    });
}

export function generateGroupCopy(task: DinnerTask, participants: Participant[], finalChoice: RestaurantCandidate, backup?: RestaurantCandidate) {
  const sensitiveNames = participants
    .filter((participant) => hasNoSpicyHard(participant) || participant.manual_fields.leave_before || wantsLowQueue(participant))
    .map((participant) => participant.nickname);
  const backupText = backup ? `备选是「${backup.name}」，更稳但综合分略低一点。` : "";

  return `我帮大家用前端 mock 规则算了一遍，推荐${task.dinner_time}去「${finalChoice.name}」。人均 ${finalChoice.avg_price} 左右，离${task.location_text}步行 ${finalChoice.walk_minutes} 分钟，排队风险${queueLabel(finalChoice.queue_risk)}，${finalChoice.supports_non_spicy ? "有不辣选项" : "不辣选择较弱"}，${finalChoice.supports_spicy ? "也能照顾想吃辣的人" : "口味更清淡"}。${sensitiveNames.length > 0 ? `这版优先照顾了${sensitiveNames.join("、")}的硬约束。` : ""}${backupText}大家 OK 的话我来约？`;
}

export function generateMockRecommendation(task: DinnerTask, participants: Participant[]): RecommendationResult {
  const normalizedParticipants = extractConstraints(participants);
  const restaurants = searchRestaurants(task, normalizedParticipants);
  const scored = scoreCandidates(restaurants, normalizedParticipants, task);
  const passedCandidates = scored.filter((candidate) => candidate.audit.passed);
  const selected = (passedCandidates[0] ?? scored[0]) || scoreCandidates(mockRestaurants.slice(0, 1), normalizedParticipants, task)[0];
  const backup = passedCandidates.find((candidate) => candidate.restaurant_id !== selected.restaurant_id) ?? scored.find((candidate) => candidate.restaurant_id !== selected.restaurant_id);
  const normalAiPick = [...mockRestaurants].sort((a, b) => b.rating - a.rating)[0];
  const risks = [
    selected.audit.hard_rules.budget_check === "risk" ? "个人最低预算会略微吃紧，建议提前确认大家能否接受。" : "",
    selected.audit.soft_checks.queue_check !== "pass" ? "排队风险不是最低，建议避开高峰或提前出发。" : "",
    selected.audit.soft_checks.atmosphere_check !== "pass" ? "氛围不是最安静，聊天体验可能打折。" : ""
  ].filter(Boolean);

  return {
    candidates: scored.slice(0, 3),
    final_choice: {
      restaurant_id: selected.restaurant_id,
      name: selected.name,
      reason: `前端规则引擎选择了综合分最高且硬规则可执行的方案：${selected.name}。它的总分为 ${selected.score}，最低个人满意度为 ${Math.min(
        ...(Object.values(selected.member_scores).length > 0 ? Object.values(selected.member_scores) : [50])
      )}。`,
      risks: risks.length > 0 ? risks : ["当前没有明显硬规则风险，仍建议到店前确认营业和排队情况。"],
      backup: backup?.name ?? "暂无备选"
    },
    group_message: generateGroupCopy(task, normalizedParticipants, selected, backup),
    normal_ai_message: `普通 AI 可能只看评分和距离，直接推荐「${normalAiPick.name}」：评分 ${normalAiPick.rating}，距离 ${normalAiPick.distance_m} 米，但它不一定检查预算、忌口、排队和公平性。`
  };
}
