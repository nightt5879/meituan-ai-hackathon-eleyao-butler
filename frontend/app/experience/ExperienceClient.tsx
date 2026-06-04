"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { siteThemes as themeCards } from "@/lib/siteThemes";

type PhoneView = "login" | "home" | "food" | "group-create" | "group-fill" | "group-board" | "weekend" | "memory";

type Identity = {
  demoUserId: string;
  displayName: string;
  userId: string;
  sessionToken: string;
};

type MemorySettings = {
  avoidTags: string[];
  spicyLevel: string;
  budget: string;
  distance: string;
  memoryEnabled: boolean;
  updatedAt: string;
  permissions: {
    stableFoodMemory: boolean;
    behaviorLearning: boolean;
    recommendationHistory: boolean;
    weekendPlans: boolean;
    [key: string]: boolean;
  };
};

type FoodSlots = {
  mealPurpose: string;
  branchPreference: string;
  budget: string;
  distance: string;
  userNotes: string;
};

type FoodPreferences = {
  tasteTags: string[];
  needTags: string[];
  temporaryAvoidTags: string[];
  avoidTags: string[];
  spicyLevel: string;
};

type RecommendationCard = {
  id: string;
  name: string;
  type: string;
  category?: string;
  perCapita: string;
  perCapitaDisplay?: string;
  distance: string;
  rating: number;
  matchedTags: string[];
  reason: string;
  riskTip: string;
  source?: string;
  isFavorited?: boolean;
};

type PreferenceRecord = {
  id: string;
  createdAt: string;
  summary: string;
  slots: FoodSlots;
  preferences: FoodPreferences;
  recommendations: RecommendationCard[];
};

type GroupBoard = {
  task: {
    taskId: string;
    title: string;
    displayTitle?: string;
    displaySummary?: string;
    creatorName: string;
    rawRequest: string;
    locationText: string;
    expectedPeopleCount: number;
    dinnerTime: string;
    status: string;
    sharePath: string;
  };
  participants: Array<{
    participantId: string;
    source?: "user" | "ai_generated";
    nickname: string;
    visibility?: "public" | "nickname_only" | "private";
    rawPreference: string;
    availabilitySummary?: string;
    budgetTag?: string;
    spicyLabel?: string;
    dietaryRestrictions?: string[];
    cuisinePreferences?: string[];
    manualFields: {
      budgetMax?: number;
      spicyPreference?: string;
      leaveBefore?: string;
    };
    hardRequirements?: string[];
    softPreferences?: string[];
    extractedConstraints: {
      hard_constraints?: string[];
      soft_preferences?: string[];
      hardConstraints?: string[];
      softPreferences?: string[];
    };
  }>;
  conflicts: Array<{
    type: string;
    severity: string;
    description: string;
    resolution_strategy?: string;
    resolutionStrategy?: string;
  }>;
  recommendationState: {
    status: string;
    hasGenerated: boolean;
    updatedAt: string;
    dirtyReason?: string;
  };
  recommendationResult: {
    candidates: Array<{
      restaurant_id?: string;
      id?: string;
      name: string;
      category: string;
      avg_price?: number;
      avgPrice?: number;
      distance_m?: number;
      walkMinutes?: number;
      walk_minutes?: number;
      rating: number;
      reason: string;
      tags: string[];
      queue_risk?: string;
      score: number;
      audit?: {
        passed?: boolean;
        hard_rules?: Record<string, "pass" | "fail" | "risk" | string>;
        hardRules?: Record<string, "pass" | "fail" | "risk" | string>;
        llm_explanation?: string;
        llmExplanation?: string;
      };
      matchedNeeds?: string[];
      unmetNeeds?: string[];
      tradeoffSummary?: string;
      tradeoffs?: Array<{ nickname?: string; reason?: string }>;
      memberScoreList?: Array<{ nickname?: string; score?: number | string }>;
      member_scores?: Record<string, number>;
    }>;
    finalChoice: {
      name: string;
      reason: string;
      risks: string[];
      backup: string;
    };
    groupMessage: string;
    normalAiMessage: string;
  } | null;
};

type WeekendPlan = {
  planId: string;
  status: string;
  weather?: {
    summary?: string;
    sourceLabel?: string;
    fallback?: boolean;
  };
  weatherNotice?: string;
  backendStatus?: string;
  backendMessage?: string;
  source?: {
    weather?: string;
    poi?: string;
    planner?: string;
  };
  openclawContext?: {
    traceId?: string;
    scene?: string;
    submitted?: boolean;
    status?: "submitted" | "skipped" | "failed" | string;
    sessionRef?: string;
    contextBlocks?: string[];
    durationMs?: number;
    detail?: string;
  };
  aiStatus?: {
    resultGeneratedBy?: "rules" | "local" | string;
    resultIsAiGenerated?: boolean;
    openclawStatus?: "submitted" | "skipped" | "failed" | "not_applicable" | string;
    openclawSubmitted?: boolean;
    traceId?: string;
    durationMs?: number;
    label?: string;
    detail?: string;
  };
  routes: Array<{
    id: string;
    type: string;
    typeLabel?: string;
    title: string;
    summary: string;
    estimatedBudget?: string;
    estimatedBudgetText?: string;
    estimatedDurationMinutes?: number;
    estimatedDurationText?: string;
    durationText?: string;
    transport?: string;
    timeline?: Array<{
      time?: string;
      title?: string;
      placeName?: string;
      activity?: string;
      durationMinutes?: number;
    }>;
    selfChecks?: Record<string, string> | Array<{ label?: string; detail?: string; passed?: boolean; statusText?: string; status?: string }>;
    risks?: string[];
    inviteText?: string;
  }>;
};

type ApiError = Error & { status?: number; code?: string };
type FoodConnectionStatus = {
  text: string;
  className: string;
  openclawReachable: boolean;
  detail?: string;
};
type FoodPingResponse = {
  ok?: boolean;
  service?: string;
  checkedAt?: string;
};
type FoodStatusResponse = {
  backend?: {
    ok?: boolean;
    checkedAt?: string;
  };
  openclaw?: {
    ok?: boolean;
    configured?: boolean;
    cliReachable?: boolean;
    gatewayReachable?: boolean;
    gatewayUrl?: string;
    mode?: string;
    detail?: string;
  };
};

type AiProgressScene = "food_recommendation" | "group_dining" | "weekend_plan";
type AiProgressStageKey = "understand" | "retrieve" | "filter" | "rank" | "compose";
type AiProgressStatus = "running" | "done" | "fallback" | "error";
type AiProgressStepStatus = "pending" | "running" | "done" | "fallback" | "error";
type AiProgressStep = {
  key: AiProgressStageKey;
  label: string;
  detail: string;
  status: AiProgressStepStatus;
  updatedAt?: string;
};
type AiProgressSnapshot = {
  traceId: string;
  scene: AiProgressScene;
  userId?: string;
  status: AiProgressStatus;
  currentStage: AiProgressStageKey;
  message: string;
  note?: string;
  progress: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  source: "server" | "client";
  steps: AiProgressStep[];
};

type FoodTagType = "taste" | "need" | "temporaryAvoid" | "avoid" | "spicyLevel";
type FoodQuestionKind = "choice" | "multi-choice" | "tag";
type FoodTagGroup = {
  title: string;
  type: FoodTagType;
  mode: "single" | "multiple";
  tags: Array<{ id: string; label: string; type: FoodTagType }>;
};

type FoodQuestion = {
  id: string;
  slot?: keyof FoodSlots;
  label?: string;
  kind?: FoodQuestionKind;
  title: string;
  helper?: string;
  options?: string[];
  groups?: FoodTagGroup[];
  optional?: boolean;
  allowEmpty?: boolean;
  multi?: boolean;
  text?: boolean;
};

type PrefSummaryRow = {
  key: string;
  label: string;
  value: string;
  action: string;
  toggleable: boolean;
  keep: boolean;
};

const identityKey = "meituan_web_demo_identity";
const judgeDeviceKey = "meituan_web_judge_device_id";
const judgeInputKey = "meituan_web_judge_input";
const desktopPreviewTip = "电脑端体验更佳：可同时查看手机复刻、评审状态和主题面板；手机端仍可继续体验核心流程。";
const defaultFoodConnectionStatus: FoodConnectionStatus = {
  text: "正在检测远端 OpenClaw",
  className: "status-checking",
  openclawReachable: false
};
const defaultMemory: MemorySettings = {
  avoidTags: [],
  spicyLevel: "看当天心情",
  budget: "50元以内",
  distance: "1公里以内",
  memoryEnabled: true,
  updatedAt: "",
  permissions: {
    stableFoodMemory: true,
    behaviorLearning: true,
    recommendationHistory: true,
    weekendPlans: true,
    rememberTastePattern: true,
    rememberBudgetByMeal: true,
    rememberCommonCategories: true,
    rememberDeliveryDineInPreference: true,
    rememberDistancePreference: true,
    rememberExplorationStyle: true,
    rememberAdjustmentPatterns: true,
    rememberDiningReport: true,
    rememberFrequentArea: true,
    rememberGroupPreference: true
  }
};

const memoryAvoidOptions = ["无", "香菜", "葱蒜", "花生", "海鲜", "牛羊肉", "乳制品", "其他"];
const memorySpicyOptions = ["不吃辣", "微辣", "中辣", "重辣", "看当天心情"];
const memoryPermissionRows = [
  { key: "rememberTastePattern", title: "口味倾向", desc: "记录你常选哪类口味/感觉" },
  { key: "rememberBudgetByMeal", title: "不同用餐场景的预算", desc: "区分午餐 / 晚餐 / 下午茶等的预算" },
  { key: "rememberCommonCategories", title: "常吃餐品 / 品类", desc: "你最常被推中的菜系或品类" },
  { key: "rememberDeliveryDineInPreference", title: "外卖 or 到店偏好", desc: "你更常选外卖还是堂食" },
  { key: "rememberDistancePreference", title: "常用距离 / 配送接受度", desc: "你愿意走多远或等多久" },
  { key: "rememberExplorationStyle", title: "探索新店 or 常吃熟店", desc: "你更爱回头店还是新店" },
  { key: "rememberAdjustmentPatterns", title: "调整反馈习惯", desc: "经常觉得太贵、太远、想换品类" },
  { key: "rememberDiningReport", title: "用餐报告与花销估算", desc: "允许管家根据你的推荐记录生成周报/月报，不读取真实支付记录。" },
  { key: "rememberFrequentArea", title: "常去区域", desc: "记录你常用的学校周边、商圈或出发区域" },
  { key: "rememberGroupPreference", title: "群聊偏好", desc: "记录你授权的小团体共同偏好，用于多人约饭折中" }
];
const learnedPlaceholderRows = [
  { label: "午餐常选", value: "待学习", desc: "完成几次午餐推荐后生成" },
  { label: "晚餐预算", value: "待学习", desc: "完成几次晚餐推荐后生成" },
  { label: "外卖偏好", value: "待学习", desc: "会学习预算、常点品类、配送接受度" },
  { label: "到店偏好", value: "待学习", desc: "会学习距离、环境、是否愿意探索新店" },
  { label: "探索倾向", value: "待学习", desc: "会判断你更爱熟悉店还是新店" }
];

const tasteTagOptions = [
  { id: "taste_light", label: "清淡", type: "taste" },
  { id: "taste_fresh", label: "鲜香", type: "taste" },
  { id: "taste_salty", label: "咸香", type: "taste" },
  { id: "taste_spicy", label: "香辣", type: "taste" },
  { id: "taste_mala", label: "麻辣", type: "taste" },
  { id: "taste_sour_spicy", label: "酸辣", type: "taste" },
  { id: "taste_sour_sweet", label: "酸甜", type: "taste" },
  { id: "taste_rich", label: "浓郁", type: "taste" },
  { id: "taste_refreshing", label: "爽口", type: "taste" }
] satisfies FoodTagGroup["tags"];

const needTagOptions = [
  { id: "need_hot", label: "热乎的", type: "need" },
  { id: "need_soup", label: "汤汤水水", type: "need" },
  { id: "need_rice", label: "下饭", type: "need" },
  { id: "need_less_oil", label: "不油腻", type: "need" },
  { id: "need_light", label: "轻负担", type: "need" },
  { id: "need_craving", label: "解馋", type: "need" },
  { id: "need_full", label: "饱腹感强", type: "need" }
] satisfies FoodTagGroup["tags"];

const temporaryAvoidTagOptions = [
  { id: "temporary_queue", label: "排队久", type: "temporaryAvoid" },
  { id: "temporary_too_oily", label: "太油", type: "temporaryAvoid" },
  { id: "temporary_too_heavy", label: "太重口", type: "temporaryAvoid" },
  { id: "temporary_too_sweet", label: "太甜腻", type: "temporaryAvoid" },
  { id: "temporary_too_far", label: "太远", type: "temporaryAvoid" }
] satisfies FoodTagGroup["tags"];

const restrictionTagOptions = [
  { id: "avoid_spicy", label: "不吃辣", type: "avoid" },
  { id: "avoid_cilantro", label: "不要香菜", type: "avoid" },
  { id: "avoid_garlic", label: "不要葱蒜", type: "avoid" },
  { id: "avoid_seafood", label: "不吃海鲜", type: "avoid" },
  { id: "avoid_offal", label: "不吃内脏", type: "avoid" },
  { id: "avoid_beef_lamb", label: "不吃牛羊肉", type: "avoid" },
  { id: "avoid_allergy", label: "过敏/不能吃", type: "avoid" },
  { id: "avoid_none", label: "没有忌口", type: "avoid" }
] satisfies FoodTagGroup["tags"];

const spicyTagOptions = [
  { id: "spicy_none", label: "不吃辣", type: "spicyLevel" },
  { id: "spicy_light", label: "微辣", type: "spicyLevel" },
  { id: "spicy_medium", label: "中辣", type: "spicyLevel" },
  { id: "spicy_heavy", label: "重辣", type: "spicyLevel" }
] satisfies FoodTagGroup["tags"];

const prefModificationOrder = [
  "branch-preference",
  "taste-feeling",
  "temporary-avoid",
  "restriction",
  "spice",
  "budget",
  "distance",
  "notes"
];

const mealPurposeAliases: Record<string, string[]> = {
  早餐: ["早餐", "早饭", "早上", "早点"],
  午餐: ["午餐", "午饭", "中午", "午间"],
  晚餐: ["晚餐", "晚饭", "晚上", "今晚", "正餐"],
  夜宵: ["夜宵", "宵夜", "深夜"],
  下午茶: ["下午茶", "奶茶", "咖啡", "甜品"],
  一个人随便吃: ["一个人", "随便", "自己吃", "单人", "懒得想"],
  和朋友一起吃: ["朋友", "一起吃", "约饭", "多人"],
  工作日快餐: ["快餐", "工作日", "上班", "上课", "赶时间"],
  周末放松吃: ["周末", "放松", "慢慢吃"]
};

const mealPurposeQuestion: FoodQuestion = {
  id: "mealPurpose",
  kind: "choice",
  slot: "mealPurpose",
  label: "就餐场景",
  title: "这次是什么用餐场景？",
  options: ["早餐", "午餐", "晚餐", "夜宵", "下午茶", "一个人随便吃", "和朋友一起吃", "工作日快餐", "周末放松吃"]
};

const tasteNeedQuestion: FoodQuestion = {
  id: "tag-preferences",
  kind: "tag",
  label: "口味/感觉",
  title: "今天想吃什么口味/感觉？",
  allowEmpty: true,
  groups: [
    { title: "口味偏好", type: "taste", mode: "multiple", tags: tasteTagOptions },
    { title: "当前想吃的感觉", type: "need", mode: "multiple", tags: needTagOptions },
    { title: "这次不想吃", type: "temporaryAvoid", mode: "multiple", tags: temporaryAvoidTagOptions }
  ]
};

const branchPreferenceOptionsByMealPurpose: Record<string, string[]> = {
  早餐: ["都可以", "包子/点心", "粥", "面条/粉", "三明治", "咖啡", "豆浆", "轻食"],
  午餐: ["都可以", "中式简餐", "家常菜", "粉面", "米饭套餐", "火锅/冒菜", "麻辣烫", "烧烤/炸物", "西餐", "日料", "韩餐", "东南亚菜", "轻食"],
  晚餐: ["都可以", "中式简餐", "家常菜", "粉面", "米饭套餐", "火锅/冒菜", "麻辣烫", "烧烤/炸物", "西餐", "日料", "韩餐", "东南亚菜", "轻食"],
  下午茶: ["都可以", "咖啡", "奶茶", "甜品", "面包/烘焙", "轻食", "水果/酸奶"],
  夜宵: ["都可以", "烧烤", "炸串/炸鸡", "粉面", "麻辣烫", "小吃", "甜品", "粥"],
  一个人随便吃: ["都可以", "近一点", "便宜一点", "快一点", "清淡点", "管饱", "不油腻"],
  和朋友一起吃: ["都可以", "中式简餐", "家常菜", "粉面", "米饭套餐", "火锅/冒菜", "麻辣烫", "烧烤/炸物", "西餐", "日料", "韩餐", "东南亚菜", "轻食"],
  工作日快餐: ["都可以", "快一点", "近一点", "便宜一点", "米饭套餐", "粉面", "轻食", "管饱"],
  周末放松吃: ["都可以", "中式简餐", "家常菜", "粉面", "米饭套餐", "火锅/冒菜", "麻辣烫", "烧烤/炸物", "西餐", "日料", "韩餐", "东南亚菜", "轻食"]
};

const avoidSpiceQuestion: FoodQuestion = {
  id: "avoid-preferences",
  kind: "tag",
  label: "忌口/辣度",
  title: "有什么忌口或辣度要求吗？",
  optional: true,
  allowEmpty: true,
  groups: [
    { title: "忌口", type: "avoid", mode: "multiple", tags: restrictionTagOptions },
    { title: "辣度偏好", type: "spicyLevel", mode: "single", tags: spicyTagOptions }
  ]
};

const budgetOptionsByMealPurpose: Record<string, string[]> = {
  早餐: ["10 元以内", "10-20 元", "20-30 元", "30 元以上"],
  午餐: ["20 元以内", "20-40 元", "40-60 元", "60 元以上"],
  晚餐: ["30 元以内", "30-60 元", "60-100 元", "100 元以上"],
  下午茶: ["15 元以内", "15-30 元", "30-50 元", "50 元以上"],
  夜宵: ["20 元以内", "20-40 元", "40-70 元", "70 元以上"],
  一个人随便吃: ["15 元以内", "15-30 元", "30-50 元", "50 元以上"],
  和朋友一起吃: ["30 元以内", "30-60 元", "60-100 元", "100 元以上"],
  工作日快餐: ["20 元以内", "20-40 元", "40-60 元", "60 元以上"],
  周末放松吃: ["30 元以内", "30-60 元", "60-100 元", "100 元以上"]
};

const distanceQuestion: FoodQuestion = {
  id: "distance",
  kind: "choice",
  slot: "distance",
  label: "想走多远",
  title: "想走多远？",
  options: ["500 米以内", "1 公里以内", "2 公里以内", "远一点也行"]
};

const userNotesQuestion: FoodQuestion = {
  id: "user-notes",
  kind: "choice",
  slot: "userNotes",
  label: "其他补充",
  title: "还有什么想补充的吗？",
  optional: true,
  allowEmpty: true,
  text: true,
  options: ["没有补充"]
};

const cuisineQuestion: FoodQuestion = {
  id: "cuisine-type",
  kind: "multi-choice",
  slot: "branchPreference",
  label: "菜系偏好",
  title: "想吃哪类菜？",
  allowEmpty: true,
  options: ["都可以", "中式简餐", "家常菜", "粉面", "米饭套餐", "火锅/冒菜", "麻辣烫", "烧烤/炸物", "西餐", "日料", "韩餐", "东南亚菜", "轻食"]
};

const modifyTasteFeelingQuestion: FoodQuestion = {
  id: "taste-feeling",
  kind: "tag",
  label: "口味/感觉",
  title: "这次想吃什么口味/感觉？",
  optional: true,
  allowEmpty: true,
  groups: [
    { title: "口味偏好", type: "taste", mode: "multiple", tags: tasteTagOptions },
    { title: "当前想吃的感觉", type: "need", mode: "multiple", tags: needTagOptions }
  ]
};

const modifyTemporaryAvoidQuestion: FoodQuestion = {
  id: "temporary-avoid",
  kind: "tag",
  label: "这次不想吃",
  title: "这次有什么不想吃的吗？",
  optional: true,
  allowEmpty: true,
  groups: [
    { title: "这次不想吃", type: "temporaryAvoid", mode: "multiple", tags: temporaryAvoidTagOptions }
  ]
};

const modifyRestrictionQuestion: FoodQuestion = {
  id: "restriction",
  kind: "tag",
  label: "忌口",
  title: "有什么忌口吗？",
  optional: true,
  allowEmpty: true,
  groups: [
    { title: "忌口", type: "avoid", mode: "multiple", tags: restrictionTagOptions }
  ]
};

const modifySpiceQuestion: FoodQuestion = {
  id: "spice",
  kind: "tag",
  label: "辣度",
  title: "辣度有什么要求吗？",
  optional: true,
  allowEmpty: true,
  groups: [
    { title: "辣度偏好", type: "spicyLevel", mode: "single", tags: spicyTagOptions }
  ]
};

function buildBranchPreferenceQuestion(mealPurpose: string): FoodQuestion {
  const ids: Record<string, string> = {
    早餐: "breakfast-type",
    下午茶: "afternoon-tea-type",
    夜宵: "supper-type",
    一个人随便吃: "solo-casual-preference",
    工作日快餐: "workday-fast-preference"
  };
  return {
    id: ids[mealPurpose] || "cuisine-type",
    kind: "multi-choice",
    slot: "branchPreference",
    label: mealPurpose === "早餐" ? "早餐类型" : mealPurpose === "下午茶" ? "下午茶类型" : mealPurpose === "夜宵" ? "夜宵类型" : mealPurpose === "一个人随便吃" ? "就餐偏好" : mealPurpose === "工作日快餐" ? "快餐偏好" : "菜系偏好",
    title: mealPurpose === "早餐" ? "早餐想吃哪一类？" : mealPurpose === "下午茶" ? "下午茶想来点什么？" : mealPurpose === "夜宵" ? "夜宵想吃哪一类？" : mealPurpose === "一个人随便吃" ? "更希望这顿饭怎么样？" : mealPurpose === "工作日快餐" ? "工作日快餐更看重什么？" : "想吃哪类菜？",
    allowEmpty: true,
    options: branchPreferenceOptionsByMealPurpose[mealPurpose] || branchPreferenceOptionsByMealPurpose.晚餐
  };
}

function buildBudgetQuestion(mealPurpose: string): FoodQuestion {
  return {
    id: "budget",
    kind: "choice",
    slot: "budget",
    label: "预算多少",
    title: "预算大概多少？",
    options: budgetOptionsByMealPurpose[mealPurpose] || budgetOptionsByMealPurpose.晚餐
  };
}

function buildFoodQuestions(mealPurpose: string): FoodQuestion[] {
  if (!mealPurpose) {
    return [mealPurposeQuestion];
  }

  const shortScenes = mealPurpose === "早餐" || mealPurpose === "下午茶";
  const branchQuestions = shortScenes
    ? [buildBranchPreferenceQuestion(mealPurpose)]
    : [tasteNeedQuestion, mealPurpose === "午餐" || mealPurpose === "晚餐" || mealPurpose === "和朋友一起吃" || mealPurpose === "周末放松吃" ? cuisineQuestion : buildBranchPreferenceQuestion(mealPurpose)];

  return [
    mealPurposeQuestion,
    ...branchQuestions,
    ...(shortScenes ? [] : [avoidSpiceQuestion]),
    buildBudgetQuestion(mealPurpose),
    distanceQuestion
  ];
}

