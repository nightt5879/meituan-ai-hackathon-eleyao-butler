App({
  globalData: {
    isLoggedIn: false,
    // Set to the deployed Next.js backend origin, for example:
    // https://your-domain.example.com
    // Leave empty to use the local mock recommendation fallback only.
    foodRecommendApiBaseUrl: ''
  },

  onLaunch() {
    this.globalData.isLoggedIn = !!wx.getStorageSync('isLoggedIn');
  }
});
