const userMemoryAdapter = require('../../services/userMemoryAdapter');

const themeOptions = [
  { key: 'warm', name: '温暖橙' },
  { key: 'blue', name: '清爽蓝' },
  { key: 'pink', name: '樱花粉' },
  { key: 'dark', name: '夜间黑' }
];

function getSavedTheme() {
  const savedTheme = wx.getStorageSync('pageTheme');
  return themeOptions.some(function (theme) {
    return theme.key === savedTheme;
  }) ? savedTheme : 'warm';
}

Page({
  data: {
    currentTheme: 'warm'
  },

  onLoad() {
    this.syncTheme();
    this.ensureLoggedIn();
  },

  onShow() {
    this.syncTheme();
    this.ensureLoggedIn();
  },

  syncTheme() {
    this.setData({
      currentTheme: getSavedTheme()
    });
  },

  ensureLoggedIn() {
    if (!wx.getStorageSync('isLoggedIn')) {
      wx.reLaunch({
        url: '/pages/login/login'
      });
    }
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

  showThemePicker() {
    const self = this;

    wx.showActionSheet({
      itemList: themeOptions.map(function (theme) {
        return theme.name;
      }),
      success: function (res) {
        const theme = themeOptions[res.tapIndex] || themeOptions[0];
        wx.setStorageSync('pageTheme', theme.key);
        self.setData({ currentTheme: theme.key });
        wx.showToast({
          title: '已切换为' + theme.name,
          icon: 'none'
        });
      },
      fail: function () {
        wx.showToast({
          title: '主题面板打开失败',
          icon: 'none'
        });
      }
    });
  },

  showPreferenceRecord() {
    const records = userMemoryAdapter.getPreferenceRecords();

    if (!records.length) {
      wx.showToast({
        title: '还没有偏好记录，完成一次推荐后我会帮你记下来',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '偏好记录',
      content: this.formatPreferenceRecords(records),
      showCancel: false,
      confirmText: '知道了'
    });
  },

  formatPreferenceRecords(records) {
    const visibleRecords = records.slice(0, 5);
    const lines = visibleRecords.map(function (record, index) {
      const recommendationNames = (record.recommendations || []).length
        ? record.recommendations.map(function (item) {
          return item.name;
        }).join('、')
        : '暂无';

      return [
        (index + 1) + '. ' + formatRecordTime(record.createdAt),
        truncateText(record.summaryText || '一次吃饭偏好', 42),
        '推荐：' + truncateText(recommendationNames, 46)
      ].join('\n');
    });

    if (records.length > 5) {
      lines.push('仅展示最近 5 条记录');
    }

    return lines.join('\n\n');
  },

  formatMemoryContent(memory) {
    const recentNames = memory.recentRecommendations.length
      ? memory.recentRecommendations.map(function (item) {
        return item.name;
      }).join('、')
      : '暂无';
    const preferences = memory.preferences || {};

    return [
      '场景：' + (memory.lastSlots.mealPurpose || '暂无'),
      '偏好：' + (memory.lastSlots.branchPreference || '暂无'),
      '口味：' + ((preferences.tasteTags || []).join('、') || '暂无'),
      '感觉：' + ((preferences.needTags || []).join('、') || '暂无'),
      '忌口：' + ((preferences.avoidTags || []).join('、') || '暂无'),
      '辣度：' + (preferences.spicyLevel || '暂无'),
      '预算：' + (memory.commonBudget || '暂无'),
      '距离：' + (memory.commonDistance || '暂无'),
      '最近推荐：' + recentNames
    ].join('\n');
  },

  showComingSoon() {
    wx.showToast({
      title: '该功能正在完善中',
      icon: 'none'
    });
  }
});

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

function truncateText(text, maxLength) {
  const safeText = String(text || '');

  if (safeText.length <= maxLength) {
    return safeText;
  }

  return safeText.slice(0, maxLength - 1) + '…';
}
