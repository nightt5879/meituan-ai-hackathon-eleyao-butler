const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
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
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
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
    }).catch(() => {
      wx.hideLoading();
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
    }).catch(() => {
      wx.hideLoading();
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
