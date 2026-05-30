const DEFAULT_API_BASE_URL = 'https://meituan-ai-hackathon.cn';
// Status taxonomy used by adapter return values:
//   REAL_STATUS     ('remote_ok')          — real backend returned a 2xx response.
//   MOCK_STATUS     ('mock_ok')            — mock mode short-circuit; the adapter
//                                            intentionally skipped wx.request and
//                                            served local data. Pages should treat
//                                            this as a normal success and inform
//                                            the user it is experience-mode data.
//   FALLBACK_STATUS ('pending_integration')— auto mode tried the real backend,
//                                            failed (network / HTTP /5xx / ...),
//                                            and silently served local fallback
//                                            data. Pages may show a "网络暂不可用"
//                                            notice.
// STATUS is kept as an alias of FALLBACK_STATUS for backward compatibility.
const REAL_STATUS = 'remote_ok';
const MOCK_STATUS = 'mock_ok';
const FALLBACK_STATUS = 'pending_integration';
const STATUS = FALLBACK_STATUS;
const CLIENT_ID_STORAGE_KEY = 'groupDiningClientId';
const API_BASE_STORAGE_KEY = 'MINIPROGRAM_API_BASE_URL';
const API_MODE_STORAGE_KEY = 'MINIPROGRAM_API_MODE';
const VALID_MODES = { auto: true, real: true, mock: true };
const userIdentityAdapter = require('./userIdentityAdapter');

// Resolve the current group dining adapter mode at call time. Priority:
//   1. wx storage key 'MINIPROGRAM_API_MODE' (lets a dev override on device)
//   2. app.globalData.groupDiningMode (set in app.js; envVersion-aware)
//   3. 'auto' default (existing real-then-fallback behaviour)
// Any unrecognised value also falls back to 'auto' to stay safe.
function getCurrentMode() {
  try {
    const stored = wx.getStorageSync(API_MODE_STORAGE_KEY);
    if (stored && VALID_MODES[stored]) {
      return stored;
    }
  } catch (error) {
    console.warn('[groupDiningAdapter] read api mode from storage failed', error);
  }

  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const mode = app && app.globalData && app.globalData.groupDiningMode;
    if (mode && VALID_MODES[mode]) {
      return mode;
    }
  } catch (error) {
    console.warn('[groupDiningAdapter] read api mode from globalData failed', error);
  }

  return 'auto';
}

function mockSuccess(result, message) {
  if (!result) {
    return result;
  }
  result.status = MOCK_STATUS;
  if (message) {
    result.message = message;
  }
  return result;
}

function mockBoard(board, message) {
  if (!board) {
    return board;
  }
  board.status = MOCK_STATUS;
  if (message) {
    board.message = message;
  }
  // Mock mode is an intentional success, not a backend failure. Clear any
  // residual error string the fallback builder may have set.
  board.errorMessage = '';
  return board;
}
const ADJUSTMENT_REASON_LABELS = {
  cannot_eat: '吃不了',
  over_budget: '超预算',
  time_mismatch: '时间不合',
  too_far: '太远',
  prefer_other_cuisine: '想换品类',
  other: '其他'
};

function getApiBaseUrl() {
  try {
    const storageBaseUrl = wx.getStorageSync(API_BASE_STORAGE_KEY);
    if (storageBaseUrl) {
      return String(storageBaseUrl).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[groupDiningAdapter] read api base url failed', error);
  }

  try {
    const app = getApp();
    const globalData = app && app.globalData ? app.globalData : {};
    const configured = globalData.groupDiningApiBaseUrl || globalData.foodRecommendApiBaseUrl;
    if (configured) {
      return String(configured).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[groupDiningAdapter] read app api base url failed', error);
  }

  return DEFAULT_API_BASE_URL;
}

function request(options) {
  return new Promise(function (resolve, reject) {
    if (!userIdentityAdapter.hasSession()) {
      const error = new Error('Wechat login required');
      error.statusCode = 401;
      reject(error);
      return;
    }

    wx.request({
      url: getApiBaseUrl() + options.path,
      method: options.method || 'GET',
      data: options.data,
      header: Object.assign({
        'content-type': 'application/json'
      }, userIdentityAdapter.getAuthorizationHeader()),
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }

        const error = new Error('HTTP ' + res.statusCode);
        error.statusCode = res.statusCode;
        error.response = res.data;
        reject(error);
      },
      fail: reject
    });
  });
}

function getClientId() {
  try {
    const existing = wx.getStorageSync(CLIENT_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const next = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2);
    wx.setStorageSync(CLIENT_ID_STORAGE_KEY, next);
    return next;
  } catch (error) {
    console.warn('[groupDiningAdapter] create client id failed', error);
    return 'client_fallback_' + Date.now().toString(36);
  }
}

function parsePeopleCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function parseExpectedCount(value) {
  if (typeof value === 'number' && isFinite(value)) {
    return value > 0 ? Math.floor(value) : 0;
  }

  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function firstPositiveCount(values) {
  for (let i = 0; i < values.length; i += 1) {
    const count = parseExpectedCount(values[i]);
    if (count > 0) {
      return count;
    }
  }
  return 0;
}

function firstKnownCount(values, fallback) {
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value === 'number' && isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    const match = String(value).match(/\d+/);
    if (match) {
      return Number(match[0]);
    }
  }
  return fallback;
}

function firstArray(values) {
  for (let i = 0; i < values.length; i += 1) {
    if (Array.isArray(values[i])) {
      return values[i];
    }
  }
  return [];
}

