const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');

const PEOPLE_PRESETS = ['2', '3', '4', '5', '6', '8', '10'];

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    isSubmitting: false,
    peopleOptions: [],
    selectedPeople: '5',
    customPeopleInput: '',
    createdTask: null
  },

  onLoad() {
    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/group/create/create');
      return;
    }
    this.refreshPeopleOptions('5');
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    const app = getApp();

    if (app && app.syncThemeToPage) {
      app.syncThemeToPage(this);
      return;
    }

    this.setData(themeAdapter.getPageThemeData());
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
    if (!value) {
      return;
    }
    this.setData({
      selectedPeople: value,
      customPeopleInput: ''
    });
    this.refreshPeopleOptions(value);
  },

  handleCustomPeopleInput(event) {
    const raw = event.detail.value || '';
    const custom = raw.trim();
    this.setData({
      customPeopleInput: raw,
      selectedPeople: custom || this.data.selectedPeople
    });
    this.refreshPeopleOptions('');
  },

  resolvePeopleCount() {
    const custom = (this.data.customPeopleInput || '').trim();
    return custom || this.data.selectedPeople;
  },

  handleCreateTask() {
    if (this.data.isSubmitting) {
      return;
    }

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

    const page = this;
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '生成任务…', mask: true });

    groupDiningAdapter.createTask({
      peopleCount: peopleNumber
    }).then(function (result) {
      wx.hideLoading();
      const board = result.board || {};
      const task = board.task || result.task || {
        title: peopleNumber + ' 人聚餐'
      };
      if (result.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '后端暂不可用',
          icon: 'none'
        });
      }
      page.setData({
        isSubmitting: false,
        createdTask: {
          taskId: result.taskId,
          inviteToken: result.inviteToken || '',
          sharePath: result.sharePath || result.nextUrl || '',
          boardUrl: result.boardUrl || ('/pages/group/board/board?taskId=' + encodeURIComponent(result.taskId || '') + '&inviteToken=' + encodeURIComponent(result.inviteToken || '')),
          task: task
        }
      });
      wx.showToast({ title: '任务已生成', icon: 'success' });
    }).catch(function (error) {
      wx.hideLoading();
      page.setData({ isSubmitting: false });
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/create/create');
        return;
      }
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    });
  },

  handleCopySharePath() {
    const created = this.data.createdTask;
    if (!created || !created.sharePath) {
      return;
    }
    wx.setClipboardData({
      data: created.sharePath,
      success: function () {
        wx.showToast({ title: '已复制分享路径', icon: 'none' });
      }
    });
  },

  handleViewBoard() {
    const created = this.data.createdTask;
    if (!created) {
      return;
    }
    wx.navigateTo({
      url: created.boardUrl || ('/pages/group/board/board?taskId=' + encodeURIComponent(created.taskId || '') + '&inviteToken=' + encodeURIComponent(created.inviteToken || ''))
    });
  },

  handleCreateAnother() {
    this.setData({ createdTask: null });
    this.refreshPeopleOptions(this.data.selectedPeople || '5');
  },

  onShareAppMessage() {
    const created = this.data.createdTask;
    if (!created) {
      return { title: '一起约个饭吧', path: '/pages/group/create/create' };
    }
    const task = created.task || {};
    return {
      title: '邀请你一起约饭：' + (task.title || '一次多人约饭'),
      path: created.sharePath || '/pages/group/create/create'
    };
  }
});
