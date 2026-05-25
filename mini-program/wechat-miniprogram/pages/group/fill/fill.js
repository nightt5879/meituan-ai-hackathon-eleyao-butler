const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userIdentityAdapter = require('../../../services/userIdentityAdapter');
const userMemoryAdapter = require('../../../services/userMemoryAdapter');

const DAY_CHIPS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日', '随时'];
const HOUR_CHIPS = [
  '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];
const DIETARY_CHIPS = ['不吃辣', '不吃香菜', '不吃葱蒜', '不吃海鲜', '不吃牛羊肉', '素食', '过敏', '无忌口'];
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
  '牛羊肉': '不吃牛羊肉',
  '花生': '过敏',
  '乳制品': '过敏'
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
      availableTimeText: '',
      dietaryRestrictions: [],
      cuisinePreferences: [],
      budgetTag: '',
      spicyPreference: '',
      rawPreference: '',
      requirementPriority: Object.assign({}, DEFAULT_REQUIREMENT_PRIORITY),
      customHardRequirement: '',
      customSoftPreference: ''
    },
    dayChips: [],
    hourChips: [],
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
    wx.navigateBack();
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
      page.setData({
        isLoadingTask: false,
        taskSummary: {
          title: task.title || '一次多人约饭',
          creatorName: task.creatorName || '',
          rawRequest: task.rawRequest || '',
          locationText: task.locationText || '',
          dinnerTime: task.dinnerTime || '',
          expectedPeopleCount: task.expectedPeopleCount || board.expectedCount || 0,
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
      hourChips: HOUR_CHIPS.map(buildToggleChip(form.availableHours)),
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
    const form = Object.assign({}, this.data.form);
    form.availableDays = toggleWithExclusive(form.availableDays, value, '随时');
    this.setData({ form });
    this.rebuildAllChips();
  },

  handleToggleHour(event) {
    const value = event.currentTarget.dataset.value;
    const form = Object.assign({}, this.data.form);
    form.availableHours = toggleValue(form.availableHours, value);
    this.setData({ form });
    this.rebuildAllChips();
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
    const current = (form.rawPreference || '').trim();
    if (current.indexOf(text) < 0) {
      form.rawPreference = current ? current + '，' + text : text;
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
      const current = (form.rawPreference || '').trim();
      if (current.indexOf(note) < 0) {
        form.rawPreference = current ? current + '；' + note : note;
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

    const page = this;
    const payload = {
      nickname: form.nickname,
      visibility: form.visibility || 'public',
      rawPreference: form.rawPreference,
      availability: {
        availableDays: form.availableDays,
        availableHours: form.availableHours,
        availableTimeText: form.availableTimeText
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
      if (result.status !== groupDiningAdapter.REAL_STATUS) {
        wx.showToast({
          title: '后端暂不可用',
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
    return { value: value, active: selected.indexOf(value) >= 0 };
  };
}

function buildSingleChip(selectedValue) {
  return function (value) {
    return { value: value, active: selectedValue === value };
  };
}

function buildSingleChipWithValue(selectedValue) {
  return function (option) {
    return { label: option.label, value: option.value, active: selectedValue === option.value };
  };
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
  const days = form.availableDays || [];
  const hours = form.availableHours || [];
  const timeText = (form.availableTimeText || '').trim();

  if (days.length && days.indexOf('随时') < 0) {
    addByPriority(buckets, priorityOf(form, 'days'), '可参与 · ' + days.join('/'));
  }
  if (hours.length) {
    const display = hours.slice(0, 3).join('/') + (hours.length > 3 ? '…' : '');
    addByPriority(buckets, priorityOf(form, 'hours'), '时段 · ' + display);
  }
  if (timeText) {
    addByPriority(buckets, priorityOf(form, 'timeText'), timeText);
  }
  (form.dietaryRestrictions || []).forEach(function (tag) {
    if (tag && tag !== '无忌口') {
      addByPriority(buckets, priorityOf(form, 'dietary'), tag);
    }
  });
  (form.cuisinePreferences || []).forEach(function (cuisine) {
    if (cuisine && cuisine !== '都可以') {
      addByPriority(buckets, priorityOf(form, 'cuisine'), '想吃 ' + cuisine);
    }
  });
  if (form.budgetTag && form.budgetTag !== '都可以') {
    addByPriority(buckets, priorityOf(form, 'budget'), '预算 ' + form.budgetTag);
  }
  const spicyText = spicyRequirementText(form.spicyPreference);
  if (spicyText) {
    addByPriority(buckets, priorityOf(form, 'spicy'), spicyText);
  }

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
