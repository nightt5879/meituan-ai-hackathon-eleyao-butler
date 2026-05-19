App({
  globalData: {
    isLoggedIn: false
  },

  onLaunch() {
    this.globalData.isLoggedIn = !!wx.getStorageSync('isLoggedIn');
  }
});
