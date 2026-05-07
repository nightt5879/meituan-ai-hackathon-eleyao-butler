import { demoTask } from "./mockData";
import { buildMockParticipant, buildMockTitle, extractBudgetMax } from "./mockFunctions";
import type { DinnerTask, Participant, ParticipantInput, RecommendationState, StoredTaskFields, TaskStatus } from "./types";

export const storageKeys = {
  task: "meituan-h5-demo:task",
  participants: "meituan-h5-demo:participants",
  recommendationState: "meituan-h5-demo:recommendation-state"
} as const;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeTask(input: StoredTaskFields): StoredTaskFields {
  const expectedPeople = Number(input.expected_people_count);
  const normalized = {
    creator_name: input.creator_name.trim() || "我",
    raw_request: input.raw_request.trim() || demoTask.raw_request,
    location_text: input.location_text.trim() || "学校附近",
    expected_people_count: Number.isFinite(expectedPeople) && expectedPeople > 0 ? expectedPeople : 3,
    dinner_time: input.dinner_time.trim() || "明晚 18:30",
    title: input.title?.trim()
  };

  return {
    ...normalized,
    title: normalized.title || buildMockTitle(normalized)
  };
}

function composeTask(stored?: StoredTaskFields | null): DinnerTask {
  if (!stored) {
    return demoTask;
  }

  const task = normalizeTask(stored);
  const budgetMax = extractBudgetMax(task.raw_request, demoTask.global_constraints.budget_max);

  return {
    ...demoTask,
    ...task,
    status: getRecommendationState().status,
    global_constraints: {
      ...demoTask.global_constraints,
      budget_max: budgetMax,
      location: task.location_text,
      people_count: task.expected_people_count
    }
  };
}

export function getStoredTask(): DinnerTask {
  return composeTask(readJson<StoredTaskFields>(storageKeys.task));
}

export function saveStoredTask(input: StoredTaskFields) {
  const task = normalizeTask(input);
  writeJson(storageKeys.task, task);
  saveRecommendationState({ status: "ready_to_recommend", hasGenerated: false });

  return composeTask(task);
}

export function getStoredParticipants(): Participant[] | null {
  return readJson<Participant[]>(storageKeys.participants);
}

export function getParticipantsForBoard(): Participant[] {
  const stored = getStoredParticipants();

  return stored && stored.length > 0 ? stored : demoTask.participants;
}

export function saveStoredParticipant(input: ParticipantInput) {
  const current = getStoredParticipants() ?? demoTask.participants;
  const normalizedName = input.nickname.trim() || "我";
  const existing = current.find((participant) => participant.nickname === normalizedName);
  const nextParticipant = buildMockParticipant({ ...input, nickname: normalizedName }, existing?.participant_id);
  const nextParticipants = existing
    ? current.map((participant) => (participant.participant_id === existing.participant_id ? nextParticipant : participant))
    : [...current, nextParticipant];

  writeJson(storageKeys.participants, nextParticipants);
  saveRecommendationState({ status: "ready_to_recommend", hasGenerated: false });

  return nextParticipants;
}

export function getRecommendationState(): RecommendationState {
  return (
    readJson<RecommendationState>(storageKeys.recommendationState) ?? {
      status: "ready_to_recommend",
      hasGenerated: false,
      updated_at: new Date(0).toISOString()
    }
  );
}

export function saveRecommendationState(input: Partial<Pick<RecommendationState, "status" | "hasGenerated">>) {
  const previous = getRecommendationState();
  const next: RecommendationState = {
    status: input.status ?? previous.status,
    hasGenerated: input.hasGenerated ?? previous.hasGenerated,
    updated_at: new Date().toISOString()
  };

  writeJson(storageKeys.recommendationState, next);

  return next;
}

export function resetDemoStorage() {
  if (!canUseStorage()) {
    return;
  }

  Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
}

export function getStatusTone(status: TaskStatus) {
  if (status === "done") {
    return "green";
  }

  if (status === "recommending" || status === "ready_to_recommend") {
    return "yellow";
  }

  if (status === "failed") {
    return "red";
  }

  return "gray";
}
