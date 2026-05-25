const userIdentityAdapter = require('./services/userIdentityAdapter');
const themeAdapter = require('./services/themeAdapter');

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
    groupDiningApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    weekendApiBaseUrl: 'http://meituan.43-110-71-200.sslip.io',
    currentTheme: themeAdapter.getThemeByKey(themeAdapter.DEFAULT_THEME_ID)
  },

  onLaunch() {
    this.globalData.currentTheme = themeAdapter.getCurrentTheme();
    themeAdapter.applyNavigationBar(this.globalData.currentTheme.id);

    this.globalData.isLoggedIn = userIdentityAdapter.hasSession();
    this.globalData.currentUserId = userIdentityAdapter.getCurrentUserId();
    this.globalData.sessionToken = userIdentityAdapter.getSessionToken();
  },

  applyTheme(themeId, options) {
    const safeOptions = options || {};
    const theme = safeOptions.persist === false
      ? themeAdapter.getThemeByKey(themeId)
      : themeAdapter.getThemeByKey(themeAdapter.saveTheme(themeId));

    this.globalData.currentTheme = theme;
    themeAdapter.applyNavigationBar(theme.id);

    if (safeOptions.syncPages !== false) {
      this.syncThemeToPages();
    }

    return theme;
  },

  getCurrentTheme() {
    if (!this.globalData.currentTheme) {
      this.globalData.currentTheme = themeAdapter.getCurrentTheme();
    }

    return this.globalData.currentTheme;
  },

  syncThemeToPage(page) {
    if (!page || !page.setData) {
      return null;
    }

    const theme = this.getCurrentTheme();
    const themeData = themeAdapter.getPageThemeData(theme.id);
    themeAdapter.applyNavigationBar(theme.id);
    page.setData(themeData);
    return themeData;
  },

  syncThemeToPages() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const theme = this.getCurrentTheme();
    const themeData = themeAdapter.getPageThemeData(theme.id);

    pages.forEach(function (page) {
      if (page && page.setData) {
        page.setData(themeData);
      }
    });
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
