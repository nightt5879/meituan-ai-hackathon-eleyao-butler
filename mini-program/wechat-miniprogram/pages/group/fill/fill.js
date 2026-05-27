const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');
const userMemoryAdapter = require('../../../services/userMemoryAdapter');
const navMetrics = require('../../../utils/navMetrics');

const DAY_CHIPS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TIME_MODE_OPTIONS = [
  { value: 'specified', label: '指定时段' },
  { value: 'allDay', label: '全天有空' }
];
const DIETARY_CHIPS = ['不吃辣', '不吃香菜', '不吃葱蒜', '不吃海鲜', '不吃牛羊肉', '素食', '无忌口'];
const CUISINE_CHIPS = ['粤菜', '川湘', '火锅', '烧烤', '日料', '韩餐', '面食', '茶餐厅', '轻食', '奶茶/甜品', '都可以'];
const BUDGET_CHIPS = ['30 以内', '30-50', '50-80', '80-120', '都可以'];
const SPICY_CHIPS = [
  { label: '不吃辣', value: 'no_spicy' },
  { label: '微辣', value: 'mild' },
  { label: '中辣', value: 'medium' },
  { label: '能吃辣', value: 'spicy' },
  { label: '都可以', value: 'any' }
];
const VISIBILITY_CHIPS = [
  { label: '公开 · 大家都能看', value: 'public' },
  { label: '只显示昵称', value: 'nickname_only' },
  { label: '匿名 · 只用于推荐', value: 'private' }
];
const PROMPT_CHIPS = [
  '想去近一点', '不想排太久', '适合聊天', '想吃点暖和的',
  '预算 50 以下', '想试试新店', '清淡不油腻'
];
const PRIORITY_OPTIONS = [
  { label: '必须满足', value: 'must' },
  { label: '希望满足', value: 'nice' }
];
const DEFAULT_REQUIREMENT_PRIORITY = {
  days: 'must',
  hours: 'must',
  timeText: 'must',
  dietary: 'must',
  cuisine: 'nice',
  budget: 'nice',
  spicy: 'nice',
  preference: 'nice'
};
const AVOID_TO_DIETARY = {
  '香菜': '不吃香菜',
  '葱蒜': '不吃葱蒜',
  '海鲜': '不吃海鲜',
  '牛羊肉': '不吃牛羊肉'
};
const SPICY_LEVEL_TO_ENUM = {
  '不吃辣': 'no_spicy',
  '微辣': 'mild',
  '中辣': 'medium',
  '重辣': 'spicy',
  '看当天心情': 'any'
};

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
    taskSummary: null,
    isLoadingTask: false,
    isSubmitting: false,
    errorMessage: '',
    form: {
      nickname: '',
      visibility: 'public',
      availableDays: [],
      availableHours: [],
      timeMode: 'specified',
      startTime: '14:00',
      endTime: '17:00',
      timeCustomText: '',
      dietaryRestrictions: [],
      cuisinePreferences: [],
      budgetTag: '',
      spicyPreference: '',
      rawPreference: '',
      restrictionCustomText: '',
      cuisineCustomText: '',
      budgetCustomText: '',
      spiceCustomText: '',
      extraCustomText: '',
      requirementPriority: Object.assign({}, DEFAULT_REQUIREMENT_PRIORITY),
      customHardRequirement: '',
      customSoftPreference: ''
    },
    dayChips: [],
    timeModeOptions: TIME_MODE_OPTIONS,
    dietaryChips: [],
    cuisineChips: [],
    budgetChips: [],
    spicyChips: [],
    visibilityChips: [],
    promptChips: PROMPT_CHIPS,
    priorityOptions: PRIORITY_OPTIONS,
    previewHardRequirements: [],
    previewSoftPreferences: []
  },

  onLoad(query) {
    this.initNavMetrics();
    this.syncTheme();
    const taskId = query && query.taskId ? query.taskId : 'group_mock_task';
    const inviteToken = query && query.inviteToken ? query.inviteToken : 'group_mock_token';

    if (!userIdentityAdapter.hasSession()) {
      userIdentityAdapter.requireLoginRedirect('/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) + '&inviteToken=' + encodeURIComponent(inviteToken));
      return;
    }

    this.setData({
      taskId,
      inviteToken
    });
    this.rebuildAllChips();
    this.loadTaskSummary();
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
  },

  loadTaskSummary() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isLoadingTask) {
      return;
    }
    const page = this;
    this.setData({ isLoadingTask: true, errorMessage: '' });
    groupDiningAdapter.getTaskBoard(taskId, this.data.inviteToken).then(function (board) {
      const task = board.task || {};
      const expectedPeopleCount = resolvePositiveCount([
        task.expectedPeopleCount,
        board.expectedCount
      ]);
      page.setData({
        isLoadingTask: false,
        taskSummary: {
          title: task.displayTitle || '多人约饭偏好收集中',
          summary: task.displaySummary || '发起人邀请你填写约饭偏好',
          creatorName: task.creatorName || '',
          rawRequest: task.rawRequest || '',
          locationText: task.locationText || '',
          dinnerTime: task.dinnerTime || '',
          expectedPeopleCount: expectedPeopleCount,
          submittedCount: board.submittedCount || 0
        }
      });
    }).catch(function (error) {
      if (error && error.statusCode === 401) {
        userIdentityAdapter.requireLoginRedirect('/pages/group/fill/fill?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken));
        return;
      }
      page.setData({
        isLoadingTask: false,
        errorMessage: '加载任务失败：' + ((error && (error.errMsg || error.message)) || 'unknown')
      });
    });
  },

  rebuildAllChips() {
    const form = this.data.form;
    this.setData({
      dayChips: DAY_CHIPS.map(buildToggleChip(form.availableDays)),
      timeModeOptions: TIME_MODE_OPTIONS,
      dietaryChips: DIETARY_CHIPS.map(buildToggleChip(form.dietaryRestrictions)),
      cuisineChips: CUISINE_CHIPS.map(buildToggleChip(form.cuisinePreferences)),
      budgetChips: BUDGET_CHIPS.map(buildSingleChip(form.budgetTag)),
      spicyChips: SPICY_CHIPS.map(buildSingleChipWithValue(form.spicyPreference)),
      visibilityChips: VISIBILITY_CHIPS.map(buildSingleChipWithValue(form.visibility))
    });
    this.rebuildPreview();
  },

  rebuildPreview() {
    const form = this.data.form;
    this.setData({
      previewHardRequirements: buildHardRequirements(form),
      previewSoftPreferences: buildSoftPreferences(form)
    });
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form);
    form[field] = event.detail.value;
    this.setData({ form });
    this.rebuildPreview();
  },

  handleToggleDay(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) {
      return;
    }
    const form = Object.assign({}, this.data.form);
    form.availableDays = toggleValue(form.availableDays, value).filter(function (day) {
      return day !== '随时';
    });
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleTimeModeTap(event) {
    const value = event.currentTarget.dataset.value;
    if (value !== 'specified' && value !== 'allDay') {
      return;
    }
    const form = Object.assign({}, this.data.form);
    form.timeMode = value;
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleStartTimeChange(event) {
    const form = Object.assign({}, this.data.form);
    form.startTime = event.detail.value || '14:00';
    form.timeMode = 'specified';
    this.setData({ form });
    this.rebuildPreview();
  },

  handleEndTimeChange(event) {
    const form = Object.assign({}, this.data.form);
    form.endTime = event.detail.value || '17:00';
    form.timeMode = 'specified';
    this.setData({ form });
    this.rebuildPreview();
  },

  handleToggleDietary(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form);
    form.dietaryRestrictions = toggleWithExclusive(form.dietaryRestrictions, value, '无忌口');
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleToggleCuisine(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form);
    form.cuisinePreferences = toggleWithExclusive(form.cuisinePreferences, value, '都可以');
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleSelectBudget(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form);
    form.budgetTag = form.budgetTag === value ? '' : value;
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleSelectSpicy(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form);
    form.spicyPreference = form.spicyPreference === value ? '' : value;
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleSelectVisibility(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form, { visibility: value });
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleSelectPriority(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value === 'must' ? 'must' : 'nice';
    if (!field) {
      return;
    }
    const form = Object.assign({}, this.data.form);
    form.requirementPriority = Object.assign({}, DEFAULT_REQUIREMENT_PRIORITY, form.requirementPriority || {});
    form.requirementPriority[field] = value;
    this.setData({ form });
    this.rebuildPreview();
  },

  handlePromptChipTap(event) {
    const text = event.currentTarget.dataset.value || '';
    if (!text) {
      return;
    }
    const form = Object.assign({}, this.data.form);
    const current = (form.customSoftPreference || '').trim();
    if (current.indexOf(text) < 0) {
      form.customSoftPreference = current ? current + '，' + text : text;
    }
    this.setData({ form });
    this.rebuildPreview();
  },

  handleAutofillFromMemory() {
    const stable = userMemoryAdapter.getStableFoodPreferences ? userMemoryAdapter.getStableFoodPreferences() : {};
    const profile = userMemoryAdapter.getEffectivePreferenceProfile
      ? userMemoryAdapter.getEffectivePreferenceProfile({ useMock: false })
      : null;
    const avoidTags = stable.avoidTags || [];
    const spicyLevel = stable.spicyLevel || '';
    const memoryEnabled = stable.memoryEnabled !== false;
    const profileBudget = profile && profile.budget;
    const profileTaste = profile && profile.taste;

    if (!avoidTags.length && !spicyLevel && !profileBudget && !profileTaste) {
      wx.showToast({ title: '管家记忆里还没有偏好', icon: 'none' });
      return;
    }

    const form = Object.assign({}, this.data.form);
    const mapped = [];
    const unmapped = [];
    avoidTags.forEach(function (tag) {
      const chip = AVOID_TO_DIETARY[tag];
      if (chip) {
        mapped.push(chip);
      } else if (tag) {
        unmapped.push(tag);
      }
    });

    if (mapped.length) {
      form.dietaryRestrictions = uniqueList(form.dietaryRestrictions.concat(mapped)).filter(function (tag) {
        return tag !== '无忌口';
      });
    }
    if (unmapped.length) {
      const note = '不吃' + unmapped.join('、');
      const current = (form.restrictionCustomText || '').trim();
      if (current.indexOf(note) < 0) {
        form.restrictionCustomText = current ? current + '；' + note : note;
      }
    }
    if (spicyLevel && SPICY_LEVEL_TO_ENUM[spicyLevel]) {
      form.spicyPreference = SPICY_LEVEL_TO_ENUM[spicyLevel];
    }
    if (profileBudget && !form.budgetTag) {
      const guess = guessBudgetTag(profileBudget);
      if (guess) {
        form.budgetTag = guess;
      }
    }
    if (profileTaste) {
      const current = (form.rawPreference || '').trim();
      const hint = '偏好：' + profileTaste;
      if (current.indexOf(profileTaste) < 0) {
        form.rawPreference = current ? current + '；' + hint : hint;
      }
    }

    this.setData({ form });
    this.rebuildAllChips();
    wx.showToast({
      title: memoryEnabled ? '已套用管家记忆' : '记忆已暂停，仅本次填入',
      icon: 'none'
    });
  },

  handleSubmitPreference() {
    if (this.data.isSubmitting) {
      return;
    }
    if (!this.data.taskId) {
      wx.showToast({ title: '缺少 taskId，请使用分享链接进入', icon: 'none' });
      return;
    }
    const form = this.data.form;
    if (!form.nickname || !form.nickname.trim()) {
      wx.showToast({ title: '先填一下昵称', icon: 'none' });
      return;
    }
    if (form.timeMode !== 'allDay' && !isValidTimeRange(form.startTime, form.endTime)) {
      wx.showToast({ title: '结束时间要晚于开始时间', icon: 'none' });
      return;
    }

    const page = this;
    const payload = {
      nickname: form.nickname,
      visibility: form.visibility || 'public',
      rawPreference: form.rawPreference,
      availability: {
        availableDays: form.availableDays,
        availableHours: form.availableHours,
        timeMode: form.timeMode,
        startTime: form.startTime,
        endTime: form.endTime,
        availableTimeText: form.timeCustomText,
        timeCustomText: form.timeCustomText
      },
      timeMode: form.timeMode,
      startTime: form.startTime,
      endTime: form.endTime,
      timeCustomText: form.timeCustomText,
      restrictionCustomText: form.restrictionCustomText,
      cuisineCustomText: form.cuisineCustomText,
      budgetCustomText: form.budgetCustomText,
      spiceCustomText: form.spiceCustomText,
      extraCustomText: form.extraCustomText,
      customTexts: {
        time: form.timeCustomText,
        restriction: form.restrictionCustomText,
        cuisine: form.cuisineCustomText,
        budget: form.budgetCustomText,
        spice: form.spiceCustomText,
        extra: form.extraCustomText
      },
      dietaryRestrictions: form.dietaryRestrictions,
      cuisinePreferences: form.cuisinePreferences,
      budgetTag: form.budgetTag,
      spicyPreference: form.spicyPreference,
      hardRequirements: buildHardRequirements(form),
      softPreferences: buildSoftPreferences(form),
      requirementPriorities: Object.assign({}, form.requirementPriority || {})
    };

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交偏好…', mask: true });
    groupDiningAdapter.submitPreference(this.data.taskId, this.data.inviteToken, payload).then(function (result) {
      wx.hideLoading();
      page.setData({ isSubmitting: false });
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
      wx.navigateTo({
        url: result.nextUrl || ('/pages/group/board/board?taskId=' + encodeURIComponent(page.data.taskId) + '&inviteToken=' + encodeURIComponent(page.data.inviteToken || ''))
      });
    }).catch(function (error) {
      wx.hideLoading();
      page.setData({ isSubmitting: false });
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

function buildToggleChip(selectedList) {
  const selected = selectedList || [];
  return function (value) {
    return { value: value, active: selected.indexOf(value) >= 0, wide: isWideChoice(value) };
  };
}

function buildSingleChip(selectedValue) {
  return function (value) {
    return { value: value, active: selectedValue === value, wide: isWideChoice(value) };
  };
}

function buildSingleChipWithValue(selectedValue) {
  return function (option) {
    return { label: option.label, value: option.value, active: selectedValue === option.value, wide: isWideChoice(option.label) || option.value === 'any' };
  };
}

function isWideChoice(value) {
  return value === '都可以' || value === '无忌口';
}

function toggleWithExclusive(list, value, exclusive) {
  const arr = (list || []).slice();
  if (value === exclusive) {
    return arr.indexOf(exclusive) >= 0 ? [] : [exclusive];
  }
  const index = arr.indexOf(value);
  if (index >= 0) {
    arr.splice(index, 1);
    return arr;
  }
  return arr.filter(function (item) {
    return item !== exclusive;
  }).concat([value]);
}

function toggleValue(list, value) {
  const arr = (list || []).slice();
  const index = arr.indexOf(value);
  if (index >= 0) {
    arr.splice(index, 1);
    return arr;
  }
  arr.push(value);
  return arr;
}

function uniqueList(list) {
  const seen = {};
  const out = [];
  (list || []).forEach(function (item) {
    if (!item || seen[item]) {
      return;
    }
    seen[item] = true;
    out.push(item);
  });
  return out;
}

function guessBudgetTag(budgetText) {
  const text = String(budgetText || '');
  if (/30\s*元?以内/.test(text)) {
    return '30 以内';
  }
  if (/30\s*-\s*60/.test(text) || /30\s*-\s*50/.test(text)) {
    return '30-50';
  }
  if (/50\s*-\s*80/.test(text)) {
    return '50-80';
  }
  if (/60\s*-\s*100/.test(text) || /80\s*-\s*120/.test(text)) {
    return '80-120';
  }
  if (/100\s*元?以上|不限/.test(text)) {
    return '都可以';
  }
  return '';
}

function buildHardRequirements(form) {
  return buildRequirementBuckets(form).hard;
}

function buildSoftPreferences(form) {
  return buildRequirementBuckets(form).soft;
}

function buildRequirementBuckets(form) {
  const buckets = { hard: [], soft: [] };
  const timeSummary = buildTimeSummary(form);
  const timeCustomText = (form.timeCustomText || '').trim();

  if (timeSummary) {
    addByPriority(buckets, priorityOf(form, 'hours'), '可参与 · ' + timeSummary);
  }
  if (timeCustomText) {
    addByPriority(buckets, priorityOf(form, 'timeText'), '时间补充：' + compactRequirementText(timeCustomText));
  }
  (form.dietaryRestrictions || []).forEach(function (tag) {
    if (tag && tag !== '无忌口') {
      addByPriority(buckets, priorityOf(form, 'dietary'), tag);
    }
  });
  addModuleCustomText(buckets, form, 'dietary', '忌口补充', form.restrictionCustomText);
  (form.cuisinePreferences || []).forEach(function (cuisine) {
    if (cuisine && cuisine !== '都可以') {
      addByPriority(buckets, priorityOf(form, 'cuisine'), '想吃 ' + cuisine);
    }
  });
  addModuleCustomText(buckets, form, 'cuisine', '品类补充', form.cuisineCustomText);
  if (form.budgetTag && form.budgetTag !== '都可以') {
    addByPriority(buckets, priorityOf(form, 'budget'), '预算 ' + form.budgetTag);
  }
  addModuleCustomText(buckets, form, 'budget', '预算补充', form.budgetCustomText);
  const spicyText = spicyRequirementText(form.spicyPreference);
  if (spicyText) {
    addByPriority(buckets, priorityOf(form, 'spicy'), spicyText);
  }
  addModuleCustomText(buckets, form, 'spicy', '辣度补充', form.spiceCustomText);

  const matchedPrompts = [];
  const text = String(form.rawPreference || '');
  PROMPT_CHIPS.forEach(function (chip) {
    if (text.indexOf(chip) >= 0) {
      matchedPrompts.push(chip);
      addByPriority(buckets, priorityOf(form, 'preference'), chip);
    }
  });
  const freeText = stripPromptChips(text, matchedPrompts).trim();
  if (freeText) {
    addByPriority(buckets, priorityOf(form, 'preference'), '补充：' + compactRequirementText(freeText));
  }
  addModuleCustomText(buckets, form, 'preference', '其他补充', form.extraCustomText);

  splitCustomText(form.customHardRequirement).forEach(function (item) {
    buckets.hard.push(item);
  });
  splitCustomText(form.customSoftPreference).forEach(function (item) {
    buckets.soft.push(item);
  });

  return {
    hard: uniqueList(buckets.hard),
    soft: uniqueList(buckets.soft)
  };
}

function buildTimeSummary(form) {
  const days = form.availableDays || [];
  const dayText = days.length ? days.join('、') : '';
  const mode = form.timeMode === 'allDay' ? 'allDay' : 'specified';
  const rangeText = mode === 'allDay'
    ? '全天有空'
    : ((form.startTime || '14:00') + '-' + (form.endTime || '17:00'));

  if (dayText && rangeText) {
    return dayText + ' ' + rangeText;
  }
  return dayText || rangeText;
}

function addModuleCustomText(buckets, form, priorityKey, label, value) {
  const text = String(value || '').trim();
  if (!text) {
    return;
  }
  addByPriority(buckets, priorityOf(form, priorityKey), label + '：' + compactRequirementText(text));
}

function addByPriority(buckets, priority, text) {
  if (!text) {
    return;
  }
  if (priority === 'must') {
    buckets.hard.push(text);
  } else {
    buckets.soft.push(text);
  }
}

function priorityOf(form, key) {
  const priority = (form.requirementPriority && form.requirementPriority[key]) || DEFAULT_REQUIREMENT_PRIORITY[key] || 'nice';
  return priority === 'must' ? 'must' : 'nice';
}

function spicyRequirementText(value) {
  if (!value || value === 'any') {
    return '';
  }
  for (let i = 0; i < SPICY_CHIPS.length; i++) {
    if (SPICY_CHIPS[i].value === value) {
      return value === 'no_spicy' ? '不吃辣' : '辣度 ' + SPICY_CHIPS[i].label;
    }
  }
  return '';
}

function compactRequirementText(text) {
  const safe = String(text || '').replace(/\s+/g, ' ').trim();
  return safe.length > 28 ? safe.slice(0, 28) + '…' : safe;
}

function stripPromptChips(text, chips) {
  let safe = String(text || '');
  (chips || []).forEach(function (chip) {
    if (!chip) {
      return;
    }
    safe = safe.split(chip).join('');
  });
  return safe.replace(/[，,；;、\s]+/g, ' ').trim();
}

function splitCustomText(text) {
  return String(text || '')
    .split(/[,，;；\n\s]+/)
    .map(function (item) {
      return item.trim();
    })
    .filter(function (item) {
      return item.length > 0;
    });
}

function isValidTimeRange(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start >= 0 && end > start;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return -1;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

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
