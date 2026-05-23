const API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const STATUS = 'pending_integration';
const REAL_STATUS = 'remote_ok';

function request(options) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: API_BASE_URL + options.path,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json'
      },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        reject(new Error('HTTP ' + res.statusCode));
      },
      fail: reject
    });
  });
}

function parsePeopleCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function spicyPreference(value) {
  if (value === '不吃辣') {
    return 'no_spicy';
  }
  if (value === '微辣') {
    return 'mild_spicy';
  }
  if (value === '中辣') {
    return 'medium_spicy';
  }
  if (value === '重辣') {
    return 'heavy_spicy';
  }
  return undefined;
}

function createFallbackTask(payload) {
  return {
    status: STATUS,
    taskId: 'group_mock_task',
    nextUrl: '/pages/group/fill/fill?taskId=group_mock_task',
    payload: payload || {},
    message: '多人约饭接口待接入，已使用本地 mock fallback'
  };
}

function submitFallbackPreference(taskId, payload) {
  return {
    status: STATUS,
    taskId: taskId || 'group_mock_task',
    nextUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId || 'group_mock_task'),
    payload: payload || {},
    message: '成员偏好提交接口待接入，已使用本地 mock fallback'
  };
}

function getFallbackTaskBoard(taskId) {
  return {
    status: STATUS,
    taskId: taskId || 'group_mock_task',
    expectedCount: 5,
    submittedCount: 0,
    members: [],
    conflicts: [],
    recommendations: [],
    message: '任务看板和推荐接口待接入，已使用本地 mock fallback'
  };
}

function normalizeTaskBoard(taskId, data) {
  const task = data.task || data;
  const participants = task.participants || data.participants || [];
  const candidates = task.candidates || data.candidates || [];
  return {
    status: REAL_STATUS,
    taskId: task.task_id || taskId,
    expectedCount: task.expected_people_count || 0,
    submittedCount: participants.length,
    members: participants,
    participants: participants,
    conflicts: task.conflicts || data.conflicts || [],
    recommendations: candidates,
    finalChoice: task.final_choice || data.final_choice || null,
    task: task,
    message: '已连接真实后端'
  };
}

function createTask(payload) {
  const safePayload = payload || {};
  const data = {
    creator_name: safePayload.creatorName || safePayload.creator_name || '小幺',
    raw_request: safePayload.rawRequest || safePayload.raw_request || '',
    location_text: safePayload.location || safePayload.location_text || '',
    expected_people_count: parsePeopleCount(safePayload.peopleCount || safePayload.expected_people_count),
    dinner_time: safePayload.dinnerTime || safePayload.dinner_time || ''
  };

  return request({
    path: '/api/tasks',
    method: 'POST',
    data: data
  }).then(function (res) {
    const task = res.task || res;
    const taskId = task.task_id || task.taskId || 'group_mock_task';
    return {
      status: REAL_STATUS,
      taskId: taskId,
      nextUrl: '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId),
      task: task,
      payload: data,
      message: '多人约饭任务已创建'
    };
  }).catch(function () {
    return createFallbackTask(safePayload);
  });
}

function submitPreference(taskId, payload) {
  const safePayload = payload || {};
  const budgetValue = Number(safePayload.budget);
  const manualFields = {
    spicy_preference: spicyPreference(safePayload.spicy),
    leave_before: safePayload.leaveBefore || undefined
  };
  if (!Number.isNaN(budgetValue) && budgetValue > 0) {
    manualFields.budget_max = budgetValue;
  }

  const data = {
    nickname: safePayload.nickname || '匿名成员',
    raw_preference: safePayload.rawPreference || safePayload.raw_preference || '',
    manual_fields: manualFields
  };

  return request({
    path: '/api/tasks/' + encodeURIComponent(taskId || 'group_mock_task') + '/participants',
    method: 'POST',
    data: data
  }).then(function (res) {
    return {
      status: REAL_STATUS,
      taskId: taskId,
      nextUrl: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId || 'group_mock_task'),
      participant: res.participant || res,
      payload: data,
      message: '成员偏好已提交'
    };
  }).catch(function () {
    return submitFallbackPreference(taskId, safePayload);
  });
}

function getTaskBoard(taskId) {
  return request({
    path: '/api/tasks/' + encodeURIComponent(taskId || 'group_mock_task')
  }).then(function (res) {
    return normalizeTaskBoard(taskId, res);
  }).catch(function () {
    return getFallbackTaskBoard(taskId);
  });
}

module.exports = {
  API_BASE_URL,
  createTask,
  submitPreference,
  getTaskBoard,
  createFallbackTask,
  submitFallbackPreference,
  getFallbackTaskBoard
};
