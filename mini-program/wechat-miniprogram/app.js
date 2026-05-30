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
    // Production backend origin. Keep all mini-program API calls on the same
    // HTTPS domain so account/session, profile memory, food, group dining, and
    // weekend planning share one server-side data path.
    authApiBaseUrl: 'https://meituan-ai-hackathon.cn',
    foodRecommendApiBaseUrl: 'https://meituan-ai-hackathon.cn',
    groupDiningApiBaseUrl: 'https://meituan-ai-hackathon.cn',
    weekendApiBaseUrl: 'https://meituan-ai-hackathon.cn',
    // Group dining adapter mode: 'auto' | 'real' | 'mock'.
    // - 'auto'  : try real backend first; fall back to local mock on failure.
    // - 'real'  : real backend only; surface errors to the page.
    // - 'mock'  : skip wx.request entirely; always serve the local fallback
    //             data so the feature works without HTTPS / online backend.
    // Priority at read time (in adapter): storage 'MINIPROGRAM_API_MODE'
    // overrides this globalData value, which overrides the 'auto' default.
    groupDiningMode: 'auto'
  },

  onLaunch() {
    this.globalData.isLoggedIn = userIdentityAdapter.hasSession();
    this.globalData.currentUserId = userIdentityAdapter.getCurrentUserId();
    this.globalData.sessionToken = userIdentityAdapter.getSessionToken();
    this.applyTheme(themeAdapter.getCurrentThemeKey(), { silent: true });

    // With the final HTTPS domain configured in the WeChat backend whitelist,
    // trial/release builds should also try the real backend first. A storage
    // override ('MINIPROGRAM_API_MODE') can still force mock mode when needed.
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
