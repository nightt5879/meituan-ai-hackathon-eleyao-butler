const userIdentityAdapter = require('./userIdentityAdapter');

const DEFAULT_API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const API_BASE_STORAGE_KEY = 'MINIPROGRAM_API_BASE_URL';

function getApiBaseUrl() {
  try {
    const storageBaseUrl = wx.getStorageSync(API_BASE_STORAGE_KEY);
    if (storageBaseUrl) {
      return String(storageBaseUrl).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[weekendPlannerAdapter] read api base url failed', error);
  }

  try {
    const app = typeof getApp === 'function' ? getApp({ allowDefault: true }) : null;
    const globalData = app && app.globalData ? app.globalData : {};
    const configured = globalData.groupDiningApiBaseUrl || globalData.foodRecommendApiBaseUrl;
    if (configured) {
      return String(configured).replace(/\/$/, '');
    }
  } catch (error) {
    console.warn('[weekendPlannerAdapter] read app api base url failed', error);
  }

  return DEFAULT_API_BASE_URL;
}

function request(options) {
  return new Promise(function (resolve, reject) {
    if (!userIdentityAdapter.hasSession()) {
      const error = new Error('Wechat login required');
      error.statusCode = 401;
      reject(error);
      return;
    }

    wx.request({
      url: getApiBaseUrl() + options.path,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 20000,
      header: Object.assign({
        'content-type': 'application/json'
      }, userIdentityAdapter.getAuthorizationHeader()),
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }

        const error = new Error('Weekend planner request failed with status ' + res.statusCode);
        error.statusCode = res.statusCode;
        error.response = res.data;
        reject(error);
      },
      fail: function (error) {
        reject(new Error(error && error.errMsg ? error.errMsg : 'Weekend planner request failed'));
      }
    });
  });
}

function createPlan(payload) {
  return request({
    path: '/api/weekend/plans',
    method: 'POST',
    timeout: 30000,
    data: payload || {}
  });
}

function getPlan(planId) {
  return request({
    path: '/api/weekend/plans/' + encodeURIComponent(planId || ''),
    method: 'GET'
  });
}

module.exports = {
  getApiBaseUrl,
  createPlan,
  getPlan
};
