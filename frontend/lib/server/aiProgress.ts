import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withFileLock } from "@/lib/server/fileLock";

export type AiProgressScene = "food_recommendation" | "group_dining" | "weekend_plan";
export type AiProgressStageKey = "understand" | "retrieve" | "filter" | "rank" | "compose";
export type AiProgressStatus = "running" | "done" | "fallback" | "error";
export type AiProgressStepStatus = "pending" | "running" | "done" | "fallback" | "error";

export type AiProgressStep = {
  key: AiProgressStageKey;
  label: string;
  detail: string;
  status: AiProgressStepStatus;
  updatedAt?: string;
};

export type AiProgressSnapshot = {
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
  source: "server";
  steps: AiProgressStep[];
};

type AiProgressDatabase = {
  version: 1;
  records: Record<string, AiProgressSnapshot>;
  order: string[];
};

type StartProgressInput = {
  traceId?: string;
  userId?: string;
  message?: string;
  note?: string;
};

const MAX_RECORDS = 120;
const STAGE_ORDER: AiProgressStageKey[] = ["understand", "retrieve", "filter", "rank", "compose"];
const STAGE_PROGRESS: Record<AiProgressStageKey, number> = {
  understand: 12,
  retrieve: 30,
  filter: 50,
  rank: 72,
  compose: 88
};

const SCENE_STEPS: Record<AiProgressScene, Array<Omit<AiProgressStep, "status" | "updatedAt">>> = {
  food_recommendation: [
    { key: "understand", label: "理解用餐需求", detail: "读取场景、预算、距离和忌口" },
    { key: "retrieve", label: "准备候选店铺", detail: "汇总餐厅候选和账号画像" },
    { key: "filter", label: "筛掉不合适选项", detail: "对齐预算、距离、忌口和临时偏好" },
    { key: "rank", label: "计算匹配排序", detail: "结合偏好和记忆给候选打分" },
    { key: "compose", label: "生成推荐卡片", detail: "组织推荐理由和管家提醒" }
  ],
  group_dining: [
    { key: "understand", label: "读取约饭任务", detail: "汇总任务、成员和可见偏好" },
    { key: "retrieve", label: "准备候选餐厅", detail: "整理成员约束和餐厅候选数据" },
    { key: "filter", label: "检查硬约束冲突", detail: "预算、忌口、时间和人数先过一遍" },
    { key: "rank", label: "折中排序", detail: "兼顾公平性、满意度和可执行性" },
    { key: "compose", label: "生成群体方案", detail: "输出主推、备选和群发文案" }
  ],
  weekend_plan: [
    { key: "understand", label: "读取出行需求", detail: "理解时间、预算、体力和兴趣" },
    { key: "retrieve", label: "汇总天气与地点", detail: "准备天气、POI 和路线候选" },
    { key: "filter", label: "自检时间预算", detail: "检查天气、步行、预算和返程风险" },
    { key: "rank", label: "排出路线优先级", detail: "按轻松度和兴趣匹配排序" },
    { key: "compose", label: "拼好时间线", detail: "生成路线、预算和邀约文案" }
  ]
};

let operationQueue: Promise<unknown> = Promise.resolve();