const foodQuestions = buildFoodQuestions("");

const foodAnswerLabels: Record<string, string> = {
  mealPurpose: "用餐场景",
  "cuisine-type": "想吃",
  "breakfast-type": "想吃",
  "afternoon-tea-type": "想吃",
  "supper-type": "想吃",
  "solo-casual-preference": "想吃",
  "workday-fast-preference": "想吃",
  branchPreference: "想吃",
  "taste-feeling": "口味/感觉",
  "temporary-avoid": "这次不想吃",
  restriction: "忌口",
  spice: "辣度",
  tasteTags: "口味/感觉",
  needTags: "优先满足",
  temporaryAvoidTags: "这次不想吃",
  avoidTags: "忌口",
  spicyLevel: "辣度",
  budget: "预算",
  distance: "距离",
  userNotes: "其他补充",
  "user-notes": "其他补充"
};

const fallbackRecommendations: RecommendationCard[] = [
  {
    id: "fallback-dessert-1",
    name: "法式甜品下午茶",
    type: "甜品/下午茶",
    perCapita: "68",
    perCapitaDisplay: "人均 68元",
    distance: "650 m",
    rating: 4.7,
    matchedTags: ["下午茶", "甜品", "50元以上", "1公里以内"],
    reason: "主打法式小蛋糕、咖啡和下午茶套餐，客单价符合预算，距离在 1 公里以内。",
    riskTip: "高峰期建议提前确认座位和库存。"
  },
  {
    id: "fallback-dessert-2",
    name: "手作千层蛋糕店",
    type: "蛋糕甜品",
    perCapita: "58",
    perCapitaDisplay: "人均 58元",
    distance: "800 m",
    rating: 4.6,
    matchedTags: ["下午茶", "甜品", "蛋糕", "预算匹配"],
    reason: "千层、慕斯和饮品组合适合下午茶，价格通常在 50 元以上，适合单人坐一会儿慢慢吃。",
    riskTip: "奶油类甜品饱腹感较强，如果只是想轻一点，可以选择单块蛋糕加无糖茶。"
  },
  {
    id: "fallback-dessert-3",
    name: "精品咖啡甜品馆",
    type: "咖啡/甜品",
    perCapita: "72",
    perCapitaDisplay: "人均 72元",
    distance: "950 m",
    rating: 4.5,
    matchedTags: ["下午茶", "甜品", "咖啡", "1公里以内"],
    reason: "咖啡搭配巴斯克蛋糕或提拉米苏，体验感更完整，符合 50 元以上预算和 1 公里以内距离要求。",
    riskTip: "下午高峰可能座位紧张，若想堂食建议先确认是否有空位。"
  }
];

const weekendInterestOptions = [
  { value: "咖啡", emoji: "☕", label: "咖啡" },
  { value: "轻食", emoji: "🥗", label: "轻食" },
  { value: "甜品", emoji: "🍰", label: "甜品" },
  { value: "citywalk", emoji: "🚶", label: "citywalk" },
  { value: "拍照", emoji: "📷", label: "拍照" },
  { value: "展览", emoji: "🎨", label: "展览" },
  { value: "公园", emoji: "🌳", label: "公园" },
  { value: "书店", emoji: "📚", label: "书店" },
  { value: "电影", emoji: "🎬", label: "电影" },
  { value: "市集", emoji: "🛍️", label: "市集" },
  { value: "博物馆", emoji: "🏛️", label: "博物馆" },
  { value: "美术馆", emoji: "🖼️", label: "美术馆" },
  { value: "夜景", emoji: "🌃", label: "夜景" },
  { value: "江边散步", emoji: "🌊", label: "江边散步" },
  { value: "安静聊天", emoji: "💬", label: "安静聊天" },
  { value: "购物", emoji: "🛒", label: "购物" },
  { value: "室内活动", emoji: "🏠", label: "室内活动" },
  { value: "户外活动", emoji: "🌞", label: "户外活动" },
  { value: "适合打卡", emoji: "✨", label: "适合打卡" },
  { value: "少走路", emoji: "🦶", label: "少走路" },
  { value: "不想排队", emoji: "🚫", label: "不想排队" },
  { value: "雨天友好", emoji: "🌧️", label: "雨天友好" },
  { value: "宠物友好", emoji: "🐶", label: "宠物友好" },
  { value: "适合放空", emoji: "🌿", label: "适合放空" }
];

const groupAdjustmentReasons = [
  { value: "cannot_eat", label: "吃不了" },
  { value: "over_budget", label: "超预算" },
  { value: "time_mismatch", label: "时间不合" },
  { value: "too_far", label: "太远" },
  { value: "prefer_other_cuisine", label: "想换品类" },
  { value: "other", label: "其他" }
];
const groupAdjustmentVisibilityOptions = [
  { value: "public", label: "公开" },
  { value: "nickname_only", label: "只显示昵称" },
  { value: "private", label: "匿名" }
];

async function requestJson<T>(url: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || `Request failed: ${response.status}`) as ApiError;
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  return data as T;
}

function buildGroupAiProgressSteps(
  submittedCount: number,
  expectedPeople: number
): Array<Omit<AiProgressStep, "status" | "updatedAt">> {
  const understandDetail = submittedCount > 0
    ? `合并 ${submittedCount}/${expectedPeople} 人填写`
    : "等待成员填写偏好";

  return [
    { key: "understand", label: "汇总大家的偏好", detail: understandDetail },
    { key: "retrieve", label: "找大家都方便的店", detail: "按公共区域召回" },
    { key: "filter", label: "识别并化解冲突", detail: "忌口冲突、预算冲突、时间冲突" },
    { key: "rank", label: "折中打分", detail: "尽量让每人都不难受" },
    { key: "compose", label: "写群发说明", detail: "主推、备选和文案" }
  ];
}

const aiProgressSteps: Record<AiProgressScene, Array<Omit<AiProgressStep, "status" | "updatedAt">>> = {
  food_recommendation: [
    { key: "understand", label: "读懂你的需求", detail: "整理场景、口味和忌口" },
    { key: "retrieve", label: "检索附近店铺", detail: "拉取候选餐厅" },
    { key: "filter", label: "按忌口和预算筛查", detail: "硬性条件不满足的直接挡掉" },
    { key: "rank", label: "算匹配度排序", detail: "结合口味和记忆打分" },
    { key: "compose", label: "写推荐理由", detail: "生成理由和风险提示" }
  ],
  group_dining: buildGroupAiProgressSteps(0, 0),
  weekend_plan: [
    { key: "understand", label: "读懂你的周末", detail: "时间、预算、体力、兴趣" },
    { key: "retrieve", label: "查天气、找周边", detail: "天气和 POI 召回" },
    { key: "filter", label: "按体力和返程筛", detail: "走太多、来不及的都去掉" },
    { key: "rank", label: "排出几条路线", detail: "轻松度和兴趣匹配" },
    { key: "compose", label: "拼好时间线", detail: "时间线、预算和邀约" }
  ]
};

function createClientAiTraceId(scene: AiProgressScene) {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
    : Math.random().toString(36).slice(2, 12);
  return `aip_${scene}_${Date.now().toString(36)}_${randomPart}`.slice(0, 96);
}

function createClientAiProgress(
  scene: AiProgressScene,
  traceId: string,
  stepsOverride?: Array<Omit<AiProgressStep, "status" | "updatedAt">>
): AiProgressSnapshot {
  const timestamp = new Date().toISOString();
  const steps = (stepsOverride ?? aiProgressSteps[scene]).map((step, index) => ({
    ...step,
    status: index === 0 ? "running" as const : "pending" as const,
    updatedAt: index === 0 ? timestamp : undefined
  }));

  return {
    traceId,
    scene,
    status: "running",
    currentStage: "understand",
    message: steps[0]?.detail || "AI 管家正在理解本次请求。",
    progress: 10,
    startedAt: timestamp,
    updatedAt: timestamp,
    source: "client",
    steps
  };
}

