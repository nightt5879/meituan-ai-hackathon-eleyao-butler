// Group dining API adapter — talks to the Next.js backend at /api/tasks.
//
// The backend speaks snake_case. The mini-program pages prefer camelCase.
// This adapter is the ONLY place that bridges the two — pages should never
// touch snake_case directly.
//
// Recommendation, conflicts, audit checks, the final choice and the group
// message all come from the backend. We never compute any of those here.
//
// During WeChat DevTools development against a local Next.js server, enable
// "不校验合法域名" so http://localhost:3000 is reachable. In production the
// real domain must be allow-listed in mp.weixin.qq.com.

let API_BASE_URL = 'http://localhost:3000';
const API_TIMEOUT_MS = 15000;

function setApiBaseUrl(url) {
  if (typeof url === 'string' && url) {
    API_BASE_URL = url.replace(/\/+$/, '');
  }
}

function getApiBaseUrl() {
  return API_BASE_URL;
}

// Promisified wx.request. Resolves with parsed JSON on 2xx, rejects with
// { status, errMsg, data } on any failure.
function request(method, path, body) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: API_BASE_URL + path,
      method: method,
      data: body == null ? undefined : body,
      header: { 'Content-Type': 'application/json' },
      timeout: API_TIMEOUT_MS,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({
            status: res.statusCode,
            errMsg: 'HTTP ' + res.statusCode,
            data: res.data
          });
        }
      },
      fail: function (err) {
        reject({
          status: 0,
          errMsg: (err && err.errMsg) || 'network_failed',
          data: null
        });
      }
    });
  });
}

// ─── Field-coercion helpers ─────────────────────────────────────────────

function toIntOrZero(value) {
  if (typeof value === 'number' && isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string') {
    const match = value.match(/-?\d+/);
    if (match) { return parseInt(match[0], 10); }
  }
  return 0;
}

function trimOrEmpty(value) {
  if (typeof value === 'string') { return value.trim(); }
  if (value == null) { return ''; }
  return String(value);
}

// Map a UI Chinese spicy label to the backend's enum.
// Backend enum: 'spicy' | 'no_spicy' | 'any'.
function mapSpicyToBackend(label) {
  if (label === '不吃辣') { return 'no_spicy'; }
  if (label === '中辣' || label === '重辣') { return 'spicy'; }
  // 微辣 / 还没选择 / anything else → no strong preference.
  return 'any';
}

function mapSpicyToLabel(value) {
  if (value === 'no_spicy') { return '不吃辣'; }
  if (value === 'spicy') { return '能吃辣'; }
  if (value === 'any') { return '都行'; }
  return '';
}

// ─── Request body builders (camelCase in → snake_case out) ──────────────

function buildCreateTaskBody(payload) {
  const safe = payload || {};
  return {
    creator_name:           trimOrEmpty(safe.creatorName       || safe.creator_name),
    raw_request:            trimOrEmpty(safe.rawRequest        || safe.raw_request),
    location_text:          trimOrEmpty(safe.location          || safe.locationText    || safe.location_text),
    expected_people_count:  toIntOrZero(safe.peopleCount       || safe.expectedPeopleCount || safe.expected_people_count),
    dinner_time:            trimOrEmpty(safe.dinnerTime        || safe.dinner_time)
  };
}

function buildParticipantBody(payload) {
  const safe = payload || {};
  const manual = safe.manualFields || safe.manual_fields || {};

  // The fill page flattens manual fields onto `form`; tolerate both shapes.
  const budgetRaw = safe.budget != null ? safe.budget
    : (manual.budgetMax != null ? manual.budgetMax : manual.budget_max);
  const spicyRaw = safe.spicy != null ? safe.spicy
    : (manual.spicyPreference || manual.spicy_preference);
  const leaveRaw = safe.leaveBefore != null ? safe.leaveBefore
    : (manual.leaveBefore || manual.leave_before);

  const body = {
    nickname: trimOrEmpty(safe.nickname),
    raw_preference: trimOrEmpty(safe.rawPreference || safe.raw_preference),
    manual_fields: {}
  };

  const budgetNumber = toIntOrZero(budgetRaw);
  if (budgetNumber > 0) {
    body.manual_fields.budget_max = budgetNumber;
  }

  if (typeof spicyRaw === 'string' && spicyRaw && spicyRaw !== '还没选择') {
    if (spicyRaw === 'spicy' || spicyRaw === 'no_spicy' || spicyRaw === 'any') {
      body.manual_fields.spicy_preference = spicyRaw;
    } else {
      body.manual_fields.spicy_preference = mapSpicyToBackend(spicyRaw);
    }
  }

  const leave = trimOrEmpty(leaveRaw);
  if (leave) {
    body.manual_fields.leave_before = leave;
  }

  return body;
}

// ─── Response normalizers (snake_case in → camelCase out) ───────────────

function normalizeManualFields(manualFields) {
  const m = manualFields || {};
  return {
    budgetMax: typeof m.budget_max === 'number' ? m.budget_max : null,
    spicyPreference: m.spicy_preference || '',
    spicyLabel: mapSpicyToLabel(m.spicy_preference),
    leaveBefore: m.leave_before || ''
  };
}

function normalizeExtractedConstraints(extracted) {
  const e = extracted || {};
  return {
    hardConstraints: Array.isArray(e.hard_constraints) ? e.hard_constraints.slice() : [],
    softPreferences: Array.isArray(e.soft_preferences) ? e.soft_preferences.slice() : []
  };
}

function normalizeParticipant(p) {
  const safe = p || {};
  return {
    id: safe.participant_id || '',
    nickname: safe.nickname || '',
    rawPreference: safe.raw_preference || '',
    manualFields: normalizeManualFields(safe.manual_fields),
    extractedConstraints: normalizeExtractedConstraints(safe.extracted_constraints)
  };
}

