const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');

Page({
  data: {
    currentTheme: 'warm',
    form: {
      nickname: '',
      rawPreference: '',
      budget: '',
      leaveBefore: '',
      spicy: '还没选择'
    },
    spicyOptions: [
      { label: '不吃辣', active: false },
      { label: '微辣', active: false },
      { label: '中辣', active: false },
      { label: '重辣', active: false }
    ]
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
    const form = Object.assign({}, this.data.form);
    form[field] = event.detail.value;
    this.setData({ form });
  },

  selectSpicy(event) {
    const label = event.currentTarget.dataset.label;
    const form = Object.assign({}, this.data.form, { spicy: label });
    const spicyOptions = this.data.spicyOptions.map(function (item) {
      return Object.assign({}, item, {
        active: item.label === label
      });
    });
    this.setData({ form, spicyOptions });
  },

  handleSubmitPreference() {
    const result = groupDiningAdapter.submitPreference('group_mock_task', this.data.form);
    wx.navigateTo({
      url: result.nextUrl
    });
  }
});
