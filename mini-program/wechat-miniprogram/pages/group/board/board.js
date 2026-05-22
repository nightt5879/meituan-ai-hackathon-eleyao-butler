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

const POLL_INTERVAL_MS = 3000;

function statusLabel(status) {
  if (!status) { return '待加载'; }
  return STATUS_LABELS[status] || status;
}

function boardStatus(board) {
  if (!board) { return ''; }
  if (board.recommendationState && board.recommendationState.status) {
    return board.recommendationState.status;
  }
  if (board.task && board.task.status) { return board.task.status; }
  return '';
}

Page({
  data: {
    currentTheme: 'warm',
    taskId: '',
    inviteToken: '',
    isLoading: false,
    isRecommending: false,
    hasInitialized: false,
    board: null,
    statusLabel: '待加载',
    errorMessage: '',
    // Static step scaffold preserved so the page still renders before data
    // arrives. Each step swaps to real data via wx:if in board.wxml.
    steps: [
      { key: 'participants',   title: '成员偏好',  desc: 'submitPreference 写入后展示真实昵称与抽取约束' },
      { key: 'conflicts',      title: '冲突识别',  desc: 'adapter 会基于成员偏好生成 conflicts' },
      { key: 'recommendation', title: '候选方案',  desc: '点「生成推荐」会调用 generateRecommendation' }
    ]
  },

  onLoad(query) {
    this.syncTheme();
    const taskId = (query && query.taskId) || '';
    const inviteToken = (query && query.inviteToken) || '';
    this.setData({ taskId: taskId, inviteToken: inviteToken });
    if (taskId) {
      this.loadBoard({ initial: true });
    } else {
      this.setData({
        errorMessage: '缺少 taskId，无法加载任务看板。请从创建或填写页跳转过来。'
      });
    }
  },

  onShow() {
    this.syncTheme();
    if (this.data.taskId) {
      this.startPolling();
    }
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  onPullDownRefresh() {
    if (!this.data.taskId) {
      wx.stopPullDownRefresh();
      return;
    }
    const self = this;
    this.loadBoard().then(function () {
      wx.stopPullDownRefresh();
    }).catch(function () {
      wx.stopPullDownRefresh();
    });
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

  // loadBoard returns a Promise so onPullDownRefresh / handlers can chain.
  loadBoard(options) {
    const opts = options || {};
    const taskId = this.data.taskId;
    if (!taskId) { return Promise.resolve(); }
    if (this.data.isLoading && !opts.silent) { return Promise.resolve(); }

    if (!opts.silent) {
      this.setData({ isLoading: true, errorMessage: '' });
    }
    const self = this;
    return groupDiningAdapter.getTaskBoard(taskId, this.data.inviteToken).then(function (board) {
      self.setData({
        board: board,
        statusLabel: statusLabel(boardStatus(board)),
        isLoading: false,
        hasInitialized: true,
        errorMessage: ''
      });
      return board;
    }).catch(function (err) {
      console.error('getTaskBoard failed', err);
      // On a silent (polled) refresh, swallow errors so we don't spam toasts.
      if (!opts.silent) {
        self.setData({
          isLoading: false,
          errorMessage: '加载失败：' + ((err && (err.errMsg || err.message)) || 'unknown')
        });
      }
      throw err;
    });
  },

  handleRefresh() {
    this.loadBoard();
  },

  handleGenerateRecommendation() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isRecommending) { return; }
    // Pause polling so the optimistic state isn't immediately overwritten.
    this.stopPolling();

    this.setData({ isRecommending: true, errorMessage: '' });
    wx.showLoading({ title: '生成推荐…', mask: true });

    const self = this;
    groupDiningAdapter.generateRecommendation(taskId, this.data.inviteToken).then(function (board) {
      wx.hideLoading();
      self.setData({
        board: board,
        statusLabel: statusLabel(boardStatus(board)),
        isRecommending: false
      });
      // Resume polling so subsequent participants still drive refreshes.
      self.startPolling();
    }).catch(function (err) {
      wx.hideLoading();
      console.error('generateRecommendation failed', err);
      self.setData({
        isRecommending: false,
        errorMessage: '生成推荐失败：' + ((err && (err.errMsg || err.message)) || 'unknown')
      });
      wx.showToast({ title: '生成失败', icon: 'none' });
      self.startPolling();
    });
  },

  handleCopyGroupMessage() {
    const board = this.data.board;
    const message = board && board.recommendationResult && board.recommendationResult.groupMessage;
    if (!message) {
      wx.showToast({ title: '还没有群消息', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: message,
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'none' });
      }
    });
  },

  // Polls every 3s so non-creator members see new submissions arrive.
  // Skipped while a manual refresh / recommendation is in flight.
  startPolling() {
    if (this._pollTimer) { return; }
    if (!this.data.taskId) { return; }
    const self = this;
    this._pollTimer = setInterval(function () {
      if (self.data.isLoading || self.data.isRecommending) { return; }
      self.loadBoard({ silent: true }).catch(function () {});
    }, POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
});
