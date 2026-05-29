const userMemoryAdapter = require('../../services/userMemoryAdapter');
const themeAdapter = require('../../services/themeAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    themeCards: [],
    showThemePanel: false,
    showHistoryPanel: false,
    showFavoritesPanel: false,
    historyRecords: [],
    hasHistoryRecords: false,
    recentRecordTitle: '还没有偏好记录',
    recentRecordSummary: '在结果页选择「记住这个偏好」后，我会把你的偏好帮你记下来。',
    recentRecordTime: '等待体验',
    recentRecordNames: '暂无',
    favoriteShops: [],
    hasFavoriteShops: false
  },

  onLoad() {
    this.syncTheme();
    this.refreshPreferenceRecords();
    this.refreshFavoriteShops();
    this.ensureLoggedIn();
  },

  onShow() {
    this.syncTheme();
    this.refreshPreferenceRecords();
    this.refreshFavoriteShops();
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
      const title = formatRecordTitle(record);
      const rawSummary = record.summaryText || buildFallbackSummary(record);
      return {
        id: record.id || ('record_' + index),
        time: formatRecordTime(record.createdAt),
        summary: stripMealSceneFromSummary(rawSummary, record.mealPurpose, title),
        title: title,
        indexText: index + 1
      };
    });
    const firstRecord = visibleRecords[0];

    this.setData({
      historyRecords: visibleRecords,
      hasHistoryRecords: visibleRecords.length > 0,
      recentRecordTitle: firstRecord ? firstRecord.title : '还没有偏好记录',
      recentRecordSummary: firstRecord ? firstRecord.summary : '在结果页选择「记住这个偏好」后，我会把你的偏好帮你记下来。',
      recentRecordTime: firstRecord ? firstRecord.time : '等待体验',
      recentRecordNames: firstRecord ? firstRecord.title : '暂无'
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

  openFavoritesPanel() {
    this.refreshFavoriteShops();
    this.setData({ showFavoritesPanel: true });
  },

  closeFavoritesPanel() {
    this.setData({ showFavoritesPanel: false });
  },

  refreshFavoriteShops() {
    try {
      const all = wx.getStorageSync('yelema_favorite_shops') || [];
      const recent = all.slice(0, 5);
      this.setData({ favoriteShops: recent, hasFavoriteShops: recent.length > 0 });
    } catch (e) {
      this.setData({ favoriteShops: [], hasFavoriteShops: false });
    }
  },

  noop() {}
});

function formatRecordTitle(record) {
  return (record && record.mealPurpose) ? record.mealPurpose : '用餐偏好';
}

// The card title already shows the meal scene (早餐 / 午餐 / 晚餐 / …), so the
// summary should not repeat it. Drop any leading " · "-separated segment that
// exactly matches the scene (or the displayed title), keeping every other
// segment. Guarded so a summary that is ONLY the scene is left intact rather
// than rendered empty.
function stripMealSceneFromSummary(summary, mealPurpose, title) {
  const text = String(summary || '').trim();
  if (!text) {
    return text;
  }
  const scene = String(mealPurpose || title || '').trim();
  if (!scene) {
    return text;
  }
  const parts = text.split(' · ');
  while (parts.length > 1 && parts[0].trim() === scene) {
    parts.shift();
  }
  return parts.join(' · ');
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
