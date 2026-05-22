const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    taskId: '',
    inviteToken: '',
    // Task summary loaded via getTaskBoard. null while loading or on error.
    taskSummary: null,
    isLoadingTask: false,
    isSubmitting: false,
    errorMessage: '',
    form: {
      nickname: '',
      rawPreference: '',
      budget: '',
      leaveBefore: '',
      spicy: '还没选择'
    },
    spicyOptions: [
      { label: '不吃辣', active: false },
      { label: '微辣', active: false },
      { label: '中辣', active: false },
      { label: '重辣', active: false }
    ]
  },

  onLoad(query) {
    this.syncTheme();
    const taskId = (query && query.taskId) || '';
    const inviteToken = (query && query.inviteToken) || '';
    this.setData({ taskId: taskId, inviteToken: inviteToken });
    if (taskId) {
      this.loadTaskSummary();
    } else {
      this.setData({
        errorMessage: '链接缺少 taskId，无法加载任务。请向发起人重新索取分享链接。'
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

  handleBack() {
    wx.navigateBack();
  },

  loadTaskSummary() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isLoadingTask) { return; }

    this.setData({ isLoadingTask: true, errorMessage: '' });
    const self = this;
    groupDiningAdapter.getTaskBoard(taskId, this.data.inviteToken).then(function (board) {
      self.setData({
        isLoadingTask: false,
        taskSummary: {
          title: (board.task && board.task.title) || '一次多人约饭',
          creatorName: (board.task && board.task.creatorName) || '',
          rawRequest: (board.task && board.task.rawRequest) || '',
          locationText: (board.task && board.task.locationText) || '',
          dinnerTime: (board.task && board.task.dinnerTime) || '',
          expectedPeopleCount: (board.task && board.task.expectedPeopleCount) || 0,
          submittedCount: board.submittedCount || 0
        }
      });
    }).catch(function (err) {
      console.error('getTaskBoard failed in fill', err);
      self.setData({
        isLoadingTask: false,
        errorMessage: '加载任务失败：' + ((err && (err.errMsg || err.message)) || 'unknown')
      });
    });
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form);
    form[field] = event.detail.value;
    this.setData({ form });
  },

  selectSpicy(event) {
    const label = event.currentTarget.dataset.label;
    const form = Object.assign({}, this.data.form, { spicy: label });
    const spicyOptions = this.data.spicyOptions.map(function (item) {
      return Object.assign({}, item, {
        active: item.label === label
      });
    });
    this.setData({ form, spicyOptions });
  },

  handleSubmitPreference() {
    if (this.data.isSubmitting) { return; }
    const taskId = this.data.taskId;
    if (!taskId) {
      wx.showToast({ title: '缺少 taskId，请使用分享链接进入', icon: 'none' });
      return;
    }

    const form = this.data.form;
    if (!form.nickname || !form.nickname.trim()) {
      wx.showToast({ title: '先填一下昵称', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交偏好…', mask: true });

    const self = this;
    groupDiningAdapter.submitPreference(taskId, this.data.inviteToken, form).then(function () {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      wx.showToast({ title: '已提交', icon: 'success' });
      wx.navigateTo({
        url: '/pages/group/board/board' +
             '?taskId=' + encodeURIComponent(taskId) +
             '&inviteToken=' + encodeURIComponent(self.data.inviteToken || '')
      });
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      console.error('submitPreference failed', err);
      wx.showToast({
        title: '提交失败：' + ((err && (err.errMsg || err.message)) || 'unknown'),
        icon: 'none'
      });
    });
  }
});