function parseBudget(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function spicyPreference(value) {
  const text = String(value || '');

  if (text === 'no_spicy' || text === 'mild' || text === 'medium' || text === 'spicy' || text === 'any') {
    return text;
  }

  if (text.indexOf('不') >= 0 && text.indexOf('辣') >= 0) {
    return 'no_spicy';
  }

  if (text.indexOf('辣') >= 0) {
    return 'spicy';
  }

  return 'any';
}

function spicyDisplayLabel(value) {
  const labels = {
    no_spicy: '不吃辣',
    mild: '微辣',
    medium: '中辣',
    spicy: '能吃辣',
    any: '辣度都可以'
  };

  return labels[value] || '';
}

function hasDemoTaskText(value) {
  const text = String(value || '');
  if (!text) {
    return false;
  }

  return /明晚|18:30|学校.?附近|别太吵|三个人|三人/.test(text) ||
    (/人均\s*100/.test(text) && /适合聊天/.test(text));
}

function cleanUserTaskText(value) {
  const text = String(value || '').trim();
  return hasDemoTaskText(text) ? '' : text;
}

function isCountOnlyTitle(title) {
  return /^\d+\s*人\s*(聚餐|约饭|吃饭|多人约饭)?$/.test(String(title || '').trim());
}

function normalizeTaskForDisplay(taskId, task, board, expectedCount) {
  const safeTask = task || {};
  const safeBoard = board || {};
  const cleanRawRequest = cleanUserTaskText(safeTask.rawRequest || safeTask.raw_request || safeBoard.rawRequest || safeBoard.raw_request || '');
  const cleanTitle = cleanUserTaskText(safeTask.title || safeTask.name || '');
  const displayTitle = cleanRawRequest || (!isCountOnlyTitle(cleanTitle) ? cleanTitle : '') || '多人约饭偏好收集中';
  const cleanLocation = cleanUserTaskText(safeTask.locationText || safeTask.location_text || safeTask.location || safeBoard.locationText || safeBoard.location_text || '');
  const cleanDinnerTime = cleanUserTaskText(safeTask.dinnerTime || safeTask.dinner_time || safeBoard.dinnerTime || safeBoard.dinner_time || '');

  return Object.assign({}, safeTask, {
    taskId: safeTask.taskId || safeTask.task_id || taskId,
    title: displayTitle,
    displayTitle: displayTitle,
    displaySummary: cleanRawRequest || '发起人邀请你填写约饭偏好',
    rawRequest: cleanRawRequest,
    locationText: cleanLocation,
    dinnerTime: cleanDinnerTime,
    expectedPeopleCount: expectedCount,
    creatorName: safeTask.creatorName || safeTask.creator_name || '',
    status: safeTask.status || safeBoard.status || 'waiting_preferences'
  });
}

// ─── Fallback task record persistence ──────────────────────────────────────
// When the real backend is unreachable, createFallbackTask used to hand back
// a fixed mock taskId with no record of the user-chosen people count. That
// caused getFallbackTaskBoard to fall back to a hardcoded 5, which made
// every fallback-mode session render "5 人 0/5 已提交" regardless of what
// the creator actually picked.
//
// To preserve the chosen count without inventing a fake shared backend, we
// persist the minimal task record to wx storage keyed by a unique local
// taskId. getFallbackTaskBoard reads it back so the count + creator info
// survive across pages and across page reloads.
const FALLBACK_TASK_STORAGE_PREFIX = 'groupDining.fallbackTask.';

function generateLocalTaskId() {
  return 'local_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
}

function generateLocalInviteToken() {
  return 'local_invite_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
}

function saveFallbackTaskRecord(taskId, record) {
  if (!taskId) { return; }
  try {
    wx.setStorageSync(FALLBACK_TASK_STORAGE_PREFIX + taskId, record);
  } catch (e) {
    console.warn('[groupDiningAdapter] saveFallbackTaskRecord failed', e);
  }
}

function readFallbackTaskRecord(taskId) {
  if (!taskId) { return null; }
  try {
    return wx.getStorageSync(FALLBACK_TASK_STORAGE_PREFIX + taskId) || null;
  } catch (e) {
    return null;
  }
}

function buildFallbackBoardFromRecord(taskId, inviteToken, record) {
  const expectedCount = parseExpectedCount(record && record.expectedPeopleCount);
  const rawParticipants = Array.isArray(record && record.participants)
    ? record.participants
    : (Array.isArray(record && record.submissions) ? record.submissions : []);
  const participants = rawParticipants.map(normalizeMember);
  const submittedCount = participants.length;
  const taskStatus = expectedCount > 0 && submittedCount >= expectedCount
    ? 'ready_to_recommend'
    : 'waiting_preferences';
  const task = {
    taskId: taskId,
    title: '多人约饭偏好收集中',
    displayTitle: '多人约饭偏好收集中',
    displaySummary: '发起人邀请你填写约饭偏好',
    expectedPeopleCount: expectedCount,
    creatorName: (record && record.creatorName) || '',
    rawRequest: cleanUserTaskText((record && record.rawRequest) || ''),
    locationText: cleanUserTaskText((record && record.locationText) || ''),
    dinnerTime: cleanUserTaskText((record && record.dinnerTime) || ''),
    status: taskStatus
  };
  return {
    taskId: taskId,
    inviteToken: inviteToken,
    expectedCount: expectedCount,
    submittedCount: submittedCount,
    pendingCount: Math.max(0, expectedCount - submittedCount),
    progressPercent: expectedCount > 0 ? Math.min(100, Math.round((submittedCount / expectedCount) * 100)) : 0,
    members: participants,
    participants: participants,
    submissions: participants,
    preferences: participants,
    conflicts: [],
    recommendations: [],
    recommendationResult: null,
    finalChoice: null,
    groupMessage: '',
    recommendationState: {
      status: taskStatus,
      hasGenerated: false,
      updatedAt: '',
      dirtyReason: ''
    },
    adjustmentRequests: [],
    adjustmentRequestCount: 0,
    task: task
  };
}

function createFallbackTask(payload, error) {
  const safe = payload || {};
  // Honor the chosen people count. parsePeopleCount returns 1 only when no
  // digit at all was provided; if the creator actually picked a number it
  // flows through unchanged.
  const expected = parsePeopleCount(
    safe.peopleCount || safe.expectedPeopleCount || safe.expected_people_count
  );
  const taskId = generateLocalTaskId();
  const inviteToken = generateLocalInviteToken();
  const record = {
    expectedPeopleCount: expected > 0 ? expected : 1,
    creatorName: safe.creatorName || safe.creator_name || '小幺',
    rawRequest: cleanUserTaskText(safe.rawRequest || safe.raw_request || ''),
    locationText: cleanUserTaskText(safe.locationText || safe.location || safe.location_text || ''),
    dinnerTime: cleanUserTaskText(safe.dinnerTime || safe.dinner_time || ''),
    createdAt: new Date().toISOString()
  };
  saveFallbackTaskRecord(taskId, record);

  const sharePath = '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) +
                    '&inviteToken=' + encodeURIComponent(inviteToken);
  const boardUrl = '/pages/group/board/board?taskId=' + encodeURIComponent(taskId) +
                   '&inviteToken=' + encodeURIComponent(inviteToken);

  return {
    status: STATUS,
    taskId: taskId,
    inviteToken: inviteToken,
    sharePath: sharePath,
    nextUrl: sharePath,
    boardUrl: boardUrl,
    expectedPeopleCount: record.expectedPeopleCount,
    board: buildFallbackBoardFromRecord(taskId, inviteToken, record),
    payload: safe,
    errorMessage: error ? error.message : '',
    message: '多人约饭后端暂不可用，已使用本地 mock fallback'
  };
}

function buildFallbackParticipant(inviteToken, payload) {
  const data = buildPreferenceRequestData(inviteToken, payload);
  const participantId = data.clientId || ('local_participant_' + Date.now().toString(36));
  const submittedAt = new Date().toISOString();

  return Object.assign({}, data, {
    id: participantId,
    participantId: participantId,
    submittedAt: submittedAt,
    updatedAt: submittedAt,
    extractedConstraints: {
      hardConstraints: data.hardRequirements.slice(),
      softPreferences: data.softPreferences.slice()
    }
  });
}

function isSameFallbackParticipant(current, next) {
  const safeCurrent = current || {};
  const currentClientId = safeCurrent.clientId || safeCurrent.client_id || '';
  const currentParticipantId = safeCurrent.participantId || safeCurrent.participant_id || safeCurrent.id || '';
  const nextClientId = next.clientId || next.client_id || '';
  const nextParticipantId = next.participantId || next.participant_id || next.id || '';

  if (nextClientId && currentClientId && currentClientId === nextClientId) {
    return true;
  }

  if (nextParticipantId && currentParticipantId && currentParticipantId === nextParticipantId) {
    return true;
  }

  return !!(next.nickname && safeCurrent.nickname && safeCurrent.nickname === next.nickname);
}

function upsertFallbackParticipant(participants, nextParticipant) {
  const list = Array.isArray(participants) ? participants.slice() : [];
  let replaced = false;
  const next = list.map(function (item) {
    if (isSameFallbackParticipant(item, nextParticipant)) {
      replaced = true;
      return nextParticipant;
    }
    return item;
  });

  if (!replaced) {
    next.push(nextParticipant);
  }

  return next;
}

// Write-only helper extracted from submitFallbackPreference. Persists the
// current member's preference to the local fallback store, deduplicating on
// clientId (and participantId / nickname as secondary keys). Safe to call
// from any code path — mock, auto, or auto-recover — without changing the
// caller's return value, since this only mutates wx storage.
function persistFallbackParticipant(taskId, inviteToken, payload) {
  const safeTaskId = taskId || 'group_mock_task';
  const safeToken = inviteToken || 'group_mock_token';
  const currentRecord = readFallbackTaskRecord(safeTaskId) || {
    expectedPeopleCount: 0,
    creatorName: '',
    createdAt: new Date().toISOString()
  };
  const participant = buildFallbackParticipant(safeToken, payload || {});
  const participants = upsertFallbackParticipant(
    currentRecord.participants || currentRecord.submissions || [],
    participant
  );
  const nextRecord = Object.assign({}, currentRecord, {
    participants: participants,
    submissions: participants,
    updatedAt: new Date().toISOString()
  });
  saveFallbackTaskRecord(safeTaskId, nextRecord);
  return {
    taskId: safeTaskId,
    inviteToken: safeToken,
    record: nextRecord,
    participant: participant
  };
}

// Seed a local task record on the first real-backend createTask success so
// that subsequent getTaskBoard / submitPreference fallbacks can still surface
// the chosen people count even before any participant has submitted. Will
// NOT overwrite an existing local record (e.g. one already containing
// participants), so it is safe to call on every createTask success.
function seedLocalTaskRecord(taskId, payload) {
  if (!taskId) {
    return null;
  }
  const existing = readFallbackTaskRecord(taskId);
  if (existing) {
    return existing;
  }
  const safe = payload || {};
  const expected = parsePeopleCount(
    safe.peopleCount || safe.expectedPeopleCount || safe.expected_people_count
  );
  const record = {
    expectedPeopleCount: expected > 0 ? expected : 1,
    creatorName: safe.creatorName || safe.creator_name || '',
    rawRequest: cleanUserTaskText(safe.rawRequest || safe.raw_request || ''),
    locationText: cleanUserTaskText(safe.locationText || safe.location || safe.location_text || ''),
    dinnerTime: cleanUserTaskText(safe.dinnerTime || safe.dinner_time || ''),
    createdAt: new Date().toISOString()
  };
  saveFallbackTaskRecord(taskId, record);
  return record;
}

// Merge any locally-cached participants for this task into the board the
// real backend returned. Deduplicates by clientId → participantId → nickname.
// Recomputes submittedCount / pendingCount / progressPercent. If the real
// backend returned no expectedCount but local has one, use local's. If the
// merged submittedCount is 0, also clears conflicts so we never show stub
// conflict rows on a board that has no submissions yet.
function mergeBoardWithLocalParticipants(remoteBoard, taskId, inviteToken) {
  if (!remoteBoard || !taskId) {
    return remoteBoard;
  }
  const localRecord = readFallbackTaskRecord(taskId);
  if (!localRecord) {
    return remoteBoard;
  }
  const localParticipants = Array.isArray(localRecord.participants)
    ? localRecord.participants
    : (Array.isArray(localRecord.submissions) ? localRecord.submissions : []);

  const remoteParticipants = Array.isArray(remoteBoard.participants)
    ? remoteBoard.participants.slice()
    : [];

  const seen = {};
  remoteParticipants.forEach(function (p) {
    const cid = p && (p.clientId || p.client_id);
    const pid = p && (p.participantId || p.participant_id || p.id);
    const nick = p && p.nickname;
    if (cid) { seen['cid:' + cid] = true; }
    if (pid) { seen['pid:' + pid] = true; }
    if (nick) { seen['nick:' + nick] = true; }
  });

  let added = 0;
  localParticipants.forEach(function (lp) {
    const cid = lp && (lp.clientId || lp.client_id);
    const pid = lp && (lp.participantId || lp.participant_id || lp.id);
    const nick = lp && lp.nickname;
    if ((cid && seen['cid:' + cid])
      || (pid && seen['pid:' + pid])
      || (nick && seen['nick:' + nick])) {
      return;
    }
    remoteParticipants.push(normalizeMember(lp));
    added++;
  });

  // Always re-derive counts so the badge "X 人 · Y/X 已提交" matches the
  // participants array, regardless of whether anything was added.
  const remoteExpected = remoteBoard.expectedCount || 0;
  const localExpected = parseExpectedCount(localRecord.expectedPeopleCount);
  const expectedCount = remoteExpected > 0 ? remoteExpected : localExpected;
  const submittedCount = remoteParticipants.length;

  if (added > 0) {
    remoteBoard.participants = remoteParticipants;
    remoteBoard.members = remoteParticipants;
    remoteBoard.submissions = remoteParticipants;
  }
  remoteBoard.expectedCount = expectedCount;
  remoteBoard.submittedCount = submittedCount;
  remoteBoard.pendingCount = Math.max(0, expectedCount - submittedCount);
  remoteBoard.progressPercent = expectedCount > 0
    ? Math.min(100, Math.round((submittedCount / expectedCount) * 100))
    : 0;
  if (remoteBoard.task) {
    remoteBoard.task.expectedPeopleCount = expectedCount;
  }

  // Stub conflicts from an empty real board would be misleading once we know
  // submittedCount is 0. Suppress them so the UI shows the friendly empty
  // state ("暂无冲突，等待更多成员…") instead of e.g. "atmosphere · low".
  if (submittedCount === 0 && Array.isArray(remoteBoard.conflicts) && remoteBoard.conflicts.length) {
    remoteBoard.conflicts = [];
  }

  return remoteBoard;
}

function submitFallbackPreference(taskId, inviteToken, payload, error) {
  const persisted = persistFallbackParticipant(taskId, inviteToken, payload || {});
  const board = buildFallbackBoardFromRecord(persisted.taskId, persisted.inviteToken, persisted.record);
  board.status = STATUS;
  board.errorMessage = error ? error.message : '';
  board.message = '成员偏好已暂存到本地 mock task';

  return {
    status: STATUS,
    taskId: persisted.taskId,
    inviteToken: persisted.inviteToken,
    nextUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(persisted.taskId) + '&inviteToken=' + encodeURIComponent(persisted.inviteToken),
    board: board,
    payload: persisted.participant,
    errorMessage: error ? error.message : '',
    message: '成员偏好提交后端暂不可用，已使用本地 mock fallback'
  };
}

function getFallbackTaskBoard(taskId, inviteToken, error) {
  const safeTaskId = taskId || 'group_mock_task';
  const safeToken = inviteToken || 'group_mock_token';
  // Recover the creator's chosen people count from the local record that
  // createFallbackTask saved. Falling back to 0 (not 5) when no record
  // exists keeps the UI honest — it shows "0 人 0/0 已提交" instead of
  // silently inventing a "5 人" group.
  const record = readFallbackTaskRecord(safeTaskId);
  const board = buildFallbackBoardFromRecord(safeTaskId, safeToken, record);
  board.status = STATUS;
  board.errorMessage = error ? error.message : '';
  board.message = '任务看板后端暂不可用，已使用本地 mock fallback';
  return board;
}

function submitFallbackAdjustmentRequest(taskId, inviteToken, payload, error) {
  // Build a minimal board-shaped response so the board page can keep
  // rendering after the user taps "对这家不满意" without a real backend.
  const board = getFallbackTaskBoard(taskId, inviteToken, error);
  const safe = payload || {};
  const reasonType = safe.reasonType || '';
  board.adjustmentRequests = [{
    id: 'adj_local_' + Date.now(),
    nickname: safe.nickname || '',
    visibility: safe.visibility || 'public',
    candidateId: safe.candidateId || '',
    candidateName: safe.candidateName || '',
    reasonType: reasonType,
    reasonLabel: ADJUSTMENT_REASON_LABELS[reasonType] || reasonType,
    note: safe.note || '',
    createdAt: new Date().toISOString()
  }];
  board.adjustmentRequestCount = 1;
  board.recommendationState.dirtyReason = 'adjustment_requested';
  board.message = '调整请求暂存本地，后端不可用时只保留本次会话';
  return board;
}

function firstText(values) {
  for (let i = 0; i < values.length; i += 1) {
    const text = String(values[i] || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function normalizeTimeMode(value) {
  return value === 'allDay' ? 'allDay' : 'specified';
}

function normalizeCustomTexts(source, payload, availability) {
  const raw = source || {};
  const safePayload = payload || {};
  const safeAvailability = availability || {};

  return {
    time: firstText([
      raw.time,
      raw.timeCustomText,
      raw.time_custom_text,
      safePayload.timeCustomText,
      safePayload.time_custom_text,
      safeAvailability.timeCustomText,
      safeAvailability.time_custom_text
    ]),
    restriction: firstText([
      raw.restriction,
      raw.restrictionCustomText,
      raw.restriction_custom_text,
      raw.dietary,
      raw.dietaryCustomText,
      safePayload.restrictionCustomText,
      safePayload.restriction_custom_text
    ]),
    cuisine: firstText([
      raw.cuisine,
      raw.cuisineCustomText,
      raw.cuisine_custom_text,
      safePayload.cuisineCustomText,
      safePayload.cuisine_custom_text
    ]),
    budget: firstText([
      raw.budget,
      raw.budgetCustomText,
      raw.budget_custom_text,
      safePayload.budgetCustomText,
      safePayload.budget_custom_text
    ]),
    spice: firstText([
      raw.spice,
      raw.spiceCustomText,
      raw.spice_custom_text,
      raw.spicy,
      raw.spicyCustomText,
      safePayload.spiceCustomText,
      safePayload.spice_custom_text,
      safePayload.spicyCustomText,
      safePayload.spicy_custom_text
    ]),
    extra: firstText([
      raw.extra,
      raw.extraCustomText,
      raw.extra_custom_text,
      safePayload.extraCustomText,
      safePayload.extra_custom_text
    ])
  };
}

function buildCustomSummaryList(customTexts) {
  const safe = customTexts || {};
  const configs = [
    { key: 'time', label: '时间补充' },
    { key: 'restriction', label: '忌口补充' },
    { key: 'cuisine', label: '品类补充' },
    { key: 'budget', label: '预算补充' },
    { key: 'spice', label: '辣度补充' },
    { key: 'extra', label: '其他补充' }
  ];

  return configs.map(function (item) {
    return {
      key: item.key,
      label: item.label,
      value: String(safe[item.key] || '').trim()
    };
  }).filter(function (item) {
    return !!item.value;
  });
}

function normalizeMember(member) {
  const safe = member || {};
  const manualFields = safe.manualFields || safe.manual_fields || {};
  const availability = safe.availability || {};
  const availableDays = Array.isArray(availability.availableDays || availability.available_days)
    ? (availability.availableDays || availability.available_days).slice()
    : [];
  const availableHours = Array.isArray(availability.availableHours || availability.available_hours)
    ? (availability.availableHours || availability.available_hours).slice()
    : [];
  const availableTimeText = availability.availableTimeText || availability.available_time_text || '';
  const customTexts = normalizeCustomTexts(safe.customTexts || safe.custom_texts, safe, availability);
  const timeMode = normalizeTimeMode(availability.timeMode || availability.time_mode || safe.timeMode || safe.time_mode);
  const startTime = availability.startTime || availability.start_time || safe.startTime || safe.start_time || '';
  const endTime = availability.endTime || availability.end_time || safe.endTime || safe.end_time || '';

  // Surface both snake_case and camelCase extractedConstraints — the board
  // WXML reads .extractedConstraints.hardConstraints / .softPreferences.
  const extractedRaw = safe.extractedConstraints || safe.extracted_constraints || {};
  const hardConstraints = Array.isArray(extractedRaw.hardConstraints || extractedRaw.hard_constraints)
    ? (extractedRaw.hardConstraints || extractedRaw.hard_constraints).slice()
    : [];
  const softPreferencesArr = Array.isArray(extractedRaw.softPreferences || extractedRaw.soft_preferences)
    ? (extractedRaw.softPreferences || extractedRaw.soft_preferences).slice()
    : [];

  const spicyEnum = safe.spicyPreference || safe.spicy_preference
                 || manualFields.spicyPreference || manualFields.spicy_preference || '';
  const participantId = safe.participantId || safe.participant_id || '';
  const clientId = safe.clientId || safe.client_id || '';
  const nickname = safe.nickname || '匿名成员';

  return {
    id: participantId || clientId || safe.id || nickname,
    participantId: participantId,
    clientId: clientId,
    nickname: nickname,
    visibility: safe.visibility || 'public',
    rawPreference: safe.rawPreference || safe.raw_preference || '',
    // New explicit-priority surfaces that board.wxml reads directly.
    availability: {
      availableDays: availableDays,
      availableHours: availableHours,
      availableTimeText: availableTimeText,
      timeCustomText: customTexts.time,
      timeMode: timeMode,
      startTime: startTime,
      endTime: endTime
    },
    availabilitySummary: buildAvailabilitySummary(availableDays, availableHours, availableTimeText, {
      timeMode: timeMode,
      startTime: startTime,
      endTime: endTime
    }),
    customTexts: customTexts,
    customSummaryList: buildCustomSummaryList(customTexts),
    dietaryRestrictions: Array.isArray(safe.dietaryRestrictions || safe.dietary_restrictions)
      ? (safe.dietaryRestrictions || safe.dietary_restrictions).slice() : [],
    cuisinePreferences: Array.isArray(safe.cuisinePreferences || safe.cuisine_preferences)
      ? (safe.cuisinePreferences || safe.cuisine_preferences).slice() : [],
    budgetTag: safe.budgetTag || safe.budget_tag || '',
    spicyPreference: spicyEnum,
    spicyLabel: spicyDisplayLabel(spicyEnum),
    hardRequirements: Array.isArray(safe.hardRequirements || safe.hard_requirements)
      ? (safe.hardRequirements || safe.hard_requirements).slice() : [],
    softPreferences: Array.isArray(safe.softPreferences || safe.soft_preferences)
      ? (safe.softPreferences || safe.soft_preferences).slice() : [],
    manualFields: {
      budgetMax: manualFields.budgetMax || manualFields.budget_max,
      spicyPreference: manualFields.spicyPreference || manualFields.spicy_preference || spicyEnum,
      leaveBefore: manualFields.leaveBefore || manualFields.leave_before
    },
    extractedConstraints: {
      hardConstraints: hardConstraints,
      softPreferences: softPreferencesArr,
      // Keep snake_case keys too for any legacy reader.
      hard_constraints: hardConstraints,
      soft_preferences: softPreferencesArr
    }
  };
}

function buildAvailabilitySummary(days, hours, freeText, timeInfo) {
  const parts = [];
  const safeTime = timeInfo || {};
  const hasStructuredTime = !!(safeTime.timeMode || safeTime.startTime || safeTime.endTime);
  const dayText = Array.isArray(days) && days.length
    ? days.slice(0, 4).join('、') + (days.length > 4 ? '…' : '')
    : '';
  let timeText = '';

  if (hasStructuredTime) {
    timeText = normalizeTimeMode(safeTime.timeMode) === 'allDay'
      ? '全天有空'
      : ((safeTime.startTime || '14:00') + '-' + (safeTime.endTime || '17:00'));
  }

  if (dayText && timeText) {
    parts.push(dayText + ' ' + timeText);
  } else if (dayText) {
    parts.push(dayText);
  } else if (timeText) {
    parts.push(timeText);
  }

  if (!hasStructuredTime && Array.isArray(hours) && hours.length) {
    parts.push(hours.slice(0, 4).join('、') + (hours.length > 4 ? '…' : ''));
  }
  if (!hasStructuredTime && freeText) {
    parts.push(freeText);
  }
  return parts.join(' · ');
}

function normalizeTaskBoard(taskId, inviteToken, data) {
  const board = data.board || data;
  const task = board.task || {};
  const rawParticipants = firstArray([
    board.participants,
    task.participants,
    board.submissions,
    task.submissions,
    board.preferences,
    task.preferences
  ]);
  const participants = rawParticipants.map(normalizeMember);
  const recommendationResult = board.recommendationResult || board.recommendation_result || null;
  const rawCandidates = recommendationResult
    ? recommendationResult.candidates || []
    : board.recommendations || task.candidates || [];
  const candidates = rawCandidates.map(normalizeCandidate);
  const expectedCount = firstPositiveCount([
    task.expectedPeopleCount,
    task.expected_people_count,
    task.targetCount,
    task.target_count,
    task.peopleCount,
    task.people_count,
    board.expectedCount,
    board.expected_count,
    board.targetCount,
    board.target_count,
    board.peopleCount,
    board.people_count
  ]);
  const knownSubmittedCount = firstKnownCount([
    board.submittedCount,
    board.submitted_count,
    task.submittedCount,
    task.submitted_count
  ], participants.length);
  const submittedCount = Math.max(participants.length, knownSubmittedCount);
  const normalizedTask = normalizeTaskForDisplay(taskId, task, board, expectedCount);

  const finalChoiceRaw = recommendationResult
    ? recommendationResult.finalChoice || recommendationResult.final_choice
    : task.final_choice || task.finalChoice || null;
  const finalChoice = finalChoiceRaw ? normalizeFinalChoice(finalChoiceRaw) : null;

  // Adjustment requests — accept either camel or snake_case from backend.
  const adjustmentRequestsRaw = board.adjustmentRequests || board.adjustment_requests || [];
  const adjustmentRequests = Array.isArray(adjustmentRequestsRaw)
    ? adjustmentRequestsRaw.map(normalizeAdjustmentRequest)
    : [];

  const recommendationStateRaw = board.recommendationState || board.recommendation_state || {};

  // Real backend stubs sometimes return synthetic conflict rows (e.g.
  // "atmosphere · low") even when no one has submitted yet. Suppress them
  // when submittedCount is 0 so the board shows the empty-state hint instead
  // of misleading fake conflicts. Real conflicts surface again as soon as
  // at least one member has actually submitted.
  const rawConflicts = (board.conflicts || task.conflicts || []).map(normalizeConflict);
  return {
    status: REAL_STATUS,
    taskId: task.taskId || task.task_id || taskId,
    inviteToken: inviteToken || '',
    sharePath: task.sharePath || board.sharePath || board.share_path || '',
    expectedCount: expectedCount,
    submittedCount: submittedCount,
    pendingCount: Math.max(0, expectedCount - submittedCount),
    progressPercent: expectedCount > 0 ? Math.min(100, Math.round((submittedCount / expectedCount) * 100)) : 0,
    members: participants,
    participants: participants,
    conflicts: submittedCount > 0 ? rawConflicts : [],
    recommendations: candidates,
    recommendationResult: recommendationResult ? {
      candidates: candidates,
      finalChoice: finalChoice,
      groupMessage: recommendationResult.groupMessage || recommendationResult.group_message || '',
      normalAiMessage: recommendationResult.normalAiMessage || recommendationResult.normal_ai_message || ''
    } : null,
    finalChoice: finalChoice,
    groupMessage: recommendationResult ? recommendationResult.groupMessage || recommendationResult.group_message || '' : task.group_message || '',
    recommendationState: {
      status: recommendationStateRaw.status || normalizedTask.status || 'waiting_preferences',
      hasGenerated: !!(recommendationStateRaw.hasGenerated || recommendationStateRaw.has_generated || finalChoice),
      updatedAt: recommendationStateRaw.updatedAt || recommendationStateRaw.updated_at || '',
      dirtyReason: recommendationStateRaw.dirtyReason || recommendationStateRaw.dirty_reason || ''
    },
    adjustmentRequests: adjustmentRequests,
    adjustmentRequestCount: adjustmentRequests.length,
    task: normalizedTask,
    message: '已连接真实多人约饭后端'
  };
}

function normalizeConflict(c) {
  const safe = c || {};
  return {
    type: safe.type || '',
    severity: safe.severity || 'low',
    description: safe.description || '',
    resolutionStrategy: safe.resolutionStrategy || safe.resolution_strategy || ''
  };
}

function normalizeCandidate(c) {
  const safe = c || {};
  const auditRaw = safe.audit || {};
  const tradeoffsRaw = Array.isArray(safe.tradeoffs) ? safe.tradeoffs : [];
  const memberScoresRaw = safe.memberScores || safe.member_scores || {};
  const memberScoreList = Object.keys(memberScoresRaw).map(function (name) {
    return { nickname: name, score: memberScoresRaw[name] };
  });
  return {
    id: safe.id || safe.restaurant_id || safe.restaurantId || '',
    restaurantId: safe.restaurantId || safe.restaurant_id || safe.id || '',
    name: safe.name || '',
    category: safe.category || '',
    avgPrice: safe.avgPrice != null ? safe.avgPrice : safe.avg_price,
    distanceM: safe.distanceM != null ? safe.distanceM : safe.distance_m,
    walkMinutes: safe.walkMinutes != null ? safe.walkMinutes : safe.walk_minutes,
    rating: safe.rating,
    score: safe.score,
    tags: Array.isArray(safe.tags) ? safe.tags.slice() : [],
    reason: safe.reason || '',
    memberScores: memberScoresRaw,
    memberScoreList: memberScoreList,
    matchedNeeds: Array.isArray(safe.matchedNeeds || safe.matched_needs)
      ? (safe.matchedNeeds || safe.matched_needs).slice() : [],
    unmetNeeds: Array.isArray(safe.unmetNeeds || safe.unmet_needs)
      ? (safe.unmetNeeds || safe.unmet_needs).slice() : [],
    tradeoffs: tradeoffsRaw.map(function (t) {
      const safeT = t || {};
      const unmet = Array.isArray(safeT.unmetNeeds || safeT.unmet_needs)
        ? (safeT.unmetNeeds || safeT.unmet_needs).slice() : [];
      return {
        nickname: safeT.nickname || '',
        unmetNeeds: unmet,
        reason: safeT.reason || (unmet.length ? '可能不满足：' + unmet.slice(0, 3).join('、') : '')
      };
    }),
    tradeoffSummary: tradeoffsRaw.length
      ? tradeoffsRaw.slice(0, 3).map(function (t) {
          const name = (t && t.nickname) || '某成员';
          const unmet = (t && (t.unmetNeeds || t.unmet_needs)) || [];
          return unmet.length ? name + ' · ' + unmet.slice(0, 2).join('/') : name;
        }).join('；') + (tradeoffsRaw.length > 3 ? '…' : '')
      : '',
    audit: {
      passed: !!auditRaw.passed,
      hardRules: auditRaw.hardRules || auditRaw.hard_rules || {},
      softChecks: auditRaw.softChecks || auditRaw.soft_checks || {},
      llmExplanation: auditRaw.llmExplanation || auditRaw.llm_explanation || ''
    }
  };
}

function normalizeFinalChoice(fc) {
  const safe = fc || {};
  return {
    restaurantId: safe.restaurantId || safe.restaurant_id || '',
    name: safe.name || '',
    reason: safe.reason || '',
    risks: Array.isArray(safe.risks) ? safe.risks.slice() : [],
    backup: safe.backup || ''
  };
}

function normalizeAdjustmentRequest(r) {
  const safe = r || {};
  const reasonType = safe.reasonType || safe.reason_type || '';
  return {
    id: safe.id || '',
    nickname: safe.nickname || '',
    visibility: safe.visibility || 'public',
    candidateId: safe.candidateId || safe.candidate_id || '',
    candidateName: safe.candidateName || safe.candidate_name || '',
    reasonType: reasonType,
    reasonLabel: safe.reasonLabel || safe.reason_label
                 || ADJUSTMENT_REASON_LABELS[reasonType] || reasonType,
    note: safe.note || '',
    createdAt: safe.createdAt || safe.created_at || ''
  };
}

function createTask(payload) {
  const safePayload = payload || {};
  const mode = getCurrentMode();

  if (mode === 'mock') {
    return Promise.resolve(mockSuccess(
      createFallbackTask(safePayload, null),
      '当前为体验模式，已使用本地模拟数据'
    ));
  }

  const data = {
    expectedPeopleCount: parsePeopleCount(safePayload.peopleCount || safePayload.expectedPeopleCount || safePayload.expected_people_count)
  };
  const creatorName = safePayload.creatorName || safePayload.creator_name || '';
  const rawRequest = cleanUserTaskText(safePayload.rawRequest || safePayload.raw_request || '');
  const locationText = cleanUserTaskText(safePayload.locationText || safePayload.location || safePayload.location_text || '');
  const dinnerTime = cleanUserTaskText(safePayload.dinnerTime || safePayload.dinner_time || '');

  if (creatorName) {
    data.creatorName = creatorName;
  }
  if (rawRequest) {
    data.rawRequest = rawRequest;
  }
  if (locationText) {
    data.locationText = locationText;
  }
  if (dinnerTime) {
    data.dinnerTime = dinnerTime;
  }

  return request({
    path: '/api/group-tasks',
    method: 'POST',
    data: data
  }).then(function (res) {
    const taskId = res.taskId || (res.board && res.board.task && res.board.task.taskId) || 'group_mock_task';
    const inviteToken = res.inviteToken || '';
    const sharePath = res.sharePath || '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken);

    // Auto mode seeds a local task record so subsequent submitPreference /
    // getTaskBoard can fall back / merge even if the real backend later goes
    // away or returns stub data. Real mode keeps the local store untouched.
    if (mode === 'auto') {
      seedLocalTaskRecord(taskId, safePayload);
    }

    let board = normalizeTaskBoard(taskId, inviteToken, res.board || res);
    if (mode === 'auto') {
      board = mergeBoardWithLocalParticipants(board, taskId, inviteToken);
    }

    return {
      status: REAL_STATUS,
      taskId: taskId,
      inviteToken: inviteToken,
      sharePath: sharePath,
      nextUrl: sharePath,
      boardUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken),
      board: board,
      payload: data,
      message: '多人约饭任务已创建'
    };
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] createTask remote failed', error);
    // Real mode surfaces every error (including 401) so the page can prompt a
    // real login. Auto mode must never block the demo, so it falls back to the
    // local mock task on ANY failure — network down, 5xx, or a missing/expired
    // session (401) — instead of bouncing the user to a login that itself needs
    // the backend.
    if (mode === 'real') {
      throw error;
    }
    return createFallbackTask(safePayload, error);
  });
}

function buildPreferenceRequestData(inviteToken, payload) {
  const safePayload = payload || {};
  // Accept BOTH the old field names (spicy / budget / leaveBefore) and the
  // new ones (spicyPreference / budgetTag / availability.*). Read new fields
  // with a fall-through to the old ones for back-compat.
  const spicyEnum = spicyPreference(safePayload.spicyPreference || safePayload.spicy);
  const budgetTag = safePayload.budgetTag || safePayload.budget_tag || '';
  const budgetValue = parseBudget(budgetTag || safePayload.budget || safePayload.budgetMax);
  const availability = safePayload.availability || {};
  const availableDays = Array.isArray(availability.availableDays) ? availability.availableDays.slice() : [];
  const availableHours = Array.isArray(availability.availableHours) ? availability.availableHours.slice() : [];
  const customTexts = normalizeCustomTexts(safePayload.customTexts || safePayload.custom_texts, safePayload, availability);
  const availableTimeText = customTexts.time || (availability.availableTimeText || availability.available_time_text || '').toString();
  const timeMode = normalizeTimeMode(availability.timeMode || availability.time_mode || safePayload.timeMode || safePayload.time_mode);
  const startTime = availability.startTime || availability.start_time || safePayload.startTime || safePayload.start_time || '14:00';
  const endTime = availability.endTime || availability.end_time || safePayload.endTime || safePayload.end_time || '17:00';
  // Legacy manual_fields shape — keep populated so the existing backend
  // contract still receives spicy / budget / leaveBefore.
  const manualFields = {
    spicyPreference: spicyEnum,
    leaveBefore: safePayload.leaveBefore || availableTimeText || undefined
  };

  if (budgetValue > 0) {
    manualFields.budgetMax = budgetValue;
  }

  return {
    inviteToken: inviteToken,
    clientId: getClientId(),
    nickname: safePayload.nickname || '匿名成员',
    visibility: safePayload.visibility || 'public',
    rawPreference: safePayload.rawPreference || safePayload.raw_preference || '',
    dietaryRestrictions: Array.isArray(safePayload.dietaryRestrictions) ? safePayload.dietaryRestrictions.slice() : [],
    cuisinePreferences: Array.isArray(safePayload.cuisinePreferences) ? safePayload.cuisinePreferences.slice() : [],
    budgetTag: budgetTag,
    spicyPreference: spicyEnum,
    timeMode: timeMode,
    startTime: startTime,
    endTime: endTime,
    timeCustomText: customTexts.time,
    restrictionCustomText: customTexts.restriction,
    cuisineCustomText: customTexts.cuisine,
    budgetCustomText: customTexts.budget,
    spiceCustomText: customTexts.spice,
    extraCustomText: customTexts.extra,
    customTexts: customTexts,
    hardRequirements: Array.isArray(safePayload.hardRequirements) ? safePayload.hardRequirements.slice() : [],
    softPreferences: Array.isArray(safePayload.softPreferences) ? safePayload.softPreferences.slice() : [],
    requirementPriorities: Object.assign({}, safePayload.requirementPriorities || {}),
    availability: {
      availableDays: availableDays,
      availableHours: availableHours,
      timeMode: timeMode,
      startTime: startTime,
      endTime: endTime,
      availableTimeText: availableTimeText,
      timeCustomText: customTexts.time
    },
    manualFields: manualFields
  };
}

function submitPreference(taskId, inviteToken, payload) {
  const safePayload = payload || {};
  const mode = getCurrentMode();

  if (mode === 'mock') {
    return Promise.resolve(mockSuccess(
      submitFallbackPreference(taskId, inviteToken, safePayload, null),
      '当前为体验模式，偏好已暂存到本地模拟数据'
    ));
  }

  // Auto mode pre-cache: write this member's preference to the local store
  // BEFORE we call the real backend. This way even if the real backend
  // returns 2xx but doesn't actually persist participants (stub /
  // misconfigured / temporarily wiped), getTaskBoard can still merge the
  // submission back in. Real mode skips the local store entirely.
  if (mode === 'auto') {
    persistFallbackParticipant(taskId, inviteToken, safePayload);
  }

  const data = buildPreferenceRequestData(inviteToken, safePayload);

  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/participants',
    method: 'POST',
    data: data
  }).then(function (res) {
    let board = normalizeTaskBoard(taskId, inviteToken, res);
    if (mode === 'auto') {
      board = mergeBoardWithLocalParticipants(board, taskId, inviteToken);
    }

    return {
      status: REAL_STATUS,
      taskId: taskId,
      inviteToken: inviteToken,
      nextUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId || 'group_mock_task') + '&inviteToken=' + encodeURIComponent(inviteToken || ''),
      board: board,
      payload: data,
      message: '成员偏好已提交'
    };
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] submitPreference remote failed', error);
    // Auto mode falls back to the local mock submission on any failure incl.
    // 401; only real mode surfaces the error for a login prompt.
    if (mode === 'real') {
      throw error;
    }
    return submitFallbackPreference(taskId, inviteToken, safePayload, error);
  });
}

