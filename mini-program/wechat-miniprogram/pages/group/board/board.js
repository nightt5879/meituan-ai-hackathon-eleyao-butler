const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');
const navMetrics = require('../../../utils/navMetrics');

const STATUS_LABELS = {
  waiting_preferences: '收集中',
  ready_to_recommend: '可推荐',
  recommending: '生成中',
  done: '已完成',
  failed: '失败'
};
const POLL_INTERVAL_MS = 3000;

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    statusBarHeight: 0,
    navBarHeight: 44,
    navRightPadding: 16,
    navTitleSidePadding: 48,
    customNavTotalHeight: 44,
    taskId: 'group_mock_task',
    inviteToken: 'group_mock_token',
    board: null,
    isLoading: false,
    isRecommending: false,
    hasInitialized: false,
    statusLabel: '待加载',
    errorMessage: '',
    steps: [
      { key: 'participants', title: '成员偏好', desc: 'submitPreference 写入后展示真实昵称与抽取约束' },
      { key: 'conflicts', title: '冲突识别', desc: 'adapter 会基于成员偏好生成 conflicts' },
      { key: 'recommendation', title: '候选方案', desc: '点「生成推荐」会调用 generateRecommendation' }
    ],
    adjustmentTargetCandidate: null,
    adjustmentNickname: '',
    adjustmentVisibility: 'public',
    adjustmentReasonType: '',
    adjustmentNote: '',
    isSubmittingAdjustment: false,
    adjustmentReasons: [
      { value: 'cannot_eat', label: '吃不了' },
      { value: 'over_budget', label: '超预算' },
      { value: 'time_mismatch', label: '时间不合' },
      { value: 'too_far', label: '太远' },
      { value: 'prefer_other_cuisine', label: '想换品类' },
      { value: 'other', label: '其他' }
    ],
    adjustmentVisibilityOptions: [
      { value: 'public', label: '公开' },
      { value: 'nickname_only', label: '只显示昵称' },
      { value: 'private', label: '匿名' }
    ]
  },

  onLoad(options) {
    const taskId = options && options.taskId ? options.taskId : 'group_mock_task';
    const inviteToken = options && options.inviteToken ? options.inviteToken : 'group_mock_token';

    this.initNavMetrics();
    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      // Only strict 'real' mode forces a blocking login. In auto/mock mode keep
      // the board usable so the local fallback board still renders when the
      // backend (and therefore login) is unavailable. Auto mode also kicks off a
      // best-effort background login so the real backend is used once reachable.
      const mode = groupDiningAdapter.getCurrentMode();
      if (mode === 'real') {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken));
        return;
      }
      if (mode === 'auto') {
        const app = getApp();
        if (app && app.ensureLogin) {
          app.ensureLogin().catch(function () {});
        }
      }
    }

    this.setData({
      taskId,
      inviteToken
    });
    this.loadBoard({ initial: true });
  },

  onShow() {
    this.syncTheme();
    if (this.data.taskId) {
      if (this.data.hasInitialized) {
        this.loadBoard({ silent: true }).catch(function () {});
      } else if (!this.data.isLoading) {
        this.loadBoard({ initial: true }).catch(function () {});
      }
      this.startPolling();
    }
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  onPullDownRefresh() {
    if (!this.data.taskId) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadBoard().then(function () {
      wx.stopPullDownRefresh();
    }).catch(function () {
      wx.stopPullDownRefresh();
    });
  },

  syncTheme() {
    const app = getApp();

    if (app && app.syncThemeToPage) {
      app.syncThemeToPage(this);
      return;
    }

    this.setData(themeAdapter.getPageThemeData());
  },

  loadBoard(options) {
    const opts = options || {};
    const page = this;
    const taskId = this.data.taskId;
    if (!taskId) {
      return Promise.resolve();
    }
    if (this.data.isLoading && !opts.silent) {
      return Promise.resolve();
    }

    if (!opts.silent) {
      this.setData({ isLoading: true, errorMessage: '' });
      wx.showLoading({ title: '加载中' });
    }

    return groupDiningAdapter.getTaskBoard(taskId, this.data.inviteToken).then(function (board) {
      if (!opts.silent) {
        wx.hideLoading();
      }
      page.setData({
        board,
        statusLabel: statusLabel(boardStatus(board)),
        isLoading: false,
        hasInitialized: true,
        errorMessage: ''
      });
      if (!opts.silent) {
        if (board.status === groupDiningAdapter.MOCK_STATUS) {
          wx.showToast({ title: '当前为体验模式，数据为模拟数据', icon: 'none' });
        } else if (board.status !== groupDiningAdapter.REAL_STATUS) {
          wx.showToast({ title: '网络暂不可用，已切换为体验数据', icon: 'none' });
        }
      }
      return board;
    }).catch(function (error) {
      if (!opts.silent) {
        wx.hideLoading();
      }
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken));
        return Promise.reject(error);
      }
      if (!opts.silent) {
        const fallbackBoard = groupDiningAdapter.getFallbackTaskBoard
          ? groupDiningAdapter.getFallbackTaskBoard(page.data.taskId, page.data.inviteToken, error)
          : null;
        page.setData({
          board: fallbackBoard,
          statusLabel: statusLabel(boardStatus(fallbackBoard)),
          isLoading: false,
          hasInitialized: true,
          errorMessage: fallbackBoard ? '' : '加载失败：' + ((error && (error.errMsg || error.message)) || 'unknown')
        });
      }
      return Promise.reject(error);
    });
  },

  handleGenerateRecommendation() {
    if (!this.data.taskId || this.data.isRecommending) {
      return;
    }
    this.stopPolling();
    this.setData({ isRecommending: true });
    wx.showLoading({ title: '生成推荐…', mask: true });

    const page = this;
    groupDiningAdapter.generateRecommendation(this.data.taskId, this.data.inviteToken).then(function (board) {
      wx.hideLoading();
      if (board.status === groupDiningAdapter.MOCK_STATUS) {
        wx.showToast({
          title: '当前为体验模式，数据为模拟数据',
          icon: 'none'
        });
      } else if (board.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '网络暂不可用，已切换为体验数据',
          icon: 'none'
        });
      }
      page.setData({
        board,
        statusLabel: statusLabel(boardStatus(board)),
        isRecommending: false
      });
      page.startPolling();
    }).catch(function (error) {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken));
        return;
      }
      wx.showToast({
        title: '推荐失败',
        icon: 'none'
      });
      page.setData({
        isRecommending: false,
        errorMessage: '生成推荐失败：' + ((error && (error.errMsg || error.message)) || 'unknown')
      });
      page.startPolling();
    });
  },

  handleRefresh() {
    this.loadBoard();
  },

  handleCopyGroupMessage() {
    const board = this.data.board;
    const message = board && board.recommendationResult && board.recommendationResult.groupMessage;
    if (!message) {
      wx.showToast({ title: '还没有群消息', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: message,
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'none' });
      }
    });
  },

  startPolling() {
    if (this._pollTimer || !this.data.taskId) {
      return;
    }
    const page = this;
    this._pollTimer = setInterval(function () {
      if (page.data.isLoading || page.data.isRecommending || page.data.isSubmittingAdjustment) {
        return;
      }
      page.loadBoard({ silent: true }).catch(function () {});
    }, POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  handleOpenAdjustmentPanel(event) {
    const id = event.currentTarget.dataset.candidateId || '';
    const name = event.currentTarget.dataset.candidateName || '';
    if (!id) {
      return;
    }
    this.setData({
      adjustmentTargetCandidate: { id, name },
      adjustmentReasonType: '',
      adjustmentNote: ''
    });
  },

  handleCloseAdjustmentPanel() {
    this.setData({
      adjustmentTargetCandidate: null,
      adjustmentReasonType: '',
      adjustmentNote: ''
    });
  },

  handleSelectAdjustmentReason(event) {
    this.setData({ adjustmentReasonType: event.currentTarget.dataset.value || '' });
  },

  handleSelectAdjustmentVisibility(event) {
    this.setData({ adjustmentVisibility: event.currentTarget.dataset.value || 'public' });
  },

  handleAdjustmentNicknameInput(event) {
    this.setData({ adjustmentNickname: event.detail.value });
  },

  handleAdjustmentNoteInput(event) {
    this.setData({ adjustmentNote: event.detail.value });
  },

  handleSubmitAdjustmentRequest() {
    if (this.data.isSubmittingAdjustment) {
      return;
    }
    const target = this.data.adjustmentTargetCandidate;
    if (!target) {
      return;
    }
    if (!this.data.adjustmentReasonType) {
      wx.showToast({ title: '请选择不满意原因', icon: 'none' });
      return;
    }
    const nickname = (this.data.adjustmentNickname || '').trim();
    if (this.data.adjustmentVisibility !== 'private' && !nickname) {
      wx.showToast({ title: '请填写昵称，或选「匿名」', icon: 'none' });
      return;
    }

    const page = this;
    this.setData({ isSubmittingAdjustment: true });
    wx.showLoading({ title: '提交反馈…', mask: true });

    groupDiningAdapter.submitAdjustmentRequest(this.data.taskId, this.data.inviteToken, {
      nickname,
      visibility: this.data.adjustmentVisibility,
      candidateId: target.id,
      candidateName: target.name,
      reasonType: this.data.adjustmentReasonType,
      note: this.data.adjustmentNote
    }).then(function (board) {
      wx.hideLoading();
      page.setData({
        board,
        statusLabel: statusLabel(boardStatus(board)),
        isSubmittingAdjustment: false,
        adjustmentTargetCandidate: null,
        adjustmentReasonType: '',
        adjustmentNote: ''
      });
      wx.showToast({ title: '已提交反馈', icon: 'success' });
    }).catch(function (error) {
      wx.hideLoading();
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/board/board?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken));
        return;
      }
      page.setData({ isSubmittingAdjustment: false });
      wx.showToast({
        title: '提交失败：' + ((error && (error.errMsg || error.message)) || 'unknown'),
        icon: 'none'
      });
    });
  },

  handleBackHome() {
    wx.reLaunch({
      url: '/pages/home/home'
    });
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

  initNavMetrics() {
    this.setData(navMetrics.getCustomNavMetrics());
  }
});

function statusLabel(status) {
  if (!status) {
    return '待加载';
  }
  return STATUS_LABELS[status] || status;
}

function boardStatus(board) {
  if (!board) {
    return '';
  }
  if (board.recommendationState && board.recommendationState.status) {
    return board.recommendationState.status;
  }
  if (board.task && board.task.status) {
    return board.task.status;
  }
  return '';
}
