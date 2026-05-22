const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

// Simplified create flow — the organiser only chooses an expected people
// count. Other backend-required fields (creator name, raw request, dinner
// time, location) are filled with sensible defaults inside the adapter.

const PEOPLE_PRESETS = ['2', '3', '4', '5', '6', '8', '10'];

Page({
  data: {
    currentTheme: 'warm',
    isSubmitting: false,
    peopleOptions: [],
    selectedPeople: '5',
    customPeopleInput: '',
    createdTask: null     // { taskId, inviteToken, sharePath, task }
  },

  onLoad() {
    this.syncTheme();
    this.refreshPeopleOptions('5');
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  refreshPeopleOptions(selected) {
    this.setData({
      peopleOptions: PEOPLE_PRESETS.map(function (value) {
        return { value: value, active: value === selected };
      })
    });
  },

  handleSelectPeople(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) { return; }
    this.setData({
      selectedPeople: value,
      customPeopleInput: ''
    });
    this.refreshPeopleOptions(value);
  },

  handleCustomPeopleInput(event) {
    const raw = event.detail.value || '';
    this.setData({
      customPeopleInput: raw,
      selectedPeople: raw.trim() ? raw.trim() : this.data.selectedPeople
    });
    this.refreshPeopleOptions(''); // clear preset highlight while typing custom
  },

  resolvePeopleCount() {
    const custom = (this.data.customPeopleInput || '').trim();
    if (custom) { return custom; }
    return this.data.selectedPeople;
  },

  handleCreateTask() {
    if (this.data.isSubmitting) { return; }

    const peopleCount = this.resolvePeopleCount();
    const peopleNumber = parseInt(peopleCount, 10);
    if (!peopleNumber || peopleNumber < 2) {
      wx.showToast({ title: '请选择或填写至少 2 人', icon: 'none' });
      return;
    }
    if (peopleNumber > 30) {
      wx.showToast({ title: '人数最多 30 人', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '生成任务…', mask: true });

    const self = this;
    groupDiningAdapter.createTask({
      peopleCount: peopleNumber
      // creator name / raw request / dinner time / location → adapter defaults
    }).then(function (board) {
      wx.hideLoading();
      self.setData({
        isSubmitting: false,
        createdTask: {
          taskId: board.taskId,
          inviteToken: board.inviteToken,
          sharePath: board.sharePath,
          task: board.task
        }
      });
      wx.showToast({ title: '任务已生成', icon: 'success' });
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      console.error('createTask failed', err);
      wx.showToast({
        title: '创建失败：' + ((err && (err.errMsg || err.message)) || 'unknown'),
        icon: 'none'
      });
    });
  },

  handleCopySharePath() {
    const created = this.data.createdTask;
    if (!created || !created.sharePath) { return; }
    wx.setClipboardData({
      data: created.sharePath,
      success: function () {
        wx.showToast({ title: '已复制分享路径', icon: 'none' });
      }
    });
  },

  handleViewBoard() {
    const created = this.data.createdTask;
    if (!created) { return; }
    wx.navigateTo({
      url: '/pages/group/board/board' +
           '?taskId=' + encodeURIComponent(created.taskId) +
           '&inviteToken=' + encodeURIComponent(created.inviteToken || '')
    });
  },

  handleCreateAnother() {
    this.setData({ createdTask: null });
  },

  // Mini-program share affordance — uses the adapter-returned sharePath so
  // invitees land directly on the fill page with both taskId + inviteToken.
  onShareAppMessage() {
    const created = this.data.createdTask;
    if (!created) {
      return { title: '一起约个饭吧', path: '/pages/group/create/create' };
    }
    const task = created.task || {};
    const title = '邀请你一起约饭：' + (task.title || '一次多人约饭');
    return { title: title, path: created.sharePath };
  }
});
