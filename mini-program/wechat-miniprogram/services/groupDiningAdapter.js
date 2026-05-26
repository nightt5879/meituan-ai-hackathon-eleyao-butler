const DEFAULT_API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const STATUS = 'pending_integration';
const REAL_STATUS = 'remote_ok';
const CLIENT_ID_STORAGE_KEY = 'groupDiningClientId';
const API_BASE_STORAGE_KEY = 'MINIPROGRAM_API_BASE_URL';
const userIdentityAdapter = require('./userIdentityAdapter');
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

function isAuthError(error) {
  return error && error.statusCode === 401;
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
  const expectedCount = record && record.expectedPeopleCount > 0 ? record.expectedPeopleCount : 0;
  const task = {
    taskId: taskId,
    title: expectedCount > 0 ? expectedCount + ' 人聚餐' : '多人约饭任务',
    expectedPeopleCount: expectedCount,
    creatorName: (record && record.creatorName) || '',
    rawRequest: (record && record.rawRequest) || '',
    locationText: (record && record.locationText) || '',
    dinnerTime: (record && record.dinnerTime) || '',
    status: 'waiting_preferences'
  };
  return {
    taskId: taskId,
    inviteToken: inviteToken,
    expectedCount: expectedCount,
    submittedCount: 0,
    pendingCount: expectedCount,
    progressPercent: 0,
    members: [],
    participants: [],
    conflicts: [],
    recommendations: [],
    recommendationResult: null,
    finalChoice: null,
    groupMessage: '',
    recommendationState: {
      status: 'waiting_preferences',
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
    rawRequest: safe.rawRequest || safe.raw_request || '',
    locationText: safe.locationText || safe.location || safe.location_text || '',
    dinnerTime: safe.dinnerTime || safe.dinner_time || '',
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

function submitFallbackPreference(taskId, inviteToken, payload, error) {
  const safeTaskId = taskId || 'group_mock_task';
  const safeToken = inviteToken || 'group_mock_token';

  return {
    status: STATUS,
    taskId: safeTaskId,
    inviteToken: safeToken,
    nextUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(safeTaskId) + '&inviteToken=' + encodeURIComponent(safeToken),
    payload: payload || {},
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

  return {
    id: safe.participantId || safe.participant_id || safe.id || '',
    participantId: safe.participantId || safe.participant_id || '',
    clientId: safe.clientId || safe.client_id || '',
    nickname: safe.nickname || '匿名成员',
    visibility: safe.visibility || 'public',
    rawPreference: safe.rawPreference || safe.raw_preference || '',
    // New explicit-priority surfaces that board.wxml reads directly.
    availability: {
      availableDays: availableDays,
      availableHours: availableHours,
      availableTimeText: availableTimeText
    },
    availabilitySummary: buildAvailabilitySummary(availableDays, availableHours, availableTimeText),
    dietaryRestrictions: Array.isArray(safe.dietaryRestrictions || safe.dietary_restrictions)
      ? (safe.dietaryRestrictions || safe.dietary_restrictions).slice() : [],
    cuisinePreferences: Array.isArray(safe.cuisinePreferences || safe.cuisine_preferences)
      ? (safe.cuisinePreferences || safe.cuisine_preferences).slice() : [],
    budgetTag: safe.budgetTag || safe.budget_tag || '',
    spicyPreference: spicyEnum,
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

function buildAvailabilitySummary(days, hours, freeText) {
  const parts = [];
  if (Array.isArray(days) && days.length) {
    parts.push(days.slice(0, 4).join('、') + (days.length > 4 ? '…' : ''));
  }
  if (Array.isArray(hours) && hours.length) {
    parts.push(hours.slice(0, 4).join('、') + (hours.length > 4 ? '…' : ''));
  }
  if (freeText) {
    if (parts.length) {
      return parts.join(' · ') + ' · ' + freeText;
    }
    return freeText;
  }
  return parts.join(' · ');
}

function normalizeTaskBoard(taskId, inviteToken, data) {
  const board = data.board || data;
  const task = board.task || {};
  const participants = (board.participants || task.participants || []).map(normalizeMember);
  const recommendationResult = board.recommendationResult || board.recommendation_result || null;
  const rawCandidates = recommendationResult
    ? recommendationResult.candidates || []
    : board.recommendations || task.candidates || [];
  const candidates = rawCandidates.map(normalizeCandidate);
  const expectedCount = task.expectedPeopleCount || task.expected_people_count || board.expectedCount || 0;
  const submittedCount = participants.length;

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
    conflicts: (board.conflicts || task.conflicts || []).map(normalizeConflict),
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
      status: recommendationStateRaw.status || task.status || 'waiting_preferences',
      hasGenerated: !!(recommendationStateRaw.hasGenerated || recommendationStateRaw.has_generated || finalChoice),
      updatedAt: recommendationStateRaw.updatedAt || recommendationStateRaw.updated_at || '',
      dirtyReason: recommendationStateRaw.dirtyReason || recommendationStateRaw.dirty_reason || ''
    },
    adjustmentRequests: adjustmentRequests,
    adjustmentRequestCount: adjustmentRequests.length,
    task: task,
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
  const data = {
    creatorName: safePayload.creatorName || safePayload.creator_name || '小幺',
    rawRequest: safePayload.rawRequest || safePayload.raw_request || '',
    locationText: safePayload.locationText || safePayload.location || safePayload.location_text || '',
    expectedPeopleCount: parsePeopleCount(safePayload.peopleCount || safePayload.expectedPeopleCount || safePayload.expected_people_count),
    dinnerTime: safePayload.dinnerTime || safePayload.dinner_time || ''
  };

  return request({
    path: '/api/group-tasks',
    method: 'POST',
    data: data
  }).then(function (res) {
    const taskId = res.taskId || (res.board && res.board.task && res.board.task.taskId) || 'group_mock_task';
    const inviteToken = res.inviteToken || '';
    const sharePath = res.sharePath || '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken);

    return {
      status: REAL_STATUS,
      taskId: taskId,
      inviteToken: inviteToken,
      sharePath: sharePath,
      nextUrl: sharePath,
      boardUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken),
      board: normalizeTaskBoard(taskId, inviteToken, res.board || res),
      payload: data,
      message: '多人约饭任务已创建'
    };
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] createTask remote failed', error);
    if (isAuthError(error)) {
      throw error;
    }
    return createFallbackTask(safePayload, error);
  });
}

function submitPreference(taskId, inviteToken, payload) {
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
  const availableTimeText = (availability.availableTimeText || '').toString();
  // Legacy manual_fields shape — keep populated so the existing backend
  // contract still receives spicy / budget / leaveBefore.
  const manualFields = {
    spicyPreference: spicyEnum,
    leaveBefore: safePayload.leaveBefore || availableTimeText || undefined
  };

  if (budgetValue > 0) {
    manualFields.budgetMax = budgetValue;
  }

  const data = {
    inviteToken: inviteToken,
    clientId: getClientId(),
    nickname: safePayload.nickname || '匿名成员',
    visibility: safePayload.visibility || 'public',
    rawPreference: safePayload.rawPreference || safePayload.raw_preference || '',
    // New explicit-priority fields the upgraded fill page sends.
    dietaryRestrictions: Array.isArray(safePayload.dietaryRestrictions) ? safePayload.dietaryRestrictions.slice() : [],
    cuisinePreferences: Array.isArray(safePayload.cuisinePreferences) ? safePayload.cuisinePreferences.slice() : [],
    budgetTag: budgetTag,
    spicyPreference: spicyEnum,
    hardRequirements: Array.isArray(safePayload.hardRequirements) ? safePayload.hardRequirements.slice() : [],
    softPreferences: Array.isArray(safePayload.softPreferences) ? safePayload.softPreferences.slice() : [],
    requirementPriorities: Object.assign({}, safePayload.requirementPriorities || {}),
    availability: {
      availableDays: availableDays,
      availableHours: availableHours,
      availableTimeText: availableTimeText
    },
    manualFields: manualFields
  };

  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/participants',
    method: 'POST',
    data: data
  }).then(function (res) {
    const board = normalizeTaskBoard(taskId, inviteToken, res);

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
    if (isAuthError(error)) {
      throw error;
    }
    return submitFallbackPreference(taskId, inviteToken, safePayload, error);
  });
}

function getTaskBoard(taskId, inviteToken) {
  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '?inviteToken=' + encodeURIComponent(inviteToken || '')
  }).then(function (res) {
    return normalizeTaskBoard(taskId, inviteToken, res);
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] getTaskBoard remote failed', error);
    if (isAuthError(error)) {
      throw error;
    }
    return getFallbackTaskBoard(taskId, inviteToken, error);
  });
}

