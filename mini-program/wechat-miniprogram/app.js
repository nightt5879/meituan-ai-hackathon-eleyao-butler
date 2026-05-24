const userIdentityAdapter = require('./services/userIdentityAdapter');

App({
  globalData: {
    isLoggedIn: false,
    authReady: false,
    authError: '',
    currentUserId: '',
    sessionToken: '',
    // Development / real-device debugging backend origin for the single-person
    // food recommendation flow. Experience build and production still require HTTPS.
    // Leave empty to use the local mock recommendation fallback only.
    authApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    foodRecommendApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    groupDiningApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io'
  },

  onLaunch() {
    this.globalData.isLoggedIn = userIdentityAdapter.hasSession();
    this.globalData.currentUserId = userIdentityAdapter.getCurrentUserId();
    this.globalData.sessionToken = userIdentityAdapter.getSessionToken();
  },

  ensureLogin(options) {
    const app = this;

    return userIdentityAdapter.ensureLogin(options).then(function (identity) {
      app.globalData.isLoggedIn = true;
      app.globalData.authReady = true;
      app.globalData.authError = '';
      app.globalData.currentUserId = identity.userId;
      app.globalData.sessionToken = identity.sessionToken;
      return identity;
    }).catch(function (error) {
      app.globalData.isLoggedIn = false;
      app.globalData.authReady = false;
      app.globalData.authError = error && error.message ? error.message : String(error || '');
      app.globalData.currentUserId = '';
      app.globalData.sessionToken = '';
      throw error;
    });
  }
});
