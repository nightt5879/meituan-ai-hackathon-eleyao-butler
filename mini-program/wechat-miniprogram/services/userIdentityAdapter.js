const DEFAULT_API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const API_BASE_STORAGE_KEY = 'MINIPROGRAM_API_BASE_URL';
const SESSION_TOKEN_STORAGE_KEY = 'MEITUAN_SESSION_TOKEN';
const CURRENT_USER_ID_STORAGE_KEY = 'MEITUAN_CURRENT_USER_ID';
const IDENTITY_TYPE_STORAGE_KEY = 'MEITUAN_IDENTITY_TYPE';
const PENDING_LOGIN_REDIRECT_STORAGE_KEY = 'MEITUAN_PENDING_LOGIN_REDIRECT';

let loginPromise = null;

function getApiBaseUrl() {
  try {
    const storageBaseUrl = wx.getStorageSync(API_BASE_STORAGE_KEY);
    if (storageBaseUrl) {
      return String(storageBaseUrl).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[userIdentityAdapter] read api base url failed', error);
  }

  try {
    const app = typeof getApp === 'function' ? getApp({ allowDefault: true }) : null;
    const globalData = app && app.globalData ? app.globalData : {};
    const configured = globalData.authApiBaseUrl || globalData.groupDiningApiBaseUrl || globalData.foodRecommendApiBaseUrl;
    if (configured) {
      return String(configured).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[userIdentityAdapter] read app api base url failed', error);
  }

  return DEFAULT_API_BASE_URL;
}

function getSessionToken() {
  try {
    return String(wx.getStorageSync(SESSION_TOKEN_STORAGE_KEY) || '');
  } catch (error) {
    console.warn('[userIdentityAdapter] read session token failed', error);
    return '';
  }
}

function getCurrentUserId() {
  try {
    return String(wx.getStorageSync(CURRENT_USER_ID_STORAGE_KEY) || '');
  } catch (error) {
    console.warn('[userIdentityAdapter] read current user id failed', error);
    return '';
  }
}

function hasSession() {
  return !!(getSessionToken() && getCurrentUserId());
}

function getAuthorizationHeader() {
  const token = getSessionToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function consumePendingRedirect(defaultUrl) {
  const fallbackUrl = defaultUrl || '/pages/home/home';
  try {
    const pendingUrl = String(wx.getStorageSync(PENDING_LOGIN_REDIRECT_STORAGE_KEY) || '');
    if (pendingUrl) {
      wx.removeStorageSync(PENDING_LOGIN_REDIRECT_STORAGE_KEY);
      return pendingUrl;
    }
  } catch (error) {
    console.warn('[userIdentityAdapter] consume pending redirect failed', error);
  }

  return fallbackUrl;
}

function requireLoginRedirect(url) {
  try {
    if (url) {
      wx.setStorageSync(PENDING_LOGIN_REDIRECT_STORAGE_KEY, url);
    }
  } catch (error) {
    console.warn('[userIdentityAdapter] save pending redirect failed', error);
  }

  wx.reLaunch({
    url: '/pages/login/login'
  });
}

function clearIdentity() {
  try {
    wx.removeStorageSync(SESSION_TOKEN_STORAGE_KEY);
    wx.removeStorageSync(CURRENT_USER_ID_STORAGE_KEY);
    wx.removeStorageSync(IDENTITY_TYPE_STORAGE_KEY);
    wx.setStorageSync('isLoggedIn', false);
  } catch (error) {
    console.warn('[userIdentityAdapter] clear identity failed', error);
  }
}

function persistIdentity(payload) {
  const sessionToken = payload && payload.sessionToken ? String(payload.sessionToken) : '';
  const userId = payload && payload.userId ? String(payload.userId) : '';
  const identityType = payload && payload.identityType ? String(payload.identityType) : 'wechat_openid';

  if (!sessionToken || !userId) {
    throw new Error('Wechat login response missing sessionToken or userId');
  }

  wx.setStorageSync(SESSION_TOKEN_STORAGE_KEY, sessionToken);
  wx.setStorageSync(CURRENT_USER_ID_STORAGE_KEY, userId);
  wx.setStorageSync(IDENTITY_TYPE_STORAGE_KEY, identityType);
  wx.setStorageSync('isLoggedIn', true);

  return {
    userId: userId,
    sessionToken: sessionToken,
    identityType: identityType,
    isStable: payload.isStable !== false
  };
}

function requestWxLoginCode() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) {
        if (res && res.code) {
          resolve(res.code);
          return;
        }

        reject(new Error('wx.login returned no code'));
      },
      fail: function (error) {
        reject(new Error(error && error.errMsg ? error.errMsg : 'wx.login failed'));
      }
    });
  });
}

function requestBackendSession(code) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: getApiBaseUrl() + '/api/auth/wechat-login',
      method: 'POST',
      data: {
        code: code
      },
      timeout: 15000,
      header: {
        'content-type': 'application/json'
      },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }

        const message = res.data && res.data.error && res.data.error.message
          ? res.data.error.message
          : 'wechat login failed with status ' + res.statusCode;
        const error = new Error(message);
        error.statusCode = res.statusCode;
        error.response = res.data;
        reject(error);
      },
      fail: function (error) {
        reject(new Error(error && error.errMsg ? error.errMsg : 'wechat login request failed'));
      }
    });
  });
}

function ensureLogin(options) {
  const force = options && options.force;

  if (!force && hasSession()) {
    return Promise.resolve({
      userId: getCurrentUserId(),
      sessionToken: getSessionToken(),
      identityType: String(wx.getStorageSync(IDENTITY_TYPE_STORAGE_KEY) || 'wechat_openid'),
      isStable: true
    });
  }

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = requestWxLoginCode()
    .then(function (code) {
      return requestBackendSession(code);
    })
    .then(function (payload) {
      return persistIdentity(payload);
    })
    .catch(function (error) {
      clearIdentity();
      throw error;
    });

  loginPromise.then(
    function () {
      loginPromise = null;
    },
    function () {
      loginPromise = null;
    }
  );

  return loginPromise;
}

module.exports = {
  API_BASE_STORAGE_KEY,
  SESSION_TOKEN_STORAGE_KEY,
  CURRENT_USER_ID_STORAGE_KEY,
  PENDING_LOGIN_REDIRECT_STORAGE_KEY,
  getApiBaseUrl,
  getSessionToken,
  getCurrentUserId,
  hasSession,
  getAuthorizationHeader,
  consumePendingRedirect,
  requireLoginRedirect,
  ensureLogin,
  clearIdentity
};