function generateRecommendation(taskId, inviteToken) {
  return request({
    path: '/api/group-tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/recommend',
    method: 'POST',
    data: {
      inviteToken: inviteToken
    }
  }).then(function (res) {
    return normalizeTaskBoard(taskId, inviteToken, res);
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] generateRecommendation remote failed', error);
    if (isAuthError(error)) {
      throw error;
    }
    return getFallbackTaskBoard(taskId, inviteToken, error);
  });
}

function submitAdjustmentRequest(taskId, inviteToken, payload) {
  const safePayload = payload || {};
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
    return normalizeTaskBoard(taskId, inviteToken, res);
  }).catch(function (error) {
    console.warn('[groupDiningAdapter] submitAdjustmentRequest remote failed', error);
    if (isAuthError(error)) {
      throw error;
    }
    return submitFallbackAdjustmentRequest(taskId, inviteToken, safePayload, error);
  });
}

module.exports = {
  API_BASE_URL: DEFAULT_API_BASE_URL,
  REAL_STATUS,
  STATUS,
  ADJUSTMENT_REASON_LABELS,
  getApiBaseUrl,
  createTask,
  submitPreference,
  getTaskBoard,
  generateRecommendation,
  submitAdjustmentRequest,
  createFallbackTask,
  submitFallbackPreference,
  getFallbackTaskBoard,
  submitFallbackAdjustmentRequest
};
