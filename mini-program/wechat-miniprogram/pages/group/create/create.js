const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    isSubmitting: false,
    // Populated after a successful createTask call.
    createdTask: null,    // { taskId, inviteToken, sharePath, task }
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

    const form = this.data.form;
    if (!form.creatorName || !form.creatorName.trim()) {
      wx.showToast({ title: '先填一下昵称', icon: 'none' });
      return;
    }
    if (!form.rawRequest || !form.rawRequest.trim()) {
      wx.showToast({ title: '描述一下这次想解决什么', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '生成任务…', mask: true });

    const self = this;
    groupDiningAdapter.createTask(form).then(function (board) {
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
        title: '创建任务失败：' + ((err && (err.errMsg || err.message)) || 'unknown'),
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

  // Mini-program share affordance — produces a card pointing at the fill
  // page with the inviteToken so recipients land directly on their form.
  onShareAppMessage() {
    const created = this.data.createdTask;
    if (!created) {
      return {
        title: '一起约个饭吧',
        path: '/pages/group/create/create'
      };
    }
    const task = created.task || {};
    const title = (task.creatorName ? task.creatorName + ' ' : '') +
                  '邀请你一起约饭：' + (task.title || '一次多人约饭');
    return {
      title: title,
      path: created.sharePath
    };
  }
});
