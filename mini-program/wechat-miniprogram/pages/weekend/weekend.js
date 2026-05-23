const themeAdapter = require('../../services/themeAdapter');
const weekendPlannerAdapter = require('../../services/weekendPlannerAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');

Page({
  data: {
    currentTheme: 'warm',
    plan: null,
    cards: [
      { title: '时间窗口', desc: '周六下午 / 周日傍晚 / 2 小时轻出门' },
      { title: '兴趣偏好', desc: '散步、咖啡、展览、拍照、轻食' },
      { title: '约束自检', desc: '预算、距离、天气、人流、返程时间' }
    ]
  },

  onLoad() {
    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/weekend/weekend');
    }
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  handleCreatePlan() {
    wx.showLoading({ title: '创建中' });
    weekendPlannerAdapter.createPlan({}).then((plan) => {
      wx.hideLoading();
      this.setData({ plan });
      wx.showToast({
        title: '已创建',
        icon: 'success'
      });
    }).catch((error) => {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/weekend/weekend');
        return;
      }
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    });
  }
});