function getTaskBoard(taskId, inviteToken) {
  const mode = getCurrentMode();

  if (mode === 'mock') {
    return Promise.resolve(mockBoard(
      getFallbackTaskBoard(taskId, inviteToken, null),
      '当前为体验模式，看板使用本地模拟数据'
    ));
  }

  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '?inviteToken=' + encodeURIComponent(inviteToken || '')
  }).then(function (res) {
    let board = normalizeTaskBoard(taskId, inviteToken, res);
    // Auto mode merges any locally-cached submissions back into the real
    // board. If the real backend is fully working, dedupe makes this a
    // no-op. If the real backend missed a submission (stub / partial), the
    // local cache surfaces it so the user sees their own preference.
    if (mode === 'auto') {
      board = mergeBoardWithLocalParticipants(board, taskId, inviteToken);
    }
    return board;
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] getTaskBoard remote failed', error);
    // Auto mode falls back to the local mock board on any failure incl. 401;
    // only real mode surfaces the error for a login prompt.
    if (mode === 'real') {
      throw error;
    }
    return getFallbackTaskBoard(taskId, inviteToken, error);
  });
}

function generateRecommendation(taskId, inviteToken) {
  const mode = getCurrentMode();

  if (mode === 'mock') {
    return Promise.resolve(mockBoard(
      getFallbackTaskBoard(taskId, inviteToken, null),
      '当前为体验模式，推荐使用本地模拟数据'
    ));
  }

  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/recommend',
    method: 'POST',
    data: {
      inviteToken: inviteToken
    }
  }).then(function (res) {
    let board = normalizeTaskBoard(taskId, inviteToken, res);
    if (mode === 'auto') {
      board = mergeBoardWithLocalParticipants(board, taskId, inviteToken);
    }
    return board;
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] generateRecommendation remote failed', error);
    // Auto mode falls back to the local mock board on any failure incl. 401;
    // only real mode surfaces the error for a login prompt.
    if (mode === 'real') {
      throw error;
    }
    return getFallbackTaskBoard(taskId, inviteToken, error);
  });
}

