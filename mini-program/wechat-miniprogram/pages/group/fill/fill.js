const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    taskId: '',
    isSubmitting: false,
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
    this.setData({ taskId: taskId });
    if (!taskId) {
      // No taskId in the query — the page was opened directly without the
      // create-task hand-off. We still render the form, but submit will warn.
      console.warn('fill page opened without taskId');
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
      wx.showToast({ title: '缺少 taskId，请回到上一步重新创建', icon: 'none' });
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
    groupDiningAdapter.submitPreference(taskId, form).then(function () {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      wx.navigateTo({
        url: '/pages/group/board/board?taskId=' + encodeURIComponent(taskId)
      });
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      console.error('submitPreference failed', err);
      wx.showToast({
        title: '提交失败：' + ((err && err.errMsg) || 'network'),
        icon: 'none'
      });
    });
  }
});
