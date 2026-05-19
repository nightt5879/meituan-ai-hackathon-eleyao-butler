Page({
  data: {
    isLoading: false
  },

  onLoad() {
    if (wx.getStorageSync('isLoggedIn')) {
      wx.reLaunch({
        url: '/pages/home/home'
      });
    }
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