export function createAiProgressTraceId() {
  return `aip_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function normalizeAiProgressTraceId(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const traceId = value.trim();
  if (/^[A-Za-z0-9_-]{8,96}$/.test(traceId)) {
    return traceId;
  }

  return undefined;
}

export async function startAiProgress(scene: AiProgressScene, input: StartProgressInput = {}) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const timestamp = nowIso();
    const traceId = normalizeAiProgressTraceId(input.traceId) || createAiProgressTraceId();
    const firstStep = SCENE_STEPS[scene][0];
    const snapshot: AiProgressSnapshot = {
      traceId,
      scene,
      userId: input.userId,
      status: "running",
      currentStage: firstStep.key,
      message: input.message || firstStep.detail,
      note: input.note,
      progress: STAGE_PROGRESS[firstStep.key],
      startedAt: timestamp,
      updatedAt: timestamp,
      source: "server",
      steps: SCENE_STEPS[scene].map((step, index) => ({
        ...step,
        status: index === 0 ? "running" : "pending",
        updatedAt: index === 0 ? timestamp : undefined
      }))
    };

    database.records[traceId] = snapshot;
    database.order = [traceId, ...database.order.filter((item) => item !== traceId)].slice(0, MAX_RECORDS);
    pruneDatabase(database);
    await writeDatabase(database);
    return snapshot;
  });
}

export async function advanceAiProgress(
  traceId: string | undefined,
  stage: AiProgressStageKey,
  input: {
    message?: string;
    note?: string;
    progress?: number;
  } = {}
) {
  const normalizedTraceId = normalizeAiProgressTraceId(traceId);
  if (!normalizedTraceId) {
    return undefined;
  }

  return enqueueWrite(async () => {
    const database = await readDatabase();
    const snapshot = database.records[normalizedTraceId];
    if (!snapshot) {
      return undefined;
    }

    const timestamp = nowIso();
    const currentIndex = STAGE_ORDER.indexOf(stage);
    const stageConfig = SCENE_STEPS[snapshot.scene].find((step) => step.key === stage);

    snapshot.status = "running";
    snapshot.currentStage = stage;
    snapshot.message = input.message || stageConfig?.detail || snapshot.message;
    snapshot.note = input.note;
    snapshot.progress = clampProgress(input.progress ?? STAGE_PROGRESS[stage]);
    snapshot.updatedAt = timestamp;
    delete snapshot.completedAt;
    snapshot.steps = snapshot.steps.map((step) => {
      const stepIndex = STAGE_ORDER.indexOf(step.key);
      if (stepIndex < currentIndex) {
        return { ...step, status: "done", updatedAt: step.updatedAt || timestamp };
      }
      if (step.key === stage) {
        return { ...step, status: "running", updatedAt: timestamp };
      }
      return { ...step, status: "pending" };
    });

    await writeDatabase(database);
    return snapshot;
  });
}

export async function completeAiProgress(
  traceId: string | undefined,
  status: Exclude<AiProgressStatus, "running">,
  input: {
    message?: string;
    note?: string;
  } = {}
) {
  const normalizedTraceId = normalizeAiProgressTraceId(traceId);
  if (!normalizedTraceId) {
    return undefined;
  }

  return enqueueWrite(async () => {
    const database = await readDatabase();
    const snapshot = database.records[normalizedTraceId];
    if (!snapshot) {
      return undefined;
    }

    const timestamp = nowIso();
    snapshot.status = status;
    snapshot.currentStage = "compose";
    snapshot.message = input.message || defaultCompleteMessage(status);
    snapshot.note = input.note;
    snapshot.progress = status === "done" ? 100 : 96;
    snapshot.updatedAt = timestamp;
    snapshot.completedAt = timestamp;
    snapshot.steps = snapshot.steps.map((step) => ({
      ...step,
      status: status === "done" ? "done" : status,
      updatedAt: step.updatedAt || timestamp
    }));

    await writeDatabase(database);
    return snapshot;
  });
}

export async function getAiProgress(traceId: string, userId?: string) {
  const normalizedTraceId = normalizeAiProgressTraceId(traceId);
  if (!normalizedTraceId) {
    return undefined;
  }

  const database = await readDatabase();
  const snapshot = database.records[normalizedTraceId];
  if (!snapshot) {
    return undefined;
  }
  if (snapshot.userId && userId && snapshot.userId !== userId) {
    return undefined;
  }
  return snapshot;
}

function getStateFilePath() {
  const configured = process.env.MEITUAN_AI_PROGRESS_STATE_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "ai-progress.json");
}

async function readDatabase(): Promise<AiProgressDatabase> {
  const filePath = getStateFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AiProgressDatabase;

    if (parsed.version !== 1 || !parsed.records || !Array.isArray(parsed.order)) {
      throw new Error("Unsupported AI progress store format.");
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const database: AiProgressDatabase = {
      version: 1,
      records: {},
      order: []
    };
    await writeDatabase(database);
    return database;
  }
}

async function writeDatabase(database: AiProgressDatabase) {
  const filePath = getStateFilePath();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${randomUUID()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const run = () => withFileLock(getStateFilePath(), operation);
  const next = operationQueue.then(run, run);
  operationQueue = next.catch(() => undefined);
  return next;
}

function pruneDatabase(database: AiProgressDatabase) {
  const active = new Set(database.order.slice(0, MAX_RECORDS));
  for (const traceId of Object.keys(database.records)) {
    if (!active.has(traceId)) {
      delete database.records[traceId];
    }
  }
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function defaultCompleteMessage(status: Exclude<AiProgressStatus, "running">) {
  if (status === "done") {
    return "AI 管家已完成这次处理。";
  }
  if (status === "fallback") {
    return "远端 OpenClaw 暂时不可用，已切到本地规则兜底。";
  }
  return "生成中断了，可以稍后重试。";
}

function nowIso() {
  return new Date().toISOString();
}
