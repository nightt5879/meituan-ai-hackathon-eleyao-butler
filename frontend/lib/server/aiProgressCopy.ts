type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(readText).filter(Boolean);
  }
  const text = readText(value);
  return text ? [text] : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = readText(value);
    if (text) return text;
  }
  return "";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function joinSummary(parts: string[], fallback: string) {
  const normalized = unique(parts).slice(0, 6);
  return normalized.length ? normalized.join(" · ") : fallback;
}

function formatBudget(value: unknown) {
  const text = readText(value);
  if (!text) return "";
  return /元|预算|人均/.test(text) ? text : `${text}元内`;
}

function formatDistance(value: unknown) {
  const text = readText(value);
  if (!text) return "";
  return /米|m|km|公里|距离/.test(text) ? text : `${text}公里内`;
}

function meaningfulAvoidTags(values: string[]) {
  return values.filter((value) => !/^(无|没有|没有忌口|都可以|不限)$/.test(value));
}

export function createFoodAiProgressCopy(input: unknown) {
  const record = asRecord(input);
  const slots = asRecord(record.slots);
  const preferences = asRecord(record.preferences);
  const memoryProfile = asRecord(record.memoryProfile);
  const stableFoodPreferences = asRecord(memoryProfile.stableFoodPreferences);

  const scene = firstText(slots.mealPurpose, slots.scene, record.scene);
  const craving = firstText(slots.branchPreference, slots.craving, record.branchPreference);
  const tasteTags = unique([
    ...readList(preferences.tasteTags),
    ...readList(preferences.needTags)
  ]).slice(0, 3);
  const avoidTags = meaningfulAvoidTags(unique([
    ...readList(preferences.temporaryAvoidTags),
    ...readList(preferences.avoidTags),
    ...readList(stableFoodPreferences.avoidTags)
  ])).slice(0, 3);
  const budget = firstText(slots.budget, record.budgetText, formatBudget(record.budgetMax));
  const distance = firstText(slots.distance, record.distanceText, formatDistance(record.maxDistanceKm));
  const notes = firstText(slots.userNotes, record.rawText);

  const preferenceText = joinSummary([
    scene,
    craving,
    tasteTags.join("、"),
    avoidTags.join("、"),
    budget,
    distance,
    notes
  ], "当前用餐条件");
  const filterText = joinSummary([
    budget ? "预算" : "",
    distance ? "距离" : "",
    avoidTags.length ? "忌口" : "",
    tasteTags.length || craving ? "口味偏好" : "",
    notes ? "补充说明" : ""
  ], "当前硬条件和偏好");

  return {
    summary: preferenceText,
    start: `正在理解：${preferenceText}。`,
    retrieve: `正在准备匹配「${preferenceText}」的候选店铺、账号画像和偏好上下文。`,
    filter: `正在按${filterText}筛掉不合适选项。`,
    feed: `正在把「${preferenceText}」提交给 OpenClaw。`,
    rank: `正在把「${preferenceText}」交给 OpenClaw 计算匹配排序。`,
    compose: `OpenClaw 正在围绕「${preferenceText}」生成推荐卡片和管家提醒。`,
    done: `AI 管家已基于「${preferenceText}」生成 2-3 个可执行推荐方案。`,
    error: `OpenClaw 生成「${preferenceText}」时中断，本次推荐没有完成。`
  };
}

export function createGroupAiProgressCopy(sourceValue: unknown) {
  const source = asRecord(sourceValue);
  const task = asRecord(source.task);
  const participants = asArray(source.participants);
  const peopleCount = firstText(task.expectedPeopleCount, task.expected_people_count);
  const time = firstText(task.dinnerTime, task.dinner_time);
  const location = firstText(task.locationText, task.location_text);
  const request = firstText(task.rawRequest, task.raw_request, task.title);
  const submitted = participants.length ? `${participants.length} 人已提交` : "等待成员提交";

  const participantHints = participants.flatMap((participant) => {
    const record = asRecord(participant);
    const manualFields = asRecord(record.manualFields || record.manual_fields);
    return [
      firstText(record.budgetTag, formatBudget(manualFields.budgetMax)),
      firstText(record.spicyLabel),
      ...readList(record.dietaryRestrictions || record.dietary_restrictions).slice(0, 2),
      ...readList(record.cuisinePreferences || record.cuisine_preferences).slice(0, 2)
    ];
  });
  const summary = joinSummary([
    peopleCount ? `${peopleCount} 人约饭` : "多人约饭",
    time,
    location,
    submitted,
    request,
    ...participantHints.slice(0, 4)
  ], "当前多人约饭任务");

  return {
    summary,
    start: `正在读取：${summary}。`,
    retrieve: `正在整理「${summary}」里的成员偏好、冲突和候选餐厅上下文。`,
    filter: `正在检查「${summary}」的预算、忌口、时间和人数硬约束。`,
    rankLocal: `正在为「${summary}」生成本地折中排序。`,
    rankOpenClaw: `正在请求 OpenClaw 为「${summary}」计算群体推荐排序。`,
    composeFeed: `正在把「${summary}」同步给 OpenClaw。`,
    composeOpenClaw: `OpenClaw 正在为「${summary}」生成主推、备选和群发文案。`,
    composeLocal: `正在整理「${summary}」的多人约饭推荐结果。`,
    done: `多人约饭推荐已按「${summary}」完成。`,
    fallback: `多人约饭推荐已按「${summary}」用本地 adapter 兜底完成，OpenClaw 同步失败。`,
    saveError: `「${summary}」的多人约饭推荐保存失败。`
  };
}

export function createWeekendAiProgressCopy(input: unknown) {
  const record = asRecord(input);
  const timeWindow = firstText(record.timeWindow, record.dateLabel);
  const budget = firstText(formatBudget(record.budgetMax), record.budgetText);
  const startArea = firstText(record.startArea, record.locationText);
  const mood = firstText(record.mood);
  const energy = firstText(record.energyLevel);
  const companions = firstText(record.companions);
  const interests = readList(record.interests).slice(0, 4).join("、");
  const rawText = firstText(record.rawText);
  const summary = joinSummary([
    timeWindow,
    startArea,
    budget,
    mood,
    energy,
    companions,
    interests,
    rawText
  ], "当前周边规划条件");

  return {
    summary,
    start: `正在理解：${summary}。`,
    retrieve: `正在准备匹配「${summary}」的天气、地点候选和路线素材。`,
    filter: `正在检查「${summary}」的天气、步行、预算和返程风险。`,
    rank: `正在对「${summary}」的路线候选做优先级排序。`,
    composeOpenClaw: `正在把「${summary}」同步给 OpenClaw。`,
    composeLocal: `正在整理「${summary}」的周边规划结果。`,
    done: `周边规划已按「${summary}」生成，AI 上下文同步流程已结束。`,
    fallback: `周边规划已按「${summary}」用本地规划器完成，OpenClaw 上下文同步失败。`
  };
}
