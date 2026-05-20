const STATUS = 'pending_integration';

function createPlan(payload) {
  return {
    status: STATUS,
    planId: 'weekend_mock_plan',
    payload: payload || {},
    message: '周末规划创建接口待接入'
  };
}

function getPlan(planId) {
  return {
    status: STATUS,
    planId: planId || 'weekend_mock_plan',
    steps: [],
    message: '周末规划详情接口待接入'
  };
}

module.exports = {
  createPlan,
  getPlan
};
