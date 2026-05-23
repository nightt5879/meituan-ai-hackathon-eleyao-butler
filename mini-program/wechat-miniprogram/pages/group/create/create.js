const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    form: {
      creatorName: '小幺',
      rawRequest: '',
      peopleCount: '5 人',
      dinnerTime: '周六 18:30',
      location: ''
    }
  },

  onLoad() {
    this.syncTheme();
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

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const form = Object.assign({}, this.data.form);
    form[field] = value;
    this.setData({ form });
  },

  handleCreateTask() {
    wx.showLoading({ title: '创建中' });
    groupDiningAdapter.createTask(this.data.form).then(function (result) {
      wx.hideLoading();
      wx.navigateTo({
        url: result.nextUrl
      });
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    });
  }
});
