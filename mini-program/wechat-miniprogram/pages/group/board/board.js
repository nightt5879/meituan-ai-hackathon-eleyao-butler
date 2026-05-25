const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    taskId: 'group_mock_task',
    inviteToken: 'group_mock_token',
    board: null,
    isLoading: false,
    isRecommending: false
  },

  onLoad(options) {
    const taskId = options && options.taskId ? options.taskId : 'group_mock_task';
    const inviteToken = options && options.inviteToken ? options.inviteToken : 'group_mock_token';

    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken));
      return;
    }

    this.setData({
      taskId,
      inviteToken
    });
    this.loadBoard();
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

  loadBoard() {
    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载中' });

    groupDiningAdapter.getTaskBoard(this.data.taskId, this.data.inviteToken).then((board) => {
      wx.hideLoading();
      if (board.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '后端暂不可用',
          icon: 'none'
        });
      }
      this.setData({
        board,
        isLoading: false
      });
    }).catch((error) => {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(this.data.taskId) + '&inviteToken=' + encodeURIComponent(this.data.inviteToken));
        return;
      }
      this.setData({
        board: groupDiningAdapter.getFallbackTaskBoard(this.data.taskId, this.data.inviteToken),
        isLoading: false
      });
    });
  },

  handleGenerateRecommendation() {
    this.setData({ isRecommending: true });
    wx.showLoading({ title: '生成中' });

    groupDiningAdapter.generateRecommendation(this.data.taskId, this.data.inviteToken).then((board) => {
      wx.hideLoading();
      if (board.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '推荐失败，已回退',
          icon: 'none'
        });
      }
      this.setData({
        board,
        isRecommending: false
      });
    }).catch((error) => {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(this.data.taskId) + '&inviteToken=' + encodeURIComponent(this.data.inviteToken));
        return;
      }
      wx.showToast({
        title: '推荐失败',
        icon: 'none'
      });
      this.setData({
        isRecommending: false
      });
    });
  },

  handleRefresh() {
    this.loadBoard();
  },

  handleBackHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  handleBack() {
    wx.navigateBack();
  }
});
