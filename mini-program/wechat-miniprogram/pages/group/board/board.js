const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    board: null,
    steps: [
      { title: '成员偏好', desc: '等待真实 participant 数据写入', status: 'empty' },
      { title: '冲突识别', desc: '后续展示硬约束、软偏好和冲突解决策略', status: 'empty' },
      { title: '候选方案', desc: '后续展示候选餐厅、自检结果和最终推荐', status: 'empty' }
    ]
  },

  onLoad() {
    this.syncTheme();
    this.setData({
      board: groupDiningAdapter.getTaskBoard('group_mock_task')
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

  handleBackHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
  },

  handleBack() {
    wx.navigateBack();
  }
});
