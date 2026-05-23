import { createHash, randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { demoTask, demoTaskId } from "@/lib/mockData";
import { buildMockParticipant, buildMockTitle, detectConflicts, extractBudgetMax, extractConstraints, generateMockRecommendation } from "@/lib/mockFunctions";
import type { Conflict, DinnerTask, Participant, ParticipantInput, RecommendationResult, RecommendationState, StoredTaskFields } from "@/lib/types";

type TaskRecord = StoredTaskFields & {
  task_id: string;
  invite_token_hash?: string;
  participants: Participant[];
  recommendation_state: RecommendationState;
  recommendation_result: RecommendationResult | null;
  created_at: string;
  updated_at: string;
};

type TaskDatabase = {
  version: 1;
  tasks: Record<string, TaskRecord>;
};

export type TaskPayload = {
  task: DinnerTask;
  participants: Participant[];
  conflicts: Conflict[];
  recommendation_state: RecommendationState;
  recommendation_result: RecommendationResult | null;
};

export type GroupTaskBoard = {
  task: {
    taskId: string;
    title: string;
    creatorName: string;
    rawRequest: string;
    locationText: string;
    expectedPeopleCount: number;
    dinnerTime: string;
    status: RecommendationState["status"];
    sharePath: string;
    createdAt: string;
    updatedAt: string;
    globalConstraints: DinnerTask["global_constraints"];
  };
  participants: Array<{
    participantId: string;
    clientId?: string;
    nickname: string;
    rawPreference: string;
    manualFields: {
      budgetMax?: number;
      spicyPreference?: ManualSpicyPreference;
      leaveBefore?: string;
    };
    extractedConstraints: Participant["extracted_constraints"];
  }>;
  conflicts: Conflict[];
  recommendationState: {
    status: RecommendationState["status"];
    hasGenerated: boolean;
    updatedAt: string;
    dirtyReason?: RecommendationState["dirty_reason"];
  };
  recommendationResult: {
    candidates: RecommendationResult["candidates"];
    finalChoice: RecommendationResult["final_choice"];
    groupMessage: string;
    normalAiMessage: string;
  } | null;
};

type ManualSpicyPreference = NonNullable<ParticipantInput["manual_fields"]["spicy_preference"]>;

export type GroupTaskError = {
  status: 400 | 403 | 404;
  error: {
    code: string;
    message: string;
  };
};

export type GroupTaskResult<T> = { status: 200; value: T } | GroupTaskError;

let operationQueue: Promise<unknown> = Promise.resolve();

function getStateFilePath() {
  const configured = process.env.MEITUAN_STATE_FILE?.trim();

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "dinner-tasks.json");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTaskFields(input: Partial<StoredTaskFields>): StoredTaskFields {
  const expectedPeople = Number(input.expected_people_count);
  const normalized: StoredTaskFields = {
    creator_name: input.creator_name?.trim() || demoTask.creator_name,
    raw_request: input.raw_request?.trim() || demoTask.raw_request,
    location_text: input.location_text?.trim() || demoTask.location_text,
    expected_people_count: Number.isFinite(expectedPeople) && expectedPeople > 0 ? expectedPeople : demoTask.expected_people_count,
    dinner_time: input.dinner_time?.trim() || demoTask.dinner_time,
    title: input.title?.trim()
  };

  return {
    ...normalized,
    title: normalized.title || buildMockTitle(normalized)
  };
}

function createRecommendationState(status: RecommendationState["status"], dirtyReason?: RecommendationState["dirty_reason"]): RecommendationState {
  return {
    status,
    hasGenerated: false,
    updated_at: nowIso(),
    dirty_reason: dirtyReason
  };
}

function createRecord(taskId: string, input: Partial<StoredTaskFields>, participants: Participant[]): TaskRecord {
  const fields = normalizeTaskFields(input);
  const timestamp = nowIso();

  return {
    task_id: taskId,
    ...fields,
    participants,
    recommendation_state: createRecommendationState(participants.length > 0 ? "ready_to_recommend" : "waiting_preferences"),
    recommendation_result: null,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function createDemoRecord(taskId = demoTaskId) {
  return createRecord(
    taskId,
    {
      creator_name: demoTask.creator_name,
      raw_request: demoTask.raw_request,
      location_text: demoTask.location_text,
      expected_people_count: demoTask.expected_people_count,
      dinner_time: demoTask.dinner_time,
      title: demoTask.title
    },
    demoTask.participants
  );
}

function createSeedDatabase(): TaskDatabase {
  const demoRecord = createDemoRecord();

  return {
    version: 1,
    tasks: {
      [demoRecord.task_id]: demoRecord
    }
  };
}

async function writeDatabase(database: TaskDatabase) {
  const filePath = getStateFilePath();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${randomUUID()}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readDatabase(): Promise<TaskDatabase> {
  const filePath = getStateFilePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as TaskDatabase;

    if (!parsed.tasks || parsed.version !== 1) {
      throw new Error("Unsupported task store format.");
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const database = createSeedDatabase();
    await writeDatabase(database);
    return database;
  }
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.catch(() => undefined);
  return next;
}

function createTaskId() {
  return `task_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function createInviteToken() {
  return `token_${randomBytes(24).toString("base64url")}`;
}

function hashInviteToken(inviteToken: string) {
  return createHash("sha256").update(inviteToken).digest("hex");
}

function buildSharePath(taskId: string, inviteToken?: string) {
  const basePath = `/pages/group/fill/fill?taskId=${encodeURIComponent(taskId)}`;
  return inviteToken ? `${basePath}&inviteToken=${encodeURIComponent(inviteToken)}` : basePath;
}

function groupError(status: GroupTaskError["status"], code: string, message: string): GroupTaskError {
  return {
    status,
    error: {
      code,
      message
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberField(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeSpicyPreference(value: unknown): ManualSpicyPreference | undefined {
  if (value === "spicy" || value === "no_spicy" || value === "any") {
    return value;
  }

  return undefined;
}

function normalizeGroupTaskInput(input: unknown): Partial<StoredTaskFields> {
  const payload = isRecord(input) ? input : {};
  const expectedPeopleCount = numberField(payload.expectedPeopleCount ?? payload.expected_people_count ?? payload.peopleCount, demoTask.expected_people_count);

  return normalizeTaskFields({
    creator_name: stringField(payload.creatorName ?? payload.creator_name, demoTask.creator_name),
    raw_request: stringField(payload.rawRequest ?? payload.raw_request, demoTask.raw_request),
    location_text: stringField(payload.locationText ?? payload.location_text ?? payload.location, demoTask.location_text),
    expected_people_count: expectedPeopleCount,
    dinner_time: stringField(payload.dinnerTime ?? payload.dinner_time, demoTask.dinner_time),
    title: stringField(payload.title, "")
  });
}

function normalizeGroupParticipantInput(input: unknown): ParticipantInput {
  const payload = isRecord(input) ? input : {};
  const rawManualFields = isRecord(payload.manualFields) ? payload.manualFields : isRecord(payload.manual_fields) ? payload.manual_fields : {};
  const budgetMax = numberField(rawManualFields.budgetMax ?? rawManualFields.budget_max, 0);
  const manualFields: ParticipantInput["manual_fields"] = {
    spicy_preference: normalizeSpicyPreference(rawManualFields.spicyPreference ?? rawManualFields.spicy_preference),
    leave_before: stringField(rawManualFields.leaveBefore ?? rawManualFields.leave_before) || undefined
  };

  if (budgetMax > 0) {
    manualFields.budget_max = budgetMax;
  }

  return {
    client_id: stringField(payload.clientId ?? payload.client_id) || undefined,
    nickname: stringField(payload.nickname, "我"),
    raw_preference: stringField(payload.rawPreference ?? payload.raw_preference),
    manual_fields: manualFields
  };
}

function verifyInviteToken(record: TaskRecord, inviteToken: string) {
  if (!record.invite_token_hash || !inviteToken.trim()) {
    return false;
  }

  return record.invite_token_hash === hashInviteToken(inviteToken.trim());
}

function buildGlobalConstraints(record: TaskRecord) {
  const budgetMax = extractBudgetMax(record.raw_request, demoTask.global_constraints.budget_max);

  return {
    ...demoTask.global_constraints,
    budget_max: budgetMax,
    location: record.location_text,
    people_count: record.expected_people_count
  };
}

function composeDinnerTask(record: TaskRecord, participants: Participant[], conflicts: Conflict[]): DinnerTask {
  const result = record.recommendation_result;

  return {
    ...demoTask,
    task_id: record.task_id,
    title: record.title || buildMockTitle(record),
    creator_name: record.creator_name,
    raw_request: record.raw_request,
    location_text: record.location_text,
    expected_people_count: record.expected_people_count,
    dinner_time: record.dinner_time,
    status: record.recommendation_state.status,
    share_url: `/dinner/${record.task_id}/fill`,
    global_constraints: buildGlobalConstraints(record),
    participants,
    conflicts,
    candidates: result?.candidates ?? [],
    final_choice: result?.final_choice ?? demoTask.final_choice,
    group_message: result?.group_message ?? "",
    normal_ai_message: result?.normal_ai_message ?? ""
  };
}

function toPayload(record: TaskRecord): TaskPayload {
  const participants = extractConstraints(record.participants);
  const budgetMax = buildGlobalConstraints(record).budget_max;
  const conflicts = detectConflicts(participants, budgetMax);
  const task = composeDinnerTask(record, participants, conflicts);

  return {
    task,
    participants,
    conflicts,
    recommendation_state: record.recommendation_state,
    recommendation_result: record.recommendation_result
  };
}

function toGroupBoard(record: TaskRecord, inviteToken?: string): GroupTaskBoard {
  const payload = toPayload(record);

  return {
    task: {
      taskId: record.task_id,
      title: payload.task.title,
      creatorName: record.creator_name,
      rawRequest: record.raw_request,
      locationText: record.location_text,
      expectedPeopleCount: record.expected_people_count,
      dinnerTime: record.dinner_time,
      status: record.recommendation_state.status,
      sharePath: buildSharePath(record.task_id, inviteToken),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      globalConstraints: payload.task.global_constraints
    },
    participants: payload.participants.map((participant) => ({
      participantId: participant.participant_id,
      clientId: participant.client_id,
      nickname: participant.nickname,
      rawPreference: participant.raw_preference,
      manualFields: {
        budgetMax: participant.manual_fields.budget_max,
        spicyPreference: participant.manual_fields.spicy_preference,
        leaveBefore: participant.manual_fields.leave_before
      },
      extractedConstraints: participant.extracted_constraints
    })),
    conflicts: payload.conflicts,
    recommendationState: {
      status: record.recommendation_state.status,
      hasGenerated: record.recommendation_state.hasGenerated,
      updatedAt: record.recommendation_state.updated_at,
      dirtyReason: record.recommendation_state.dirty_reason
    },
    recommendationResult: record.recommendation_result
      ? {
          candidates: record.recommendation_result.candidates,
          finalChoice: record.recommendation_result.final_choice,
          groupMessage: record.recommendation_result.group_message,
          normalAiMessage: record.recommendation_result.normal_ai_message
        }
      : null
  };
}

function markRecordRecommendationDirty(record: TaskRecord, dirtyReason: RecommendationState["dirty_reason"]) {
  record.recommendation_state = createRecommendationState(record.participants.length > 0 ? "ready_to_recommend" : "waiting_preferences", dirtyReason);
  record.recommendation_result = null;
  record.updated_at = nowIso();
}

export async function createTask(input: Partial<StoredTaskFields>) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    let taskId = createTaskId();

    while (database.tasks[taskId]) {
      taskId = createTaskId();
    }

    const record = createRecord(taskId, input, []);
    database.tasks[taskId] = record;
    await writeDatabase(database);

    return toPayload(record);
  });
}

export async function createGroupTask(input: unknown) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    let taskId = createTaskId();

    while (database.tasks[taskId]) {
      taskId = createTaskId();
    }

    const inviteToken = createInviteToken();
    const record = createRecord(taskId, normalizeGroupTaskInput(input), []);
    record.invite_token_hash = hashInviteToken(inviteToken);
    database.tasks[taskId] = record;
    await writeDatabase(database);

    return {
      taskId,
      inviteToken,
      sharePath: buildSharePath(taskId, inviteToken),
      board: toGroupBoard(record, inviteToken)
    };
  });
}

export async function getTask(taskId: string) {
  const database = await readDatabase();
  const record = database.tasks[taskId];

  return record ? toPayload(record) : null;
}

export async function getGroupTaskBoard(taskId: string, inviteToken: string): Promise<GroupTaskResult<GroupTaskBoard>> {
  const database = await readDatabase();
  const record = database.tasks[taskId];

  if (!record) {
    return groupError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  if (!verifyInviteToken(record, inviteToken)) {
    return groupError(403, "INVALID_INVITE_TOKEN", "Invalid invite token.");
  }

  return {
    status: 200,
    value: toGroupBoard(record, inviteToken)
  };
}

export async function markRecommendationDirty(taskId: string, dirtyReason: RecommendationState["dirty_reason"]) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return null;
    }

    markRecordRecommendationDirty(record, dirtyReason);
    await writeDatabase(database);

    return toPayload(record);
  });
}

export async function addOrUpdateParticipant(taskId: string, input: ParticipantInput) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return null;
    }

    const normalizedName = input.nickname.trim() || "我";
    const existing = record.participants.find((participant) => participant.nickname === normalizedName);
    const nextParticipant = buildMockParticipant({ ...input, nickname: normalizedName }, existing?.participant_id);
    record.participants = existing
      ? record.participants.map((participant) => (participant.participant_id === existing.participant_id ? nextParticipant : participant))
      : [...record.participants, nextParticipant];
    markRecordRecommendationDirty(record, "participants_changed");
    await writeDatabase(database);

    return toPayload(record);
  });
}

export async function addOrUpdateGroupParticipant(taskId: string, inviteToken: string, rawInput: unknown): Promise<GroupTaskResult<GroupTaskBoard>> {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return groupError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    if (!verifyInviteToken(record, inviteToken)) {
      return groupError(403, "INVALID_INVITE_TOKEN", "Invalid invite token.");
    }

    const input = normalizeGroupParticipantInput(rawInput);

    if (!input.raw_preference.trim()) {
      return groupError(400, "PREFERENCE_REQUIRED", "Preference is required.");
    }

    const normalizedName = input.nickname.trim() || "我";
    const clientId = input.client_id?.trim();
    const existing = clientId
      ? record.participants.find((participant) => participant.client_id === clientId)
      : record.participants.find((participant) => participant.nickname === normalizedName);
    const fallbackExisting = existing ?? record.participants.find((participant) => participant.nickname === normalizedName);
    const nextParticipant = buildMockParticipant({ ...input, nickname: normalizedName, client_id: clientId }, fallbackExisting?.participant_id);

    record.participants = fallbackExisting
      ? record.participants.map((participant) => (participant.participant_id === fallbackExisting.participant_id ? nextParticipant : participant))
      : [...record.participants, nextParticipant];
    markRecordRecommendationDirty(record, "participants_changed");
    await writeDatabase(database);

    return {
      status: 200,
      value: toGroupBoard(record, inviteToken)
    };
  });
}

export async function deleteParticipant(taskId: string, participantId: string) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return null;
    }

    record.participants = record.participants.filter((participant) => participant.participant_id !== participantId);
    markRecordRecommendationDirty(record, "participants_changed");
    await writeDatabase(database);

    return toPayload(record);
  });
}

export async function saveRecommendation(taskId: string, recommendation?: RecommendationResult) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return null;
    }

    const payload = toPayload(record);
    const nextRecommendation = recommendation ?? generateMockRecommendation(payload.task, payload.participants);
    record.recommendation_result = nextRecommendation;
    record.recommendation_state = {
      status: "done",
      hasGenerated: true,
      updated_at: nowIso()
    };
    record.updated_at = nowIso();
    await writeDatabase(database);

    return toPayload(record);
  });
}

export async function saveGroupRecommendation(taskId: string, inviteToken: string): Promise<GroupTaskResult<GroupTaskBoard>> {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = database.tasks[taskId];

    if (!record) {
      return groupError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    if (!verifyInviteToken(record, inviteToken)) {
      return groupError(403, "INVALID_INVITE_TOKEN", "Invalid invite token.");
    }

    if (record.participants.length === 0) {
      return groupError(400, "PARTICIPANTS_REQUIRED", "Please add participants before generating a recommendation.");
    }

    const payload = toPayload(record);
    record.recommendation_result = generateMockRecommendation(payload.task, payload.participants);
    record.recommendation_state = {
      status: "done",
      hasGenerated: true,
      updated_at: nowIso()
    };
    record.updated_at = nowIso();
    await writeDatabase(database);

    return {
      status: 200,
      value: toGroupBoard(record, inviteToken)
    };
  });
}

export async function resetDemoTask(taskId = demoTaskId) {
  return enqueueWrite(async () => {
    const database = await readDatabase();
    const record = createDemoRecord(taskId);

    database.tasks[taskId] = record;
    await writeDatabase(database);

    return toPayload(record);
  });
}
