const userIdentityAdapter = require('./services/userIdentityAdapter');
const themeAdapter = require('./services/themeAdapter');

App({
  globalData: {
    isLoggedIn: false,
    authReady: false,
    authError: '',
    currentUserId: '',
    sessionToken: '',
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    // Development / real-device debugging backend origin for the single-person
    // food recommendation flow. Experience build and production still require HTTPS.
    // Leave empty to use the local mock recommendation fallback only.
    authApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    foodRecommendApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    groupDiningApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    weekendApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io'
  },

  onLaunch() {
    this.globalData.isLoggedIn = userIdentityAdapter.hasSession();
    this.globalData.currentUserId = userIdentityAdapter.getCurrentUserId();
    this.globalData.sessionToken = userIdentityAdapter.getSessionToken();
    this.applyTheme(themeAdapter.getCurrentThemeKey(), { silent: true });
  },

  getCurrentTheme() {
    return themeAdapter.getThemeByKey(this.globalData.currentTheme || themeAdapter.getCurrentThemeKey());
  },

  applyTheme(themeId, options) {
    const opts = options || {};
    const nextThemeId = opts.silent ? themeAdapter.normalizeThemeId(themeId) : themeAdapter.saveTheme(themeId);
    const themeData = themeAdapter.getPageThemeData(nextThemeId);

    this.globalData.currentTheme = themeData.currentTheme;
    themeAdapter.applyNavigationBar(themeData.currentTheme);

    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    pages.forEach((page) => {
      this.syncThemeToPage(page, themeData.currentTheme);
    });

    return themeData.theme;
  },

  syncThemeToPage(page, themeId) {
    if (!page || typeof page.setData !== 'function') {
      return;
    }

    const currentTheme = themeAdapter.normalizeThemeId(themeId || this.globalData.currentTheme || themeAdapter.getCurrentThemeKey());
    const themeData = themeAdapter.getPageThemeData(currentTheme);

    this.globalData.currentTheme = themeData.currentTheme;
    themeAdapter.applyNavigationBar(themeData.currentTheme);
    page.setData(themeData);
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
