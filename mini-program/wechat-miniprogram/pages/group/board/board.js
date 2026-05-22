const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

// Translate backend status strings into Chinese labels for the progress pill.
const STATUS_LABELS = {
  waiting_preferences: '收集中',
  ready_to_recommend: '可推荐',
  recommending: '生成中',
  done: '已完成',
  failed: '失败'
};

function statusLabel(status) {
  if (!status) { return '待接入'; }
  return STATUS_LABELS[status] || status;
}

Page({
  data: {
    currentTheme: 'warm',
    taskId: '',
    isLoading: false,
    isRecommending: false,
    board: null,
    statusLabel: '待接入',
    errorMessage: '',
    // Static step scaffold preserved so the page still renders when data
    // hasn't arrived yet. Each step swaps to real data via wx:if in WXML.
    steps: [
      { key: 'participants',   title: '成员偏好',  desc: '后端返回 participants 后会展示真实昵称与抽取结果' },
      { key: 'conflicts',      title: '冲突识别',  desc: '后端返回 conflicts 后展示硬约束/软偏好冲突' },
      { key: 'recommendation', title: '候选方案',  desc: '后端 recommend 调用后展示候选餐厅与最终推荐' }
    ]
  },

  onLoad(query) {
    this.syncTheme();
    const taskId = (query && query.taskId) || '';
    this.setData({ taskId: taskId });
    if (taskId) {
      this.loadBoard();
    } else {
      this.setData({
        errorMessage: '缺少 taskId，无法加载任务看板。请从创建/填写页跳转过来。'
      });
    }
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
  },

  handleBackHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  loadBoard() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isLoading) { return; }

    this.setData({ isLoading: true, errorMessage: '' });
    const self = this;
    groupDiningAdapter.getTaskBoard(taskId).then(function (board) {
      self.setData({
        board: board,
        statusLabel: statusLabel((board.recommendationState && board.recommendationState.status) || (board.task && board.task.status)),
        isLoading: false
      });
    }).catch(function (err) {
      console.error('getTaskBoard failed', err);
      self.setData({
        isLoading: false,
        errorMessage: '加载失败：' + ((err && err.errMsg) || 'network')
      });
    });
  },

  handleRefresh() {
    this.loadBoard();
  },

  handleGenerateRecommendation() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isRecommending) { return; }

    this.setData({ isRecommending: true, errorMessage: '' });
    wx.showLoading({ title: '生成推荐…', mask: true });
    const self = this;
    groupDiningAdapter.generateRecommendation(taskId).then(function (board) {
      wx.hideLoading();
      self.setData({
        board: board,
        statusLabel: statusLabel((board.recommendationState && board.recommendationState.status) || (board.task && board.task.status)),
        isRecommending: false
      });
    }).catch(function (err) {
      wx.hideLoading();
      console.error('generateRecommendation failed', err);
      self.setData({
        isRecommending: false,
        errorMessage: '生成推荐失败：' + ((err && err.errMsg) || 'network')
      });
      wx.showToast({ title: '生成失败', icon: 'none' });
    });
  }
});
