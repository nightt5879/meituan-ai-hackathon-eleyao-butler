"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "login" | "home" | "food" | "group-create" | "group-fill" | "group-board" | "weekend" | "memory";

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
  permissions: {
    stableFoodMemory: boolean;
    behaviorLearning: boolean;
    recommendationHistory: boolean;
    weekendPlans: boolean;
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
  matchedTagsText?: string;
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
    nickname: string;
    rawPreference: string;
    manualFields: {
      budgetMax?: number;
      spicyPreference?: string;
      leaveBefore?: string;
    };
    extractedConstraints: {
      hard_constraints: string[];
      soft_preferences: string[];
    };
  }>;
  conflicts: Array<{
    type: string;
    severity: string;
    description: string;
    resolution_strategy: string;
  }>;
  recommendationState: {
    status: string;
    hasGenerated: boolean;
    updatedAt: string;
    dirtyReason?: string;
  };
  recommendationResult: {
    candidates: Array<{
      restaurant_id: string;
      name: string;
      category: string;
      avg_price: number;
      distance_m: number;
      rating: number;
      reason: string;
      tags: string[];
      queue_risk: string;
      score: number;
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
    status?: string;
    fallback?: boolean;
    condition?: string;
  };
  backendStatus?: string;
  backendMessage?: string;
  routes: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    estimatedBudget?: string;
    estimatedDurationMinutes?: number;
    durationText?: string;
    transport?: string;
    timeline?: Array<{
      time?: string;
      title?: string;
      placeName?: string;
      activity?: string;
      durationMinutes?: number;
    }>;
    selfChecks?: Record<string, string> | Array<{ label?: string; detail?: string; passed?: boolean; status?: string }>;
    risks?: string[];
    inviteText?: string;
  }>;
};

type ApiError = Error & { status?: number; code?: string };

type FoodQuestion = {
  id: string;
  title: string;
  helper: string;
  options: string[];
  multi?: boolean;
  text?: boolean;
};

const identityKey = "meituan_web_demo_identity";
const defaultMemory: MemorySettings = {
  avoidTags: [],
  spicyLevel: "都可以",
  budget: "50元以内",
  distance: "1公里以内",
  permissions: {
    stableFoodMemory: true,
    behaviorLearning: true,
    recommendationHistory: true,
    weekendPlans: true
  }
};

const foodQuestions: FoodQuestion[] = [
  {
    id: "mealPurpose",
    title: "这次主要是什么用餐场景？",
    helper: "和小程序一致，先确定早餐、午餐、晚餐、下午茶或夜宵。",
    options: ["早餐", "午餐", "晚餐", "下午茶", "夜宵"]
  },
  {
    id: "branchPreference",
    title: "这次更想吃哪类？",
    helper: "可以直接选择一个大方向，后面还能补充调整。",
    options: ["饭/面正餐", "甜品/下午茶", "火锅/烤肉", "轻食/咖啡", "都可以"]
  },
  {
    id: "tasteTags",
    title: "口味和感觉更偏向？",
    helper: "可多选。",
    multi: true,
    options: ["清淡", "鲜香", "酸甜", "重口", "热乎", "有汤", "精致一点"]
  },
  {
    id: "needTags",
    title: "这次最想优先满足什么？",
    helper: "可多选，AI 会优先满足这些条件。",
    multi: true,
    options: ["近一点", "便宜一点", "适合聊天", "快速出餐", "不排队", "可打包"]
  },
  {
    id: "avoidTags",
    title: "这次不想踩哪些雷？",
    helper: "可多选，也可以后面手动补充。",
    multi: true,
    options: ["太辣", "太油", "排队久", "太远", "奶制品", "海鲜", "甜腻"]
  },
  {
    id: "spicyLevel",
    title: "辣度能接受到哪里？",
    helper: "会影响推荐的风险提醒。",
    options: ["不辣", "微辣", "都可以", "能吃辣"]
  },
  {
    id: "budget",
    title: "预算大概是多少？",
    helper: "按人均估算。",
    options: ["30元以内", "30-50元", "50-80元", "80元以上"]
  },
  {
    id: "distance",
    title: "距离希望控制在？",
    helper: "会和场景、预算一起权衡。",
    options: ["500米以内", "1公里以内", "2公里以内", "都可以"]
  },
  {
    id: "userNotes",
    title: "还有其他补充吗？",
    helper: "例如：想坐一会儿、不要太吵、最好能外带。可跳过。",
    text: true,
    options: []
  }
];

const fallbackRecommendations: RecommendationCard[] = [
  {
    id: "fallback-dessert",
    name: "法式甜品下午茶",
    type: "甜品/下午茶",
    perCapita: "68",
    distance: "650 m",
    rating: 4.7,
    matchedTags: ["下午茶", "甜品", "精致一点", "1公里以内"],
    reason: "适合想坐下来慢慢吃甜品的场景，预算和距离都比较稳。",
    riskTip: "热门时段可能限量，建议先确认库存。"
  },
  {
    id: "fallback-rice",
    name: "校园旁轻正餐",
    type: "简餐",
    perCapita: "45",
    distance: "520 m",
    rating: 4.5,
    matchedTags: ["近一点", "便宜一点", "快速出餐"],
    reason: "适合午晚餐快速解决，价格友好，路程短。",
    riskTip: "口味偏稳妥，如果想吃重口可再换一批。"
  },
  {
    id: "fallback-cafe",
    name: "精品咖啡甜品馆",
    type: "咖啡/甜品",
    perCapita: "72",
    distance: "950 m",
    rating: 4.6,
    matchedTags: ["适合聊天", "下午茶", "精致一点"],
    reason: "适合聊天和轻松停留，体验完整。",
    riskTip: "下午高峰座位可能紧张。"
  }
];

