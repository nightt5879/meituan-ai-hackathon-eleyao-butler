const themeAdapter = require('../../services/themeAdapter');
const weekendPlannerAdapter = require('../../services/weekendPlannerAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');

const DATE_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TIME_MODE_OPTIONS = [
  { value: 'range', label: '指定时段' },
  { value: 'allDay', label: '全天有空' }
];
const MOOD_OPTIONS = ['想轻松一点', '想拍照出片', '想换个地方', '想安静放空'];
const ENERGY_OPTIONS = ['低体力', '中等体力', '想多走走'];
const COMPANION_OPTIONS = ['自己', '朋友', '情侣', '家人'];
const INTEREST_OPTIONS = [
  { value: '咖啡', emoji: '☕', label: '咖啡' },
  { value: '轻食', emoji: '🥗', label: '轻食' },
  { value: '甜品', emoji: '🍰', label: '甜品' },
  { value: 'citywalk', emoji: '🚶', label: 'citywalk' },
  { value: '拍照', emoji: '📷', label: '拍照' },
  { value: '展览', emoji: '🎨', label: '展览' },
  { value: '公园', emoji: '🌳', label: '公园' },
  { value: '书店', emoji: '📚', label: '书店' },
  { value: '电影', emoji: '🎬', label: '电影' },
  { value: '市集', emoji: '🛍️', label: '市集' },
  { value: '博物馆', emoji: '🏛️', label: '博物馆' },
  { value: '美术馆', emoji: '🖼️', label: '美术馆' },
  { value: '夜景', emoji: '🌃', label: '夜景' },
  { value: '江边散步', emoji: '🌊', label: '江边散步' },
  { value: '安静聊天', emoji: '💬', label: '安静聊天' },
  { value: '购物', emoji: '🛒', label: '购物' },
  { value: '室内活动', emoji: '🏠', label: '室内活动' },
  { value: '户外活动', emoji: '🌞', label: '户外活动' },
  { value: '适合打卡', emoji: '✨', label: '适合打卡' },
  { value: '少走路', emoji: '🦶', label: '少走路' },
  { value: '不想排队', emoji: '🚫', label: '不想排队' },
  { value: '雨天友好', emoji: '🌧️', label: '雨天友好' },
  { value: '宠物友好', emoji: '🐶', label: '宠物友好' },
  { value: '适合放空', emoji: '🌿', label: '适合放空' }
];

const DEFAULT_FORM = {
  dateLabel: '周六',
  timeMode: 'range',
  startTime: '14:00',
  endTime: '17:00',
  isAllDay: false,
  timeWindow: '周六 14:00-17:00',
  budgetMax: '120',
  startArea: '学校周边',
  mood: '想轻松一点',
  energyLevel: '低体力',
  companions: '朋友',
  interests: ['咖啡', 'citywalk', '轻食'],
  rawText: ''
};

