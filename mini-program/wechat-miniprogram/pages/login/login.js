const themeAdapter = require('../../services/themeAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');

Page({
  data: {
    isLoading: false,
    errorMessage: '',
    currentTheme: themeAdapter.DEFAULT_THEME_ID
  },

  onLoad() {
    this.syncTheme();
    if (userIdentityAdapter.hasSession()) {
      wx.reLaunch({
        url: userIdentityAdapter.consumePendingRedirect('/pages/home/home')
      });
    }
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    const app = getApp();

    if (app && app.syncThemeToPage) {
      app.syncThemeToPage(this);
      return;
    }

    this.setData(themeAdapter.getPageThemeData());
  },

  handleLogin() {
    this.setData({
      isLoading: true,
      errorMessage: ''
    });

    const app = getApp();
    const loginPromise = app && typeof app.ensureLogin === 'function'
      ? app.ensureLogin({ force: true })
      : userIdentityAdapter.ensureLogin({ force: true });

    loginPromise.then(() => {
      wx.reLaunch({
        url: userIdentityAdapter.consumePendingRedirect('/pages/home/home'),
        fail: () => {
          this.setData({
            isLoading: false
          });
          wx.showToast({
            title: 'open home failed',
            icon: 'none'
          });
        }
      });
    }).catch((error) => {
      const message = error && error.message ? error.message : String(error || '');
      console.error('[login] wechat login failed', error);
      this.setData({
        isLoading: false,
        errorMessage: message
      });
      wx.showToast({
        title: 'login failed',
        icon: 'none'
      });
    });
  }
});