const themeOptions = [
  { id: "mint", name: "薄荷绿", bg: "bg-[#effff8]", accent: "text-emerald-700" },
  { id: "sun", name: "暖阳黄", bg: "bg-[#fff8df]", accent: "text-amber-700" },
  { id: "night", name: "夜间灰", bg: "bg-[#eef2f7]", accent: "text-slate-700" }
];

function storageKey(userId: string, suffix: string) {
  return `meituan_web_demo:${userId}:${suffix}`;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    let code = "";

    try {
      const body = await response.json();
      if (typeof body?.error === "string") {
        message = body.error;
      } else if (body?.error?.message) {
        message = body.error.message;
        code = body.error.code || "";
      } else if (body?.detail) {
        message = body.detail;
      }
    } catch {
      // Keep fallback message.
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.code = code;
    throw error;
  }

  return await response.json() as T;
}

function formatPrice(value: string) {
  const match = String(value || "").match(/\d+/);
  return match ? `人均 ${match[0]} 元` : "人均待确认";
}

function budgetMaxFromText(value: string) {
  if (value.includes("30")) return 30;
  if (value.includes("50")) return 50;
  if (value.includes("80")) return 80;
  return 120;
}

function distanceKmFromText(value: string) {
  if (value.includes("500")) return 0.5;
  if (value.includes("1")) return 1;
  if (value.includes("2")) return 2;
  return 5;
}