function normalizeConflict(c) {
  const safe = c || {};
  return {
    type: safe.type || '',
    severity: safe.severity || 'low',
    description: safe.description || '',
    resolutionStrategy: safe.resolution_strategy || ''
  };
}

function normalizeAudit(audit) {
  const safe = audit || {};
  return {
    passed: !!safe.passed,
    hardRules: safe.hard_rules || {},
    softChecks: safe.soft_checks || {},
    llmExplanation: safe.llm_explanation || ''
  };
}

function normalizeCandidate(c) {
  const safe = c || {};
  return {
    id: safe.restaurant_id || '',
    name: safe.name || '',
    category: safe.category || '',
    avgPrice: typeof safe.avg_price === 'number' ? safe.avg_price : null,
    distanceM: typeof safe.distance_m === 'number' ? safe.distance_m : null,
    walkMinutes: typeof safe.walk_minutes === 'number' ? safe.walk_minutes : null,
    rating: typeof safe.rating === 'number' ? safe.rating : null,
    score: typeof safe.score === 'number' ? safe.score : null,
    tags: Array.isArray(safe.tags) ? safe.tags.slice() : [],
    reason: safe.reason || '',
    audit: normalizeAudit(safe.audit)
  };
}

function normalizeFinalChoice(choice) {
  const safe = choice || {};
  return {
    restaurantId: safe.restaurant_id || '',
    name: safe.name || '',
    reason: safe.reason || '',
    risks: Array.isArray(safe.risks) ? safe.risks.slice() : [],
    backup: safe.backup || ''
  };
}

function normalizeRecommendationResult(result) {
  if (!result) { return null; }
  return {
    candidates: Array.isArray(result.candidates) ? result.candidates.map(normalizeCandidate) : [],
    finalChoice: normalizeFinalChoice(result.final_choice),
    groupMessage: result.group_message || '',
    normalAiMessage: result.normal_ai_message || ''
  };
}

function normalizeRecommendationState(state) {
  const safe = state || {};
  return {
    status: safe.status || '',
    hasGenerated: !!safe.hasGenerated,
    updatedAt: safe.updated_at || '',
    dirtyReason: safe.dirty_reason || ''
  };
}

function normalizeTask(t) {
  const safe = t || {};
  return {
    id: safe.task_id || '',
    title: safe.title || '',
    creatorName: safe.creator_name || '',
    rawRequest: safe.raw_request || '',
    locationText: safe.location_text || '',
    expectedPeopleCount: typeof safe.expected_people_count === 'number' ? safe.expected_people_count : 0,
    dinnerTime: safe.dinner_time || '',
    status: safe.status || '',
    shareUrl: safe.share_url || '',
    globalConstraints: safe.global_constraints || null
  };
}

// Map a full board payload from the backend.
// Backend response shape: { task, participants, conflicts,
//                           recommendation_state, recommendation_result }.
function mapTaskBoard(payload) {
  const safe = payload || {};
  const task = normalizeTask(safe.task);
  const participants = Array.isArray(safe.participants)
    ? safe.participants.map(normalizeParticipant)
    : [];
  return {
    task: task,
    taskId: task.id,
    participants: participants,
    conflicts: Array.isArray(safe.conflicts) ? safe.conflicts.map(normalizeConflict) : [],
    recommendationState: normalizeRecommendationState(safe.recommendation_state),
    recommendationResult: normalizeRecommendationResult(safe.recommendation_result),
    submittedCount: participants.length,
    expectedCount: task.expectedPeopleCount,
    shareUrl: task.shareUrl || safe.share_url || '',
    raw: safe
  };
}

// ─── Public API ─────────────────────────────────────────────────────────

// POST /api/tasks
// Returns a Promise resolving to a normalized board PLUS convenience aliases
// (taskId, shareUrl, fillUrl, boardUrl) the create page uses for navigation.
function createTask(payload) {
  const body = buildCreateTaskBody(payload);
  return request('POST', '/api/tasks', body).then(function (data) {
    const board = mapTaskBoard(data);
    return Object.assign(board, {
      taskId:   (data && data.task_id)    || board.taskId   || '',
      shareUrl: (data && data.share_url)  || board.shareUrl || '',
      fillUrl:  (data && data.fill_url)   || '',
      boardUrl: (data && data.board_url)  || ''
    });
  });
}

// GET /api/tasks/:taskId
function getTaskBoard(taskId) {
  const id = encodeURIComponent(taskId || '');
  return request('GET', '/api/tasks/' + id, null).then(mapTaskBoard);
}

// POST /api/tasks/:taskId/participants
// May return either the new participant or the full updated board; we
// normalise as a board when possible and otherwise pass the raw payload
// through so callers can decide what to do.
function submitPreference(taskId, payload) {
  const id = encodeURIComponent(taskId || '');
  const body = buildParticipantBody(payload);
  return request('POST', '/api/tasks/' + id + '/participants', body).then(function (data) {
    if (data && data.task) { return mapTaskBoard(data); }
    return { raw: data };
  });
}

// POST /api/tasks/:taskId/recommend — no request body required.
// Returns the updated board (with recommendation_result populated).
function generateRecommendation(taskId) {
  const id = encodeURIComponent(taskId || '');
  return request('POST', '/api/tasks/' + id + '/recommend', {}).then(mapTaskBoard);
}

module.exports = {
  API_TIMEOUT_MS,
  setApiBaseUrl,
  getApiBaseUrl,
  createTask,
  getTaskBoard,
  submitPreference,
  generateRecommendation
};