function submitAdjustmentRequest(taskId, inviteToken, payload) {
  const safePayload = payload || {};
  const mode = getCurrentMode();

  if (mode === 'mock') {
    return Promise.resolve(mockBoard(
      submitFallbackAdjustmentRequest(taskId, inviteToken, safePayload, null),
      '当前为体验模式，反馈已暂存到本地模拟数据'
    ));
  }

  const data = {
    inviteToken: inviteToken,
    clientId: getClientId(),
    nickname: safePayload.nickname || '',
    visibility: safePayload.visibility || 'public',
    candidateId: safePayload.candidateId || '',
    candidateName: safePayload.candidateName || '',
    reasonType: safePayload.reasonType || '',
    reasonLabel: ADJUSTMENT_REASON_LABELS[safePayload.reasonType] || safePayload.reasonType || '',
    note: safePayload.note || ''
  };

  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/adjustment-requests',
    method: 'POST',
    data: data
  }).then(function (res) {
    let board = normalizeTaskBoard(taskId, inviteToken, res);
    if (mode === 'auto') {
      board = mergeBoardWithLocalParticipants(board, taskId, inviteToken);
    }
    return board;
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] submitAdjustmentRequest remote failed', error);
    // Auto mode falls back to the local mock adjustment on any failure incl.
    // 401; only real mode surfaces the error for a login prompt.
    if (mode === 'real') {
      throw error;
    }
    return submitFallbackAdjustmentRequest(taskId, inviteToken, safePayload, error);
  });
}

module.exports = {
  API_BASE_URL: DEFAULT_API_BASE_URL,
  API_MODE_STORAGE_KEY,
  REAL_STATUS,
  MOCK_STATUS,
  FALLBACK_STATUS,
  STATUS,
  ADJUSTMENT_REASON_LABELS,
  getApiBaseUrl,
  getCurrentMode,
  createTask,
  submitPreference,
  getTaskBoard,
  generateRecommendation,
  submitAdjustmentRequest,
  createFallbackTask,
  submitFallbackPreference,
  getFallbackTaskBoard,
  submitFallbackAdjustmentRequest,
  persistFallbackParticipant,
  seedLocalTaskRecord,
  mergeBoardWithLocalParticipants
};
