const userMemoryAdapter = require('../../services/userMemoryAdapter');
const themeAdapter = require('../../services/themeAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    themeCards: [],
    showThemePanel: false,
    showHistoryPanel: false,
    historyRecords: [],
    hasHistoryRecords: false,
    recentRecordTitle: '还没有推荐记录',
    recentRecordSummary: '在结果页选择「记住这个偏好」后，我会把偏好和推荐帮你记下来。',
    recentRecordTime: '等待体验',
    recentRecordNames: '暂无'
  },

  onLoad() {
    this.syncTheme();
    this.refreshPreferenceRecords();
    this.ensureLoggedIn();
  },

  onShow() {
    this.syncTheme();
    this.refreshPreferenceRecords();
    this.ensureLoggedIn();
  },

  syncTheme() {
    const app = getApp();

    if (app && app.syncThemeToPage) {
      app.syncThemeToPage(this);
    }

    const currentTheme = (app && app.globalData && app.globalData.currentTheme) || themeAdapter.getCurrentThemeKey();
    this.setData({
      currentTheme,
      themeCards: this.buildThemeCards(currentTheme)
    });
  },

  ensureLoggedIn() {
    if (!userIdentityAdapter.hasSession()) {
      wx.reLaunch({
        url: '/pages/login/login'
      });
    }
  },

  buildThemeCards(currentTheme) {
    return themeAdapter.getThemeCards(currentTheme);
  },

  refreshPreferenceRecords() {
    const records = userMemoryAdapter.getPreferenceRecords();
    const visibleRecords = records.slice(0, 5).map(function (record, index) {
      const recommendationNames = formatRecommendationNames(record.recommendations);
      return {
        id: record.id || ('record_' + index),
        time: formatRecordTime(record.createdAt),
        summary: record.summaryText || buildFallbackSummary(record),
        names: recommendationNames,
        indexText: index + 1
      };
    });
    const firstRecord = visibleRecords[0];

    this.setData({
      historyRecords: visibleRecords,
      hasHistoryRecords: visibleRecords.length > 0,
      recentRecordTitle: firstRecord ? firstRecord.names : '还没有推荐记录',
      recentRecordSummary: firstRecord ? firstRecord.summary : '在结果页选择「记住这个偏好」后，我会把偏好和推荐帮你记下来。',
      recentRecordTime: firstRecord ? firstRecord.time : '等待体验',
      recentRecordNames: firstRecord ? firstRecord.names : '暂无'
    });
  },

  goToFood() {
    wx.navigateTo({
      url: '/pages/food/food',
      fail: function (err) {
        console.error('navigate to food failed', err);
        wx.showToast({
          title: '进入问答页失败，请看 Console',
          icon: 'none'
        });
      }
    });
  },

  goToGroupDining() {
    wx.navigateTo({
      url: '/pages/group/create/create'
    });
  },

  goToWeekend() {
    wx.navigateTo({
      url: '/pages/weekend/weekend'
    });
  },

  goToMemory() {
    wx.navigateTo({
      url: '/pages/memory/memory',
      fail: function (err) {
        console.error('navigate to memory failed', err);
        wx.showToast({
          title: '打开管家记忆失败，请看 Console',
          icon: 'none'
        });
      }
    });
  },

  openThemePanel() {
    this.syncTheme();
    this.setData({ showThemePanel: true });
  },

  closeThemePanel() {
    this.setData({ showThemePanel: false });
  },

  selectTheme(event) {
    const themeKey = event.currentTarget.dataset.key;
    const app = getApp();
    const theme = app && app.applyTheme
      ? app.applyTheme(themeKey)
      : themeAdapter.getThemeByKey(themeAdapter.saveTheme(themeKey));
    const nextTheme = theme.key || theme.id;

    this.setData({
      currentTheme: nextTheme,
      themeCards: this.buildThemeCards(nextTheme),
      showThemePanel: false
    });

    wx.showToast({
      title: '已切换为' + theme.name,
      icon: 'none'
    });
  },

  openHistoryPanel() {
    this.refreshPreferenceRecords();
    this.setData({ showHistoryPanel: true });
  },

  closeHistoryPanel() {
    this.setData({ showHistoryPanel: false });
  },

  noop() {}
});

function formatRecommendationNames(recommendations) {
  const names = (recommendations || []).map(function (item) {
    return item.name;
  }).filter(function (name) {
    return !!name;
  });

  return names.length ? names.join('、') : '暂无推荐';
}

function buildFallbackSummary(record) {
  return [
    record.mealPurpose,
    record.branchPreference,
    record.budget,
    record.distance
  ].filter(function (item) {
    return !!item;
  }).join(' · ') || '一次吃饭偏好';
}

function formatRecordTime(createdAt) {
  if (!createdAt) {
    return '时间未知';
  }

  const date = new Date(createdAt);

  if (isNaN(date.getTime())) {
    return createdAt;
  }

  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());

  return month + '-' + day + ' ' + hour + ':' + minute;
}

function padNumber(value) {
  return value < 10 ? '0' + value : String(value);
}
