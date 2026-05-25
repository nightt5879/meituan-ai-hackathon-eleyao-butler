const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    form: {
      nickname: '',
      rawPreference: '',
      budget: '',
      leaveBefore: '',
      spicy: '还没选择'
    },
    taskId: 'group_mock_task',
    inviteToken: 'group_mock_token',
    spicyOptions: [
      { label: '不吃辣', active: false },
      { label: '微辣', active: false },
      { label: '中辣', active: false },
      { label: '重辣', active: false }
    ]
  },

  onLoad(options) {
    this.syncTheme();
    const taskId = options && options.taskId ? options.taskId : 'group_mock_task';
    const inviteToken = options && options.inviteToken ? options.inviteToken : 'group_mock_token';

    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken));
      return;
    }

    this.setData({
      taskId,
      inviteToken
    });
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
    const page = this;
    wx.showLoading({ title: '提交中' });
    groupDiningAdapter.submitPreference(this.data.taskId, this.data.inviteToken, this.data.form).then(function (result) {
      wx.hideLoading();
      if (result.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '后端暂不可用',
          icon: 'none'
        });
      }
      wx.navigateTo({
        url: result.nextUrl
      });
    }).catch(function (error) {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/fill/fill?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken));
        return;
      }
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      });
    });
  }
});
