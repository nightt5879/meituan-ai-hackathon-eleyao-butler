const STATUS = 'pending_integration';

function createTask(payload) {
  const safePayload = payload || {};
  return {
    status: STATUS,
    taskId: 'group_mock_task',
    nextUrl: '/pages/group/fill/fill',
    payload: safePayload,
    message: '多人约饭接口待接入'
  };
}

function submitPreference(taskId, payload) {
  return {
    status: STATUS,
    taskId: taskId || 'group_mock_task',
    nextUrl: '/pages/group/board/board',
    payload: payload || {},
    message: '成员偏好提交接口待接入'
  };
}

function getTaskBoard(taskId) {
  return {
    status: STATUS,
    taskId: taskId || 'group_mock_task',
    expectedCount: 5,
    submittedCount: 0,
    members: [],
    conflicts: [],
    recommendations: [],
    message: '任务看板和推荐接口待接入'
  };
}

module.exports = {
  createTask,
  submitPreference,
  getTaskBoard
};
