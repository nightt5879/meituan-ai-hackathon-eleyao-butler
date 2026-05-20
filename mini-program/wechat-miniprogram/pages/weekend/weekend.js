const themeAdapter = require('../../services/themeAdapter');
const weekendPlannerAdapter = require('../../services/weekendPlannerAdapter');

Page({
  data: {
    currentTheme: 'warm',
    plan: null,
    cards: [
      { title: '时间窗口', desc: '周六下午 / 周日晚间 / 2 小时轻出门' },
      { title: '兴趣偏好', desc: '散步、咖啡、展览、拍照、轻食' },
      { title: '约束自检', desc: '预算、距离、天气、人流、返程时间' }
    ]
  },

  onLoad() {
    this.syncTheme();
    this.setData({
      plan: weekendPlannerAdapter.getPlan('weekend_mock_plan')
    });
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
    weekendPlannerAdapter.createPlan({});
    wx.showToast({
      title: '规划接口待接入',
      icon: 'none'
    });
  }
});