function normalizeCards(cards: RecommendationCard[], favorites: RecommendationCard[]) {
  const favoriteKeys = new Set(favorites.map((item) => item.id || item.name));
  return cards.map((item) => ({
    ...item,
    perCapitaDisplay: item.perCapitaDisplay || formatPrice(item.perCapita),
    isFavorited: favoriteKeys.has(item.id || item.name)
  }));
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

function normalizeSelfChecks(route: WeekendPlan["routes"][number]) {
  if (!route.selfChecks) {
    return [];
  }

  if (Array.isArray(route.selfChecks)) {
    return route.selfChecks.map((item, index) => ({
      key: `${route.id}-check-${index}`,
      label: item.label || item.status || "自查项",
      detail: item.detail || (item.passed === false ? "需要人工确认" : "已通过")
    }));
  }

  return Object.entries(route.selfChecks).map(([label, detail]) => ({
    key: `${route.id}-check-${label}`,
    label,
    detail
  }));
}

function buildLocalWeekendPlan(input: Record<string, string>): WeekendPlan {
  const budget = input.budgetMax || "120";
  const start = input.startArea || "学校东门";
  const mood = input.mood || "轻松一点";

  return {
    planId: `local_${Date.now().toString(36)}`,
    status: "ready",
    backendStatus: "fallback",
    backendMessage: "后端不可用时展示本地保守规划，便于完整体验。",
    weather: {
      status: "unavailable",
      fallback: true,
      summary: "天气暂不可用，优先选择室内/短步行方案。"
    },
    routes: [
      {
        id: "local-cafe-walk",
        type: "balanced",
        title: "咖啡开场 + 校园周边轻 citywalk",
        summary: `从${start}出发，适合${mood}，路线短、预算稳。`,
        estimatedBudget: `${budget} 元以内/人`,
        estimatedDurationMinutes: 150,
        transport: "步行 + 短途骑行",
        timeline: [
          { time: "0-20 分钟", title: "集合确认", placeName: start, activity: "确认返程时间和预算上限。", durationMinutes: 20 },
          { time: "20-70 分钟", title: "咖啡/轻食", placeName: "学校周边咖啡店", activity: "先坐下来补能量，避免一开始就走太多。", durationMinutes: 50 },
          { time: "70-130 分钟", title: "短步行路线", placeName: "校园周边", activity: "选 1-2 个拍照/散步点，保留弹性。", durationMinutes: 60 }
        ],
        selfChecks: {
          budget: `${budget} 元以内`,
          weather: "按天气未知处理，减少露天停留",
          returnTime: "预留 30 分钟返程"
        },
        risks: ["天气未确认，建议带伞并保留室内替代点"],
        inviteText: `从${start}出发，轻松走一条咖啡 + citywalk 路线，预算 ${budget} 元以内。`
      }
    ]
  };
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-emerald-100 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 ${className}`} />;
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`rounded-md border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:text-slate-400 ${className}`} />;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`w-full rounded-md border border-emerald-100 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 ${className}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`min-h-24 w-full rounded-md border border-emerald-100 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-emerald-500 ${className}`} />;
}

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${active ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-100 bg-emerald-50 text-emerald-800 hover:border-emerald-400"}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function ExperienceClient() {
  const [view, setView] = useState<View>("login");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loginId, setLoginId] = useState("judge-demo");
  const [loginName, setLoginName] = useState("评审 Demo 用户");
  const [authError, setAuthError] = useState("");
  const [themeId, setThemeId] = useState("mint");
  const [memory, setMemory] = useState<MemorySettings>(defaultMemory);
  const [records, setRecords] = useState<PreferenceRecord[]>([]);
  const [favorites, setFavorites] = useState<RecommendationCard[]>([]);

  const [foodIndex, setFoodIndex] = useState(0);
  const [foodSlots, setFoodSlots] = useState<FoodSlots>({ mealPurpose: "", branchPreference: "", budget: "", distance: "", userNotes: "" });
  const [foodPrefs, setFoodPrefs] = useState<FoodPreferences>({ tasteTags: [], needTags: [], avoidTags: [], spicyLevel: "" });
  const [foodRecommendations, setFoodRecommendations] = useState<RecommendationCard[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodNotice, setFoodNotice] = useState("");
  const [adjustmentText, setAdjustmentText] = useState("");
  const [batchIndex, setBatchIndex] = useState(0);

  const [groupDraft, setGroupDraft] = useState({
    creatorName: "我",
    rawRequest: "周六晚上 4 个人在学校附近聚餐，人均 80 内，适合聊天。",
    locationText: "学校东门",
    expectedPeopleCount: 4,
    dinnerTime: "周六 18:30"
  });
  const [groupParticipant, setGroupParticipant] = useState({
    nickname: "我",
    rawPreference: "想吃不太辣、适合聊天的店，预算 80 以内。",
    budgetMax: "80",
    spicyPreference: "no_spicy",
    leaveBefore: "20:30"
  });
  const [groupTaskId, setGroupTaskId] = useState("");
  const [groupInviteToken, setGroupInviteToken] = useState("");
  const [groupBoard, setGroupBoard] = useState<GroupBoard | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupNotice, setGroupNotice] = useState("");

  const [weekendForm, setWeekendForm] = useState({
    dateLabel: "周六",
    startTime: "14:00",
    endTime: "17:00",
    budgetMax: "120",
    startArea: "学校东门",
    mood: "轻松一点",
    energyLevel: "中等",
    companions: "朋友",
    interests: "咖啡, citywalk, 拍照"
  });
  const [weekendPlan, setWeekendPlan] = useState<WeekendPlan | null>(null);
  const [weekendLoading, setWeekendLoading] = useState(false);
  const [weekendNotice, setWeekendNotice] = useState("");

  const theme = useMemo(() => themeOptions.find((item) => item.id === themeId) || themeOptions[0], [themeId]);
  const currentQuestion = foodQuestions[foodIndex];
  const isFoodComplete = foodIndex >= foodQuestions.length;

  useEffect(() => {
    const stored = safeJsonParse<Identity | null>(window.localStorage.getItem(identityKey), null);
    if (stored?.sessionToken && stored.userId) {
      setIdentity(stored);
      setLoginId(stored.demoUserId);
      setLoginName(stored.displayName);
      setView("home");
    }
  }, []);

  useEffect(() => {
    if (!identity) {
      return;
    }

    setMemory(safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "memory")), defaultMemory));
    setRecords(safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "records")), []));
    setFavorites(safeJsonParse(window.localStorage.getItem(storageKey(identity.userId, "favorites")), []));
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("groupTaskId");
    const inviteToken = params.get("inviteToken");
    if (taskId && inviteToken) {
      setGroupTaskId(taskId);
      setGroupInviteToken(inviteToken);
      setView("group-board");
      void loadGroupBoard(taskId, inviteToken, identity.sessionToken);
    }
  }, [identity]);

  function persistMemory(next: MemorySettings) {
    if (!identity) return;
    setMemory(next);
    window.localStorage.setItem(storageKey(identity.userId, "memory"), JSON.stringify(next));
  }

  function persistRecords(next: PreferenceRecord[]) {
    if (!identity) return;
    setRecords(next);
    window.localStorage.setItem(storageKey(identity.userId, "records"), JSON.stringify(next.slice(0, 20)));
  }

  function persistFavorites(next: RecommendationCard[]) {
    if (!identity) return;
    setFavorites(next);
    window.localStorage.setItem(storageKey(identity.userId, "favorites"), JSON.stringify(next.slice(0, 30)));
    setFoodRecommendations((items) => normalizeCards(items, next));
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    try {
      const result = await requestJson<Identity>("/api/demo/session", {
        method: "POST",
        body: JSON.stringify({ demoUserId: loginId, displayName: loginName })
      });
      const nextIdentity = {
        demoUserId: result.demoUserId,
        displayName: result.displayName,
        userId: result.userId,
        sessionToken: result.sessionToken
      };
      window.localStorage.setItem(identityKey, JSON.stringify(nextIdentity));
      setIdentity(nextIdentity);
      setView("home");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }

  function logout() {
    window.localStorage.removeItem(identityKey);
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

  function updateFoodValue(questionId: string, value: string) {
    if (questionId === "mealPurpose" || questionId === "branchPreference" || questionId === "budget" || questionId === "distance" || questionId === "userNotes") {
      setFoodSlots((current) => ({ ...current, [questionId]: value }));
      return;
    }

    if (questionId === "spicyLevel") {
      setFoodPrefs((current) => ({ ...current, spicyLevel: value }));
    }
  }

  function toggleFoodTag(questionId: string, value: string) {
    const key = questionId as "tasteTags" | "needTags" | "avoidTags";
    setFoodPrefs((current) => {
      const list = current[key] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  }

  async function rankLocalRestaurants(excludeIds: string[] = []): Promise<RecommendationCard[]> {
    try {
      const result = await requestJson<{ items: Array<Record<string, unknown>> }>("/api/restaurants/rank", {
        method: "POST",
        body: JSON.stringify({
          slots: {
            scene: "soloToday",
            tasteTags: foodPrefs.tasteTags,
            needTags: foodPrefs.needTags,
            avoidTags: [...foodPrefs.avoidTags, ...memory.avoidTags],
            budgetMax: budgetMaxFromText(foodSlots.budget || memory.budget),
            maxDistanceKm: distanceKmFromText(foodSlots.distance || memory.distance)
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

  async function generateFoodRecommendations(options: { adjustment?: string; refresh?: boolean } = {}) {
    if (!identity) return;
    setFoodLoading(true);
    setFoodNotice("");
    const excludeIds = options.refresh ? foodRecommendations.map((item) => item.id) : [];
    const nextBatch = options.refresh ? batchIndex + 1 : batchIndex;

    try {
      const response = await requestJson<{ recommendations: RecommendationCard[]; source?: string; diagnostics?: { durationMs?: number } }>("/api/food/recommend", {
        method: "POST",
        body: JSON.stringify({
          slots: {
            mealPurpose: foodSlots.mealPurpose,
            branchPreference: foodSlots.branchPreference,
            budget: foodSlots.budget || memory.budget,
            distance: foodSlots.distance || memory.distance
          },
          preferences: {
            tasteTags: foodPrefs.tasteTags,
            needTags: foodPrefs.needTags,
            avoidTags: [...foodPrefs.avoidTags, ...memory.avoidTags],
            spicyLevel: foodPrefs.spicyLevel || memory.spicyLevel
          },
          memoryProfile: {
            enabled: memory.permissions.stableFoodMemory,
            stableFoodPreferences: {
              avoidTags: memory.avoidTags,
              spicyLevel: memory.spicyLevel,
              source: "web-demo"
            },
            permissions: {
              behaviorLearningEnabled: memory.permissions.behaviorLearning,
              rememberTastePattern: memory.permissions.recommendationHistory,
              rememberBudgetByMeal: true,
              rememberDistancePreference: true,
              rememberCommonCategories: true
            }
          },
          requestContext: {
            excludeIds,
            batchIndex: nextBatch,
            adjustment: options.adjustment ? { types: [options.adjustment], avoidCategories: [] } : undefined
          }
        })
      }, identity.sessionToken);

      const cards = normalizeCards(response.recommendations || [], favorites);
      setFoodRecommendations(cards);
      setBatchIndex(nextBatch);
      setFoodNotice(`OpenClaw 推荐成功${response.diagnostics?.durationMs ? `，耗时 ${response.diagnostics.durationMs}ms` : ""}。`);
    } catch (error) {
      if (handleAuthError(error)) return;
      const localCards = normalizeCards(await rankLocalRestaurants(excludeIds), favorites);
      setFoodRecommendations(localCards);
      setBatchIndex(nextBatch);
      setFoodNotice(`远端推荐不可用，已切换本地保守推荐：${error instanceof Error ? error.message : String(error)}`);
    } finally {
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
      recommendations: foodRecommendations.slice(0, 3)
    };
    persistRecords([record, ...records]);
    setFoodNotice("已记住这次偏好，首页和下次推荐会读取这条记录。");
  }

  function toggleFavorite(card: RecommendationCard) {
    const key = card.id || card.name;
    const exists = favorites.some((item) => (item.id || item.name) === key);
    const next = exists ? favorites.filter((item) => (item.id || item.name) !== key) : [{ ...card, isFavorited: true }, ...favorites];
    persistFavorites(next);
  }

  async function createGroupTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity) return;
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const result = await requestJson<{ taskId: string; inviteToken: string; board: GroupBoard }>("/api/group-tasks", {
        method: "POST",
        body: JSON.stringify(groupDraft)
      }, identity.sessionToken);
      setGroupTaskId(result.taskId);
      setGroupInviteToken(result.inviteToken);
      setGroupBoard(result.board);
      setView("group-fill");
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function loadGroupBoard(taskId = groupTaskId, inviteToken = groupInviteToken, token = identity?.sessionToken) {
    if (!taskId || !inviteToken || !token) return;
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(taskId)}?inviteToken=${encodeURIComponent(inviteToken)}`, {}, token);
      setGroupBoard(board);
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function submitGroupParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || !groupTaskId || !groupInviteToken) return;
    setGroupLoading(true);
    setGroupNotice("");

    try {
      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(groupTaskId)}/participants`, {
        method: "POST",
        body: JSON.stringify({
          inviteToken: groupInviteToken,
          clientId: identity.userId,
          nickname: groupParticipant.nickname,
          rawPreference: groupParticipant.rawPreference,
          manualFields: {
            budgetMax: Number(groupParticipant.budgetMax) || undefined,
            spicyPreference: groupParticipant.spicyPreference,
            leaveBefore: groupParticipant.leaveBefore
          }
        })
      }, identity.sessionToken);
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

    try {
      const board = await requestJson<GroupBoard>(`/api/group-tasks/${encodeURIComponent(groupTaskId)}/recommend`, {
        method: "POST",
        body: JSON.stringify({ inviteToken: groupInviteToken })
      }, identity.sessionToken);
      setGroupBoard(board);
    } catch (error) {
      if (!handleAuthError(error)) {
        setGroupNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function createWeekendPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity) return;
    setWeekendLoading(true);
    setWeekendNotice("");

    const payload = {
      ...weekendForm,
      timeWindow: `${weekendForm.dateLabel} ${weekendForm.startTime}-${weekendForm.endTime}`,
      budgetMax: Number(weekendForm.budgetMax) || 120,
      interests: weekendForm.interests.split(/[，,、\s]+/).filter(Boolean),
      rawText: `${weekendForm.mood}，${weekendForm.energyLevel}体力，和${weekendForm.companions}一起。`
    };

    try {
      const plan = await requestJson<WeekendPlan>("/api/weekend/plans", {
        method: "POST",
        body: JSON.stringify(payload)
      }, identity.sessionToken);
      setWeekendPlan(plan);
      setWeekendNotice(plan.weather?.fallback ? "天气或外部服务不可用，后端已生成保守路线。" : "后端路线生成成功。");
    } catch (error) {
      if (handleAuthError(error)) return;
      setWeekendPlan(buildLocalWeekendPlan(weekendForm));
      setWeekendNotice(`后端不可用，已切换本地路线：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setWeekendLoading(false);
    }
  }

  async function copyText(text: string) {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
  }

  function resetFoodFlow() {
    setFoodIndex(0);
    setFoodSlots({ mealPurpose: "", branchPreference: "", budget: "", distance: "", userNotes: "" });
    setFoodPrefs({ tasteTags: [], needTags: [], avoidTags: [], spicyLevel: "" });
    setFoodRecommendations([]);
    setFoodNotice("");
    setBatchIndex(0);
  }

  if (!identity || view === "login") {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#eef8f5] px-5 py-10 text-[#12342f]">
        <form className="w-full max-w-[350px] rounded-md border border-emerald-100 bg-white p-6 shadow-xl sm:max-w-md" onSubmit={login}>
          <a className="text-sm font-bold text-emerald-700" href="/">返回作品首页</a>
          <h1 className="mt-5 text-2xl font-black leading-tight sm:text-3xl">进入 Web 版 AI 管家</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">输入一个 demo id 即可获得独立体验身份。不同 id 会区分用户状态和本地记忆。</p>
          <label className="mt-6 block text-sm font-bold">Demo ID</label>
          <TextInput value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="judge-demo" />
          <label className="mt-4 block text-sm font-bold">展示昵称</label>
          <TextInput value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="评审 Demo 用户" />
          {authError ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{authError}</p> : null}
          <PrimaryButton className="mt-6 w-full" type="submit">进入在线体验</PrimaryButton>
        </form>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${theme.bg} text-[#12342f]`}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_430px_1fr]">
        <aside className="space-y-4">
          <Panel>
            <a className="text-sm font-bold text-emerald-700" href="/">作品首页</a>
            <h1 className="mt-4 text-2xl font-black">饿了幺 AI 管家</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">当前身份：{identity.displayName}</p>
            <p className="mt-1 break-all text-xs text-slate-500">userId: {identity.userId}</p>
            <SecondaryButton className="mt-4 w-full" onClick={logout} type="button">退出 demo 身份</SecondaryButton>
          </Panel>
          <Panel>
            <h2 className="text-sm font-black text-emerald-950">页面入口</h2>
            <div className="mt-3 grid gap-2">
              {[
                ["home", "首页"],
                ["food", "今天吃什么"],
                ["group-create", "多人约饭"],
                ["weekend", "周末轻规划"],
                ["memory", "管家记忆"]
              ].map(([target, label]) => (
                <button
                  className={`rounded-md px-3 py-2 text-left text-sm font-bold ${view === target ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-900"}`}
                  key={target}
                  onClick={() => setView(target as View)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </Panel>
          <Panel>
            <h2 className="text-sm font-black text-emerald-950">主题</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {themeOptions.map((option) => (
                <Chip active={themeId === option.id} key={option.id} onClick={() => setThemeId(option.id)}>{option.name}</Chip>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="mx-auto w-full max-w-[430px] rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl">
          <div className="min-h-[760px] overflow-hidden rounded-[1.45rem] bg-[#effff8]">
            <header className="flex items-center justify-between border-b border-emerald-100 bg-white px-5 py-4">
              <button className="text-sm font-black text-emerald-800" onClick={() => setView("home")} type="button">‹</button>
              <div className="text-center">
                <div className="text-sm font-black">饿了幺</div>
                <div className="text-xs text-emerald-700">Web 复刻版</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Demo</span>
            </header>
            <div className="max-h-[700px] overflow-y-auto p-4">
              {view === "home" ? renderHome() : null}
              {view === "food" ? renderFood() : null}
              {view === "group-create" ? renderGroupCreate() : null}
              {view === "group-fill" ? renderGroupFill() : null}
              {view === "group-board" ? renderGroupBoard() : null}
              {view === "weekend" ? renderWeekend() : null}
              {view === "memory" ? renderMemory() : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel>
            <h2 className="text-xl font-black text-emerald-950">当前体验状态</h2>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
              <p>最近偏好记录：{records.length} 条</p>
              <p>收藏店铺：{favorites.length} 家</p>
              <p>多人约饭任务：{groupTaskId || "未创建"}</p>
              <p>周末规划：{weekendPlan?.planId || "未生成"}</p>
            </div>
          </Panel>
          <Panel>
            <h2 className="text-xl font-black text-emerald-950">验收覆盖</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
              <li>登录/demo 身份初始化</li>
              <li>首页、历史、收藏、主题</li>
              <li>今天吃什么问答与推荐</li>
              <li>多人约饭创建、填写、看板</li>
              <li>周末规划生成与 fallback</li>
              <li>记忆设置与本地持久化</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </main>
  );

  function renderHome() {
    const recent = records[0];
    return (
      <div className="space-y-4">
        <Panel>
          <p className={`text-sm font-bold ${theme.accent}`}>AI 管家已就绪</p>
          <h2 className="mt-2 text-2xl font-black">今天想让管家帮你做什么？</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">这里对齐小程序首页：进入推荐、多人约饭、周末规划和记忆设置。</p>
        </Panel>
        <div className="grid gap-3">
          <PrimaryButton onClick={() => setView("food")} type="button">今天吃什么</PrimaryButton>
          <SecondaryButton onClick={() => setView("group-create")} type="button">发起多人约饭</SecondaryButton>
          <SecondaryButton onClick={() => setView("weekend")} type="button">生成周末轻规划</SecondaryButton>
          <SecondaryButton onClick={() => setView("memory")} type="button">管理 AI 管家记忆</SecondaryButton>
        </div>
        <Panel>
          <h3 className="text-lg font-black">最近偏好</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{recent ? recent.summary : "还没有记录。完成一次推荐后可选择记住偏好。"}</p>
        </Panel>
        <Panel>
          <h3 className="text-lg font-black">收藏店铺</h3>
          <div className="mt-3 space-y-2">
            {favorites.slice(0, 4).map((item) => (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900" key={item.id || item.name}>{item.name}</div>
            ))}
            {!favorites.length ? <p className="text-sm text-slate-600">推荐结果里点收藏后会出现在这里。</p> : null}
          </div>
        </Panel>
      </div>
    );
  }

  function renderFood() {
    if (isFoodComplete) {
      return (
        <div className="space-y-4">
          <Panel>
            <h2 className="text-2xl font-black">偏好确认</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{summarizeFood(foodSlots, foodPrefs) || "暂无偏好"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...foodPrefs.tasteTags, ...foodPrefs.needTags, ...foodPrefs.avoidTags, foodPrefs.spicyLevel].filter(Boolean).map((tag) => (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" key={tag}>{tag}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SecondaryButton onClick={resetFoodFlow} type="button">重新开始</SecondaryButton>
              <PrimaryButton disabled={foodLoading} onClick={() => void generateFoodRecommendations()} type="button">
                {foodLoading ? "生成中..." : "生成推荐"}
              </PrimaryButton>
            </div>
          </Panel>
          {foodNotice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">{foodNotice}</p> : null}
          {foodRecommendations.length ? (
            <div className="space-y-3">
              {foodRecommendations.map((card, index) => (
                <Panel key={card.id || card.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{index === 0 ? "首推" : "备选"}</span>
                      <h3 className="mt-3 text-xl font-black">{card.name}</h3>
                    </div>
                    <button className="rounded-full border border-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700" onClick={() => toggleFavorite(card)} type="button">
                      {card.isFavorited ? "已收藏" : "收藏"}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{card.perCapitaDisplay || formatPrice(card.perCapita)} · {card.distance} · 评分 {card.rating || "待确认"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(card.matchedTags || []).slice(0, 5).map((tag) => <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700" key={tag}>{tag}</span>)}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{card.reason}</p>
                  <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">管家提醒：{card.riskTip}</p>
                </Panel>
              ))}
              <Panel>
                <label className="block text-sm font-bold">想怎么调整？</label>
                <TextInput value={adjustmentText} onChange={(event) => setAdjustmentText(event.target.value)} placeholder="例如：更近一点 / 不想吃甜的" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SecondaryButton disabled={foodLoading} onClick={() => void generateFoodRecommendations({ refresh: true })} type="button">换一批</SecondaryButton>
                  <PrimaryButton disabled={foodLoading} onClick={() => void generateFoodRecommendations({ adjustment: adjustmentText || "adjust", refresh: true })} type="button">按反馈调整</PrimaryButton>
                </div>
                <SecondaryButton className="mt-3 w-full" onClick={saveCurrentPreferenceRecord} type="button">记住这次偏好</SecondaryButton>
              </Panel>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Panel>
          <p className="text-sm font-bold text-emerald-700">问题 {foodIndex + 1}/{foodQuestions.length}</p>
          <h2 className="mt-2 text-2xl font-black">{currentQuestion.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{currentQuestion.helper}</p>
        </Panel>
        <Panel>
          {currentQuestion.text ? (
            <TextArea value={foodSlots.userNotes} onChange={(event) => updateFoodValue("userNotes", event.target.value)} placeholder="可以留空跳过" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {currentQuestion.options.map((option) => {
                const currentValue = foodSlots[currentQuestion.id as keyof FoodSlots] || foodPrefs[currentQuestion.id as keyof FoodPreferences];
                const active = Array.isArray(currentValue) ? currentValue.includes(option) : currentValue === option;
                return (
                  <Chip
                    active={active}
                    key={option}
                    onClick={() => currentQuestion.multi ? toggleFoodTag(currentQuestion.id, option) : updateFoodValue(currentQuestion.id, option)}
                  >
                    {option}
                  </Chip>
                );
              })}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <SecondaryButton disabled={foodIndex === 0} onClick={() => setFoodIndex(Math.max(0, foodIndex - 1))} type="button">上一步</SecondaryButton>
            <PrimaryButton onClick={() => setFoodIndex(foodIndex + 1)} type="button">{currentQuestion.text ? "完成" : "下一步"}</PrimaryButton>
          </div>
        </Panel>
        {records[0] && foodIndex === 0 ? (
          <Panel>
            <h3 className="text-lg font-black">可复用最近偏好</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{records[0].summary}</p>
            <SecondaryButton
              className="mt-3 w-full"
              onClick={() => {
                setFoodSlots(records[0].slots);
                setFoodPrefs(records[0].preferences);
                setFoodIndex(foodQuestions.length);
              }}
              type="button"
            >
              应用这条偏好
            </SecondaryButton>
          </Panel>
        ) : null}
      </div>
    );
  }

  function renderGroupCreate() {
    return (
      <form className="space-y-4" onSubmit={createGroupTask}>
        <Panel>
          <h2 className="text-2xl font-black">发起多人约饭</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">创建后会得到 invite token，浏览器版用复制链接替代小程序分享。</p>
        </Panel>
        <Panel className="space-y-3">
          <TextInput value={groupDraft.creatorName} onChange={(event) => setGroupDraft({ ...groupDraft, creatorName: event.target.value })} placeholder="发起人" />
          <TextArea value={groupDraft.rawRequest} onChange={(event) => setGroupDraft({ ...groupDraft, rawRequest: event.target.value })} placeholder="聚餐需求" />
          <TextInput value={groupDraft.locationText} onChange={(event) => setGroupDraft({ ...groupDraft, locationText: event.target.value })} placeholder="地点" />
          <TextInput type="number" value={groupDraft.expectedPeopleCount} onChange={(event) => setGroupDraft({ ...groupDraft, expectedPeopleCount: Number(event.target.value) })} placeholder="人数" />
          <TextInput value={groupDraft.dinnerTime} onChange={(event) => setGroupDraft({ ...groupDraft, dinnerTime: event.target.value })} placeholder="时间" />
          {groupNotice ? <p className="text-sm text-red-700">{groupNotice}</p> : null}
          <PrimaryButton className="w-full" disabled={groupLoading} type="submit">{groupLoading ? "创建中..." : "创建任务"}</PrimaryButton>
        </Panel>
      </form>
    );
  }

  function renderGroupFill() {
    return (
      <form className="space-y-4" onSubmit={submitGroupParticipant}>
        <Panel>
          <h2 className="text-2xl font-black">填写成员偏好</h2>
          <p className="mt-2 break-all text-sm leading-6 text-slate-600">任务：{groupTaskId || "未创建"}</p>
        </Panel>
        <Panel className="space-y-3">
          <TextInput value={groupParticipant.nickname} onChange={(event) => setGroupParticipant({ ...groupParticipant, nickname: event.target.value })} placeholder="昵称" />
          <TextArea value={groupParticipant.rawPreference} onChange={(event) => setGroupParticipant({ ...groupParticipant, rawPreference: event.target.value })} placeholder="偏好和硬约束" />
          <TextInput value={groupParticipant.budgetMax} onChange={(event) => setGroupParticipant({ ...groupParticipant, budgetMax: event.target.value })} placeholder="预算上限" />
          <TextInput value={groupParticipant.leaveBefore} onChange={(event) => setGroupParticipant({ ...groupParticipant, leaveBefore: event.target.value })} placeholder="最晚离开时间" />
          <div className="flex flex-wrap gap-2">
            {[
              ["no_spicy", "不辣"],
              ["any", "都可以"],
              ["spicy", "能吃辣"]
            ].map(([value, label]) => (
              <Chip active={groupParticipant.spicyPreference === value} key={value} onClick={() => setGroupParticipant({ ...groupParticipant, spicyPreference: value })}>{label}</Chip>
            ))}
          </div>
          {groupNotice ? <p className="text-sm text-red-700">{groupNotice}</p> : null}
          <PrimaryButton className="w-full" disabled={groupLoading} type="submit">{groupLoading ? "提交中..." : "提交偏好"}</PrimaryButton>
        </Panel>
      </form>
    );
  }

  function renderGroupBoard() {
    const shareLink = typeof window !== "undefined" && groupTaskId && groupInviteToken
      ? `${window.location.origin}/experience?groupTaskId=${encodeURIComponent(groupTaskId)}&inviteToken=${encodeURIComponent(groupInviteToken)}`
      : "";

    return (
      <div className="space-y-4">
        <Panel>
          <h2 className="text-2xl font-black">{groupBoard?.task.title || "多人约饭看板"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{groupBoard?.task.rawRequest || "创建任务后可在这里查看成员偏好和推荐。"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setView("group-fill")} type="button">继续填写</SecondaryButton>
            <SecondaryButton disabled={!shareLink} onClick={() => void copyText(shareLink)} type="button">复制分享链接</SecondaryButton>
          </div>
        </Panel>
        {groupNotice ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{groupNotice}</p> : null}
        <Panel>
          <h3 className="text-lg font-black">成员偏好</h3>
          <div className="mt-3 space-y-2">
            {(groupBoard?.participants || []).map((participant) => (
              <div className="rounded-md bg-emerald-50 p-3 text-sm" key={participant.participantId}>
                <div className="font-bold">{participant.nickname}</div>
                <div className="mt-1 leading-6 text-slate-600">{participant.rawPreference}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(participant.extractedConstraints?.hard_constraints || []).map((item) => (
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-rose-700" key={`hard-${participant.participantId}-${item}`}>{item}</span>
                  ))}
                  {(participant.extractedConstraints?.soft_preferences || []).map((item) => (
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700" key={`soft-${participant.participantId}-${item}`}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
            {!groupBoard?.participants?.length ? <p className="text-sm text-slate-600">还没有成员提交偏好。</p> : null}
          </div>
        </Panel>
        <Panel>
          <h3 className="text-lg font-black">冲突识别</h3>
          <div className="mt-3 space-y-2">
            {(groupBoard?.conflicts || []).map((conflict, index) => (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" key={`${conflict.type}-${index}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black text-amber-950">{conflict.description}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-amber-800">{conflict.severity}</span>
                </div>
                <p className="mt-2 leading-6 text-amber-900">{conflict.resolution_strategy}</p>
              </div>
            ))}
            {!groupBoard?.conflicts?.length ? <p className="text-sm text-slate-600">当前没有明显冲突，生成推荐时会继续检查预算、辣度、时间和距离。</p> : null}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">推荐方案</h3>
            <PrimaryButton disabled={groupLoading || !groupBoard?.participants?.length} onClick={() => void generateGroupRecommendation()} type="button">
              {groupLoading ? "生成中..." : "生成"}
            </PrimaryButton>
          </div>
          {groupBoard?.recommendationResult ? (
            <div className="mt-4 space-y-3">
              {groupBoard.recommendationResult.candidates.slice(0, 3).map((candidate) => (
                <div className="rounded-md border border-emerald-100 p-3" key={candidate.restaurant_id}>
                  <h4 className="font-black">{candidate.name}</h4>
                  <p className="mt-1 text-sm text-slate-600">人均 {candidate.avg_price} 元 · {candidate.distance_m} m · 得分 {candidate.score}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(candidate.tags || []).slice(0, 5).map((tag) => (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700" key={`${candidate.restaurant_id}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{candidate.reason}</p>
                  <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">排队风险：{candidate.queue_risk || "待确认"}</p>
                </div>
              ))}
              <div className="rounded-md bg-emerald-950 p-3 text-sm leading-6 text-white">
                <div className="font-black">最终建议：{groupBoard.recommendationResult.finalChoice.name}</div>
                <p className="mt-1 text-emerald-50">{groupBoard.recommendationResult.finalChoice.reason}</p>
                <p className="mt-1 text-emerald-100">备选：{groupBoard.recommendationResult.finalChoice.backup}</p>
                {groupBoard.recommendationResult.finalChoice.risks?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-50">
                    {groupBoard.recommendationResult.finalChoice.risks.map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                ) : null}
              </div>
              <p className="rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{groupBoard.recommendationResult.groupMessage}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">提交至少一个成员偏好后即可生成。</p>
          )}
        </Panel>
      </div>
    );
  }

  function renderWeekend() {
    return (
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={createWeekendPlan}>
          <Panel>
            <h2 className="text-2xl font-black">周末轻规划</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">输入时间、预算、体力和兴趣，生成 3 小时左右的轻路线。</p>
          </Panel>
          <Panel className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={weekendForm.dateLabel} onChange={(event) => setWeekendForm({ ...weekendForm, dateLabel: event.target.value })} placeholder="日期" />
              <TextInput value={weekendForm.budgetMax} onChange={(event) => setWeekendForm({ ...weekendForm, budgetMax: event.target.value })} placeholder="预算" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={weekendForm.startTime} onChange={(event) => setWeekendForm({ ...weekendForm, startTime: event.target.value })} placeholder="开始" />
              <TextInput value={weekendForm.endTime} onChange={(event) => setWeekendForm({ ...weekendForm, endTime: event.target.value })} placeholder="结束" />
            </div>
            <TextInput value={weekendForm.startArea} onChange={(event) => setWeekendForm({ ...weekendForm, startArea: event.target.value })} placeholder="出发区域" />
            <TextInput value={weekendForm.mood} onChange={(event) => setWeekendForm({ ...weekendForm, mood: event.target.value })} placeholder="心情" />
            <TextInput value={weekendForm.energyLevel} onChange={(event) => setWeekendForm({ ...weekendForm, energyLevel: event.target.value })} placeholder="体力" />
            <TextInput value={weekendForm.companions} onChange={(event) => setWeekendForm({ ...weekendForm, companions: event.target.value })} placeholder="同行人" />
            <TextInput value={weekendForm.interests} onChange={(event) => setWeekendForm({ ...weekendForm, interests: event.target.value })} placeholder="兴趣，用逗号分隔" />
            <PrimaryButton className="w-full" disabled={weekendLoading} type="submit">{weekendLoading ? "生成中..." : "生成路线"}</PrimaryButton>
          </Panel>
        </form>
        {weekendNotice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">{weekendNotice}</p> : null}
        {weekendPlan ? (
          <div className="space-y-3">
            <Panel>
              <h3 className="text-lg font-black">天气与策略</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{weekendPlan.weather?.summary || "天气信息待确认。"}</p>
              {weekendPlan.backendMessage ? <p className="mt-2 rounded-md bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">{weekendPlan.backendMessage}</p> : null}
            </Panel>
            {weekendPlan.routes.map((route) => (
              <Panel key={route.id}>
                <h3 className="text-xl font-black">{route.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{route.summary}</p>
                <p className="mt-2 text-sm font-bold text-emerald-800">{route.estimatedBudget || "预算待确认"} · {route.durationText || `${route.estimatedDurationMinutes || 150} 分钟`}</p>
                <div className="mt-3 space-y-2">
                  {(route.timeline || []).map((item, index) => (
                    <div className="rounded-md bg-emerald-50 p-3 text-sm" key={`${route.id}-${index}`}>
                      <div className="font-bold">{item.time} · {item.title}</div>
                      <div className="mt-1 text-slate-600">{item.placeName}：{item.activity}</div>
                    </div>
                  ))}
                </div>
                {normalizeSelfChecks(route).length ? (
                  <div className="mt-4">
                    <h4 className="text-sm font-black text-emerald-950">自查结果</h4>
                    <div className="mt-2 grid gap-2">
                      {normalizeSelfChecks(route).map((check) => (
                        <div className="rounded-md bg-slate-50 p-3 text-xs leading-5" key={check.key}>
                          <div className="font-bold text-slate-900">{check.label}</div>
                          <div className="mt-1 text-slate-600">{check.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {route.risks?.length ? (
                  <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    <div className="font-black">风险提示</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {route.risks.map((risk) => <li key={risk}>{risk}</li>)}
                    </ul>
                  </div>
                ) : null}
                {route.inviteText ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">{route.inviteText}</p> : null}
              </Panel>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderMemory() {
    return (
      <div className="space-y-4">
        <Panel>
          <h2 className="text-2xl font-black">AI 管家记忆</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">对齐小程序记忆页：管理忌口、辣度、预算、距离和行为学习权限。</p>
        </Panel>
        <Panel className="space-y-3">
          <label className="block text-sm font-bold">固定忌口</label>
          <div className="flex flex-wrap gap-2">
            {["太辣", "海鲜", "奶制品", "甜腻", "油炸", "排队久"].map((tag) => (
              <Chip
                active={memory.avoidTags.includes(tag)}
                key={tag}
                onClick={() => {
                  const nextTags = memory.avoidTags.includes(tag) ? memory.avoidTags.filter((item) => item !== tag) : [...memory.avoidTags, tag];
                  persistMemory({ ...memory, avoidTags: nextTags });
                }}
              >
                {tag}
              </Chip>
            ))}
          </div>
          <label className="block text-sm font-bold">默认辣度</label>
          <div className="flex flex-wrap gap-2">
            {["不辣", "微辣", "都可以", "能吃辣"].map((tag) => (
              <Chip active={memory.spicyLevel === tag} key={tag} onClick={() => persistMemory({ ...memory, spicyLevel: tag })}>{tag}</Chip>
            ))}
          </div>
          <label className="block text-sm font-bold">默认预算</label>
          <TextInput value={memory.budget} onChange={(event) => persistMemory({ ...memory, budget: event.target.value })} />
          <label className="block text-sm font-bold">默认距离</label>
          <TextInput value={memory.distance} onChange={(event) => persistMemory({ ...memory, distance: event.target.value })} />
        </Panel>
        <Panel>
          <h3 className="text-lg font-black">记忆权限</h3>
          <div className="mt-3 space-y-3">
            {[
              ["stableFoodMemory", "使用长期饮食偏好"],
              ["behaviorLearning", "允许行为学习"],
              ["recommendationHistory", "记住推荐历史"],
              ["weekendPlans", "记住周末规划"]
            ].map(([key, label]) => (
              <label className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold" key={key}>
                <span>{label}</span>
                <input
                  checked={memory.permissions[key as keyof MemorySettings["permissions"]]}
                  onChange={(event) => persistMemory({ ...memory, permissions: { ...memory.permissions, [key]: event.target.checked } })}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        </Panel>
        <Panel>
          <h3 className="text-lg font-black">历史记录</h3>
          <div className="mt-3 space-y-2">
            {records.map((record) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm" key={record.id}>
                <div className="font-bold">{record.summary}</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(record.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!records.length ? <p className="text-sm text-slate-600">暂无历史记录。</p> : null}
          </div>
          <SecondaryButton className="mt-3 w-full" onClick={() => persistRecords([])} type="button">清空历史</SecondaryButton>
        </Panel>
      </div>
    );
  }
}