function completeClientAiProgress(current: AiProgressSnapshot | null, status: AiProgressStatus, message: string, note?: string) {
  if (!current) return current;
  const timestamp = new Date().toISOString();
  return {
    ...current,
    status,
    currentStage: "compose" as AiProgressStageKey,
    message,
    note,
    progress: status === "done" ? 100 : 96,
    updatedAt: timestamp,
    completedAt: timestamp,
    steps: current.steps.map((step) => ({
      ...step,
      status: status === "done" ? "done" as AiProgressStepStatus : status as AiProgressStepStatus,
      updatedAt: step.updatedAt || timestamp
    }))
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pollAiProgress(
  traceId: string,
  token: string,
  apply: (snapshot: AiProgressSnapshot) => void,
  shouldStop: () => boolean
) {
  const startedAt = Date.now();
  while (!shouldStop() && Date.now() - startedAt < 180_000) {
    try {
      const snapshot = await requestJson<AiProgressSnapshot>(`/api/ai-progress/${encodeURIComponent(traceId)}`, {}, token);
      apply(snapshot);
      if (snapshot.status !== "running") {
        return;
      }
    } catch (error) {
      const status = (error as ApiError).status;
      if (status && status !== 404) {
        console.warn("[aiProgress] poll failed", error);
      }
    }
    await wait(850);
  }
}

type AiProgressUiMode = "thinking" | "slow" | "fallback" | "error" | "done";
type AiProgressVisualStepStatus = AiProgressStepStatus | "slow";

function aiProgressSceneTitle(scene: AiProgressScene) {
  if (scene === "group_dining") return "多人约饭";
  if (scene === "weekend_plan") return "周边规划";
  return "今天吃什么";
}

function compactSummaryParts(parts: Array<string | undefined | null | false>, fallback: string) {
  const normalized = Array.from(new Set(parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
  ));
  return normalized.length ? normalized.slice(0, 6).join(" · ") : fallback;
}

function aiProgressRequestSummary(scene: AiProgressScene, requestSummary?: string) {
  if (requestSummary?.trim()) return requestSummary.trim();
  if (scene === "group_dining") return "当前多人约饭任务";
  if (scene === "weekend_plan") return "当前周边规划条件";
  return "当前用餐条件";
}

function aiProgressDoneText(scene: AiProgressScene) {
  if (scene === "group_dining") return "约饭方案已生成";
  if (scene === "weekend_plan") return "周边路线已生成";
  return "推荐结果已生成";
}

function getAiProgressUiMode(progress: AiProgressSnapshot): AiProgressUiMode {
  if (progress.status === "done") return "done";
  if (progress.status === "fallback") return "fallback";
  if (progress.status === "error") return "error";

  const startedAtMs = Date.parse(progress.startedAt);
  const isSlow = Number.isFinite(startedAtMs) && Date.now() - startedAtMs > 12_000;
  return isSlow ? "slow" : "thinking";
}

function aiProgressStatusLabel(mode: AiProgressUiMode) {
  if (mode === "done") return "完成";
  if (mode === "fallback") return "兜底";
  if (mode === "error") return "失败";
  if (mode === "slow") return "慢了";
  return "思考中";
}

function aiProgressBannerText(mode: AiProgressUiMode) {
  if (mode === "slow") return "云端还在算，比平时久一点；先把已完成的判断点亮给你看。";
  if (mode === "fallback") return "远端 OpenClaw 暂时不可用，已切换本地兜底方案。";
  if (mode === "error") return "这次生成中断了，可能是网络抖动或模型超时，可以换条件后重试。";
  return "";
}

function aiProgressCurrentStepIndex(progress: AiProgressSnapshot, steps: AiProgressStep[]) {
  const index = steps.findIndex((step) => step.key === progress.currentStage);
  return index >= 0 ? index : Math.max(0, steps.findIndex((step) => step.status === "running"));
}

function aiProgressStepVisualStatus(
  progress: AiProgressSnapshot,
  step: AiProgressStep,
  index: number,
  currentIndex: number,
  mode: AiProgressUiMode
): AiProgressVisualStepStatus {
  if (mode === "done") return "done";
  if (mode === "error" && index >= currentIndex) return index === currentIndex ? "error" : "pending";
  if (mode === "fallback" && index >= currentIndex) return index === currentIndex ? "fallback" : "pending";
  if ((mode === "thinking" || mode === "slow") && index === currentIndex) return mode === "slow" ? "slow" : "running";
  if (index < currentIndex) return "done";
  return step.status;
}

function renderAiProgressCard(progress: AiProgressSnapshot | null, requestSummary?: string): ReactNode {
  if (!progress) return null;

  const steps = progress.steps.length
    ? progress.steps
    : aiProgressSteps[progress.scene].map((step) => ({ ...step, status: "pending" as const }));
  const mode = getAiProgressUiMode(progress);
  const currentIndex = aiProgressCurrentStepIndex(progress, steps);
  const bannerText = aiProgressBannerText(mode);
  const progressWidth = Math.max(0, Math.min(100, progress.progress));

  return (
    <div className={`ai-progress-card ai-progress-${mode}`}>
      <div className="ai-progress-cap">
        <div className="ai-progress-cat" aria-hidden="true">
          <span className="ai-progress-cat-eye ai-progress-cat-eye-left"></span>
          <span className="ai-progress-cat-eye ai-progress-cat-eye-right"></span>
          <span className="ai-progress-cat-mouth"></span>
          <span className="ai-progress-cat-spark ai-progress-cat-spark-left"></span>
          <span className="ai-progress-cat-spark ai-progress-cat-spark-right"></span>
        </div>
        <div className="ai-progress-cap-text">
          <div className="ai-progress-eyebrow">AI 管家 · {aiProgressStatusLabel(mode)}</div>
          <div className="ai-progress-title">{aiProgressSceneTitle(progress.scene)}</div>
        </div>
      </div>

      <div className="ai-progress-ask">{aiProgressRequestSummary(progress.scene, requestSummary)}</div>

      <div className="ai-progress-timeline">
        {steps.map((step, index) => {
          const visualStatus = aiProgressStepVisualStatus(progress, step, index, currentIndex, mode);
          const showMiniMeter = visualStatus === "running" || visualStatus === "slow";

          return (
            <div className={`ai-progress-row is-${visualStatus}`} key={step.key}>
              <span className="ai-progress-node" aria-hidden="true">
                {visualStatus === "done" ? "✓" : ""}
              </span>
              <div className="ai-progress-row-copy">
                <div className="ai-progress-row-title">{step.label}</div>
                <div className="ai-progress-row-detail">{step.detail}</div>
                {showMiniMeter ? (
                  <div className="ai-progress-mini-meter">
                    <div style={{ width: `${Math.max(18, progressWidth)}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {bannerText ? <div className="ai-progress-banner">{bannerText}</div> : null}
      {mode === "done" ? (
        <div className="ai-progress-result">
          <span className="ai-progress-result-check">✓</span>
          <span>{aiProgressDoneText(progress.scene)}</span>
          <span className="ai-progress-result-chip">可继续调整</span>
        </div>
      ) : null}
      {progress.note && mode !== "done" ? <div className="ai-progress-note">{progress.note}</div> : null}

      <div className="ai-progress-rail" aria-hidden="true">
        <div style={{ width: `${progressWidth}%` }} />
      </div>
    </div>
  );
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function storageKey(userId: string, suffix: string) {
  return `meituan_web_demo:${userId}:${suffix}`;
}

function normalizeJudgeId(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createBrowserJudgeId() {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `judge-auto-${randomPart}`;
}

function getOrCreateBrowserJudgeId() {
  const stored = normalizeJudgeId(window.localStorage.getItem(judgeDeviceKey) || "");
  if (stored) return stored;

  const next = createBrowserJudgeId();
  window.localStorage.setItem(judgeDeviceKey, next);
  return next;
}

function formatJudgeDisplayName(demoUserId: string) {
  return demoUserId.startsWith("judge-auto-") ? "评委 Demo 用户" : `评委 ${demoUserId}`;
}

function formatPrice(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "人均待确认";
  if (raw.includes("人均")) return raw;
  const match = raw.match(/\d+(?:\.\d+)?/);
  return match ? `人均 ${match[0]}元` : `人均 ${raw}`;
}

function normalizeCards(cards: RecommendationCard[], favorites: RecommendationCard[]) {
  return (cards.length ? cards : fallbackRecommendations).slice(0, 3).map((card, index) => {
    const id = card.id || `card_${index}`;
    const key = id || card.name;
    return {
      ...card,
      id,
      perCapitaDisplay: card.perCapitaDisplay || formatPrice(card.perCapita),
      matchedTags: Array.isArray(card.matchedTags) ? card.matchedTags : [],
      isFavorited: favorites.some((item) => (item.id || item.name) === key)
    };
  });
}

function summarizeFood(slots: FoodSlots, preferences: FoodPreferences) {
  return [
    slots.mealPurpose,
    slots.branchPreference,
    slots.budget,
    slots.distance,
    preferences.spicyLevel,
    preferences.tasteTags.slice(0, 2).join("、")
  ].filter(Boolean).join(" · ");
}

function detectMealPurposeFromText(value: string) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return "";

  for (const [canonical, aliases] of Object.entries(mealPurposeAliases)) {
    if (aliases.some((alias) => text.includes(alias))) {
      return canonical;
    }
  }

  return "";
}

function splitManualTags(value: string) {
  return String(value || "").split(/[、,，/ ]+/).map((item) => item.trim()).filter(Boolean);
}

function mergeUnique(base: string[], additions: string[]) {
  return Array.from(new Set([...base, ...additions].filter(Boolean)));
}

function applyManualTagsToPreferences(question: FoodQuestion, prefs: FoodPreferences, manualText: string): FoodPreferences {
  const manualTags = splitManualTags(manualText);
  if (!manualTags.length || !question.groups?.length) return prefs;

  const asks = (type: FoodTagType) => Boolean(question.groups?.some((group) => group.type === type));
  const next = {
    ...prefs,
    tasteTags: [...prefs.tasteTags],
    needTags: [...prefs.needTags],
    temporaryAvoidTags: [...prefs.temporaryAvoidTags],
    avoidTags: [...prefs.avoidTags]
  };

  manualTags.forEach((tag) => {
    if (asks("temporaryAvoid") && !asks("taste") && !asks("need") && !asks("avoid")) {
      next.temporaryAvoidTags = mergeUnique(next.temporaryAvoidTags, [tag]);
    } else if (asks("avoid") && !asks("taste") && !asks("need")) {
      next.avoidTags = mergeUnique(next.avoidTags.filter((item) => item !== "没有忌口"), [tag]);
    } else if (asks("need")) {
      next.needTags = mergeUnique(next.needTags, [tag]);
    } else if (asks("taste")) {
      next.tasteTags = mergeUnique(next.tasteTags, [tag]);
    }
  });

  return next;
}

function buildModifyQuestion(action: string, mealPurpose: string): FoodQuestion | null {
  switch (action) {
    case "branch-preference":
      return buildBranchPreferenceQuestion(mealPurpose);
    case "taste-feeling":
      return modifyTasteFeelingQuestion;
    case "temporary-avoid":
      return modifyTemporaryAvoidQuestion;
    case "restriction":
      return modifyRestrictionQuestion;
    case "spice":
      return modifySpiceQuestion;
    case "budget":
      return buildBudgetQuestion(mealPurpose);
    case "distance":
      return distanceQuestion;
    case "notes":
      return userNotesQuestion;
    default:
      return null;
  }
}

function budgetMaxFromText(value: string) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 80;
}

function distanceKmFromText(value: string) {
  const raw = String(value || "");
  if (raw.includes("500")) return 0.5;
  const match = raw.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 1;
}

function buildLocalWeekendPlan(input: { budgetMax?: string; startArea?: string }): WeekendPlan {
  const budget = input.budgetMax || "120";
  const start = input.startArea || "学校周边";

  return {
    planId: `local_${Date.now().toString(36)}`,
    status: "ready",
    backendStatus: "fallback",
    backendMessage: "后端不可用时展示本地保守规划，便于完整体验。",
    weather: {
      fallback: true,
      sourceLabel: "fallback",
      summary: "天气暂不可用，优先选择室内/短步行方案。"
    },
    source: {
      weather: "fallback",
      poi: "local",
      planner: "local"
    },
    aiStatus: {
      resultGeneratedBy: "local",
      resultIsAiGenerated: false,
      openclawStatus: "not_applicable",
      openclawSubmitted: false,
      label: "本地兜底路线，未调用 OpenClaw",
      detail: "后端不可用时展示本地保守规划；这不是 AI 直接返回，也没有完成 OpenClaw 上下文投喂。"
    },
    routes: [
      {
        id: "local-cafe-walk",
        type: "balanced",
        typeLabel: "轻松",
        title: "咖啡开场 + 校园周边轻 citywalk",
        summary: `从${start}出发，路线短、预算稳，适合轻松聊天。`,
        estimatedBudget: `${budget} 元以内/人`,
        estimatedDurationMinutes: 150,
        transport: "步行 + 短途骑行",
        timeline: [
          { time: "0-20 分钟", title: "集合确认", placeName: start, activity: "确认返程时间和预算上限。", durationMinutes: 20 },
          { time: "20-70 分钟", title: "咖啡/轻食", placeName: "学校周边咖啡店", activity: "先坐下来补能量，避免一开始就走太多。", durationMinutes: 50 },
          { time: "70-130 分钟", title: "短步行路线", placeName: "校园周边", activity: "选 1-2 个拍照/散步点，保留弹性。", durationMinutes: 60 }
        ],
        selfChecks: {
          预算: `${budget} 元以内`,
          天气: "按天气未知处理，减少露天停留",
          返程: "预留 30 分钟返程"
        },
        risks: ["天气未确认，建议带伞并保留室内替代点"],
        inviteText: `从${start}出发，轻松走一条咖啡 + citywalk 路线，预算 ${budget} 元以内。`
      }
    ]
  };
}

function normalizeSelfChecks(route: WeekendPlan["routes"][number]) {
  if (!route.selfChecks) return [];
  if (Array.isArray(route.selfChecks)) {
    return route.selfChecks.map((item, index) => ({
      key: `${route.id}-check-${index}`,
      label: item.label || "自查项",
      detail: item.detail || item.status || item.statusText || (item.passed === false ? "需要确认" : "通过"),
      statusText: item.statusText || (item.passed === false ? "注意" : "通过")
    }));
  }
  return Object.entries(route.selfChecks).map(([label, detail]) => ({
    key: `${route.id}-${label}`,
    label,
    detail,
    statusText: "通过"
  }));
}

type WeekendRuntimeStatus = FoodConnectionStatus & {
  tags: string[];
  resultSourceLabel: string;
  openclawStatusLabel: string;
  resultIsAiGenerated: boolean;
  traceId?: string;
  durationMs?: number;
};

function getWeekendPlannerLabel(plan: WeekendPlan) {
  const source = plan.aiStatus?.resultGeneratedBy || plan.source?.planner || plan.backendStatus || "";
  if (source === "local") return "本地兜底";
  if (source === "rules" || source === "rules-v1" || source === "weekend-data-rules-v1") return "规则规划器";
  return source ? source : "后端规划器";
}

function buildWeekendRuntimeStatus(plan: WeekendPlan | null, loading = false): WeekendRuntimeStatus {
  if (loading) {
    return {
      text: "正在生成周边规划",
      className: "status-checking",
      openclawReachable: false,
      detail: "正在综合天气、预算、体力和返程时间；生成完成后会显示 OpenClaw 是否接收上下文。",
      tags: ["状态 生成中", "路线 待生成", "OpenClaw 待确认"],
      resultSourceLabel: "待生成",
      openclawStatusLabel: "待确认",
      resultIsAiGenerated: false
    };
  }

  if (!plan) {
    return {
      text: "规则规划待生成 · OpenClaw 待确认",
      className: "status-checking",
      openclawReachable: false,
      detail: "提交后会展示路线来源，以及本次上下文是否提交到 OpenClaw。",
      tags: ["路线 待生成", "OpenClaw 待确认", "非 AI 直接返回路线"],
      resultSourceLabel: "待生成",
      openclawStatusLabel: "待确认",
      resultIsAiGenerated: false
    };
  }

  const openclawStatus = plan.aiStatus?.openclawStatus || plan.openclawContext?.status || "";
  const openclawSubmitted = Boolean(plan.aiStatus?.openclawSubmitted ?? plan.openclawContext?.submitted);
  const localFallback = plan.source?.planner === "local" || plan.aiStatus?.resultGeneratedBy === "local" || plan.backendStatus === "fallback";
  const resultIsAiGenerated = Boolean(plan.aiStatus?.resultIsAiGenerated);
  const resultSourceLabel = resultIsAiGenerated ? "AI 直接返回" : getWeekendPlannerLabel(plan);
  const traceId = plan.aiStatus?.traceId || plan.openclawContext?.traceId;
  const durationMs = plan.aiStatus?.durationMs ?? plan.openclawContext?.durationMs;
  const baseDetail = plan.aiStatus?.detail || plan.openclawContext?.detail || plan.backendMessage;

  if (localFallback) {
    return {
      text: "本地兜底路线 · 未调用 OpenClaw",
      className: "status-mock",
      openclawReachable: false,
      detail: baseDetail || "后端不可用时展示本地保守路线；这不是 AI 直接返回，也没有完成 OpenClaw 上下文投喂。",
      tags: [`路线 ${resultSourceLabel}`, "OpenClaw 未调用", "非 AI 直接返回路线"],
      resultSourceLabel,
      openclawStatusLabel: "未调用",
      resultIsAiGenerated,
      traceId,
      durationMs
    };
  }

  if (openclawSubmitted || openclawStatus === "submitted") {
    return {
      text: "规则路线 · OpenClaw 已接收上下文",
      className: "status-connected",
      openclawReachable: true,
      detail: baseDetail || "本次路线由规则规划器生成；OpenClaw 已接收用户画像、天气和候选路线上下文。",
      tags: [`路线 ${resultSourceLabel}`, "OpenClaw 已接收上下文", "非 AI 直接返回路线"],
      resultSourceLabel,
      openclawStatusLabel: "已接收上下文",
      resultIsAiGenerated,
      traceId,
      durationMs
    };
  }

  if (openclawStatus === "failed") {
    return {
      text: "规则路线 · OpenClaw 提交失败",
      className: "status-error",
      openclawReachable: false,
      detail: baseDetail || "本次路线由规则规划器生成；OpenClaw 上下文投喂失败。",
      tags: [`路线 ${resultSourceLabel}`, "OpenClaw 提交失败", "非 AI 直接返回路线"],
      resultSourceLabel,
      openclawStatusLabel: "提交失败",
      resultIsAiGenerated,
      traceId,
      durationMs
    };
  }

  return {
    text: openclawStatus === "skipped" ? "规则路线 · OpenClaw 未启用" : "规则路线 · OpenClaw 状态待确认",
    className: "status-backend-only",
    openclawReachable: false,
    detail: baseDetail || "本次路线由规则规划器生成；OpenClaw 未返回可确认的上下文投喂状态。",
    tags: [`路线 ${resultSourceLabel}`, openclawStatus === "skipped" ? "OpenClaw 未启用" : "OpenClaw 待确认", "非 AI 直接返回路线"],
    resultSourceLabel,
    openclawStatusLabel: openclawStatus === "skipped" ? "未启用" : "待确认",
    resultIsAiGenerated,
    traceId,
    durationMs
  };
}

function buildWeekendTimeWindow(form: typeof defaultWeekendForm) {
  const dateLabel = String(form.dateLabel || "").trim();
  if (form.timeMode === "allDay") {
    return dateLabel ? `${dateLabel} 全天` : "全天";
  }
  const start = String(form.startTime || "").trim();
  const end = String(form.endTime || "").trim();
  const range = start && end ? `${start}-${end}` : "";
  return [dateLabel, range].filter(Boolean).join(" ");
}

function parseWeekendBudget(value: string) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function validateWeekendForm(form: typeof defaultWeekendForm) {
  const timeWindow = buildWeekendTimeWindow(form);
  const budgetMax = parseWeekendBudget(form.budgetMax);
  if (!form.dateLabel.trim()) return { ok: false as const, message: "请选择周几出行" };
  if (form.timeMode !== "allDay") {
    if (!form.startTime.trim()) return { ok: false as const, message: "请选择开始时间" };
    if (!form.endTime.trim()) return { ok: false as const, message: "请选择结束时间" };
    if (form.startTime >= form.endTime) return { ok: false as const, message: "结束时间要晚于开始时间" };
  }
  if (!budgetMax || budgetMax <= 0) return { ok: false as const, message: "请填写有效预算" };
  if (budgetMax > 2000) return { ok: false as const, message: "预算先控制在 2000 内" };
  if (!form.startArea.trim()) return { ok: false as const, message: "请填写出发起点" };
  return { ok: true as const, budgetMax, timeWindow };
}

const defaultWeekendForm = {
  dateLabel: "周六",
  timeMode: "range",
  startTime: "14:00",
  endTime: "17:00",
  budgetMax: "120",
  startArea: "学校周边",
  mood: "想轻松一点",
  energyLevel: "低体力",
  companions: "朋友",
  interests: ["咖啡", "citywalk", "轻食"],
  rawText: ""
};

export default function ExperienceClient() {
  const [view, setView] = useState<PhoneView>("login");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [judgeIdInput, setJudgeIdInput] = useState("");
  const [browserJudgeId, setBrowserJudgeId] = useState("");
  const [identityNotice, setIdentityNotice] = useState("");
  const [copyToast, setCopyToast] = useState<{ id: number; message: string; tone: "success" | "error" } | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [authError, setAuthError] = useState("");
  const { activeTheme, themeId, selectTheme } = useSiteTheme();

  const [memory, setMemory] = useState<MemorySettings>(defaultMemory);
  const [memoryCustomAvoid, setMemoryCustomAvoid] = useState("");
  const [memoryNotice, setMemoryNotice] = useState("");
  const [records, setRecords] = useState<PreferenceRecord[]>([]);
  const [favorites, setFavorites] = useState<RecommendationCard[]>([]);

  const [foodIndex, setFoodIndex] = useState(0);
  const [foodSlots, setFoodSlots] = useState<FoodSlots>({ mealPurpose: "", branchPreference: "", budget: "", distance: "", userNotes: "" });
  const [foodPrefs, setFoodPrefs] = useState<FoodPreferences>({ tasteTags: [], needTags: [], temporaryAvoidTags: [], avoidTags: [], spicyLevel: "" });
  const [manualAnswer, setManualAnswer] = useState("");
  const [showSlotSummaryDetail, setShowSlotSummaryDetail] = useState(false);
  const [foodFinished, setFoodFinished] = useState(false);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodNotice, setFoodNotice] = useState("");
  const [foodAiProgress, setFoodAiProgress] = useState<AiProgressSnapshot | null>(null);
  const [foodConnection, setFoodConnection] = useState<FoodConnectionStatus>(defaultFoodConnectionStatus);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [adjustmentText, setAdjustmentText] = useState("");
  const [showAdjustmentOptions, setShowAdjustmentOptions] = useState(false);
  const [memoryDecision, setMemoryDecision] = useState<"kept" | "session-only" | "">("");
  const [batchIndex, setBatchIndex] = useState(0);
  const [prefCheckRecord, setPrefCheckRecord] = useState<PreferenceRecord | null>(null);
  const [prefModifyRecord, setPrefModifyRecord] = useState<PreferenceRecord | null>(null);
  const [prefModifyRows, setPrefModifyRows] = useState<PrefSummaryRow[]>([]);
  const [activeFoodQuestionIds, setActiveFoodQuestionIds] = useState<Array<FoodQuestion["id"]> | null>(null);
  const [activeFoodQuestionOverride, setActiveFoodQuestionOverride] = useState<FoodQuestion[] | null>(null);
  const [foodPreambleMessages, setFoodPreambleMessages] = useState<Array<{ id: string; role: "user" | "butler"; text: string }>>([]);
  const [adjustmentMessages, setAdjustmentMessages] = useState<Array<{ id: string; role: "user" | "butler"; text: string }>>([]);

  const [groupPeople, setGroupPeople] = useState(4);
  const [customPeopleInput, setCustomPeopleInput] = useState("");
  const [groupTaskId, setGroupTaskId] = useState("");
  const [groupInviteToken, setGroupInviteToken] = useState("");
  const [groupBoard, setGroupBoard] = useState<GroupBoard | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupNotice, setGroupNotice] = useState("");
  const [groupAiProgress, setGroupAiProgress] = useState<AiProgressSnapshot | null>(null);
  const [groupAdjustmentRequests, setGroupAdjustmentRequests] = useState<Array<{ id: string; nickname: string; visibility: string; candidateId: string; candidateName: string; reasonType: string; reasonLabel: string; note: string }>>([]);
  const [adjustmentTargetCandidate, setAdjustmentTargetCandidate] = useState<{ id: string; name: string } | null>(null);
  const [adjustmentNickname, setAdjustmentNickname] = useState("");
  const [adjustmentVisibility, setAdjustmentVisibility] = useState("public");
  const [adjustmentReasonType, setAdjustmentReasonType] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [groupParticipant, setGroupParticipant] = useState({
    nickname: "我",
    rawPreference: "不吃辣，人均 80 以内，最好不要排太久。",
    budgetMax: "80",
    leaveBefore: "20:30",
    spicyPreference: "no_spicy"
  });
  const [groupFill, setGroupFill] = useState({
    days: ["周五", "周六", "周日"],
    timeMode: "specified",
    startTime: "18:00",
    endTime: "20:30",
    dietaryTags: ["不吃辣"],
    cuisineTags: ["都可以"],
    budgetTag: "80以内",
    visibility: "nickname_only",
    timeCustomText: "",
    restrictionCustomText: "",
    cuisineCustomText: "",
    budgetCustomText: "",
    spiceCustomText: "",
    hardRequirement: "",
    softPreference: "适合聊天，最好不要排太久。",
    priority: {
      days: "must",
      hours: "must",
      timeText: "must",
      dietary: "must",
      cuisine: "nice",
      budget: "nice",
      spicy: "nice"
    }
  });

  const [weekendForm, setWeekendForm] = useState(defaultWeekendForm);
  const [weekendPlan, setWeekendPlan] = useState<WeekendPlan | null>(null);
  const [weekendLoading, setWeekendLoading] = useState(false);
  const [weekendNotice, setWeekendNotice] = useState("");
  const [weekendError, setWeekendError] = useState("");
  const [weekendAiProgress, setWeekendAiProgress] = useState<AiProgressSnapshot | null>(null);

  const themeClass = activeTheme.className;
  const foodAiProgressSummary = useMemo(() => compactSummaryParts([
    foodSlots.mealPurpose,
    foodSlots.branchPreference,
    foodPrefs.needTags.join("、"),
    foodPrefs.tasteTags.join("、"),
    foodPrefs.temporaryAvoidTags.join("、"),
    foodPrefs.avoidTags.length ? foodPrefs.avoidTags.join("、") : memory.avoidTags.join("、"),
    foodSlots.budget || memory.budget,
    foodSlots.distance || memory.distance,
    foodSlots.userNotes
  ], aiProgressRequestSummary("food_recommendation")), [foodSlots, foodPrefs, memory]);
  const groupAiProgressSummary = useMemo(() => {
    const task = groupBoard?.task;
    const expectedPeople = groupBoard?.task.expectedPeopleCount || groupPeople;
    const submittedCount = groupBoard?.participants.length || 0;
    const timeText = task?.dinnerTime || (groupFill.timeMode === "allDay"
      ? `${groupFill.days.join("、") || "待商量"} 全天`
      : `${groupFill.days.join("、") || "待商量"} ${groupFill.startTime}-${groupFill.endTime}`);

    return compactSummaryParts([
      `${expectedPeople}人约饭`,
      timeText,
      task?.locationText,
      submittedCount > 0 ? `${submittedCount}人已提交` : "等待成员提交",
      groupFill.dietaryTags.join("、"),
      groupFill.cuisineTags.join("、"),
      groupParticipant.budgetMax ? `${groupParticipant.budgetMax}元内` : groupFill.budgetTag,
      groupFill.softPreference
    ], aiProgressRequestSummary("group_dining"));
  }, [groupBoard, groupPeople, groupFill, groupParticipant]);
  const weekendAiProgressSummary = useMemo(() => compactSummaryParts([
    buildWeekendTimeWindow(weekendForm),
    weekendForm.startArea,
    weekendForm.budgetMax ? `${weekendForm.budgetMax}元/人` : "",
    weekendForm.mood,
    weekendForm.energyLevel,
    weekendForm.companions,
    weekendForm.interests.join("、"),
    weekendForm.rawText
  ], aiProgressRequestSummary("weekend_plan")), [weekendForm]);

  useEffect(() => {
    if (!copyToast) return;

    const timer = window.setTimeout(() => setCopyToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copyToast]);

  const resolvedFoodQuestions = useMemo(() => buildFoodQuestions(foodSlots.mealPurpose), [foodSlots.mealPurpose]);
  const activeFoodQuestions = activeFoodQuestionOverride || (activeFoodQuestionIds ? resolvedFoodQuestions.filter((question) => activeFoodQuestionIds.includes(question.id)) : resolvedFoodQuestions);
  const currentQuestion = activeFoodQuestions[foodIndex] || activeFoodQuestions[activeFoodQuestions.length - 1] || resolvedFoodQuestions[0] || foodQuestions[0];
  const progressPercent = Math.round(((Math.min(foodIndex + 1, activeFoodQuestions.length || 1)) / (activeFoodQuestions.length || 1)) * 100);
  const recentRecord = records[0];
  const summaryFields = [
    { key: "mealPurpose", label: "场景", value: foodSlots.mealPurpose || "待填写" },
    { key: "branchPreference", label: "想吃", value: foodSlots.branchPreference || "待填写" },
    { key: "tasteTags", label: "口味", value: foodPrefs.tasteTags.join("、") || "待填写" },
    { key: "needTags", label: "优先", value: foodPrefs.needTags.join("、") || "待填写" },
    { key: "temporaryAvoidTags", label: "避雷", value: foodPrefs.temporaryAvoidTags.join("、") || "待填写" },
    { key: "avoidTags", label: "忌口", value: foodPrefs.avoidTags.join("、") || "待填写" },
    { key: "spicyLevel", label: "辣度", value: foodPrefs.spicyLevel || memory.spicyLevel || "待填写" },
    { key: "budget", label: "预算", value: foodSlots.budget || memory.budget || "待填写" },
    { key: "distance", label: "距离", value: foodSlots.distance || memory.distance || "待填写" },
    { key: "userNotes", label: "补充", value: foodSlots.userNotes || "可跳过" }
  ];

  useEffect(() => {
    const localJudgeId = getOrCreateBrowserJudgeId();
    const storedJudgeId = normalizeJudgeId(window.localStorage.getItem(judgeInputKey) || "");
    const stored = safeJsonParse<Identity | null>(window.localStorage.getItem(identityKey), null);
    setBrowserJudgeId(localJudgeId);
    setJudgeIdInput(stored?.demoUserId || storedJudgeId || localJudgeId);
    if (stored?.sessionToken && stored.userId) {
      setIdentity(stored);
      setView("home");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTaskId = params.get("groupTaskId") || params.get("taskId") || "";
    const sharedInviteToken = params.get("inviteToken") || "";

    if (!sharedTaskId || !sharedInviteToken) return;

    setGroupTaskId(sharedTaskId);
    setGroupInviteToken(sharedInviteToken);
    setView(params.get("view") === "group-board" ? "group-board" : "group-fill");
    void loadSharedGroupBoard(sharedTaskId, sharedInviteToken);
  }, []);

  useEffect(() => {
    if (!identity) return;

    const storedMemory = safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "memory")), defaultMemory);
    const fixedAvoidSet = new Set(memoryAvoidOptions.filter((item) => item !== "无" && item !== "其他"));
    setMemory({ ...defaultMemory, ...storedMemory, permissions: { ...defaultMemory.permissions, ...storedMemory.permissions } });
    setMemoryCustomAvoid((storedMemory.avoidTags || []).filter((tag) => !fixedAvoidSet.has(tag)).join("、"));
    setRecords(safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "records")), []));
    setFavorites(safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "favorites")), []));
  }, [identity]);

  useEffect(() => {
    if (view !== "food") return;
    void refreshFoodConnectionStatus();
  }, [view]);

  function persistMemory(next: MemorySettings) {
    if (!identity) return;
    setMemory(next);
    window.localStorage.setItem(storageKey(identity.userId, "memory"), JSON.stringify(next));
  }

  function parseMemoryCustomAvoid(value: string) {
    return String(value || "").split(/[,，、/\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function saveStableMemory(nextMemory: MemorySettings = memory, customAvoid = memoryCustomAvoid) {
    const fixedAvoidSet = new Set(memoryAvoidOptions.filter((item) => item !== "无" && item !== "其他"));
    const fixedTags = (nextMemory.avoidTags || []).filter((tag) => fixedAvoidSet.has(tag));
    const avoidTags = nextMemory.avoidTags.includes("无") ? [] : Array.from(new Set([...fixedTags, ...parseMemoryCustomAvoid(customAvoid)]));
    const updatedAt = new Date().toISOString();
    const uiMemory = { ...nextMemory, updatedAt };
    const storedMemory = { ...nextMemory, avoidTags, updatedAt };
    setMemory(uiMemory);
    if (identity) {
      window.localStorage.setItem(storageKey(identity.userId, "memory"), JSON.stringify(storedMemory));
    }
    setMemoryNotice("已保存");
  }

  function handleMemoryAvoidTap(tag: string) {
    if (tag === "无") {
      setMemoryCustomAvoid("");
      setMemory({ ...memory, avoidTags: memory.avoidTags.includes("无") ? [] : ["无"] });
      return;
    }

    if (tag === "其他") {
      const nextTags = memory.avoidTags.includes("其他")
        ? memory.avoidTags.filter((item) => item !== "其他")
        : [...memory.avoidTags.filter((item) => item !== "无"), "其他"];
      setMemory({ ...memory, avoidTags: nextTags });
      return;
    }

    const nextTags = memory.avoidTags.includes(tag)
      ? memory.avoidTags.filter((item) => item !== tag)
      : [...memory.avoidTags.filter((item) => item !== "无"), tag];
    setMemory({ ...memory, avoidTags: nextTags });
  }

  function handleMemoryCustomAvoidInput(value: string) {
    setMemoryCustomAvoid(value);
    if (value.trim() && memory.avoidTags.includes("无")) {
      setMemory({ ...memory, avoidTags: memory.avoidTags.filter((item) => item !== "无") });
    }
  }

  function formatMemoryUpdatedAt(iso?: string) {
    if (!iso) return "尚未保存";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "尚未保存";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `上次保存：${month}-${day} ${hour}:${minute}`;
  }

  function persistRecords(next: PreferenceRecord[]) {
    if (!identity) return;
    const limited = next.slice(0, 20);
    setRecords(limited);
    window.localStorage.setItem(storageKey(identity.userId, "records"), JSON.stringify(limited));
  }

  function persistFavorites(next: RecommendationCard[]) {
    if (!identity) return;
    const limited = next.slice(0, 30);
    setFavorites(limited);
    window.localStorage.setItem(storageKey(identity.userId, "favorites"), JSON.stringify(limited));
    setRecommendations((items) => normalizeCards(items, limited));
  }

  async function login(nextJudgeId = judgeIdInput) {
    setAuthError("");
    setIdentityNotice("");
    setAuthLoading(true);

    try {
      const fallbackJudgeId = browserJudgeId || getOrCreateBrowserJudgeId();
      const demoUserId = normalizeJudgeId(nextJudgeId) || fallbackJudgeId;
      const displayName = formatJudgeDisplayName(demoUserId);
      const result = await requestJson<Identity>("/api/demo/session", {
        method: "POST",
        body: JSON.stringify({ demoUserId, displayName })
      });
      const nextIdentity = {
        demoUserId: result.demoUserId,
        displayName: result.displayName,
        userId: result.userId,
        sessionToken: result.sessionToken
      };
      window.localStorage.setItem(identityKey, JSON.stringify(nextIdentity));
      window.localStorage.setItem(judgeInputKey, nextIdentity.demoUserId);
      setIdentity(nextIdentity);
      setJudgeIdInput(nextIdentity.demoUserId);
      setIdentityNotice(`已切换到 ${nextIdentity.displayName}`);
      setView("home");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthLoading(false);
    }
  }

  function startIdentityLogin() {
    if (authLoading) return;
    void login();
  }

  function handleIdentitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startIdentityLogin();
  }

  function logout() {
    window.localStorage.removeItem(identityKey);
    setIdentityNotice("");
    setIdentity(null);
    setView("login");
  }

  function handleAuthError(error: unknown) {
    const apiError = error as ApiError;
    if (apiError?.status === 401 || apiError?.code === "AUTH_REQUIRED") {
      logout();
      setAuthError("登录状态已过期，请重新进入 demo。");
      return true;
    }
    return false;
  }

  async function refreshFoodConnectionStatus() {
    const checking = defaultFoodConnectionStatus;
    setFoodConnection(checking);

    let pingOk = false;

    try {
      const ping = await requestJson<FoodPingResponse>("/api/remote/food/ping");
      pingOk = Boolean(ping.ok);
    } catch {
      pingOk = false;
    }

    try {
      const status = await requestJson<FoodStatusResponse>("/api/remote/food/status");
      const backendOk = Boolean(status.backend?.ok || pingOk);
      const gatewayReachable = Boolean(status.openclaw?.gatewayReachable);
      const openclawReachable = Boolean(status.openclaw?.ok || gatewayReachable);
      const detail = status.openclaw?.detail || status.openclaw?.gatewayUrl || status.backend?.checkedAt;
      const nextStatus = openclawReachable
        ? {
            text: gatewayReachable ? "远端 OpenClaw Gateway 可达" : "远端 OpenClaw 已连接",
            className: "status-connected",
            openclawReachable: true,
            detail
          }
        : backendOk
          ? {
              text: "远端 API 可达，OpenClaw 状态待确认",
              className: "status-backend-only",
              openclawReachable: false,
              detail
            }
          : {
              text: "远端推荐服务未连通",
              className: "status-error",
              openclawReachable: false,
              detail
            };

      setFoodConnection(nextStatus);
      return nextStatus;
    } catch (error) {
      const nextStatus = pingOk
        ? {
            text: "远端 API ping 可达，OpenClaw 状态未返回",
            className: "status-backend-only",
            openclawReachable: false,
            detail: error instanceof Error ? error.message : String(error)
          }
        : {
            text: "远端推荐服务未连通",
            className: "status-error",
            openclawReachable: false,
            detail: error instanceof Error ? error.message : String(error)
          };
      setFoodConnection(nextStatus);
      return nextStatus;
    }
  }

  function goHome() {
    setView("home");
  }

  function buildGroupShareUrl() {
    if (!groupTaskId || !groupInviteToken) return "";

    const url = new URL("/experience", window.location.origin);
    url.searchParams.set("view", "group-fill");
    url.searchParams.set("groupTaskId", groupTaskId);
    url.searchParams.set("inviteToken", groupInviteToken);
    return url.toString();
  }

  async function writeClipboardText(value: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      if (!copied) {
        throw new Error("copy command failed");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }

  function showCopyToast(message: string, tone: "success" | "error" = "success") {
    setCopyToast({ id: Date.now(), message, tone });
  }

  async function copyTextWithFeedback(value: string, successMessage: string, failureContext: string) {
    if (!value.trim()) {
      showCopyToast("没有可复制内容", "error");
      return false;
    }

    try {
      await writeClipboardText(value);
      showCopyToast(successMessage);
      return true;
    } catch {
      showCopyToast(`${failureContext}失败，请长按文本手动复制`, "error");
      return false;
    }
  }

  function copyGroupShareLink() {
    const shareUrl = buildGroupShareUrl();

    if (!shareUrl) {
      setGroupNotice("还没有可分享的约饭任务。");
      showCopyToast("还没有可分享的约饭任务", "error");
      return;
    }

    void copyTextWithFeedback(shareUrl, "分享链接已复制", "复制分享链接")
      .then((copied) => {
        setGroupNotice(copied ? "分享链接已复制；无痕浏览器打开也会进入同一个任务。" : `复制失败，请手动复制：${shareUrl}`);
      });
  }

  function copyGroupMessage(message: string) {
    void copyTextWithFeedback(message, "群消息已复制", "复制群消息")
      .then((copied) => {
        setGroupNotice(copied ? "群消息已复制，可以直接粘贴到群里。" : "复制群消息失败，请长按文案手动复制。");
      });
  }

  function copyWeekendInvite(inviteText: string) {
    void copyTextWithFeedback(inviteText, "邀约文案已复制", "复制邀约")
      .then((copied) => {
        setWeekendNotice(copied ? "邀约文案已复制，可以直接发给朋友。" : "复制邀约失败，请长按文案手动复制。");
      });
  }

  async function loadSharedGroupBoard(taskId: string, inviteToken: string) {
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(taskId)}?inviteToken=${encodeURIComponent(inviteToken)}`, {}, identity?.sessionToken);
      setGroupBoard(board);
      setGroupPeople(board.task.expectedPeopleCount || groupPeople);
    } catch (error) {
      setGroupNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setGroupLoading(false);
    }
  }

  function toggleGroupArrayField(field: "days" | "dietaryTags" | "cuisineTags", value: string, resetValue?: string) {
    setGroupFill((current) => {
      const list = current[field];
      const next = resetValue && value === resetValue
        ? [resetValue]
        : list.includes(value)
          ? list.filter((item) => item !== value && item !== resetValue)
          : [...list.filter((item) => item !== resetValue), value];
      return { ...current, [field]: next };
    });
  }

  function setGroupPriority(field: keyof typeof groupFill.priority, value: string) {
    setGroupFill((current) => ({ ...current, priority: { ...current.priority, [field]: value } }));
  }

  function reasonLabel(reasonType: string) {
    return groupAdjustmentReasons.find((item) => item.value === reasonType)?.label || "其他";
  }

  function submitLocalAdjustmentRequest() {
    if (!adjustmentTargetCandidate) return;

    if (!adjustmentReasonType) {
      setGroupNotice("请选择不满意原因");
      return;
    }

    const nickname = adjustmentNickname.trim();
    if (adjustmentVisibility !== "private" && !nickname) {
      setGroupNotice("请填写昵称，或选「匿名」");
      return;
    }

    setGroupAdjustmentRequests((current) => [
      {
        id: `adjust_${Date.now().toString(36)}`,
        nickname,
        visibility: adjustmentVisibility,
        candidateId: adjustmentTargetCandidate.id,
        candidateName: adjustmentTargetCandidate.name,
        reasonType: adjustmentReasonType,
        reasonLabel: reasonLabel(adjustmentReasonType),
        note: adjustmentNote
      },
      ...current
    ]);
    setAdjustmentTargetCandidate(null);
    setAdjustmentReasonType("");
    setAdjustmentNote("");
    setGroupNotice("已提交反馈，发起人可以重新生成推荐。");
  }

  function toggleFoodTag(questionId: string, value: string) {
    const key = questionId as "tasteTags" | "needTags" | "avoidTags";
    setFoodPrefs((current) => {
      const list = current[key] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  }

  function toggleFoodTagByType(type: FoodTagType, label: string, mode: "single" | "multiple") {
    setFoodPrefs((current) => {
      if (type === "spicyLevel") {
        return { ...current, spicyLevel: current.spicyLevel === label ? "" : label };
      }

      const key = type === "taste" ? "tasteTags" : type === "need" ? "needTags" : type === "temporaryAvoid" ? "temporaryAvoidTags" : "avoidTags";
      if (type === "avoid" && label === "没有忌口") {
        return { ...current, avoidTags: current.avoidTags.includes(label) ? [] : [label] };
      }

      const baseList = type === "avoid" ? current[key].filter((item) => item !== "没有忌口") : current[key];
      const next = mode === "single"
        ? (baseList.includes(label) ? [] : [label])
        : (baseList.includes(label) ? baseList.filter((item) => item !== label) : [...baseList, label]);
      return { ...current, [key]: next };
    });
  }

  function isFoodTagSelected(type: FoodTagType, label: string) {
    if (type === "spicyLevel") return foodPrefs.spicyLevel === label;
    if (type === "taste") return foodPrefs.tasteTags.includes(label);
    if (type === "need") return foodPrefs.needTags.includes(label);
    if (type === "temporaryAvoid") return foodPrefs.temporaryAvoidTags.includes(label);
    return foodPrefs.avoidTags.includes(label);
  }

  function toggleFoodMultiChoiceOption(question: FoodQuestion, option: string) {
    if (!question.slot) return;
    setFoodSlots((current) => {
      const currentList = current[question.slot!].split("、").map((item) => item.trim()).filter(Boolean).filter((item) => item !== "未选择");
      const nextList = currentList.includes(option) ? currentList.filter((item) => item !== option) : [...currentList, option];
      return { ...current, [question.slot!]: nextList.join("、") };
    });
  }

  function updateFoodValue(questionId: string, value: string) {
    if (questionId === "mealPurpose" || questionId === "branchPreference" || questionId === "budget" || questionId === "distance" || questionId === "userNotes") {
      setFoodSlots((current) => ({ ...current, [questionId]: value }));
      return;
    }

    if (questionId === "spicyLevel") {
      setFoodPrefs((current) => ({ ...current, spicyLevel: value }));
    }
  }

  function buildNextFoodState(question: FoodQuestion, value?: string) {
    const nextSlots = { ...foodSlots };
    const nextPrefs = {
      ...foodPrefs,
      tasteTags: [...foodPrefs.tasteTags],
      needTags: [...foodPrefs.needTags],
      temporaryAvoidTags: [...foodPrefs.temporaryAvoidTags],
      avoidTags: [...foodPrefs.avoidTags]
    };
    const answer = question.text
      ? value || manualAnswer || "没有补充"
      : question.kind === "multi-choice" && question.slot
        ? value || nextSlots[question.slot] || "未选择"
        : value;

    if (question.slot) {
      nextSlots[question.slot] = answer || "";
    }

    if (question.kind === "tag") {
      const withManualTags = applyManualTagsToPreferences(question, nextPrefs, manualAnswer);
      nextPrefs.tasteTags = withManualTags.tasteTags;
      nextPrefs.needTags = withManualTags.needTags;
      nextPrefs.temporaryAvoidTags = withManualTags.temporaryAvoidTags;
      nextPrefs.avoidTags = withManualTags.avoidTags;
      nextPrefs.spicyLevel = withManualTags.spicyLevel;
    }

    if (question.id === "spicyLevel") {
      nextPrefs.spicyLevel = answer || "";
    }

    if (question.id === "mealPurpose") {
      nextSlots.branchPreference = "";
      nextSlots.budget = "";
      nextSlots.distance = "";
      nextSlots.userNotes = "";
      nextPrefs.tasteTags = [];
      nextPrefs.needTags = [];
      nextPrefs.temporaryAvoidTags = [];
      nextPrefs.avoidTags = [];
      nextPrefs.spicyLevel = "";
    }

    return { nextSlots, nextPrefs };
  }

  function applyFoodState(nextSlots: FoodSlots, nextPrefs: FoodPreferences) {
    setFoodSlots(nextSlots);
    setFoodPrefs(nextPrefs);
  }

  function findMatchingPreferenceRecord(mealPurpose: string) {
    const scene = mealPurpose.trim();
    if (!scene) return null;
    return records.find((record) => (record.slots.mealPurpose || "").trim() === scene) || null;
  }

  function buildPrefSummaryRows(record: PreferenceRecord) {
    const rows = [
      { key: "mealScene", label: "用餐场景", value: record.slots.mealPurpose, action: "", toggleable: false },
      { key: "cravings", label: "想吃", value: record.slots.branchPreference, action: "branch-preference", toggleable: true },
      { key: "taste", label: "口味/感觉", value: [...(record.preferences.tasteTags || []), ...(record.preferences.needTags || [])].join("、"), action: "taste-feeling", toggleable: true },
      { key: "temporaryAvoid", label: "这次不想吃", value: (record.preferences.temporaryAvoidTags || []).join("、"), action: "temporary-avoid", toggleable: true },
      { key: "taboo", label: "忌口", value: (record.preferences.avoidTags || []).join("、"), action: "restriction", toggleable: true },
      { key: "spiceLevel", label: "辣度", value: record.preferences.spicyLevel, action: "spice", toggleable: true },
      { key: "budget", label: "预算", value: record.slots.budget, action: "budget", toggleable: true },
      { key: "distance", label: "距离", value: record.slots.distance, action: "distance", toggleable: true },
      { key: "notes", label: "其他补充", value: record.slots.userNotes, action: "notes", toggleable: true }
    ];
    return rows.map((row) => ({ ...row, keep: true })).filter((row) => row.value && row.value !== "未选择");
  }

  function addFoodPreamble(userText: string, butlerText: string) {
    const id = Date.now().toString(36);
    setFoodPreambleMessages((messages) => [
      ...messages,
      { id: `${id}-user`, role: "user", text: userText },
      { id: `${id}-butler`, role: "butler", text: butlerText }
    ]);
  }

  function applyPreferenceRecord(record: PreferenceRecord) {
    const nextSlots = {
      mealPurpose: foodSlots.mealPurpose || record.slots.mealPurpose,
      branchPreference: record.slots.branchPreference || "",
      budget: record.slots.budget || "",
      distance: record.slots.distance || "",
      userNotes: record.slots.userNotes || ""
    };
    const nextPrefs = {
      tasteTags: [...(record.preferences.tasteTags || [])],
      needTags: [...(record.preferences.needTags || [])],
      temporaryAvoidTags: [...(record.preferences.temporaryAvoidTags || [])],
      avoidTags: [...(record.preferences.avoidTags || [])],
      spicyLevel: record.preferences.spicyLevel || ""
    };
    applyFoodState(nextSlots, nextPrefs);
    return { nextSlots, nextPrefs };
  }

  function questionsForPrefActions(actions: string[], mealPurpose: string) {
    return prefModificationOrder
      .filter((action) => actions.includes(action))
      .map((action) => buildModifyQuestion(action, mealPurpose))
      .filter((question): question is FoodQuestion => Boolean(question));
  }

  function selectedPrefModifyActions() {
    return prefModifyRows.filter((row) => row.toggleable && !row.keep).map((row) => row.action).filter(Boolean);
  }

  function summaryKeyToQuestionId(key: string) {
    if (key === "mealPurpose") return "mealPurpose";
    if (key === "branchPreference") return activeFoodQuestions.find((question) => question.slot === "branchPreference")?.id || "cuisine-type";
    if (key === "tasteTags" || key === "needTags" || key === "temporaryAvoidTags") {
      return activeFoodQuestions.some((question) => question.id === "taste-feeling" || question.id === "temporary-avoid")
        ? (key === "temporaryAvoidTags" ? "temporary-avoid" : "taste-feeling")
        : "tag-preferences";
    }
    if (key === "avoidTags") return activeFoodQuestions.some((question) => question.id === "restriction") ? "restriction" : "avoid-preferences";
    if (key === "spicyLevel") return activeFoodQuestions.some((question) => question.id === "spice") ? "spice" : "avoid-preferences";
    if (key === "budget") return "budget";
    if (key === "distance") return "distance";
    if (key === "userNotes") return "user-notes";
    return key;
  }

  function jumpToFoodQuestion(key: string, value: string) {
    if (foodFinished || prefCheckRecord || prefModifyRecord || value === "待填写") return;
    const targetId = summaryKeyToQuestionId(key);
    const targetIndex = activeFoodQuestions.findIndex((question) => question.id === targetId || question.slot === targetId);
    if (targetIndex < 0 || targetIndex > foodIndex) return;

    setFoodIndex(targetIndex);
    setManualAnswer("");
    setShowSlotSummaryDetail(false);
    setFoodFinished(false);
    setRecommendations([]);
    setMemoryDecision("");
    setFoodNotice("");
    setFoodAiProgress(null);
    setAdjustmentMessages([]);
  }

  function togglePrefModifyRow(key: string) {
    setPrefModifyRows((rows) => rows.map((row) => row.key === key && row.toggleable ? { ...row, keep: !row.keep } : row));
  }

  async function startPrefModifyFlow(record: PreferenceRecord, actions: string[], label: string) {
    const { nextSlots, nextPrefs } = applyPreferenceRecord(record);
    const questions = questionsForPrefActions(actions, nextSlots.mealPurpose);
    setPrefCheckRecord(null);
    setPrefModifyRecord(null);
    setPrefModifyRows([]);
    setManualAnswer("");
    setShowSlotSummaryDetail(false);

    if (!questions.length) {
      addFoodPreamble(label, "好，已沿用上次偏好。");
      setActiveFoodQuestionIds(null);
      setActiveFoodQuestionOverride(null);
      setFoodFinished(true);
      await generateFoodRecommendations({}, nextSlots, nextPrefs);
      return;
    }

    addFoodPreamble(label, `好的，只调整：${prefModifyRows.filter((row) => actions.includes(row.action)).map((row) => row.label).join("、")}，其他沿用上次偏好。`);
    setActiveFoodQuestionIds(null);
    setActiveFoodQuestionOverride(questions);
    setFoodIndex(0);
    setFoodFinished(false);
  }

  async function usePreferenceRecord(record: PreferenceRecord, shouldRecommend: boolean) {
    const { nextSlots, nextPrefs } = applyPreferenceRecord(record);
    setPrefCheckRecord(null);
    setManualAnswer("");

    if (shouldRecommend) {
      addFoodPreamble("全都按这个来", "好，已沿用上次偏好。");
      setActiveFoodQuestionOverride(null);
      setActiveFoodQuestionIds(null);
      setFoodFinished(true);
      await generateFoodRecommendations({}, nextSlots, nextPrefs);
      return;
    }

    setPrefModifyRecord(record);
    setPrefModifyRows(buildPrefSummaryRows(record));
    addFoodPreamble("部分修改", "好的，我把你上次的偏好带进来了。");
  }

  function skipPreferenceRecord() {
    setPrefCheckRecord(null);
    addFoodPreamble("这次不用历史偏好", "好的，这次不用历史偏好，我们从当前场景继续。");
  }

  function addButlerPreamble(text: string) {
    setFoodPreambleMessages((messages) => [
      ...messages,
      { id: `${Date.now().toString(36)}-butler`, role: "butler", text }
    ]);
  }

  function resolveSubmissionValue(question: FoodQuestion, value?: string) {
    const manual = manualAnswer.trim();

    if (question.id === "mealPurpose") {
      return value || detectMealPurposeFromText(manual) || manual;
    }

    if (question.kind === "tag") {
      const hasTagSelection = Boolean(
        foodPrefs.tasteTags.length ||
        foodPrefs.needTags.length ||
        foodPrefs.temporaryAvoidTags.length ||
        foodPrefs.avoidTags.length ||
        foodPrefs.spicyLevel ||
        manual
      );
      if (!hasTagSelection && !question.optional && !question.allowEmpty) {
        return "";
      }
      return value;
    }

    if (question.kind === "multi-choice" && question.slot) {
      return value || foodSlots[question.slot] || manual || (question.allowEmpty ? "未选择" : "");
    }

    return value || manual || (question.allowEmpty || question.optional ? "未选择" : "");
  }

  async function confirmFoodAnswer(value?: string) {
    const submissionValue = resolveSubmissionValue(currentQuestion, value);
    if (!submissionValue && currentQuestion.kind !== "tag") {
      setFoodNotice("请先选择或填写一个偏好");
      return;
    }

    const { nextSlots, nextPrefs } = buildNextFoodState(currentQuestion, submissionValue);
    applyFoodState(nextSlots, nextPrefs);

    if (foodIndex === 0 && currentQuestion.id === "mealPurpose") {
      const matchedRecord = findMatchingPreferenceRecord(nextSlots.mealPurpose);
      if (matchedRecord) {
        setFoodIndex(1);
        setPrefCheckRecord(matchedRecord);
        setManualAnswer("");
        return;
      }
      addButlerPreamble("还没有可沿用的偏好，我会先问你几个问题。");
      setFoodIndex(1);
      setManualAnswer("");
      return;
    }

    if (foodIndex >= activeFoodQuestions.length - 1) {
      setFoodFinished(true);
      setManualAnswer("");
      await generateFoodRecommendations({}, nextSlots, nextPrefs);
      return;
    }

    setFoodIndex((current) => current + 1);
    setManualAnswer("");
  }

  function resetFoodFlow() {
    setFoodIndex(0);
    setShowSlotSummaryDetail(false);
    setFoodSlots({ mealPurpose: "", branchPreference: "", budget: "", distance: "", userNotes: "" });
    setFoodPrefs({ tasteTags: [], needTags: [], temporaryAvoidTags: [], avoidTags: [], spicyLevel: "" });
    setRecommendations([]);
    setFoodFinished(false);
    setFoodNotice("");
    setFoodAiProgress(null);
    setShowAdjustmentOptions(false);
    setMemoryDecision("");
    setBatchIndex(0);
    setPrefCheckRecord(null);
    setPrefModifyRecord(null);
    setPrefModifyRows([]);
    setActiveFoodQuestionIds(null);
    setActiveFoodQuestionOverride(null);
    setFoodPreambleMessages([]);
    setAdjustmentMessages([]);
  }

  async function rankLocalRestaurants(excludeIds: string[] = [], slots: FoodSlots = foodSlots, prefs: FoodPreferences = foodPrefs) {
    try {
      const result = await requestJson<{ items: Array<Record<string, unknown>> }>("/api/restaurants/rank", {
        method: "POST",
        body: JSON.stringify({
          slots: {
            scene: "soloToday",
            tasteTags: prefs.tasteTags,
            needTags: prefs.needTags,
            avoidTags: [...prefs.temporaryAvoidTags, ...prefs.avoidTags, ...memory.avoidTags],
            budgetMax: budgetMaxFromText(slots.budget || memory.budget),
            maxDistanceKm: distanceKmFromText(slots.distance || memory.distance)
          },
          userMemory: {
            likedTags: records.flatMap((record) => record.preferences.tasteTags).slice(0, 8),
            favoriteShopIds: favorites.map((item) => item.id)
          },
          limit: 8
        })
      });

      return result.items
        .filter((item) => !excludeIds.includes(String(item.id || "")))
        .slice(0, 3)
        .map((item, index) => ({
          id: String(item.id || `ranked_${index}`),
          name: String(item.name || "推荐餐厅"),
          type: String(item.category || "餐饮"),
          perCapita: String(item.avgPrice || "待确认"),
          perCapitaDisplay: formatPrice(String(item.avgPrice || "")),
          distance: item.distanceKm ? `${Math.round(Number(item.distanceKm) * 1000)} m` : "距离待确认",
          rating: Number(item.rating || 4.5),
          matchedTags: Array.isArray(item.matchedTags) ? item.matchedTags.map(String).slice(0, 5) : [],
          reason: Array.isArray(item.rankReasons) ? item.rankReasons.map(String).join("；") : "根据预算、距离和偏好综合匹配。",
          riskTip: Array.isArray(item.riskHints) && item.riskHints.length ? item.riskHints.map(String).slice(0, 2).join("；") : "到店前建议确认营业和排队情况。",
          source: "local-rank"
        }));
    } catch {
      return fallbackRecommendations.filter((item) => !excludeIds.includes(item.id)).slice(0, 3);
    }
  }

  async function generateFoodRecommendations(options: { adjustment?: string; refresh?: boolean } = {}, slots: FoodSlots = foodSlots, prefs: FoodPreferences = foodPrefs) {
    if (!identity) return;
    setFoodLoading(true);
    setFoodNotice("");
    const aiProgressTraceId = createClientAiTraceId("food_recommendation");
    setFoodAiProgress(createClientAiProgress("food_recommendation", aiProgressTraceId));
    let stopProgressPolling = false;
    const progressPolling = pollAiProgress(aiProgressTraceId, identity.sessionToken, setFoodAiProgress, () => stopProgressPolling);
    if (!options.adjustment) {
      setShowAdjustmentOptions(false);
      setAdjustmentMessages([]);
    } else {
      const id = Date.now().toString(36);
      setAdjustmentMessages((messages) => [
        ...messages,
        { id: `${id}-user`, role: "user", text: options.adjustment || "调整一下" },
        { id: `${id}-butler`, role: "butler", text: `收到，我会按「${options.adjustment}」重新筛选。` }
      ]);
    }
    const excludeIds = options.refresh ? recommendations.map((item) => item.id) : [];
    const nextBatch = options.refresh ? batchIndex + 1 : batchIndex;

    try {
      const response = await requestJson<{ recommendations: RecommendationCard[]; diagnostics?: { durationMs?: number; aiProgress?: AiProgressSnapshot } }>("/api/food/recommend", {
        method: "POST",
        body: JSON.stringify({
          aiProgressTraceId,
          slots: {
            mealPurpose: slots.mealPurpose,
            branchPreference: slots.branchPreference,
            budget: slots.budget || memory.budget,
            distance: slots.distance || memory.distance
          },
          preferences: {
            tasteTags: prefs.tasteTags,
            needTags: prefs.needTags,
            avoidTags: [...prefs.temporaryAvoidTags, ...prefs.avoidTags, ...memory.avoidTags],
            spicyLevel: prefs.spicyLevel || memory.spicyLevel
          },
          memoryProfile: {
            enabled: memory.memoryEnabled && memory.permissions.stableFoodMemory,
            stableFoodPreferences: {
              avoidTags: memory.avoidTags,
              spicyLevel: memory.spicyLevel,
              source: "web-demo"
            }
          },
          requestContext: {
            excludeIds,
            batchIndex: nextBatch,
            adjustment: options.adjustment ? { types: [options.adjustment], avoidCategories: [] } : undefined
          }
        })
      }, identity.sessionToken);

      setRecommendations(normalizeCards(response.recommendations || [], favorites));
      setBatchIndex(nextBatch);
      if (response.diagnostics?.aiProgress) {
        setFoodAiProgress(response.diagnostics.aiProgress);
      }
      setFoodNotice(response.diagnostics?.durationMs ? `OpenClaw 已连接 · ${response.diagnostics.durationMs}ms` : "OpenClaw 已连接");
    } catch (error) {
      if (handleAuthError(error)) return;
      setRecommendations(normalizeCards(await rankLocalRestaurants(excludeIds, slots, prefs), favorites));
      setBatchIndex(nextBatch);
      setFoodAiProgress((current) => completeClientAiProgress(current, foodConnection.openclawReachable ? "fallback" : "error", foodConnection.openclawReachable ? "OpenClaw 响应未完成，已先用本地餐厅库兜底。" : "OpenClaw 暂不可用，已切换本地推荐兜底。"));
      setFoodNotice(foodConnection.openclawReachable
        ? "远端 OpenClaw Gateway 可达；当前本地 Web 预览未完成一次管家推荐，已先使用本地餐厅库兜底。"
        : "OpenClaw 暂不可用，已切换本地推荐兜底。");
    } finally {
      stopProgressPolling = true;
      await progressPolling.catch(() => undefined);
      setFoodLoading(false);
      setAdjustmentText("");
    }
  }

  function saveCurrentPreferenceRecord() {
    const record: PreferenceRecord = {
      id: `record_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      summary: summarizeFood(foodSlots, foodPrefs),
      slots: foodSlots,
      preferences: foodPrefs,
      recommendations: recommendations.slice(0, 3)
    };
    persistRecords([record, ...records]);
    setMemoryDecision("kept");
    setFoodNotice("已记住这次偏好，下次首页会展示这条记录。");
  }

  function toggleFavorite(card: RecommendationCard) {
    const key = card.id || card.name;
    const exists = favorites.some((item) => (item.id || item.name) === key);
    const next = exists ? favorites.filter((item) => (item.id || item.name) !== key) : [{ ...card, isFavorited: true }, ...favorites];
    persistFavorites(next);
  }

  async function createGroupTask() {
    if (!identity) return;
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const expectedPeopleCount = Number(customPeopleInput || groupPeople) || 4;
      const result = await requestJson<{ taskId: string; inviteToken: string; board: GroupBoard }>("/api/group-tasks", {
        method: "POST",
        body: JSON.stringify({
          creatorName: identity.displayName || "我",
          rawRequest: `${expectedPeopleCount} 人约饭，时间地点朋友各自填，管家整理冲突后推荐。`,
          locationText: "待商量",
          expectedPeopleCount,
          dinnerTime: "待商量"
        })
      }, identity.sessionToken);
      setGroupTaskId(result.taskId);
      setGroupInviteToken(result.inviteToken);
      setGroupBoard(result.board);
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function submitGroupParticipant(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!groupTaskId || !groupInviteToken) return;
    if (!groupParticipant.nickname.trim()) {
      setGroupNotice("先填一下昵称");
      return;
    }
    if (groupFill.timeMode !== "allDay" && groupFill.startTime >= groupFill.endTime) {
      setGroupNotice("结束时间要晚于开始时间");
      return;
    }
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const clientId = identity?.userId || getOrCreateBrowserJudgeId();
      const hardRequirements = [
        groupFill.priority.hours === "must" && groupFill.timeMode !== "allDay" ? `${groupFill.startTime}-${groupFill.endTime}` : "",
        groupFill.priority.timeText === "must" ? groupFill.timeCustomText : "",
        groupFill.priority.dietary === "must" ? groupFill.dietaryTags.join("、") : "",
        groupFill.restrictionCustomText,
        groupFill.priority.budget === "must" ? `人均 ${groupParticipant.budgetMax || groupFill.budgetTag}` : "",
        groupFill.priority.budget === "must" ? groupFill.budgetCustomText : "",
        groupFill.priority.spicy === "must" ? (groupParticipant.spicyPreference === "no_spicy" ? "不吃辣" : "辣度都可以") : "",
        groupFill.priority.spicy === "must" ? groupFill.spiceCustomText : "",
        groupFill.hardRequirement
      ].filter(Boolean);
      const softPreferences = [
        groupFill.priority.days !== "must" ? groupFill.days.join("、") : "",
        groupFill.priority.timeText !== "must" ? groupFill.timeCustomText : "",
        groupFill.priority.cuisine !== "must" ? groupFill.cuisineTags.join("、") : "",
        groupFill.priority.cuisine !== "must" ? groupFill.cuisineCustomText : "",
        groupFill.priority.budget !== "must" ? groupFill.budgetCustomText : "",
        groupFill.priority.spicy !== "must" ? groupFill.spiceCustomText : "",
        groupFill.softPreference
      ].filter(Boolean);
      const spicyLabel = groupParticipant.spicyPreference === "no_spicy" ? "不辣" : groupParticipant.spicyPreference === "mild" ? "微辣" : groupParticipant.spicyPreference === "spicy" ? "能吃辣" : "都可以";
      const availabilitySummary = `${groupFill.days.join("、") || "待商量"} ${groupFill.timeMode === "allDay" ? "全天有空" : `${groupFill.startTime}-${groupFill.endTime}`}`;
      const rawPreference = [
        groupParticipant.rawPreference,
        `可参与：${availabilitySummary}`,
        groupFill.timeCustomText ? `时间补充：${groupFill.timeCustomText}` : "",
        groupFill.dietaryTags.length ? `忌口：${groupFill.dietaryTags.join("、")}` : "",
        groupFill.restrictionCustomText ? `忌口补充：${groupFill.restrictionCustomText}` : "",
        groupFill.cuisineTags.length ? `想吃：${groupFill.cuisineTags.join("、")}` : "",
        groupFill.cuisineCustomText ? `品类补充：${groupFill.cuisineCustomText}` : "",
        `预算：${groupParticipant.budgetMax || groupFill.budgetTag}`,
        groupFill.budgetCustomText ? `预算补充：${groupFill.budgetCustomText}` : "",
        groupFill.spiceCustomText ? `辣度补充：${groupFill.spiceCustomText}` : "",
        groupFill.hardRequirement ? `必须满足：${groupFill.hardRequirement}` : "",
        groupFill.softPreference ? `希望有：${groupFill.softPreference}` : "",
        `可见性：${groupFill.visibility === "public" ? "公开" : groupFill.visibility === "nickname_only" ? "只显示昵称" : "匿名，仅用于推荐"}`
      ].filter(Boolean).join("；");

      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(groupTaskId)}/participants`, {
        method: "POST",
        body: JSON.stringify({
          inviteToken: groupInviteToken,
          clientId,
          nickname: groupParticipant.nickname,
          visibility: groupFill.visibility,
          rawPreference,
          availabilitySummary,
          availability: {
            availableDays: groupFill.days,
            timeMode: groupFill.timeMode,
            startTime: groupFill.startTime,
            endTime: groupFill.endTime,
            timeCustomText: groupFill.timeCustomText
          },
          dietaryRestrictions: groupFill.dietaryTags.filter((tag) => tag !== "无忌口"),
          cuisinePreferences: groupFill.cuisineTags.filter((tag) => tag !== "都可以"),
          budgetTag: groupFill.budgetTag,
          spicyLabel,
          hardRequirements,
          softPreferences,
          requirementPriorities: groupFill.priority,
          manualFields: {
            budgetMax: Number(groupParticipant.budgetMax) || undefined,
            spicyPreference: groupParticipant.spicyPreference,
            leaveBefore: groupFill.timeMode === "allDay" ? undefined : groupFill.endTime || groupParticipant.leaveBefore || undefined
          }
        })
      }, identity?.sessionToken);
      setGroupBoard(board);
      setView("group-board");
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function generateGroupRecommendation() {
    if (!identity || !groupTaskId || !groupInviteToken) return;
    setGroupLoading(true);
    setGroupNotice("");
    setGroupAiProgress(null);
    const expectedPeople = groupBoard?.task.expectedPeopleCount || groupPeople;
    const submittedCount = groupBoard?.participants.length || 0;
    const aiProgressTraceId = createClientAiTraceId("group_dining");
    setGroupAiProgress(createClientAiProgress(
      "group_dining",
      aiProgressTraceId,
      buildGroupAiProgressSteps(submittedCount, expectedPeople)
    ));
    let stopProgressPolling = false;
    const progressPolling = pollAiProgress(aiProgressTraceId, identity.sessionToken, setGroupAiProgress, () => stopProgressPolling);

    try {
      const board = await requestJson<GroupBoard & { aiProgress?: AiProgressSnapshot; recommendationSource?: "openclaw" | "mock"; openclawStatus?: string }>(`/api/group-tasks/${encodeURIComponent(groupTaskId)}/recommend`, {
        method: "POST",
        body: JSON.stringify({ inviteToken: groupInviteToken, useOpenClaw: true, aiProgressTraceId })
      }, identity.sessionToken);
      setGroupBoard(board);
      if (board.aiProgress) {
        setGroupAiProgress(board.aiProgress);
      }
      if (board.recommendationSource === "openclaw") {
        setGroupNotice("本次多人推荐由 OpenClaw AI 在真实餐厅候选中生成。");
      } else if (board.recommendationSource === "mock") {
        setGroupNotice("OpenClaw 未生效，本次由服务端规则引擎兜底生成。");
      }
      setGroupAdjustmentRequests([]);
      setAdjustmentTargetCandidate(null);
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
        setGroupAiProgress((current) => completeClientAiProgress(current, "error", "多人约饭推荐生成失败。", error instanceof Error ? error.message : String(error)));
      }
    } finally {
      stopProgressPolling = true;
      await progressPolling.catch(() => undefined);
      setGroupLoading(false);
    }
  }

  async function refreshGroupBoard() {
    if (!groupTaskId || !groupInviteToken) return;
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(groupTaskId)}?inviteToken=${encodeURIComponent(groupInviteToken)}`, {}, identity?.sessionToken);
      setGroupBoard(board);
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function aiFillGroupFriends() {
    if (!identity || !groupTaskId || !groupInviteToken) return;
    const expectedPeople = groupBoard?.task.expectedPeopleCount || groupPeople;
    const submittedCount = groupBoard?.participants.length || 0;
    const missingPeople = Math.max(0, expectedPeople - submittedCount);

    if (expectedPeople > 5) {
      setGroupNotice("AI 辅助填写目前只支持 5 人以内的小局。当前人数较多，建议邀请朋友自己填写，或新建 5 人以内任务体验。");
      return;
    }

    if (missingPeople <= 0) {
      setGroupNotice("当前成员偏好已经收齐，可以直接生成推荐。");
      return;
    }

    setGroupLoading(true);
    setGroupNotice("");

    try {
      const result = await requestJson<{ board: GroupBoard; generatedCount: number; remainingCount: number }>(
        `/api/group-tasks/${encodeURIComponent(groupTaskId)}/participants/ai-fill`,
        {
          method: "POST",
          body: JSON.stringify({ inviteToken: groupInviteToken })
        },
        identity.sessionToken
      );
      setGroupBoard(result.board);
      setGroupNotice(result.generatedCount > 0 ? `AI 已填写 ${result.generatedCount} 位朋友偏好，可以继续生成推荐。` : "当前成员偏好已经收齐，可以直接生成推荐。");
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function createWeekendPlan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!identity) return;
    const validation = validateWeekendForm(weekendForm);
    if (!validation.ok) {
      setWeekendError(validation.message);
      setWeekendNotice("");
      setWeekendPlan(null);
      setWeekendAiProgress(null);
      return;
    }

    setWeekendLoading(true);
    setWeekendNotice("");
    setWeekendError("");
    const aiProgressTraceId = createClientAiTraceId("weekend_plan");
    setWeekendAiProgress(createClientAiProgress("weekend_plan", aiProgressTraceId));
    let stopProgressPolling = false;
    const progressPolling = pollAiProgress(aiProgressTraceId, identity.sessionToken, setWeekendAiProgress, () => stopProgressPolling);

    const payload = {
      ...weekendForm,
      aiProgressTraceId,
      timeWindow: validation.timeWindow,
      isAllDay: weekendForm.timeMode === "allDay",
      budgetMax: validation.budgetMax,
      rawText: weekendForm.rawText || `${weekendForm.mood}，${weekendForm.energyLevel}，和${weekendForm.companions}一起。`
    };

    try {
      const plan = await requestJson<WeekendPlan & { aiProgress?: AiProgressSnapshot }>("/api/weekend/plans", {
        method: "POST",
        body: JSON.stringify(payload)
      }, identity.sessionToken);
      setWeekendPlan(plan);
      if (plan.aiProgress) {
        setWeekendAiProgress(plan.aiProgress);
      }
      setWeekendNotice(plan.weather?.fallback ? "天气或外部服务不可用，后端已生成保守路线。" : "已生成路线，可以复制喜欢的邀约文案。");
    } catch (error) {
      if (handleAuthError(error)) return;
      setWeekendPlan(buildLocalWeekendPlan(weekendForm));
      setWeekendAiProgress((current) => completeClientAiProgress(current, "fallback", "后端规划暂不可用，已切到本地路线兜底。", error instanceof Error ? error.message : String(error)));
      setWeekendNotice("后端不可用，已切换本地路线。");
    } finally {
      stopProgressPolling = true;
      await progressPolling.catch(() => undefined);
      setWeekendLoading(false);
    }
  }

  function updateWeekendForm(patch: Partial<typeof defaultWeekendForm>) {
    setWeekendForm((current) => ({ ...current, ...patch }));
    setWeekendError("");
  }

  function toggleWeekendInterest(value: string) {
    setWeekendForm((current) => ({
      ...current,
      interests: current.interests.includes(value)
        ? current.interests.filter((item) => item !== value)
        : [...current.interests, value]
    }));
    setWeekendError("");
  }

  function renderPhone() {
    let content: ReactNode;

    if (view === "home") {
      content = renderHomePage();
    } else if (view === "group-fill") {
      content = renderGroupFillPage();
    } else if (view === "group-board" && groupTaskId && groupInviteToken) {
      content = renderGroupBoardPage();
    } else if (!identity || view === "login") {
      content = renderLoginPage();
    } else if (view === "food") {
      content = renderFoodPage();
    } else if (view === "group-create") {
      content = renderGroupCreatePage();
    } else if (view === "weekend") {
      content = renderWeekendPage();
    } else {
      content = renderMemoryPage();
    }

    return (
      <>
        {view !== "home" ? (
          <button className="phone-home-shortcut" onClick={goHome} type="button" aria-label="返回手机首页">首页</button>
        ) : null}
        {content}
        {copyToast ? (
          <div className={`copy-toast ${copyToast.tone === "error" ? "error" : ""}`} role="status" aria-live="polite">
            {copyToast.message}
          </div>
        ) : null}
      </>
    );
  }

  function getFoodQuestionBubbleText(question: FoodQuestion, answeredCount = foodIndex) {
    if (question.id === "mealPurpose" && answeredCount === 0) {
      return "这次是什么用餐场景？";
    }
    return question.title;
  }

  function getFoodAnswerValue(question: FoodQuestion) {
    if (question.id === "tag-preferences" || question.id === "taste-feeling") {
      return [
        foodPrefs.tasteTags.length ? `口味：${foodPrefs.tasteTags.join("、")}` : "",
        foodPrefs.needTags.length ? `感觉：${foodPrefs.needTags.join("、")}` : "",
        question.id === "tag-preferences" && foodPrefs.temporaryAvoidTags.length ? `这次不想吃：${foodPrefs.temporaryAvoidTags.join("、")}` : ""
      ].filter(Boolean).join("；");
    }
    if (question.id === "temporary-avoid") {
      return foodPrefs.temporaryAvoidTags.length ? `这次不想吃：${foodPrefs.temporaryAvoidTags.join("、")}` : "";
    }
    if (question.id === "avoid-preferences" || question.id === "restriction" || question.id === "spice") {
      return [
        question.id !== "spice" && foodPrefs.avoidTags.length ? `忌口：${foodPrefs.avoidTags.join("、")}` : "",
        question.id !== "restriction" && foodPrefs.spicyLevel ? `辣度：${foodPrefs.spicyLevel}` : ""
      ].filter(Boolean).join("；");
    }
    if (question.id === "tasteTags") return foodPrefs.tasteTags.join("、");
    if (question.id === "needTags") return foodPrefs.needTags.join("、");
    if (question.id === "temporaryAvoidTags") return foodPrefs.temporaryAvoidTags.join("、");
    if (question.id === "avoidTags") return foodPrefs.avoidTags.join("、");
    if (question.id === "spicyLevel") return foodPrefs.spicyLevel;
    if (question.slot) {
      return foodSlots[question.slot];
    }
    return "";
  }

  function renderAnsweredFoodMessages() {
    const answeredCount = foodFinished ? activeFoodQuestions.length : foodIndex;
    const preamble = foodPreambleMessages.map((message) => (
      <div className={`chat-message ${message.role === "user" ? "user-message" : "butler-message"}`} key={message.id}>
        {message.role === "butler" ? <div className="message-avatar ai-mark">幺</div> : null}
        <div className={`message-content ${message.role === "user" ? "user-content" : "butler-content"}`}>
          <div className={`chat-bubble ${message.role === "user" ? "user-bubble" : "butler-bubble"}`}>{message.text}</div>
        </div>
      </div>
    ));
    const answers = activeFoodQuestions.slice(0, answeredCount).map((question) => (
      <div className="chat-message user-message" key={`answer-${question.id}`}>
        <div className="message-content user-content">
          <div className="chat-bubble user-bubble">{foodAnswerLabels[question.id] || question.label || "你的选择"}：{getFoodAnswerValue(question) || "未选择"}</div>
        </div>
      </div>
    ));
    return [...preamble, ...answers];
  }

  function renderThemeListPanel() {
    return (
      <aside className="review-panel theme-list-panel" aria-label="六主题统一换肤">
        <div className="tlp-head">
          <span
            className="tlp-mark"
            style={{ "--orb-primary": activeTheme.primary, "--orb-soft": activeTheme.soft, "--orb-accent": activeTheme.accent } as CSSProperties}
          />
          <div>
            <div className="tlp-eyebrow">统一主题服务</div>
            <div className="tlp-title">六主题换肤</div>
          </div>
        </div>
        <p className="tlp-desc">Web 外壳与手机界面共用同一份主题状态，刷新后保留当前选择。</p>
        <div className="theme-list">
          {themeCards.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <button
                aria-pressed={selected}
                className={`tl-row ${selected ? "active" : ""}`}
                key={theme.id}
                onClick={(event) => selectTheme(theme.id, event)}
                style={{ "--tl-primary": theme.primary, "--tl-soft": theme.soft, "--tl-accent": theme.accent } as CSSProperties}
                type="button"
              >
                <span className="tl-swatch" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="tl-meta">
                  <span className="tl-name">{theme.name}</span>
                  <span className="tl-key">{theme.description}</span>
                </span>
                <span className="tl-check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>
        <div className="tlp-sync"><span className="lk" /><span>右侧列表与手机内「主题换装」同步。</span></div>
      </aside>
    );
  }

  return (
    <main className={`experience-stage ${themeClass}`}>
      <div className="experience-shell">
        <aside className="review-panel">
          <a className="panel-link" href="/">作品首页</a>
          <h1>饿了幺 AI 管家</h1>
          <p>当前身份：{identity?.displayName || "未登录"}</p>
          <p className="mono">demoId: {identity?.demoUserId || judgeIdInput || browserJudgeId || "待生成"}</p>
          <p className="mono">userId: {identity?.userId || "等待登录"}</p>
          <a className="panel-outline-button compact" href="/">回到四象限首页</a>
          <p className="desktop-preview-note">{desktopPreviewTip}</p>
          <form className="identity-form" onSubmit={handleIdentitySubmit}>
            <label className="identity-label" htmlFor="judge-id-panel">评委 ID</label>
            <input
              className="identity-input"
              id="judge-id-panel"
              maxLength={40}
              onChange={(event) => setJudgeIdInput(event.target.value)}
              placeholder={browserJudgeId || "judge-auto"}
              value={judgeIdInput}
            />
            <p className="identity-hint">不填会使用当前浏览器生成的本地匿名 ID；手动输入可复现同一评委身份。</p>
            {identityNotice ? <div className="identity-notice">{identityNotice}</div> : null}
            <button className="panel-outline-button compact" disabled={authLoading} onClick={startIdentityLogin} type="button">{authLoading ? "进入中..." : identity ? "切换评委身份" : "进入 demo 身份"}</button>
          </form>
          {identity ? <button className="panel-outline-button muted" onClick={logout} type="button">退出 demo 身份</button> : null}
        </aside>

        <section className="phone-frame" aria-label="小程序复刻预览">
          <div className="phone-screen">{renderPhone()}</div>
        </section>

        <div className="right-col">
          <aside className="review-panel right-panel">
            <h2>当前体验状态</h2>
            <p>最近偏好记录：{records.length} 条</p>
            <p>收藏店铺：{favorites.length} 家</p>
            <p>多人约饭任务：{groupTaskId || "未创建"}</p>
            <p>周末规划：{weekendPlan?.planId || "未生成"}</p>
            <h2>验收覆盖</h2>
            <p>登录/demo 身份初始化</p>
            <p>首页、历史、收藏、主题</p>
            <p>今天吃什么问答与推荐</p>
            <p>多人约饭创建、填写、看板</p>
            <p>周末规划生成与 fallback</p>
            <p>记忆设置与本地持久化</p>
          </aside>
          {renderThemeListPanel()}
        </div>
      </div>

      <button className="review-fab" onClick={() => setShowReviewSheet(true)} type="button" aria-label="评审说明">
        <span className="review-fab-icon">i</span>
        <span className="review-fab-text">评审说明</span>
      </button>
      <div className={`review-sheet-mask ${showReviewSheet ? "is-open" : ""}`} onClick={() => setShowReviewSheet(false)} />
      <div className={`review-sheet ${showReviewSheet ? "is-open" : ""}`} role="dialog" aria-label="评审说明">
        <div className="review-sheet-grip" />
        <div className="review-sheet-scroll">
          <a className="panel-link" href="/">作品首页</a>
          <h1>饿了幺 AI 管家</h1>
          <p>当前身份：{identity?.displayName || "未登录"}</p>
          <p className="mono">demoId: {identity?.demoUserId || judgeIdInput || browserJudgeId || "待生成"}</p>
          <p className="mono">userId: {identity?.userId || "等待登录"}</p>
          <a className="panel-outline-button compact" href="/">回到四象限首页</a>
          <p className="desktop-preview-note">{desktopPreviewTip}</p>
          <h2>当前体验状态</h2>
          <p>最近偏好记录：{records.length} 条 · 收藏店铺：{favorites.length} 家</p>
          <p>多人约饭任务：{groupTaskId || "未创建"} · 周末规划：{weekendPlan?.planId || "未生成"}</p>
          <h2>验收覆盖</h2>
          <p>登录 · 首页/历史/收藏/主题 · 今天吃什么 · 多人约饭 · 周末规划 · 记忆持久化</p>
          {identity ? <button className="panel-outline-button" onClick={logout} type="button">退出 demo 身份</button> : null}
          <button className="review-sheet-close" onClick={() => setShowReviewSheet(false)} type="button">收起</button>
        </div>
      </div>
    </main>
  );

  function renderLoginPage() {
    return (
      <div className="page login-page">
        <div className="login-content">
          <div className="brand-block">
            <div className="brand-mark ai-mark">幺</div>
            <div className="brand-name">饿了幺</div>
            <div className="brand-subtitle">藏在小程序里的 AI 本地生活管家</div>
          </div>

          <div className="login-copy">
            <div className="login-title">选择评委 Demo 身份</div>
            <div className="login-desc">输入评委 ID 后会建立独立会话、画像和本地偏好；不填写时使用当前浏览器生成的匿名 ID。</div>
          </div>

          <div className="mvp-note">
            <div className="note-icon">i</div>
            <div className="note-text">当前为 MVP 演示版本，评委身份只用于隔离 Demo 数据，不采集硬件指纹。</div>
          </div>

          <div className="mvp-note preview-note">
            <div className="note-icon">桌</div>
            <div className="note-text">{desktopPreviewTip}</div>
          </div>

          {authError ? <div className="inline-error">{authError}</div> : null}

          <form className="login-actions" onSubmit={handleIdentitySubmit}>
            <label className="login-label" htmlFor="judge-id-login">评委 ID</label>
            <input
              className="login-input"
              id="judge-id-login"
              maxLength={40}
              onChange={(event) => setJudgeIdInput(event.target.value)}
              placeholder={browserJudgeId || "judge-auto"}
              value={judgeIdInput}
            />
            {authLoading ? <div className="login-status" role="status">正在建立 Demo 身份，请稍等...</div> : null}
            <button aria-busy={authLoading} className={`login-button ${authLoading ? "loading" : ""}`} disabled={authLoading} onClick={startIdentityLogin} type="button">{authLoading ? "正在进入..." : "进入在线体验"}</button>
            <div className="login-tip">同一 ID 会复用同一份后端账号画像，方便评委多次回到同一体验状态。</div>
          </form>
        </div>
      </div>
    );
  }

  function renderHomePage() {
    return (
      <div className="page home-page">
        <div className="home-topline">
          <span className="hello-muted">你好，</span>
          <span className="hello-name">小幺</span>
        </div>

        <div className="home-hero">
          <div className="section-title">今天需要管家帮什么？</div>
          <div className="section-desc">从一个人吃什么，到多人约饭和周边规划，<span className="line-break"></span>先给你 2-3 个可执行方案。</div>
        </div>

        <div className="utility-row">
          <button className="utility-chip" onClick={() => setShowThemePanel(true)} type="button"><span className="utility-icon">◐</span><span>主题换装</span></button>
          <button className="utility-chip" onClick={() => setShowFavoritesPanel(true)} type="button"><span className="utility-icon">★</span><span>店铺收藏</span></button>
        </div>

        <button className="primary-entry" onClick={() => setView("food")} type="button">
          <span className="primary-glow"></span>
          <span className="primary-mark ai-mark">幺</span>
          <span className="primary-eyebrow">AI 管家 · 主入口</span>
          <span className="primary-title">今天吃什么</span>
          <span className="primary-desc">问 4-7 个小问题，给你 2-3 个匹配场景、预算和忌口的方案</span>
          <span className="primary-cta"><span>开始问答</span><span className="cta-arrow">→</span></span>
        </button>

        <div className="secondary-grid">
          <button className="secondary-entry" onClick={() => setView("group-create")} type="button">
            <span className="entry-badge entry-badge-live">可联调</span>
            <span className="secondary-icon group-icon">饭</span>
            <span className="secondary-title">发起约饭</span>
            <span className="secondary-desc">创建任务 · 分享填写 · 生成推荐</span>
          </button>
          <button className="secondary-entry" onClick={() => setView("weekend")} type="button">
            <span className="entry-badge">周边 · 时间 · 天气适配</span>
            <span className="secondary-icon weekend-icon">周</span>
            <span className="secondary-title">周边规划</span>
            <span className="secondary-desc">按时间、预算和兴趣安排轻路线</span>
          </button>
        </div>

        <button className="memory-entry" onClick={() => setView("memory")} type="button">
          <span className="memory-icon ai-mark">♡</span>
          <span className="memory-copy">
            <span className="memory-title">管家记忆</span>
            <span className="memory-desc">忌口、辣度与偏好授权</span>
          </span>
          <span className="memory-arrow">›</span>
        </button>

        <div className="recent-block">
          <div className="recent-head">
            <span>偏好记录</span>
            <button className="recent-link" onClick={() => setShowHistoryPanel(true)} type="button">全部记录 ›</button>
          </div>
          <button className="recent-card" onClick={() => setShowHistoryPanel(true)} type="button">
            <span className="recent-title-row">
              <span className="recent-title">{recentRecord ? recentRecord.slots.mealPurpose || "用餐偏好" : "还没有偏好记录"}</span>
              <span className="recent-time">{recentRecord ? new Date(recentRecord.createdAt).toLocaleString() : "等待体验"}</span>
            </span>
            <span className="recent-summary">{recentRecord ? recentRecord.summary : "在结果页选择「记住这个偏好」后，我会把你的偏好帮你记下来。"}</span>
          </button>
        </div>

        {showThemePanel ? renderThemePanel() : null}
        {showHistoryPanel ? renderHistoryPanel() : null}
        {showFavoritesPanel ? renderFavoritesPanel() : null}
      </div>
    );
  }

  function renderFoodPage() {
    return (
      <div className="page food-page">
        <div className="custom-food-header">
          <div className="food-nav-row">
            <button className="header-back-hit" onClick={goHome} type="button"><span className="header-back-button">‹</span></button>
            <div className="food-nav-title">今天吃什么</div>
          </div>
          <button className={`header-online-status ${foodConnection.className}`} onClick={() => void refreshFoodConnectionStatus()} title={foodConnection.detail} type="button">
            <span className="header-online-dot"></span>
            <span className="header-online-text">{foodConnection.text}</span>
          </button>
        </div>

        <div className="chat-body">
          {!foodFinished && !prefCheckRecord && !prefModifyRecord ? (
            <div className="progress-strip">
              <div className="progress-copy">
                <span>第 {foodIndex + 1} / {activeFoodQuestions.length} 题</span>
                {currentQuestion.optional || currentQuestion.allowEmpty ? <span className="optional-hint">可跳过</span> : null}
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPercent}%` }}></div></div>
            </div>
          ) : null}

          <div className="chat-thread">
            {renderAnsweredFoodMessages()}
            {prefCheckRecord ? renderPreferenceCheck(prefCheckRecord) : prefModifyRecord ? renderPreferenceModify() : !foodFinished ? renderQuestionMessage() : renderFoodResult()}
          </div>
        </div>

        {!foodFinished && !prefCheckRecord && !prefModifyRecord ? renderReplyDock() : null}
        {foodFinished ? renderResultActions() : null}
      </div>
    );
  }

  function renderPreferenceCheck(record: PreferenceRecord) {
    return (
      <div className="chat-message butler-message pref-check-message">
        <div className="message-avatar ai-mark">幺</div>
        <div className="message-content butler-content">
          <div className="pref-check-card">
            <div className="pref-check-title">我找到你上次「{record.slots.mealPurpose || "这类场景"}」的偏好：</div>
            <div className="pref-summary-block">
              {buildPrefSummaryRows(record).map((row) => (
                <div className="pref-summary-row" key={row.key}>
                  <span className="pref-summary-label">{row.label}</span>
                  <span className="pref-summary-value">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="pref-check-prompt">这次要沿用这些偏好吗？</div>
          </div>
          <div className="inline-replies pref-check-actions">
            <div className="quick-list">
              <button className="quick-chip pref-check-chip" onClick={() => void usePreferenceRecord(record, true)} type="button">全都按这个来</button>
              <button className="quick-chip pref-check-chip" onClick={skipPreferenceRecord} type="button">这次不用历史偏好</button>
              <button className="quick-chip pref-check-chip" onClick={() => void usePreferenceRecord(record, false)} type="button">部分修改</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPreferenceModify() {
    if (!prefModifyRecord) return null;
    const modifyCount = prefModifyRows.filter((row) => row.toggleable && !row.keep).length;
    const actions = selectedPrefModifyActions();

    return (
      <div className="chat-message butler-message pref-modify-message">
        <div className="message-avatar ai-mark">幺</div>
        <div className="message-content butler-content">
          <div className="pref-modify-panel">
            <div className="pref-modify-title">已为你带入以下偏好：</div>
            <div className="pref-summary-block pref-summary-interactive">
              {prefModifyRows.map((row) => (
                <div className={`pref-summary-row ${row.toggleable && !row.keep ? "to-modify" : ""}`} key={row.key}>
                  <span className="pref-summary-label">{row.label}</span>
                  <span className="pref-summary-value">{row.value}</span>
                  {row.toggleable ? (
                    <button className={`pref-keep-toggle ${row.keep ? "kept" : "modify"}`} onClick={() => togglePrefModifyRow(row.key)} type="button">{row.keep ? "保留" : "要修改"}</button>
                  ) : (
                    <span className="pref-keep-static">本次</span>
                  )}
                </div>
              ))}
            </div>
            <div className="pref-modify-hint">默认全部「保留」沿用。点右侧切换为「要修改」，确认后我只会重新问这几项。</div>
            <button className="pref-modify-submit pref-modify-primary" onClick={() => void startPrefModifyFlow(prefModifyRecord, actions, "直接按这些推荐")} type="button">直接按这些推荐</button>
            <button className="pref-modify-submit pref-modify-secondary" disabled={modifyCount === 0} onClick={() => void startPrefModifyFlow(prefModifyRecord, actions, "修改这些")} type="button">确定修改这些{modifyCount > 0 ? `（${modifyCount}）` : ""}</button>
          </div>
        </div>
      </div>
    );
  }

  function renderQuestionMessage() {
    const selectedValue = currentQuestion.slot ? foodSlots[currentQuestion.slot] : foodPrefs[currentQuestion.id as keyof FoodPreferences];
    const selectedMultiValues = currentQuestion.kind === "multi-choice" && typeof selectedValue === "string"
      ? selectedValue.split("、").map((item) => item.trim()).filter(Boolean).filter((item) => item !== "未选择")
      : [];
    return (
      <div className="chat-message butler-message">
        <div className="message-avatar ai-mark">幺</div>
        <div className="message-content butler-content">
          <div className="chat-bubble butler-bubble">{getFoodQuestionBubbleText(currentQuestion)}</div>
          <div className="inline-replies">
            {currentQuestion.groups ? (
              <div className="quick-groups">
                {currentQuestion.groups.map((group) => (
                  <div className="tag-group" key={group.type}>
                    <div className="tag-group-title">{group.title}</div>
                    <div className="quick-list">
                      {group.tags.map((tag) => {
                        const selected = isFoodTagSelected(group.type, tag.label);
                        return (
                          <button
                            aria-pressed={selected}
                            className={`quick-chip tag-chip ${selected ? "selected" : ""}`}
                            key={tag.id}
                            onClick={() => toggleFoodTagByType(group.type, tag.label, group.mode)}
                            type="button"
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : currentQuestion.text ? null : (
              <div className="quick-list">
                {(currentQuestion.options || []).map((option) => {
                  const active = selectedMultiValues.length
                    ? selectedMultiValues.includes(option)
                    : Array.isArray(selectedValue) ? selectedValue.includes(option) : selectedValue === option;
                  return (
                    <button
                      aria-pressed={active}
                      className={`quick-chip option-button ${active ? "selected" : ""}`}
                      key={option}
                      onClick={() => currentQuestion.kind === "multi-choice" ? toggleFoodMultiChoiceOption(currentQuestion, option) : currentQuestion.multi ? toggleFoodTag(currentQuestion.id, option) : void confirmFoodAnswer(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderReplyDock() {
    return (
      <div className="reply-dock">
        {foodIndex > 0 ? (
          <div className="reply-top-row">
            <button className="back-button" onClick={() => setFoodIndex(Math.max(0, foodIndex - 1))} type="button">上一题</button>
          </div>
        ) : null}

        <div className="slot-summary-card">
          <div className="slot-summary-bar">
            <div className="slot-summary-text">{summarizeFood(foodSlots, foodPrefs) || "还没有填写条件"}</div>
            <button className="slot-summary-toggle" onClick={() => setShowSlotSummaryDetail((current) => !current)} type="button">{showSlotSummaryDetail ? "收起" : "查看"}</button>
          </div>
          <div className="slot-summary-hint">当前条件仅用于本次推荐，你可以在结果页选择是否长期记住</div>
          {showSlotSummaryDetail ? (
            <div className="slots-panel">
              <div className="slots-title">完整需求状态</div>
              {summaryFields.map((row) => (
                <button className={`slot-row ${row.value === "待填写" ? "disabled" : ""}`} key={row.key} onClick={() => jumpToFoodQuestion(row.key, row.value)} type="button">
                  <span className="slot-label">{row.label}</span>
                  <span className="slot-value">{row.value}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="manual-entry-label">想自己说？直接输入</div>
        <div className="input-bar">
          <input className="manual-input chat-input" value={manualAnswer} onChange={(event) => setManualAnswer(event.target.value)} placeholder="也可以直接告诉我你的想法" />
          <button className="send-button" onClick={() => void confirmFoodAnswer(manualAnswer || (currentQuestion.text ? "没有补充" : undefined))} type="button">发送</button>
        </div>
      </div>
    );
  }

  function renderFoodResult() {
    return (
      <>
        <div className="chat-message butler-message">
          <div className="message-avatar ai-mark">幺</div>
          <div className="chat-bubble butler-bubble">我明白啦，会结合你的场景、预算、距离和偏好，给你 2-3 个可执行方案。</div>
        </div>
        {adjustmentMessages.map((message) => (
          <div className={`chat-message ${message.role === "user" ? "user-message" : "butler-message"}`} key={message.id}>
            {message.role === "butler" ? <div className="message-avatar ai-mark">幺</div> : null}
            <div className={`message-content ${message.role === "user" ? "user-content" : "butler-content"}`}>
              <div className={`chat-bubble ${message.role === "user" ? "user-bubble" : "butler-bubble"}`}>{message.text}</div>
            </div>
          </div>
        ))}
        {foodNotice ? <div className="recommendation-notice">{foodNotice}</div> : null}
        {renderAiProgressCard(foodAiProgress, foodAiProgressSummary)}
        {foodLoading && !recommendations.length ? (
          <div className="recommendation-loading-card">
            <span className="loading-dot"></span>
            <span>管家正在结合预算、距离和偏好生成推荐...</span>
          </div>
        ) : (
          <div className="recommendation-list">
          {(recommendations.length ? recommendations : fallbackRecommendations).map((card, index) => (
            <div className={`shop-card ${index === 0 ? "featured" : ""}`} key={card.id || card.name}>
              <div className="shop-header">
                <div className="shop-title-wrap">
                  {index === 0 ? <div className="shop-rank">首推</div> : null}
                  <div className="shop-name">{card.name}</div>
                </div>
                <div className="shop-header-right">
                  <div className="shop-type">{card.type}</div>
                  <button className={`shop-fav-btn ${card.isFavorited ? "favorited" : ""}`} onClick={() => toggleFavorite(card)} type="button">{card.isFavorited ? "★" : "☆"}</button>
                </div>
              </div>
              <div className="shop-meta">
                <div>{card.perCapitaDisplay || formatPrice(card.perCapita)}</div>
                <div>{card.distance}</div>
                <div>评分 {card.rating}</div>
              </div>
              <div className="matched-tags-row">
                <span className="shop-section-label">匹配点</span>
                <div className="matched-tags">
                  {(card.matchedTags || []).slice(0, 5).map((tag) => <span className="matched-tag" key={tag}>{tag}</span>)}
                  {!(card.matchedTags || []).length ? <span className="matched-tag muted">默认推荐</span> : null}
                </div>
              </div>
              <div className="shop-reason"><span className="shop-section-label">为什么推荐</span>{card.reason}</div>
              <div className="shop-risk"><span className="shop-section-label">管家提醒</span>{card.riskTip}</div>
            </div>
          ))}
          </div>
        )}

        {showAdjustmentOptions ? (
          <div className="chat-message butler-message adjustment-message">
            <div className="message-avatar ai-mark">幺</div>
            <div className="message-content butler-content">
              <div className="chat-bubble butler-bubble">哪里不满意呀？我可以按这些方向帮你调整：</div>
              <div className="adjustment-options">
                {["太贵了", "太远了", "想清淡一点", "想换个品类"].map((label) => (
                  <button className="adjustment-chip" key={label} onClick={() => void generateFoodRecommendations({ adjustment: label, refresh: true })} type="button">{label}</button>
                ))}
              </div>
              <div className="adjustment-input-row">
                <input className="adjustment-input" value={adjustmentText} onChange={(event) => setAdjustmentText(event.target.value)} placeholder="也可以直接告诉我哪里不满意" />
                <button className="adjustment-submit" onClick={() => void generateFoodRecommendations({ adjustment: adjustmentText || "调整", refresh: true })} type="button">发送</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function renderResultActions() {
    return (
      <div className="result-actions-wrap">
        {!memoryDecision ? (
          <div className="memory-actions">
            <div className="memory-actions-hint">这次的偏好要不要长期记住？长期记忆完全由你决定。</div>
            <div className="memory-actions-row">
              <button className="memory-keep-button" onClick={saveCurrentPreferenceRecord} type="button">记住这个偏好</button>
              <button className="memory-once-button" onClick={() => setMemoryDecision("session-only")} type="button">仅本次使用</button>
            </div>
          </div>
        ) : (
          <div className="memory-decision-note">{memoryDecision === "kept" ? "已加入长期偏好" : "本次条件不会写入长期偏好"}</div>
        )}

        <div className="result-actions">
          <button className="secondary-action-button" disabled={foodLoading} onClick={() => void generateFoodRecommendations({ refresh: true })} type="button">{foodLoading ? "生成中" : "换一批"}</button>
          <button className="restart-button" onClick={() => setShowAdjustmentOptions(true)} type="button">调整一下</button>
          <button className="tertiary-action-button" onClick={resetFoodFlow} type="button">重新开始</button>
        </div>
      </div>
    );
  }

  function renderGroupCreatePage() {
    const createdTask = Boolean(groupTaskId && groupInviteToken);
    return (
      <div className="page scaffold-page create-scaffold">
        <div className="create-hero">
          <div className="create-nav-row">
            <button className="group-nav-back-hit" onClick={goHome} type="button"><span className="group-nav-back-button create-back"><span className="group-nav-back-icon create-back-icon">‹</span></span></button>
            <div className="page-heading create-heading"><div className="page-title">{createdTask ? "任务已生成" : "发起约饭"}</div></div>
          </div>
          <div className="create-hero-subtitle">{createdTask ? "现在可以分享到群里，或直接查看偏好收集进度。" : "选一下人数就能生成任务链接，朋友点开就能填偏好。"}</div>
        </div>

        <div className="status-badge"><span className="status-dot"></span><span>极简发起 · 后端联调</span></div>

        {!createdTask ? (
          <>
            <div className="panel-card">
              <div className="field">
                <div className="field-label">预计几个人？</div>
                <div className="option-grid people-grid">
                  {[2, 3, 4, 5, 6, 8].map((value) => (
                    <button className={`option-cell ${groupPeople === value ? "active" : ""}`} key={value} onClick={() => setGroupPeople(value)} type="button">{value}人</button>
                  ))}
                </div>
                <div className="field-hint">不在列表里？下面也可以直接填数字。</div>
              </div>
              <div className="field last">
                <div className="field-label">自定义人数</div>
                <input className="field-input" type="number" value={customPeopleInput} onChange={(event) => setCustomPeopleInput(event.target.value)} placeholder="例如 12" />
              </div>
            </div>
            <div className="panel-card">
              <div className="field-label">关于其他字段</div>
              <div className="field-hint">时间、地点、口味会让朋友各自填。管家会自动整理冲突，并给出一个最终方案。</div>
            </div>
            {groupNotice ? <div className="inline-error">{groupNotice}</div> : null}
            <button className="primary-button" disabled={groupLoading} onClick={() => void createGroupTask()} type="button">{groupLoading ? "生成中..." : "生成任务链接"}</button>
          </>
        ) : (
          <>
            <div className="panel-card">
              <div className="field-label">{groupBoard?.task.title || "多人约饭偏好收集中"}</div>
              <div className="field-hint">{groupBoard?.task.rawRequest || "发起人邀请大家填写约饭偏好"}</div>
              <div className="chip-row">
                <div className="info-chip">{groupBoard?.task.expectedPeopleCount || groupPeople} 人</div>
                <div className="info-chip soft">{groupBoard?.participants.length || 0}/{groupBoard?.task.expectedPeopleCount || groupPeople} 已提交</div>
                <div className="info-chip">点击填写偏好</div>
              </div>
            </div>
            <div className="button-stack">
              <button className="primary-button" onClick={() => setView("group-fill")} type="button">我也填写偏好</button>
              <button className="primary-button" onClick={copyGroupShareLink} type="button">分享到群里</button>
              <button className="primary-button" onClick={() => setView("group-board")} type="button">查看任务看板</button>
              <button className="primary-button" onClick={() => { setGroupTaskId(""); setGroupInviteToken(""); setGroupBoard(null); setGroupAiProgress(null); }} type="button">再发起一个</button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderGroupFillPage() {
    const priorityOptions = [
      { value: "must", label: "必须满足" },
      { value: "nice", label: "希望满足" }
    ];
    const hardRequirements = [
      groupFill.priority.hours === "must" && groupFill.timeMode !== "allDay" ? `${groupFill.startTime}-${groupFill.endTime}` : "",
      groupFill.priority.timeText === "must" ? groupFill.timeCustomText : "",
      groupFill.priority.dietary === "must" ? groupFill.dietaryTags.join("、") : "",
      groupFill.restrictionCustomText,
      groupFill.priority.budget === "must" ? `人均 ${groupParticipant.budgetMax || groupFill.budgetTag}` : "",
      groupFill.priority.budget === "must" ? groupFill.budgetCustomText : "",
      groupFill.priority.spicy === "must" ? (groupParticipant.spicyPreference === "no_spicy" ? "不吃辣" : "辣度都可以") : "",
      groupFill.priority.spicy === "must" ? groupFill.spiceCustomText : "",
      groupFill.hardRequirement
    ].filter(Boolean);
    const softPreferences = [
      groupFill.priority.days !== "must" ? groupFill.days.join("、") : "",
      groupFill.priority.timeText !== "must" ? groupFill.timeCustomText : "",
      groupFill.priority.cuisine !== "must" ? groupFill.cuisineTags.join("、") : "",
      groupFill.priority.cuisine !== "must" ? groupFill.cuisineCustomText : "",
      groupFill.priority.budget !== "must" ? groupFill.budgetCustomText : "",
      groupFill.priority.spicy !== "must" ? groupFill.spiceCustomText : "",
      groupFill.softPreference
    ].filter(Boolean);

    return (
      <form className="page scaffold-page fill-scaffold" onSubmit={(event) => void submitGroupParticipant(event)}>
        <div className="group-safe-header">
          <div className="group-safe-nav">
            <button className="group-nav-back-hit" onClick={() => setView("group-create")} type="button"><span className="group-nav-back-button"><span className="group-nav-back-icon">‹</span></span></button>
            <div className="group-safe-title">填写偏好</div>
          </div>
          <div className="group-safe-subtitle">点几个标签就行；不写也能交，管家会兜底。</div>
        </div>

        <div className="task-brief">
          <div className="task-eyebrow">{groupBoard?.task.creatorName || "发起人"} 邀请你 · 多人约饭</div>
          <div className="task-title">{groupBoard?.task.title || "多人约饭偏好收集"}</div>
          <div className="task-desc">{groupBoard?.task.rawRequest || "填写你的时间、忌口和想吃的品类。"}</div>
          <div className="task-meta">
            <span>{groupBoard?.task.expectedPeopleCount || groupPeople} 人</span>
            <span>{groupBoard?.participants.length || 0}/{groupBoard?.task.expectedPeopleCount || groupPeople} 已提交</span>
            <span>{groupBoard?.task.dinnerTime && groupBoard.task.dinnerTime !== "待商量" ? groupBoard.task.dinnerTime : "时间待商量"}</span>
            <span>{groupBoard?.task.locationText && groupBoard.task.locationText !== "待商量" ? groupBoard.task.locationText : "地点待商量"}</span>
          </div>
        </div>

        <div className="panel-card">
          <div className="field-label">用管家记忆一键填</div>
          <div className="field-hint">把你保存过的忌口/辣度/常用预算套到下面字段，提交前可以再改。</div>
          <button className="primary-button" onClick={() => setGroupParticipant((current) => ({ ...current, budgetMax: String(budgetMaxFromText(memory.budget)), spicyPreference: memory.spicyLevel === "不辣" ? "no_spicy" : "any", rawPreference: `忌口：${memory.avoidTags.join("、") || "无"}；辣度：${memory.spicyLevel}；预算：${memory.budget}` }))} type="button">使用我的管家记忆</button>
        </div>

        <div className="panel-card">
          <div className="field">
            <div className="field-label">你的昵称</div>
            <input className="field-input" value={groupParticipant.nickname} onChange={(event) => setGroupParticipant({ ...groupParticipant, nickname: event.target.value })} placeholder="例如：阿酒" />
          </div>
        </div>

        <div className="planner-card group-time-card">
          <div className="planner-card-title">⏰ 可参与时间</div>
          <div className="planner-card-desc">选择可参加的日期和大致时间段。</div>
          <div className="time-priority-grid">
            <div className="time-priority-item">
              <div className="field-label">日期优先级</div>
              <div className="priority-toggle">
                {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.days === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("days", option.value)} type="button">{option.label}</button>)}
              </div>
            </div>
            <div className="time-priority-item">
              <div className="field-label">时间优先级</div>
              <div className="priority-toggle">
                {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.hours === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("hours", option.value)} type="button">{option.label}</button>)}
              </div>
            </div>
          </div>
          <div className="planner-chip-list scroll-row">
            {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => <button className={`planner-chip ${groupFill.days.includes(day) ? "selected" : ""}`} key={day} onClick={() => toggleGroupArrayField("days", day)} type="button">{day}</button>)}
          </div>
          <div className="planner-field">
            <div className="planner-chip-list">
              {[["specified", "指定时段"], ["allDay", "全天都行"]].map(([value, label]) => (
                <button className={`planner-chip ${groupFill.timeMode === value ? "selected" : ""}`} key={value} onClick={() => setGroupFill({ ...groupFill, timeMode: value })} type="button">{label}</button>
              ))}
            </div>
          </div>
          {groupFill.timeMode === "specified" ? (
            <div className="planner-two-column planner-field">
              <div className="planner-column"><div className="planner-picker-card"><div className="planner-picker-label">开始时间</div><input className="planner-picker-value inline-time-input" value={groupFill.startTime} onChange={(event) => setGroupFill({ ...groupFill, startTime: event.target.value })} /></div></div>
              <div className="planner-column"><div className="planner-picker-card"><div className="planner-picker-label">结束时间</div><input className="planner-picker-value inline-time-input" value={groupFill.endTime} onChange={(event) => setGroupFill({ ...groupFill, endTime: event.target.value })} /></div></div>
            </div>
          ) : <div className="planner-note planner-field">当天时间都可以，管家会按大家的可参与日期合并。</div>}
          <div className="field last custom-field-block">
            <div className="field-heading">
              <div className="field-label">时间补充（选填）</div>
              <div className="priority-toggle">
                {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.timeText === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("timeText", option.value)} type="button">{option.label}</button>)}
              </div>
            </div>
            <input className="field-input preference-custom-input" value={groupFill.timeCustomText} onChange={(event) => setGroupFill({ ...groupFill, timeCustomText: event.target.value })} placeholder="还有其他时间要求可以补充，例如周五晚一点也可以" />
          </div>
        </div>

        <div className="panel-card">
          <div className="field-heading">
            <div className="field-label">🚫 忌口 / 过敏</div>
            <div className="priority-toggle">
              {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.dietary === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("dietary", option.value)} type="button">{option.label}</button>)}
            </div>
          </div>
          <div className="field-hint">可多选；选「无忌口」会清空其他选择。</div>
          <div className="option-grid">
            {["无忌口", "不吃辣", "海鲜过敏", "不吃奶制品", "少油", "不吃内脏"].map((tag) => <button className={`option-cell ${groupFill.dietaryTags.includes(tag) ? "active" : ""}`} key={tag} onClick={() => toggleGroupArrayField("dietaryTags", tag, "无忌口")} type="button">{tag}</button>)}
          </div>
          <div className="custom-field-block">
            <div className="field-label">忌口补充（选填）</div>
            <input className="field-input preference-custom-input" value={groupFill.restrictionCustomText} onChange={(event) => setGroupFill({ ...groupFill, restrictionCustomText: event.target.value })} placeholder="还有其他忌口或过敏可以补充，例如芒果过敏、不吃动物内脏" />
          </div>
        </div>

        <div className="panel-card">
          <div className="field-heading">
            <div className="field-label">🍽️ 想吃的品类</div>
            <div className="priority-toggle">
              {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.cuisine === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("cuisine", option.value)} type="button">{option.label}</button>)}
            </div>
          </div>
          <div className="option-grid">
            {["都可以", "粤菜", "火锅", "烧烤", "甜品", "轻食"].map((tag) => <button className={`option-cell ${groupFill.cuisineTags.includes(tag) ? "active" : ""}`} key={tag} onClick={() => toggleGroupArrayField("cuisineTags", tag, "都可以")} type="button">{tag}</button>)}
          </div>
          <div className="custom-field-block">
            <div className="field-label">品类补充（选填）</div>
            <input className="field-input preference-custom-input" value={groupFill.cuisineCustomText} onChange={(event) => setGroupFill({ ...groupFill, cuisineCustomText: event.target.value })} placeholder="还想吃什么可以补充，例如云南菜、东南亚菜" />
          </div>
        </div>

        <div className="panel-card">
          <div className="field">
            <div className="field-heading">
              <div className="field-label">💰 预算</div>
              <div className="priority-toggle">
                {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.budget === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("budget", option.value)} type="button">{option.label}</button>)}
              </div>
            </div>
            <div className="option-grid">
              {["50以内", "80以内", "100以内", "150以内"].map((tag) => <button className={`option-cell ${groupFill.budgetTag === tag ? "active" : ""}`} key={tag} onClick={() => { setGroupFill({ ...groupFill, budgetTag: tag }); setGroupParticipant({ ...groupParticipant, budgetMax: tag.replace("以内", "") }); }} type="button">{tag}</button>)}
            </div>
            <input className="field-input" value={groupParticipant.budgetMax} onChange={(event) => setGroupParticipant({ ...groupParticipant, budgetMax: event.target.value })} placeholder="80" />
            <div className="custom-field-block">
              <div className="field-label">预算补充（选填）</div>
              <input className="field-input preference-custom-input" value={groupFill.budgetCustomText} onChange={(event) => setGroupFill({ ...groupFill, budgetCustomText: event.target.value })} placeholder="还有预算要求可以补充，例如人均 60 左右" />
            </div>
          </div>
          <div className="field last">
            <div className="field-heading">
              <div className="field-label">🌶️ 辣度</div>
              <div className="priority-toggle">
                {priorityOptions.map((option) => <button className={`priority-option ${groupFill.priority.spicy === option.value ? "active" : ""} ${option.value}`} key={option.value} onClick={() => setGroupPriority("spicy", option.value)} type="button">{option.label}</button>)}
              </div>
            </div>
            <div className="option-grid">
              {[["no_spicy", "不辣"], ["mild", "微辣"], ["any", "都可以"], ["spicy", "能吃辣"]].map(([value, label]) => <button className={`option-cell ${groupParticipant.spicyPreference === value ? "active" : ""}`} key={value} onClick={() => setGroupParticipant({ ...groupParticipant, spicyPreference: value })} type="button">{label}</button>)}
            </div>
            <div className="custom-field-block">
              <div className="field-label">辣度补充（选填）</div>
              <input className="field-input preference-custom-input" value={groupFill.spiceCustomText} onChange={(event) => setGroupFill({ ...groupFill, spiceCustomText: event.target.value })} placeholder="还有辣度要求可以补充，例如只能微辣、最好不辣" />
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="field last">
            <div className="field-label">👀 这条偏好谁能看</div>
            <div className="field-hint">选择这条偏好在多人约饭中的展示方式</div>
            <div className="privacy-option-list">
              {[
                ["public", "公开，大家都能看", "适合不敏感的共同偏好"],
                ["nickname_only", "只显示昵称", "其他人只能看到你的昵称和选择"],
                ["private", "匿名，仅用于推荐", "不展示给其他成员，只参与推荐计算"]
              ].map(([value, title, desc]) => (
                <button className={`privacy-option ${groupFill.visibility === value ? "active" : ""}`} key={value} onClick={() => setGroupFill({ ...groupFill, visibility: value })} type="button">
                  <span className="privacy-copy"><span className="privacy-title">{title}</span><span className="privacy-desc">{desc}</span></span>
                  <span className={`privacy-check ${groupFill.visibility === value ? "checked" : ""}`}>✓</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="field">
            <div className="field-label">📝 还有其他必须满足的吗？<span className="priority-tag must">必须满足</span></div>
            <div className="field-hint">用逗号或空格分隔。例如：要有素食、不在医院附近。</div>
            <textarea className="field-textarea" value={groupFill.hardRequirement} onChange={(event) => setGroupFill({ ...groupFill, hardRequirement: event.target.value })} placeholder="例如：要有素食，必须能停车" />
          </div>
          <div className="field">
            <div className="field-label">📝 还有其他希望的吗？<span className="priority-tag nice">希望有</span></div>
            <div className="field-hint">这些不一定满足，但管家会尽量考虑。</div>
            <textarea className="field-textarea" value={groupFill.softPreference} onChange={(event) => setGroupFill({ ...groupFill, softPreference: event.target.value })} placeholder="例如：能拍照，靠窗座位" />
          </div>
          <div className="field last">
            <div className="prompt-head">
              <div className="field-label prompt-title">快捷提示词</div>
              <div className="field-hint prompt-subtitle">点一下，自动拼到「希望有」里。</div>
            </div>
            <div className="prompt-chip-grid">
              {["适合聊天", "不要排队", "能拍照", "有包间", "离学校近", "能点外卖"].map((label) => (
                <button className="prompt-chip-item" key={label} onClick={() => setGroupFill((current) => ({ ...current, softPreference: current.softPreference.includes(label) ? current.softPreference : `${current.softPreference ? `${current.softPreference}，` : ""}${label}` }))} type="button">{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="field-label">提交时会包含的需求</div>
          <div className="field-hint">必须满足（hardRequirements）</div>
          <div className="chip-row">{hardRequirements.length ? hardRequirements.map((item) => <div className="info-chip hard" key={item}>{item}</div>) : <div className="field-hint">— 当前没有必须满足项 —</div>}</div>
          <div className="field-hint preview-soft-title">希望有（softPreferences）</div>
          <div className="chip-row">{softPreferences.length ? softPreferences.map((item) => <div className="info-chip soft" key={item}>{item}</div>) : <div className="field-hint">— 当前没有希望项 —</div>}</div>
        </div>

        <div className="empty-panel">
          <div className="empty-title">提交后会进入任务看板</div>
          <div className="empty-desc">提交会通过 adapter.submitPreference 写入本条偏好；同昵称重复提交会覆盖之前的内容。</div>
        </div>

        {groupNotice ? <div className="inline-error">{groupNotice}</div> : null}
        <button className="primary-button submit-button sticky-submit" disabled={groupLoading || !groupTaskId} type="submit">{groupLoading ? "提交中..." : "提交我的偏好"}</button>
      </form>
    );
  }

  function renderGroupBoardPage() {
    const submittedCount = groupBoard?.participants.length || 0;
    const expectedPeople = groupBoard?.task.expectedPeopleCount || groupPeople;
    const missingPeople = Math.max(0, expectedPeople - submittedCount);
    const progress = Math.min(100, Math.round((submittedCount / Math.max(expectedPeople, 1)) * 100));

    return (
      <div className="page scaffold-page board-scaffold">
        <div className="group-safe-header">
          <div className="group-safe-nav">
            <button className="group-nav-back-hit" onClick={() => setView("group-create")} type="button"><span className="group-nav-back-button"><span className="group-nav-back-icon">‹</span></span></button>
            <div className="group-safe-title">约饭看板</div>
          </div>
          <div className="group-safe-subtitle">下拉刷新或保持在页面，每几秒会自动同步最新状态。</div>
        </div>

        <div className="panel-card progress-card">
          <div className="progress-head">
            <div>
              <div className="progress-title">{groupBoard?.task.displayTitle || groupBoard?.task.title || "多人约饭偏好收集"}</div>
              <div className="progress-desc">{submittedCount}/{expectedPeople} 已提交</div>
            </div>
            <div className="progress-pill">{groupBoard?.recommendationResult ? "已推荐" : "收集中"}</div>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>
          <div className="avatar-row">
            <div className="empty-avatar">幺</div>
            {groupBoard?.participants.length
              ? groupBoard.participants.map((member) => <div className="empty-avatar" key={member.participantId}>{member.visibility === "private" ? "匿" : (member.nickname || "友")}</div>)
              : Array.from({ length: Math.max(expectedPeople - 1, 0) }).map((_, index) => <div className="empty-avatar" key={index}>{index + 1}</div>)}
          </div>
        </div>

        <BoardSection title="成员偏好" desc="真实成员和 AI 代填的朋友偏好会出现在这里。">
          {groupBoard?.participants.length ? (
            <div className="panel-card">
              {groupBoard.participants.map((member) => {
                const hard = member.extractedConstraints?.hard_constraints || member.extractedConstraints?.hardConstraints || [];
                const soft = member.extractedConstraints?.soft_preferences || member.extractedConstraints?.softPreferences || [];
                return (
                  <div className="field" key={member.participantId}>
                    {member.visibility === "private" ? (
                      <div className="field-label">匿名成员已提交</div>
                    ) : (
                      <div className="field-label">
                        {member.nickname}
                        {member.source === "ai_generated" ? <span className="field-hint inline-member-note"> · AI代填</span> : null}
                        {member.visibility === "nickname_only" ? <span className="field-hint inline-member-note"> · 偏好仅用于推荐</span> : null}
                      </div>
                    )}

                    {member.visibility === "public" ? (
                      <>
                        <div className="field-hint">{member.rawPreference || "（未填写自由偏好）"}</div>
                        {member.availabilitySummary ? <div className="field-hint">可参与：{member.availabilitySummary}</div> : null}
                        <div className="chip-row">
                          {member.budgetTag ? <div className="info-chip">预算 {member.budgetTag}</div> : null}
                          {!member.budgetTag && member.manualFields.budgetMax ? <div className="info-chip">预算 ≤ {member.manualFields.budgetMax}</div> : null}
                          {member.spicyLabel ? <div className="info-chip">{member.spicyLabel}</div> : null}
                          {!member.spicyLabel && member.manualFields.spicyPreference ? <div className="info-chip soft">{member.manualFields.spicyPreference === "no_spicy" ? "不辣" : "都可以"}</div> : null}
                          {(member.dietaryRestrictions || []).map((item) => <div className="info-chip hard" key={`diet-${item}`}>{item}</div>)}
                          {(member.cuisinePreferences || []).map((item) => <div className="info-chip soft" key={`cuisine-${item}`}>想吃 {item}</div>)}
                          {hard.map((item) => <div className="info-chip hard" key={`hard-${item}`}>{item}</div>)}
                          {soft.map((item) => <div className="info-chip soft" key={`soft-${item}`}>{item}</div>)}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <EmptyPanel title="还没有成员提交" desc="把分享链接发给朋友，他们填好后这里会出现真实数据。" />}
        </BoardSection>

        <BoardSection title="冲突识别" desc="预算、忌口、辣度和时间会被优先检查。">
          {groupBoard?.conflicts.length ? (
            <div className="panel-card">
              {groupBoard.conflicts.map((conflict) => (
                <div className="field" key={conflict.description}>
                  <div className="field-label">{conflict.type} · {conflict.severity}</div>
                  <div className="field-hint">{conflict.description}</div>
                  <div className="field-hint">建议：{conflict.resolutionStrategy || conflict.resolution_strategy}</div>
                </div>
              ))}
            </div>
          ) : <EmptyPanel title="暂无冲突" desc="成员偏好相近，或还没有足够数据触发冲突识别。" />}
        </BoardSection>

        {renderAiProgressCard(groupAiProgress, groupAiProgressSummary)}
        <BoardSection title="推荐方案" desc="点生成推荐会调用 adapter.generateRecommendation。">
          {groupBoard?.recommendationResult ? renderGroupRecommendationResult(groupBoard) : <EmptyPanel title="还没生成推荐" desc="点下面「生成推荐」会调用后端推荐。" />}
        </BoardSection>

        {groupNotice ? <div className="inline-error">{groupNotice}</div> : null}
        {groupAdjustmentRequests.length ? (
          <div className="panel-card">
            <div className="field-label">收到的调整请求 · {groupAdjustmentRequests.length} 条</div>
            <div className="field-hint">有成员对当前候选不满意。下方按 reasonType 汇总；点上方「生成推荐」会清空这些反馈并重新出方案。</div>
            {groupAdjustmentRequests.map((request) => (
              <div className="field" key={request.id}>
                <div className="field-label">{request.visibility === "private" ? "匿名成员" : request.nickname || "某成员"} · {request.reasonLabel}</div>
                <div className="field-hint">针对：{request.candidateName}</div>
                {request.note ? <div className="field-hint">补充：{request.note}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="panel-card">
          <div className="field-label">Adapter 调用</div>
          <div className="chip-row">
            <div className="info-chip hard">getTaskBoard(taskId, inviteToken)</div>
            <div className="info-chip soft">submitPreference</div>
            <div className="info-chip">aiFillFriends</div>
            <div className="info-chip">generateRecommendation</div>
            <div className="info-chip">submitAdjustmentRequest</div>
          </div>
          <div className="field-hint">所有数据均经 adapter；页面不直接 wx.request。Mock fallback 可在 services/groupDiningAdapter.js 切换真实接口。</div>
        </div>

        {missingPeople > 0 ? (
          <button className="primary-button" disabled={!groupTaskId || groupLoading} onClick={() => void aiFillGroupFriends()} type="button">
            {groupLoading ? "生成中..." : `AI 填写剩余 ${missingPeople} 位朋友偏好`}
          </button>
        ) : null}
        <button className="primary-button" disabled={!submittedCount || groupLoading} onClick={() => void generateGroupRecommendation()} type="button">{groupLoading ? "生成中..." : "生成推荐"}</button>
        <button className="primary-button" disabled={!groupTaskId || groupLoading} onClick={() => void refreshGroupBoard()} type="button">{groupLoading ? "刷新中..." : "手动刷新"}</button>
        <button className="primary-button" onClick={goHome} type="button">回到首页</button>
      </div>
    );
  }

  function renderGroupRecommendationResult(board: GroupBoard) {
    const result = board.recommendationResult;
    if (!result) return null;
    const hardRuleLabels: Record<string, string> = {
      spicy: "辣度可能不合",
      budget: "预算偏紧",
      distance: "距离稍远"
    };

    return (
      <div className="panel-card">
        <div className="field">
          <div className="field-label">最终推荐 · {result.finalChoice.name}</div>
          <div className="field-hint">{result.finalChoice.reason}</div>
          <div className="chip-row">{result.finalChoice.risks.map((risk) => <div className="info-chip hard" key={risk}>{risk}</div>)}</div>
          {result.finalChoice.backup ? <div className="field-hint">备选：{result.finalChoice.backup}</div> : null}
        </div>
        <div className="field">
          <div className="field-label">群里发这条</div>
          <div className="field-hint">{result.groupMessage}</div>
          <button className="primary-button" onClick={() => copyGroupMessage(result.groupMessage)} type="button">复制群消息</button>
        </div>
        <div className="field last">
          <div className="field-label">全部候选 ({result.candidates.length})</div>
          {result.candidates.map((candidate) => {
            const candidateId = String(candidate.restaurant_id || candidate.id || candidate.name);
            const walkMinutes = candidate.walkMinutes || candidate.walk_minutes || Math.round((candidate.distance_m || 900) / 80);
            const hardRules = candidate.audit?.hard_rules || candidate.audit?.hardRules || {};
            const auditExplanation = candidate.audit?.llm_explanation || candidate.audit?.llmExplanation;
            const memberScoreList = candidate.memberScoreList || Object.entries(candidate.member_scores || {}).map(([nickname, score]) => ({ nickname, score }));
            const riskyHardRules = Object.entries(hardRules).filter(([, status]) => status === "risk" || status === "fail");
            const isAdjustmentOpen = adjustmentTargetCandidate?.id === candidateId;

            return (
              <div className="candidate-card" key={candidateId}>
                <div className="field-label">{candidate.name} · 人均 ¥{candidate.avg_price || candidate.avgPrice || "待确认"} · {walkMinutes} 分钟</div>
                <div className="field-hint">{candidate.reason}</div>
                <div className="chip-row">{candidate.tags?.map((tag) => <div className="info-chip" key={tag}>{tag}</div>)}</div>

                {candidate.audit ? (
                  <div className="chip-row">
                    <div className={`info-chip ${candidate.audit.passed ? "soft" : "hard"}`}>自检 {candidate.audit.passed ? "通过" : "存在风险"}</div>
                    {riskyHardRules.map(([rule]) => <div className="info-chip hard" key={rule}>{hardRuleLabels[rule] || rule}</div>)}
                  </div>
                ) : null}

                {candidate.matchedNeeds?.length ? (
                  <>
                    <div className="field-hint">满足：</div>
                    <div className="chip-row">{candidate.matchedNeeds.map((need) => <div className="info-chip soft" key={need}>{need}</div>)}</div>
                  </>
                ) : null}

                {candidate.unmetNeeds?.length ? (
                  <>
                    <div className="field-hint">可能牺牲：</div>
                    <div className="chip-row">{candidate.unmetNeeds.map((need) => <div className="info-chip hard" key={need}>{need}</div>)}</div>
                  </>
                ) : null}

                {candidate.tradeoffSummary ? <div className="field-hint">取舍：{candidate.tradeoffSummary}</div> : null}
                {candidate.tradeoffs?.length ? (
                  <div className="chip-row">{candidate.tradeoffs.map((tradeoff) => <div className="info-chip hard" key={`${tradeoff.nickname}-${tradeoff.reason}`}>{tradeoff.nickname || "成员"}：{tradeoff.reason}</div>)}</div>
                ) : null}

                {memberScoreList.length ? (
                  <div className="chip-row">{memberScoreList.map((score) => <div className="info-chip soft" key={score.nickname || String(score.score)}>{score.nickname || "成员"}：{score.score}</div>)}</div>
                ) : null}
                {auditExplanation ? <div className="field-hint">自检说明：{auditExplanation}</div> : null}

                <button className="primary-button" onClick={() => { setAdjustmentTargetCandidate({ id: candidateId, name: candidate.name }); setAdjustmentReasonType(""); setAdjustmentNote(""); setGroupNotice(""); }} type="button">对这家不满意</button>

                {isAdjustmentOpen ? (
                  <div className="adjustment-panel">
                    <div className="field-label">告诉管家哪里不合适</div>
                    <div className="field-hint">提交后管家会标记这家有人不满意，发起人可以选择重新生成推荐。</div>

                    <div className="field">
                      <div className="field-label">你的昵称（匿名时可留空）</div>
                      <input className="field-input" value={adjustmentNickname} onChange={(event) => setAdjustmentNickname(event.target.value)} placeholder="例如：阿酒" />
                    </div>

                    <div className="field">
                      <div className="field-label">这条反馈谁能看</div>
                      <div className="option-grid">
                        {groupAdjustmentVisibilityOptions.map((option) => <button className={`option-cell ${adjustmentVisibility === option.value ? "active" : ""}`} key={option.value} onClick={() => setAdjustmentVisibility(option.value)} type="button">{option.label}</button>)}
                      </div>
                    </div>

                    <div className="field">
                      <div className="field-label">不满意原因</div>
                      <div className="option-grid">
                        {groupAdjustmentReasons.map((reason) => <button className={`option-cell ${adjustmentReasonType === reason.value ? "active" : ""}`} key={reason.value} onClick={() => setAdjustmentReasonType(reason.value)} type="button">{reason.label}</button>)}
                      </div>
                    </div>

                    <div className="field last">
                      <div className="field-label">补充说明（选填）</div>
                      <textarea className="field-textarea" value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} placeholder="例如：刚刚说错了，我对辣过敏" />
                    </div>

                    <button className="primary-button" onClick={submitLocalAdjustmentRequest} type="button">提交反馈</button>
                    <button className="primary-button" onClick={() => { setAdjustmentTargetCandidate(null); setAdjustmentReasonType(""); setAdjustmentNote(""); }} type="button">取消</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeekendPage() {
    const hasPlan = Boolean(weekendPlan);
    const weekendRuntimeStatus = buildWeekendRuntimeStatus(weekendPlan, weekendLoading);
    return (
      <form className="page weekend-page" onSubmit={(event) => void createWeekendPlan(event)}>
        <div className="custom-food-header planner-header">
          <div className="food-nav-row">
            <button className="header-back-hit" onClick={goHome} type="button"><span className="header-back-button">‹</span></button>
            <div className="food-nav-title">周边规划</div>
          </div>
          <div className={`header-online-status ${weekendRuntimeStatus.className}`} title={weekendRuntimeStatus.detail}>
            <span className="header-online-dot"></span>
            <span className="header-online-text">{weekendRuntimeStatus.text}</span>
          </div>
          <div className="planner-header-subtitle">告诉我时间、预算和想要的状态，我会整理 2-3 条轻路线。</div>
        </div>

        <div className="planner-body">
          <div className="planner-form-list">
            <div className="planner-card">
              <div className="planner-card-title">⏰ 出行时间</div>
              <div className="planner-card-desc">选择出发日和大致时间段。</div>
              <div className="planner-chip-list scroll-row">
                {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => (
                  <button className={`planner-chip ${weekendForm.dateLabel === day ? "selected" : ""}`} key={day} onClick={() => updateWeekendForm({ dateLabel: day })} type="button">{day}</button>
                ))}
              </div>
              <div className="planner-field">
                <div className="planner-chip-list">
                  {[["range", "指定时段"], ["allDay", "全天有空"]].map(([value, label]) => (
                    <button className={`planner-chip ${weekendForm.timeMode === value ? "selected" : ""}`} key={value} onClick={() => updateWeekendForm({ timeMode: value })} type="button">{label}</button>
                  ))}
                </div>
              </div>
              {weekendForm.timeMode === "range" ? (
                <div className="planner-two-column planner-field">
                  <div className="planner-column"><div className="planner-picker-card"><div className="planner-picker-label">开始时间</div><input className="planner-picker-value inline-time-input" value={weekendForm.startTime} onChange={(event) => updateWeekendForm({ startTime: event.target.value })} /></div></div>
                  <div className="planner-column"><div className="planner-picker-card"><div className="planner-picker-label">结束时间</div><input className="planner-picker-value inline-time-input" value={weekendForm.endTime} onChange={(event) => updateWeekendForm({ endTime: event.target.value })} /></div></div>
                </div>
              ) : <div className="planner-note planner-field">当天时间都可以，我会按半日或轻松路线生成。</div>}
            </div>

            <div className="planner-card">
              <div className="planner-card-title">💰 预算和起点</div>
              <div className="planner-two-column">
                <div className="planner-column">
                  <div className="planner-field-label">预算上限</div>
                  <input className="planner-input" value={weekendForm.budgetMax} onChange={(event) => updateWeekendForm({ budgetMax: event.target.value })} placeholder="120" />
                  <div className="planner-helper">元 / 人</div>
                </div>
                <div className="planner-column">
                  <div className="planner-field-label">出发起点</div>
                  <input className="planner-input" value={weekendForm.startArea} onChange={(event) => updateWeekendForm({ startArea: event.target.value })} placeholder="学校周边" />
                </div>
              </div>
            </div>

            <div className="planner-card">
              <div className="planner-card-title">✨ 这次想要什么感觉</div>
              {[
                ["mood", "🌿 心情", ["想轻松一点", "想拍照出片", "想换个地方", "想安静放空"]],
                ["energyLevel", "🚶 体力", ["低体力", "中等体力", "想多走走"]],
                ["companions", "👥 同行人", ["自己", "朋友", "情侣", "家人"]]
              ].map(([field, label, options]) => (
                <div className="planner-field" key={field as string}>
                  <div className="planner-field-label">{label as string}</div>
                  <div className="planner-chip-list">
                    {(options as string[]).map((option) => (
                      <button className={`planner-chip ${weekendForm[field as "mood" | "energyLevel" | "companions"] === option ? "selected" : ""}`} key={option} onClick={() => updateWeekendForm({ [field as string]: option })} type="button">{option}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="planner-card">
              <div className="planner-card-title">📝 其他偏好</div>
              <div className="planner-card-desc">室内、拍照、吃饭、少走路等限制都可以点选。</div>
              <div className="planner-chip-list">
                {weekendInterestOptions.map((option) => {
                  const value = option.value;
                  const active = weekendForm.interests.includes(value);
                  return <button className={`planner-chip ${active ? "selected" : ""}`} key={value} onClick={() => toggleWeekendInterest(value)} type="button">{option.emoji} {option.label}</button>;
                })}
              </div>
              <div className="planner-field">
                <div className="planner-field-label">补充说明</div>
                <textarea className="planner-textarea" value={weekendForm.rawText} onChange={(event) => updateWeekendForm({ rawText: event.target.value })} placeholder="例如：不想排队，想找能坐下来聊天和拍照的地方。" />
              </div>
            </div>

            {weekendError ? <div className="planner-state error">生成失败：{weekendError}</div> : null}
            {!hasPlan && !weekendLoading && !weekendError ? <div className="planner-state">提交后会展示出门路线、折中路线、雨天或低体力备选。</div> : null}
            {weekendLoading ? <div className="planner-state">正在综合天气、预算、体力和返程时间。</div> : null}
            {weekendNotice && !weekendPlan ? <div className="planner-state success">{weekendNotice}</div> : null}
            {renderAiProgressCard(weekendAiProgress, weekendAiProgressSummary)}
          </div>

          {weekendPlan ? renderWeekendResults(weekendPlan) : null}
        </div>

        <div className="planner-action-dock">
          <div className="planner-summary-line">{buildWeekendTimeWindow(weekendForm)} · {weekendForm.startArea} · {weekendForm.budgetMax} 元/人</div>
          <div className="planner-summary-hint">当前条件仅用于本次周边规划，不会写入长期偏好。</div>
          <div className="planner-action-row">
            {hasPlan ? <button className="planner-secondary-button" onClick={() => { setWeekendPlan(null); setWeekendNotice(""); setWeekendError(""); setWeekendAiProgress(null); }} type="button">重新填写</button> : null}
            <button className={`planner-primary-button ${weekendLoading ? "disabled-button" : ""}`} disabled={weekendLoading} type="submit">{weekendLoading ? "生成中" : "生成周边规划"}</button>
          </div>
        </div>
      </form>
    );
  }

  function renderWeekendResults(plan: WeekendPlan) {
    const runtimeStatus = buildWeekendRuntimeStatus(plan);
    const source = {
      weather: plan.source?.weather || (plan.weather?.fallback ? "fallback" : "backend"),
      poi: plan.source?.poi || "backend",
      planner: plan.source?.planner || plan.backendStatus || "backend"
    };

    return (
      <div className="planner-result-list">
        {plan.backendMessage ? <div className="planner-state">{plan.backendMessage}</div> : null}

        <div className={`planner-card planner-ai-status-card ${runtimeStatus.className}`}>
          <div className="planner-result-head">
            <div className="planner-result-title-wrap">
              <div className="planner-rank">生成状态</div>
              <div className="planner-result-title">{runtimeStatus.text}</div>
            </div>
            <div className="planner-result-type">{runtimeStatus.resultIsAiGenerated ? "AI" : "规则"}</div>
          </div>
          <div className="planner-route-summary">{runtimeStatus.detail}</div>
          <div className="planner-source-row">
            <span className="planner-section-label">状态</span>
            <div className="planner-source-tags">
              {runtimeStatus.tags.map((tag, index) => <span className="planner-tag" key={`${tag}-${index}`}>{tag}</span>)}
              {runtimeStatus.traceId ? <span className="planner-tag">Trace {runtimeStatus.traceId}</span> : null}
              {typeof runtimeStatus.durationMs === "number" && runtimeStatus.durationMs > 0 ? <span className="planner-tag">{runtimeStatus.durationMs}ms</span> : null}
            </div>
          </div>
        </div>

        <div className={`planner-card planner-weather-card ${plan.weather?.fallback ? "featured" : ""}`}>
          <div className="planner-result-head">
            <div>
              <div className="planner-rank">天气</div>
              <div className="planner-result-title">{plan.weather?.summary || "天气信息待确认"}</div>
            </div>
            <div className="planner-result-type">{plan.weather?.sourceLabel || "后端"}</div>
          </div>
          {plan.weatherNotice ? <div className="planner-risk"><span className="planner-section-label">提醒</span>{plan.weatherNotice}</div> : null}
          <div className="planner-source-row">
            <span className="planner-section-label">来源</span>
            <div className="planner-source-tags">
              <span className="planner-tag">天气 {source.weather}</span>
              <span className="planner-tag">POI {source.poi}</span>
              <span className="planner-tag">规划 {source.planner}</span>
            </div>
          </div>
        </div>

        <div className="planner-state success">已生成 {plan.routes.length} 条路线，可以复制喜欢的邀约文案。</div>

        {plan.routes.map((route, index) => (
          <div className={`planner-card planner-route-card ${index === 0 ? "featured" : ""}`} key={route.id}>
            <div className="planner-result-head">
              <div className="planner-result-title-wrap">
                {index === 0 ? <div className="planner-rank">首推</div> : null}
                <div className="planner-result-title">{route.title}</div>
              </div>
              <div className="planner-result-type">{route.typeLabel || route.type}</div>
            </div>
            <div className="planner-meta">
              <div>预算 {route.estimatedBudgetText || route.estimatedBudget || "待确认"}</div>
              <div>时长 {route.estimatedDurationText || route.durationText || `${route.estimatedDurationMinutes || 150} 分钟`}</div>
              <div>{route.transport}</div>
            </div>
            <div className="planner-route-summary">{route.summary}</div>
            <div className="planner-route-block">
              <div className="planner-route-block-title">时间线</div>
              {route.timeline?.length ? (
                <div className="planner-timeline">
                  {route.timeline.map((step, stepIndex) => (
                  <div className="planner-timeline-item" key={`${route.id}-${stepIndex}`}>
                    <div className="planner-timeline-head"><span className="planner-timeline-time">{step.time}</span><span className="planner-timeline-title">{step.title}</span></div>
                    {step.placeName ? <div className="planner-timeline-place">{step.placeName}</div> : null}
                    {step.activity ? <div className="planner-timeline-activity">{step.activity}</div> : null}
                    {step.durationMinutes ? <div className="planner-timeline-duration">预计停留 {step.durationMinutes} 分钟</div> : null}
                  </div>
                  ))}
                </div>
              ) : <div className="planner-note">暂无详细时间线，可根据路线摘要灵活安排。</div>}
            </div>
            {normalizeSelfChecks(route).length ? (
              <div className="planner-route-block">
                <div className="planner-route-block-title">自检结果</div>
                <div className="planner-check-grid">
                  {normalizeSelfChecks(route).map((check) => (
                    <div className="planner-check-item" key={check.key}>
                      <div className="planner-check-top"><span>{check.label}</span><span>{check.statusText}</span></div>
                      <div className="planner-check-detail">{check.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {route.risks?.length ? (
              <div className="planner-route-block">
                <div className="planner-route-block-title">风险提示</div>
                <div className="planner-risk-list">{route.risks.map((risk) => <div className="planner-risk-item" key={risk}>{risk}</div>)}</div>
              </div>
            ) : null}
            {route.inviteText ? (
              <div className="planner-route-invite">
                <div className="planner-route-invite-text">{route.inviteText}</div>
                <button className="planner-secondary-button" onClick={() => copyWeekendInvite(route.inviteText || "")} type="button">复制邀约</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  function renderMemoryPage() {
    const isNoneSelected = memory.avoidTags.includes("无");

    return (
      <div className="page memory-page">
        <div className="memory-intro">
          <button className="mini-back-link" onClick={goHome} type="button">‹ 返回</button>
          <div className="memory-page-title">管家记忆</div>
          <div className="memory-page-subtitle">你可以在这里管理管家记住的饮食偏好</div>
          <div className="memory-privacy">这些记忆只用于帮你推荐吃什么，你可以随时修改或清空。</div>
        </div>

        <div className="memory-section-group">
          <div className="memory-group-header"><div className="memory-group-title">我主动告诉管家的</div><div className="memory-group-hint">保存后生效</div></div>
          <div className="memory-section">
            <div className="memory-section-title">忌口 / 过敏</div>
            <div className="memory-section-desc">可多选。选「无」会清空其他选项。点「其他」后请在下方填写。</div>
            <div className="memory-chip-list">
              {memoryAvoidOptions.map((tag) => (
                <button className={`memory-chip ${(tag === "无" && isNoneSelected) || (tag === "其他" && memoryCustomAvoid.trim()) || memory.avoidTags.includes(tag) ? "selected" : ""}`} key={tag} onClick={() => handleMemoryAvoidTap(tag)} type="button">{tag}</button>
              ))}
            </div>
            <div className={`memory-custom-input-row ${isNoneSelected ? "dim" : ""}`}><input className="memory-custom-input" value={memoryCustomAvoid} onChange={(event) => handleMemoryCustomAvoidInput(event.target.value)} placeholder="也可以自己填写，例如：芒果、鸡蛋、菌菇" /></div>
          </div>

          <div className="memory-section">
            <div className="memory-section-title">辣度偏好</div>
            <div className="memory-section-desc">单选。再点一下取消。</div>
            <div className="memory-chip-list">
              {memorySpicyOptions.map((tag) => (
                <button className={`memory-chip ${memory.spicyLevel === tag ? "selected" : ""}`} key={tag} onClick={() => setMemory({ ...memory, spicyLevel: memory.spicyLevel === tag ? "" : tag })} type="button">{tag}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="memory-section-group">
          <div className="memory-group-header"><div className="memory-group-title">允许管家记住</div><div className="memory-group-hint">下方开关改动后会立刻生效。</div></div>
          <div className="memory-section memory-permissions">
            <PermissionRow checked={memory.permissions.behaviorLearning} desc="总开关。关闭后下方授权项不会被记录。" master title="允许管家从我的使用中学习偏好" onChange={(checked) => persistMemory({ ...memory, permissions: { ...memory.permissions, behaviorLearning: checked } })} />
            <div className="permission-divider"></div>
            {memoryPermissionRows.map((row) => (
              <PermissionRow
                checked={memory.permissions.behaviorLearning !== false && memory.permissions[row.key] !== false}
                desc={row.desc}
                dim={memory.permissions.behaviorLearning === false}
                key={row.key}
                title={row.title}
                onChange={(checked) => persistMemory({ ...memory, permissions: { ...memory.permissions, [row.key]: checked } })}
              />
            ))}
          </div>
        </div>

        <div className="memory-section-group">
          <div className="memory-group-header"><div className="memory-group-title">管家从使用中学到的</div><div className="memory-learning-pill">学习中</div></div>
          <div className="memory-section memory-learned">
            <div className="memory-learned-empty">多用几次后，我会帮你整理出午餐、晚餐、外卖和到店的习惯。你可以随时修改或删除。</div>
            <div className="memory-learned-list">
              {learnedPlaceholderRows.map((row) => (
                <div className="memory-learned-card" key={row.label}><div className="memory-learned-copy"><div className="memory-learned-label">{row.label}</div><div className="memory-learned-desc">{row.desc}</div></div><div className="memory-learned-status">{row.value}</div></div>
              ))}
            </div>
          </div>
        </div>

        <div className="memory-section-group">
          <div className="memory-group-header"><div className="memory-group-title">记忆控制</div></div>
          <div className="memory-section memory-switch-section">
            <label className="memory-switch-row">
              <span className="memory-switch-copy">
                <span className="memory-section-title">暂停管家记忆</span>
                <span className="memory-section-desc">开关关闭后我不会读取这些记忆，已保存的内容仍会保留。</span>
              </span>
              <span className={`switch-control ${memory.memoryEnabled ? "checked" : ""}`}>
                <input checked={memory.memoryEnabled} onChange={(event) => { persistMemory({ ...memory, memoryEnabled: event.target.checked, updatedAt: new Date().toISOString() }); setMemoryNotice(event.target.checked ? "已恢复记忆" : "已暂停记忆"); }} type="checkbox" />
              </span>
            </label>
          </div>
          <div className="memory-actions-row">
            <button className="memory-save-button" onClick={() => saveStableMemory()} type="button">保存记忆</button>
            <button className="memory-clear-button" onClick={() => { setMemoryCustomAvoid(""); persistMemory({ ...memory, avoidTags: [], spicyLevel: "", updatedAt: new Date().toISOString() }); setMemoryNotice("已清空"); }} type="button">清空主动填写记忆</button>
          </div>
          <div className="memory-actions-row memory-actions-row-compact">
            <button className="memory-clear-button memory-clear-button-wide" onClick={() => { persistRecords([]); setMemoryNotice("已清空学习记忆"); }} type="button">清空行为学习记忆</button>
          </div>
        </div>
        {memoryNotice ? <div className="memory-notice">{memoryNotice}</div> : null}
        <div className="memory-updated-at">{formatMemoryUpdatedAt(memory.updatedAt)}</div>
      </div>
    );
  }

  function renderThemePanel() {
    return (
      <div className="panel-mask" onClick={() => setShowThemePanel(false)}>
        <div className="bottom-panel theme-panel" onClick={(event) => event.stopPropagation()}>
          <div className="panel-header">
            <div className="panel-header-copy"><div className="panel-title">主题换装</div><div className="panel-desc">选择后会同步影响首页、问答、多人约饭、周边规划和管家记忆。</div></div>
            <button className="panel-close" onClick={() => setShowThemePanel(false)} type="button">×</button>
          </div>
          <div className="theme-grid">
            {themeCards.map((theme) => (
              <button className={`theme-card ${themeId === theme.id ? "selected active" : ""}`} key={theme.id} onClick={(event) => { selectTheme(theme.id, event); setShowThemePanel(false); }} type="button">
                <div className="theme-preview" style={{ background: theme.soft }}>
                  <div className="swatch-row">
                    <span className="swatch" style={{ background: theme.primary }}></span>
                    <span className="swatch" style={{ background: theme.soft }}></span>
                    <span className="swatch" style={{ background: theme.accent }}></span>
                    <span className="swatch" style={{ background: theme.warn }}></span>
                  </div>
                  <div className="mini-chat">
                    <span className="mini-avatar" style={{ background: theme.primary }}>幺</span>
                    <span className="mini-line"></span>
                  </div>
                  <div className="mini-bubble" style={{ background: theme.primary }}>清淡 · 热乎</div>
                </div>
                <div className="theme-card-footer">
                  <div>
                    <div className="theme-name">{theme.name}</div>
                    <div className="theme-key">{theme.description}</div>
                  </div>
                  <div className={`theme-check ${themeId === theme.id ? "checked" : ""}`}>✓</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderHistoryPanel() {
    return (
      <div className="panel-mask" onClick={() => setShowHistoryPanel(false)}>
        <div className="bottom-panel history-panel" onClick={(event) => event.stopPropagation()}>
          <div className="panel-header"><div className="panel-header-copy"><div className="panel-title">偏好记录</div><div className="panel-desc">已选择「记住这个偏好」的最近 5 次会留在这里，方便继续调整。</div></div><button className="panel-close" onClick={() => setShowHistoryPanel(false)} type="button">×</button></div>
          {!records.length ? (
            <div className="empty-state">
              <div className="empty-mark ai-mark">幺</div>
              <div className="empty-title">还没有偏好记录</div>
              <div className="empty-desc">在结果页选择「记住这个偏好」后，我会把场景、预算、距离和推荐结果帮你记下来。</div>
            </div>
          ) : (
            <div className="history-list">{records.slice(0, 5).map((record, index) => <div className="history-item" key={record.id}><div className="history-index">{index + 1}</div><div className="history-copy"><div className="history-names">{record.slots.mealPurpose || "用餐偏好"}</div><div className="history-summary">{record.summary}</div><div className="history-time">{new Date(record.createdAt).toLocaleString()}</div></div></div>)}</div>
          )}
        </div>
      </div>
    );
  }

  function renderFavoritesPanel() {
    return (
      <div className="panel-mask" onClick={() => setShowFavoritesPanel(false)}>
        <div className="bottom-panel favorites-panel" onClick={(event) => event.stopPropagation()}>
          <div className="panel-header"><div className="panel-header-copy"><div className="panel-title">店铺收藏</div><div className="panel-desc">在推荐卡片右上角点星星收藏，喜欢的店铺会留在这里。</div></div><button className="panel-close" onClick={() => setShowFavoritesPanel(false)} type="button">×</button></div>
          {!favorites.length ? (
            <div className="favorites-empty">
              <div className="favorites-empty-title">还没有收藏的店铺</div>
              <div className="favorites-empty-desc">在推荐卡片右上角点星星收藏喜欢的店铺</div>
            </div>
          ) : (
            <div className="favorites-list">{favorites.map((item) => <div className="fav-item" key={item.id || item.name}><div className="fav-name">{item.name}</div><div className="fav-detail-row"><span className="fav-meta">{item.perCapitaDisplay || formatPrice(item.perCapita)}</span><span className="fav-meta">{item.distance}</span>{item.matchedTags?.[0] ? <span className="fav-tag">{item.matchedTags[0]}</span> : null}</div></div>)}</div>
          )}
        </div>
      </div>
    );
  }
}

function BoardSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="board-section">
      <div className="section-head"><div className="section-dot"></div><div><div className="section-title-small">{title}</div><div className="section-desc-small">{desc}</div></div></div>
      {children}
    </section>
  );
}

function EmptyPanel({ title, desc }: { title: string; desc: string }) {
  return <div className="empty-panel section-empty"><div className="empty-title">{title}</div><div className="empty-desc">{desc}</div></div>;
}

function PermissionRow({ checked, desc, dim, disabled, master, pill, title, onChange }: { checked: boolean; desc: string; dim?: boolean; disabled?: boolean; master?: boolean; pill?: string; title: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={`permission-row ${master ? "permission-master" : ""} ${dim ? "dim" : ""} ${disabled ? "is-disabled" : ""}`}>
      <span className="permission-copy"><span className="permission-title-row"><span className="permission-title">{title}</span>{pill ? <span className="permission-pill">{pill}</span> : null}</span><span className="permission-desc">{desc}</span></span>
      <span className={`switch-control ${checked ? "checked" : ""}`}><input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /></span>
    </label>
  );
}
