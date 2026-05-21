const themeAdapter = require('../../services/themeAdapter');

Page({
  data: {
    isLoading: false,
    currentTheme: 'warm'
  },

  onLoad() {
    this.syncTheme();
    if (wx.getStorageSync('isLoggedIn')) {
      wx.reLaunch({
        url: '/pages/home/home'
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

  handleLogin() {
    this.setData({
      isLoading: true
    });

    wx.setStorageSync('isLoggedIn', true);

    const app = getApp();
    app.globalData.isLoggedIn = true;

    wx.reLaunch({
      url: '/pages/home/home',
      fail: () => {
        this.setData({
          isLoading: false
        });
        wx.showToast({
          title: '进入首页失败，请看 Console',
          icon: 'none'
        });
      }
    });
  }
});