Page({
  data: {
    currentTheme: 'warm',
    form: DEFAULT_FORM,
    dateOptions: [],
    timeModeOptions: [],
    moodOptions: [],
    energyOptions: [],
    companionOptions: [],
    interestOptions: [],
    isSubmitting: false,
    plan: null,
    hasPlan: false,
    showEmptyState: true,
    hasError: false,
    errorMessage: '',
    hasBackendNotice: false,
    backendNotice: ''
  },

  onLoad() {
    this.syncTheme();
    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/weekend/weekend');
      return;
    }
    this.refreshFormState(DEFAULT_FORM);
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
  },

  refreshFormState(form, extra) {
    const nextForm = normalizeForm(form);
    const nextData = Object.assign({
      form: nextForm,
      dateOptions: DATE_OPTIONS,
      timeModeOptions: TIME_MODE_OPTIONS,
      moodOptions: buildChoiceOptions(MOOD_OPTIONS, nextForm.mood),
      energyOptions: buildChoiceOptions(ENERGY_OPTIONS, nextForm.energyLevel),
      companionOptions: buildChoiceOptions(COMPANION_OPTIONS, nextForm.companions),
      interestOptions: buildInterestOptions(nextForm.interests)
    }, extra || {});
    this.setData(nextData);
  },

  updateForm(patch, extra) {
    const nextForm = Object.assign({}, this.data.form, patch || {});
    this.refreshFormState(nextForm, extra);
  },

  updateFormField(field, value, extra) {
    if (!field) { return; }

    const patch = {};
    patch[field] = value || '';
    this.updateForm(patch, Object.assign({
      hasError: false,
      errorMessage: ''
    }, extra || {}));
  },

  handleBack() {
    wx.navigateBack({
      fail: function () {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    });
  },

  handleSelectOption(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    if (!field || !value) { return; }

    const patch = {};
    patch[field] = value;
    this.updateForm(patch, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleDateTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) { return; }

    this.updateForm({ dateLabel: value }, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleTimeModeTap(event) {
    const mode = event.currentTarget.dataset.value;
    if (mode !== 'range' && mode !== 'allDay') { return; }

    this.updateForm({
      timeMode: mode,
      isAllDay: mode === 'allDay'
    }, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) { return; }

    this.updateFormField(field, event.detail.value || '');
  },

  handleStartTimeChange(event) {
    this.updateForm({
      startTime: event.detail.value || '',
      timeMode: 'range',
      isAllDay: false
    }, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleEndTimeChange(event) {
    this.updateForm({
      endTime: event.detail.value || '',
      timeMode: 'range',
      isAllDay: false
    }, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleToggleInterest(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) { return; }

    const interests = (this.data.form.interests || []).slice();
    const index = interests.indexOf(value);
    if (index >= 0) {
      interests.splice(index, 1);
    } else {
      interests.push(value);
    }

    this.updateForm({ interests: interests }, {
      hasError: false,
      errorMessage: ''
    });
  },

  handleCreatePlan() {
    if (this.data.isSubmitting) { return; }

    const validation = this.buildPayload();
    if (!validation.ok) {
      this.showInlineError(validation.message);
      wx.showToast({ title: validation.message, icon: 'none' });
      return;
    }

    const self = this;
    this.setData({
      isSubmitting: true,
      hasError: false,
      errorMessage: '',
      hasBackendNotice: false,
      backendNotice: ''
    });
    wx.showLoading({ title: '生成路线中', mask: true });

    weekendPlannerAdapter.createPlan(validation.payload).then(function (createdPlan) {
      if (!createdPlan || !createdPlan.planId || createdPlan.backendUnavailable) {
        return createdPlan;
      }
      return weekendPlannerAdapter.getPlan(createdPlan.planId).catch(function (err) {
        if (isAuthRequiredError(err)) {
          throw err;
        }
        console.warn('[weekend] getPlan readback failed', err);
        return Object.assign({}, createdPlan, {
          readbackError: true,
          backendMessage: '规划已生成，但回查暂时失败，先展示创建结果。'
        });
      });
    }).then(function (plan) {
      wx.hideLoading();
      self.applyPlan(plan);
      wx.showToast({ title: '规划已生成', icon: 'success' });
    }).catch(function (err) {
      wx.hideLoading();
      const message = normalizeErrorMessage(err);
      self.setData({
        isSubmitting: false,
        hasError: true,
        errorMessage: message,
        showEmptyState: false
      });
      console.error('[weekend] createPlan failed', err);
      wx.showToast({ title: message, icon: 'none' });
    });
  },

  buildPayload() {
    const form = this.data.form || {};
    const dateLabel = trim(form.dateLabel);
    const startTime = trim(form.startTime);
    const endTime = trim(form.endTime);
    const timeMode = form.timeMode === 'allDay' ? 'allDay' : 'range';
    const isAllDay = timeMode === 'allDay';
    const timeWindow = buildTimeWindowText(Object.assign({}, form, {
      dateLabel: dateLabel,
      timeMode: timeMode,
      startTime: startTime,
      endTime: endTime
    }));
    const budgetMax = parseIntLoose(form.budgetMax);
    const startArea = trim(form.startArea);
    const interests = (form.interests || []).slice();

    const payload = {
      timeWindow: timeWindow,
      dateLabel: dateLabel,
      timeMode: timeMode,
      startTime: startTime,
      endTime: endTime,
      isAllDay: isAllDay,
      budgetMax: budgetMax,
      startArea: startArea,
      mood: trim(form.mood),
      energyLevel: trim(form.energyLevel),
      companions: trim(form.companions),
      interests: interests,
      rawText: trim(form.rawText)
    };

    return validatePayload(payload);
  },

  showInlineError(message) {
    this.setData({
      hasError: true,
      errorMessage: message,
      showEmptyState: false
    });
  },

  applyPlan(plan) {
    const safePlan = plan || null;
    const backendNotice = buildBackendNotice(safePlan);
    this.setData({
      isSubmitting: false,
      plan: safePlan,
      hasPlan: !!safePlan,
      showEmptyState: !safePlan,
      hasError: !safePlan,
      errorMessage: safePlan ? '' : '暂时没有生成规划，请重试。',
      hasBackendNotice: !!backendNotice,
      backendNotice: backendNotice
    });
  },

  handleCopyInvite(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    const routes = this.data.plan && this.data.plan.routes;
    const route = routes && routes[index];
    if (!route || !route.inviteText) { return; }

    wx.setClipboardData({
      data: route.inviteText,
      success: function () {
        wx.showToast({ title: '邀约文案已复制', icon: 'none' });
      }
    });
  },

  handleClearResult() {
    this.setData({
      plan: null,
      hasPlan: false,
      showEmptyState: true,
      hasError: false,
      errorMessage: '',
      hasBackendNotice: false,
      backendNotice: ''
    });
  }
});

function buildChoiceOptions(options, selected) {
  return options.map(function (value) {
    return {
      value: value,
      active: value === selected
    };
  });
}

function normalizeForm(form) {
  const safe = Object.assign({}, DEFAULT_FORM, form || {});
  const timeMode = safe.timeMode === 'allDay' ? 'allDay' : 'range';
  const nextForm = Object.assign({}, safe, {
    timeMode: timeMode,
    isAllDay: timeMode === 'allDay',
    interests: (safe.interests || []).slice()
  });
  nextForm.timeWindow = buildTimeWindowText(nextForm);
  return nextForm;
}

function buildInterestOptions(selected) {
  const map = {};
  (selected || []).forEach(function (item) {
    map[item] = true;
  });
  return INTEREST_OPTIONS.map(function (option) {
    return {
      value: option.value,
      emoji: option.emoji,
      label: option.label,
      active: !!map[option.value]
    };
  });
}

function buildBackendNotice(plan) {
  if (!plan) { return ''; }
  if (plan.backendUnavailable) {
    return plan.backendMessage || '后端暂不可用，当前展示本地保守方案。';
  }
  if (plan.backendMessage) {
    return plan.backendMessage;
  }
  if (plan.weather && plan.weather.fallback) {
    return plan.weatherNotice || '天气暂不可用，已按保守方案生成。';
  }
  return '';
}

function normalizeErrorMessage(err) {
  if (isAuthRequiredError(err)) {
    return '请先完成微信登录后再生成周边轻规划';
  }
  const raw = (err && (err.errMsg || err.message)) || '';
  if (!raw) { return '生成失败，请稍后重试'; }
  if (raw.indexOf('AUTH_REQUIRED') >= 0) { return '请先完成微信登录后再生成周边轻规划'; }
  if (raw.indexOf('timeout') >= 0) { return '请求超时，请稍后重试'; }
  if (raw.indexOf('network') >= 0) { return '网络不可用，请稍后重试'; }
  return '生成失败：' + raw;
}

function validatePayload(payload) {
  if (!payload.timeWindow) {
    return { ok: false, message: '请选择出行时间' };
  }
  if (!payload.dateLabel) {
    return { ok: false, message: '请选择周几出行' };
  }
  if (payload.timeMode !== 'allDay') {
    if (!payload.startTime) {
      return { ok: false, message: '请选择开始时间' };
    }
    if (!payload.endTime) {
      return { ok: false, message: '请选择结束时间' };
    }
    if (payload.startTime >= payload.endTime) {
      return { ok: false, message: '结束时间要晚于开始时间' };
    }
  }
  if (!payload.budgetMax || payload.budgetMax <= 0) {
    return { ok: false, message: '请填写有效预算' };
  }
  if (payload.budgetMax > 2000) {
    return { ok: false, message: '预算先控制在 2000 内' };
  }
  if (!payload.startArea) {
    return { ok: false, message: '请填写出发起点' };
  }

  return {
    ok: true,
    payload: payload
  };
}

function buildTimeWindowText(form) {
  const safe = form || {};
  const dateLabel = trim(safe.dateLabel);
  const timeMode = safe.timeMode === 'allDay' ? 'allDay' : 'range';
  if (timeMode === 'allDay') {
    return dateLabel ? dateLabel + ' 全天' : '全天';
  }
  const startTime = trim(safe.startTime);
  const endTime = trim(safe.endTime);
  const timeRange = startTime && endTime ? startTime + '-' + endTime : '';
  return [dateLabel, timeRange].filter(function (item) {
    return !!item;
  }).join(' ');
}

function isAuthRequiredError(err) {
  return !!err && (err.authRequired || err.code === 'AUTH_REQUIRED');
}

function parseIntLoose(value) {
  if (typeof value === 'number' && isFinite(value)) { return Math.max(0, Math.floor(value)); }
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) { return parseInt(match[0], 10); }
  }
  return 0;
}

function trim(value) {
  if (typeof value === 'string') { return value.trim(); }
  if (value == null) { return ''; }
  return String(value).trim();
}
