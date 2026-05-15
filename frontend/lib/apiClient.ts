import type { Conflict, DinnerTask, Participant, ParticipantInput, RecommendationResult, RecommendationState, StoredTaskFields, TaskStatus } from "./types";

export type TaskApiResponse = {
  task: DinnerTask;
  participants: Participant[];
  conflicts: Conflict[];
  recommendation_state: RecommendationState;
  recommendation_result: RecommendationResult | null;
};

export type CreateTaskResponse = TaskApiResponse & {
  task_id: string;
  share_url: string;
  fill_url: string;
  board_url: string;
  status: TaskStatus;
};

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const body = (await response.json()) as { error?: string };
      message = body.error || message;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function createTask(input: StoredTaskFields) {
  return requestJson<CreateTaskResponse>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getTask(taskId: string) {
  return requestJson<TaskApiResponse>(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export function submitParticipant(taskId: string, input: ParticipantInput) {
  return requestJson<TaskApiResponse>(`/api/tasks/${encodeURIComponent(taskId)}/participants`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteParticipant(taskId: string, participantId: string) {
  return requestJson<TaskApiResponse>(`/api/tasks/${encodeURIComponent(taskId)}/participants/${encodeURIComponent(participantId)}`, {
    method: "DELETE"
  });
}

export function resetDemoTask(taskId: string) {
  return requestJson<TaskApiResponse>(`/api/tasks/${encodeURIComponent(taskId)}/reset`, {
    method: "POST"
  });
}

export function generateRecommendation(taskId: string) {
  return requestJson<TaskApiResponse>(`/api/tasks/${encodeURIComponent(taskId)}/recommend`, {
    method: "POST"
  });
}
