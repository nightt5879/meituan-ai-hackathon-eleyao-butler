const DEFAULT_API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const STATUS = 'pending_integration';
const REAL_STATUS = 'remote_ok';
const CLIENT_ID_STORAGE_KEY = 'groupDiningClientId';
const API_BASE_STORAGE_KEY = 'MINIPROGRAM_API_BASE_URL';
const userIdentityAdapter = require('./userIdentityAdapter');

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

  if (text.indexOf('不') >= 0 && text.indexOf('辣') >= 0) {
    return 'no_spicy';
  }

  if (text.indexOf('辣') >= 0) {
    return 'spicy';
  }

  return 'any';
}

function createFallbackTask(payload, error) {
  return {
    status: STATUS,
    taskId: 'group_mock_task',
    inviteToken: 'group_mock_token',
    sharePath: '/pages/group/fill/fill?taskId=group_mock_task&inviteToken=group_mock_token',
    nextUrl: '/pages/group/fill/fill?taskId=group_mock_task&inviteToken=group_mock_token',
    payload: payload || {},
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
  return {
    status: STATUS,
    taskId: taskId || 'group_mock_task',
    inviteToken: inviteToken || 'group_mock_token',
    expectedCount: 5,
    submittedCount: 0,
    progressPercent: 0,
    members: [],
    participants: [],
    conflicts: [],
    recommendations: [],
    finalChoice: null,
    groupMessage: '',
    recommendationState: {
      status: 'waiting_preferences',
      hasGenerated: false
    },
    errorMessage: error ? error.message : '',
    message: '任务看板后端暂不可用，已使用本地 mock fallback'
  };
}

function normalizeMember(member) {
  const manualFields = member.manualFields || member.manual_fields || {};

  return {
    participantId: member.participantId || member.participant_id || '',
    clientId: member.clientId || member.client_id || '',
    nickname: member.nickname || '匿名成员',
    rawPreference: member.rawPreference || member.raw_preference || '',
    manualFields: {
      budgetMax: manualFields.budgetMax || manualFields.budget_max,
      spicyPreference: manualFields.spicyPreference || manualFields.spicy_preference,
      leaveBefore: manualFields.leaveBefore || manualFields.leave_before
    },
    extractedConstraints: member.extractedConstraints || member.extracted_constraints || {
      hard_constraints: [],
      soft_preferences: []
    }
  };
}

function normalizeTaskBoard(taskId, inviteToken, data) {
  const board = data.board || data;
  const task = board.task || {};
  const participants = (board.participants || task.participants || []).map(normalizeMember);
  const recommendationResult = board.recommendationResult || board.recommendation_result || null;
  const candidates = recommendationResult
    ? recommendationResult.candidates || []
    : board.recommendations || task.candidates || [];
  const expectedCount = task.expectedPeopleCount || task.expected_people_count || board.expectedCount || 0;
  const submittedCount = participants.length;

  return {
    status: REAL_STATUS,
    taskId: task.taskId || task.task_id || taskId,
    inviteToken: inviteToken || '',
    sharePath: task.sharePath || board.sharePath || '',
    expectedCount: expectedCount,
    submittedCount: submittedCount,
    progressPercent: expectedCount > 0 ? Math.min(100, Math.round((submittedCount / expectedCount) * 100)) : 0,
    members: participants,
    participants: participants,
    conflicts: board.conflicts || task.conflicts || [],
    recommendations: candidates,
    finalChoice: recommendationResult ? recommendationResult.finalChoice || recommendationResult.final_choice : task.final_choice || null,
    groupMessage: recommendationResult ? recommendationResult.groupMessage || recommendationResult.group_message || '' : task.group_message || '',
    recommendationState: board.recommendationState || board.recommendation_state || {
      status: task.status || 'waiting_preferences',
      hasGenerated: false
    },
    task: task,
    message: '已连接真实多人约饭后端'
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
  const budgetValue = parseBudget(safePayload.budget || safePayload.budgetMax);
  const manualFields = {
    spicyPreference: spicyPreference(safePayload.spicy),
    leaveBefore: safePayload.leaveBefore || undefined
  };

  if (budgetValue > 0) {
    manualFields.budgetMax = budgetValue;
  }

  const data = {
    inviteToken: inviteToken,
    clientId: getClientId(),
    nickname: safePayload.nickname || '匿名成员',
    rawPreference: safePayload.rawPreference || safePayload.raw_preference || '',
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

module.exports = {
  API_BASE_URL: DEFAULT_API_BASE_URL,
  REAL_STATUS,
  STATUS,
  getApiBaseUrl,
  createTask,
  submitPreference,
  getTaskBoard,
  generateRecommendation,
  createFallbackTask,
  submitFallbackPreference,
  getFallbackTaskBoard
};
