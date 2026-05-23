App({
  globalData: {
    isLoggedIn: false,
    // Development / real-device debugging backend origin for the single-person
    // food recommendation flow. Experience build and production still require HTTPS.
    // Leave empty to use the local mock recommendation fallback only.
    foodRecommendApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    groupDiningApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io'
  },

  onLaunch() {
    this.globalData.isLoggedIn = !!wx.getStorageSync('isLoggedIn');
  }
});
