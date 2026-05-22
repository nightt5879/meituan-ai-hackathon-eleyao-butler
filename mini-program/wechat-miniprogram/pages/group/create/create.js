const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    isSubmitting: false,
    form: {
      creatorName: '小幺',
      rawRequest: '',
      peopleCount: '5 人',
      dinnerTime: '周六 18:30',
      location: ''
    }
  },

  onLoad() {
    this.syncTheme();
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

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const form = Object.assign({}, this.data.form);
    form[field] = value;
    this.setData({ form });
  },

  handleCreateTask() {
    if (this.data.isSubmitting) { return; }
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '生成任务…', mask: true });

    const self = this;
    groupDiningAdapter.createTask(this.data.form).then(function (result) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      const taskId = (result && result.taskId) || '';
      if (!taskId) {
        wx.showToast({ title: '后端未返回 task_id', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId)
      });
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      console.error('createTask failed', err);
      wx.showToast({
        title: '创建任务失败：' + ((err && err.errMsg) || 'network'),
        icon: 'none'
      });
    });
  }
});
