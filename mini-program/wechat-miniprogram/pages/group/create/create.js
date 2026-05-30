const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');
const navMetrics = require('../../../utils/navMetrics');

const PEOPLE_PRESETS = ['2', '3', '4', '5', '6', '8', '10'];

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    statusBarHeight: 0,
    navBarHeight: 44,
    navRightPadding: 16,
    navTitleSidePadding: 48,
    customNavTotalHeight: 44,
    menuButtonTop: 0,
    menuButtonHeight: 32,
    isSubmitting: false,
    peopleOptions: [],
    selectedPeople: '5',
    customPeopleInput: '',
    createdTask: null
  },

  onLoad() {
    this.initNavMetrics();
    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      // Only strict 'real' mode forces a blocking login. In auto/mock mode keep
      // the page usable so the local fallback flow still works when the backend
      // (and therefore login) is unavailable. Auto mode also kicks off a
      // best-effort background login so the real backend is used once reachable.
      const mode = groupDiningAdapter.getCurrentMode();
      if (mode === 'real') {
        userIdentityAdapter.requireLoginRedirect('/pages/group/create/create');
        return;
      }
      if (mode === 'auto') {
        const app = getApp();
        if (app && app.ensureLogin) {
          app.ensureLogin().catch(function () {});
        }
      }
    }
    this.refreshPeopleOptions('5');
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

  initNavMetrics() {
    this.setData(navMetrics.getCustomNavMetrics());
  },

  handleBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];

    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }

    wx.redirectTo({
      url: '/pages/home/home',
      fail: function () {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    });
  },

  refreshPeopleOptions(selected) {
    this.setData({
      peopleOptions: PEOPLE_PRESETS.map(function (value) {
        return { value: value, active: value === selected };
      })
    });
  },

  handleSelectPeople(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) {
      return;
    }
    this.setData({
      selectedPeople: value,
      customPeopleInput: ''
    });
    this.refreshPeopleOptions(value);
  },

  handleCustomPeopleInput(event) {
    const raw = event.detail.value || '';
    const custom = raw.trim();
    this.setData({
      customPeopleInput: raw,
      selectedPeople: custom || this.data.selectedPeople
    });
    this.refreshPeopleOptions('');
  },

  resolvePeopleCount() {
    const custom = (this.data.customPeopleInput || '').trim();
    return custom || this.data.selectedPeople;
  },

  handleCreateTask() {
    if (this.data.isSubmitting) {
      return;
    }

    const peopleCount = this.resolvePeopleCount();
    const peopleNumber = parseInt(peopleCount, 10);
    if (!peopleNumber || peopleNumber < 2) {
      wx.showToast({ title: '请选择或填写至少 2 人', icon: 'none' });
      return;
    }
    if (peopleNumber > 30) {
      wx.showToast({ title: '人数最多 30 人', icon: 'none' });
      return;
    }

    const page = this;
    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '生成任务…', mask: true });

    groupDiningAdapter.createTask({
      peopleCount: peopleNumber
    }).then(function (result) {
      wx.hideLoading();
      const board = result.board || {};
      const task = board.task || result.task || {
        title: '多人约饭偏好收集中',
        displayTitle: '多人约饭偏好收集中',
        displaySummary: '发起人邀请你填写约饭偏好',
        expectedPeopleCount: peopleNumber
      };
      const expectedPeopleCount = resolvePositiveCount([
        task.expectedPeopleCount,
        board.expectedCount,
        result.expectedPeopleCount,
        peopleNumber
      ]);
      if (result.status === groupDiningAdapter.MOCK_STATUS) {
        wx.showToast({
          title: '当前为体验模式，数据为模拟数据',
          icon: 'none'
        });
      } else if (result.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '网络暂不可用，已切换为体验数据',
          icon: 'none'
        });
      }
      page.setData({
        isSubmitting: false,
        createdTask: {
          taskId: result.taskId,
          inviteToken: result.inviteToken || '',
          fillPath: result.nextUrl || result.sharePath || ('/pages/group/fill/fill?taskId=' + encodeURIComponent(result.taskId || '') + '&inviteToken=' + encodeURIComponent(result.inviteToken || '')),
          sharePath: result.sharePath || result.nextUrl || '',
          boardUrl: result.boardUrl || ('/pages/group/board/board?taskId=' + encodeURIComponent(result.taskId || '') + '&inviteToken=' + encodeURIComponent(result.inviteToken || '')),
          task: task,
          expectedPeopleCount: expectedPeopleCount,
          submittedCount: board.submittedCount || 0
        }
      });
      wx.showToast({ title: '任务已生成', icon: 'success' });
    }).catch(function (error) {
      wx.hideLoading();
      page.setData({ isSubmitting: false });
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/create/create');
        return;
      }
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      });
    });
  },

  handleFillPreference() {
    const created = this.data.createdTask;
    if (!created) {
      return;
    }
    wx.navigateTo({
      url: created.fillPath || created.sharePath || ('/pages/group/fill/fill?taskId=' + encodeURIComponent(created.taskId || '') + '&inviteToken=' + encodeURIComponent(created.inviteToken || ''))
    });
  },

  handleViewBoard() {
    const created = this.data.createdTask;
    if (!created) {
      return;
    }
    wx.navigateTo({
      url: created.boardUrl || ('/pages/group/board/board?taskId=' + encodeURIComponent(created.taskId || '') + '&inviteToken=' + encodeURIComponent(created.inviteToken || ''))
    });
  },

  handleCreateAnother() {
    this.setData({ createdTask: null });
    this.refreshPeopleOptions(this.data.selectedPeople || '5');
  },

  onShareAppMessage() {
    const created = this.data.createdTask;
    if (!created) {
      return { title: '一起约个饭吧', path: '/pages/group/create/create' };
    }
    return {
      title: '邀请你填写约饭偏好',
      path: created.sharePath || '/pages/group/create/create'
    };
  }
});

function resolvePositiveCount(values) {
  for (let i = 0; i < values.length; i += 1) {
    const match = String(values[i] || '').match(/\d+/);
    const count = match ? Number(match[0]) : 0;
    if (count > 0) {
      return count;
    }
  }
  return 0;
}
