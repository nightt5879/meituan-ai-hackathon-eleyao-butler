const themeAdapter = require('../../../services/themeAdapter');
const groupDiningAdapter = require('../../../services/groupDiningAdapter');
const userMemoryAdapter = require('../../../services/userMemoryAdapter');

// Chip catalogues — single source of truth for both UI and submission.
const DAY_CHIPS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日', '随时'];
const HOUR_CHIPS = [
  '10:00','11:00','12:00','13:00','14:00','15:00','16:00',
  '17:00','18:00','19:00','20:00','21:00','22:00','23:00'
];
const DIETARY_CHIPS = ['不吃辣', '不吃香菜', '不吃葱蒜', '不吃海鲜', '不吃牛羊肉', '素食', '过敏', '无忌口'];
const CUISINE_CHIPS = ['粤菜', '川湘', '火锅', '烧烤', '日料', '韩餐', '面食', '茶餐厅', '轻食', '奶茶/甜品', '都可以'];
const BUDGET_CHIPS = ['30 以内', '30-50', '50-80', '80-120', '都可以'];
const SPICY_CHIPS = [
  { label: '不吃辣',   value: 'no_spicy' },
  { label: '微辣',     value: 'mild' },
  { label: '中辣',     value: 'medium' },
  { label: '能吃辣',   value: 'spicy' },
  { label: '都可以',   value: 'any' }
];
const VISIBILITY_CHIPS = [
  { label: '公开 · 大家都能看', value: 'public' },
  { label: '只显示昵称',         value: 'nickname_only' },
  { label: '匿名 · 只用于推荐',   value: 'private' }
];
const PROMPT_CHIPS = [
  '想去近一点', '不想排太久', '适合聊天', '想吃点暖和的',
  '预算 50 以下', '想试试新店', '清淡不油腻'
];

// Maps butler-memory avoid tags → fill-page dietary chips when possible.
const AVOID_TO_DIETARY = {
  '香菜': '不吃香菜',
  '葱蒜': '不吃葱蒜',
  '海鲜': '不吃海鲜',
  '牛羊肉': '不吃牛羊肉',
  '花生': '过敏',
  '乳制品': '过敏'
};

// Maps butler-memory spicy level (Chinese) → spicy enum.
const SPICY_LEVEL_TO_ENUM = {
  '不吃辣': 'no_spicy',
  '微辣': 'mild',
  '中辣': 'medium',
  '重辣': 'spicy',
  '看当天心情': 'any'
};

Page({
  data: {
    currentTheme: 'warm',
    taskId: '',
    inviteToken: '',
    taskSummary: null,
    isLoadingTask: false,
    isSubmitting: false,
    errorMessage: '',

    // Form state (camelCase — adapter handles snake_case conversion)
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
      // Free-text additions for needs the chips don't cover.
      customHardRequirement: '',
      customSoftPreference: ''
    },

    // Rendered chip view-models with active flags
    dayChips: [], hourChips: [], dietaryChips: [], cuisineChips: [],
    budgetChips: [], spicyChips: [], visibilityChips: [],
    promptChips: PROMPT_CHIPS,

    // Live preview of what will be sent as hardRequirements / softPreferences.
    previewHardRequirements: [],
    previewSoftPreferences: []
  },

  onLoad(query) {
    this.syncTheme();
    const taskId = (query && query.taskId) || '';
    const inviteToken = (query && query.inviteToken) || '';
    this.setData({ taskId: taskId, inviteToken: inviteToken });
    this.rebuildAllChips();
    if (taskId) {
      this.loadTaskSummary();
    } else {
      this.setData({
        errorMessage: '链接缺少 taskId。请向发起人重新索取分享链接。'
      });
    }
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

  // ─── Task summary ─────────────────────────────────────────────────────

  loadTaskSummary() {
    const taskId = this.data.taskId;
    if (!taskId || this.data.isLoadingTask) { return; }
    this.setData({ isLoadingTask: true, errorMessage: '' });
    const self = this;
    groupDiningAdapter.getTaskBoard(taskId, this.data.inviteToken).then(function (board) {
      self.setData({
        isLoadingTask: false,
        taskSummary: {
          title: (board.task && board.task.title) || '一次多人约饭',
          creatorName: (board.task && board.task.creatorName) || '',
          rawRequest: (board.task && board.task.rawRequest) || '',
          locationText: (board.task && board.task.locationText) || '',
          dinnerTime: (board.task && board.task.dinnerTime) || '',
          expectedPeopleCount: (board.task && board.task.expectedPeopleCount) || 0,
          submittedCount: board.submittedCount || 0
        }
      });
    }).catch(function (err) {
      console.error('getTaskBoard failed in fill', err);
      self.setData({
        isLoadingTask: false,
        errorMessage: '加载任务失败：' + ((err && (err.errMsg || err.message)) || 'unknown')
      });
    });
  },

  // ─── Chip rebuild helpers ─────────────────────────────────────────────

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

  // Live preview — keeps hardRequirements / softPreferences visible to the
  // user before submission so they can sanity-check what gets sent.
  rebuildPreview() {
    const form = this.data.form;
    this.setData({
      previewHardRequirements: buildHardRequirements(form),
      previewSoftPreferences: buildSoftPreferences(form)
    });
  },

  // ─── Form input handlers ──────────────────────────────────────────────

  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form);
    form[field] = event.detail.value;
    this.setData({ form });
    // customHardRequirement / customSoftPreference / rawPreference all affect
    // the live preview, so rebuild it on every keystroke.
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

  handlePromptChipTap(event) {
    const text = event.currentTarget.dataset.value || '';
    if (!text) { return; }
    const form = Object.assign({}, this.data.form);
    const current = (form.rawPreference || '').trim();
    if (current.indexOf(text) >= 0) {
      this.setData({ form });
      return;
    }
    form.rawPreference = current ? current + '，' + text : text;
    this.setData({ form });
    this.rebuildPreview();
  },

  // ─── Butler memory autofill ───────────────────────────────────────────

  handleAutofillFromMemory() {
    const stable = (userMemoryAdapter.getStableFoodPreferences && userMemoryAdapter.getStableFoodPreferences()) || {};
    const profile = (userMemoryAdapter.getEffectivePreferenceProfile && userMemoryAdapter.getEffectivePreferenceProfile({ useMock: false })) || null;

    const avoidTags = (stable.avoidTags || []);
    const spicyLevel = stable.spicyLevel || '';
    const memoryEnabled = stable.memoryEnabled !== false;
    const profileBudget = profile && profile.budget;
    const profileTaste = profile && profile.taste;

    if (!avoidTags.length && !spicyLevel && !profileBudget && !profileTaste) {
      wx.showToast({ title: '管家记忆里还没有偏好', icon: 'none' });
      return;
    }

    const form = Object.assign({}, this.data.form);

    // Dietary chips — map known avoid tags; the rest go to NL preference.
    const mapped = [];
    const unmapped = [];
    avoidTags.forEach(function (tag) {
      const chip = AVOID_TO_DIETARY[tag];
      if (chip) { mapped.push(chip); }
      else if (tag) { unmapped.push(tag); }
    });
    if (mapped.length) {
      form.dietaryRestrictions = uniqueList(form.dietaryRestrictions.concat(mapped));
      form.dietaryRestrictions = form.dietaryRestrictions.filter(function (t) { return t !== '无忌口'; });
    }
    if (unmapped.length) {
      const note = '不吃' + unmapped.join('、');
      const current = (form.rawPreference || '').trim();
      if (current.indexOf(note) < 0) {
        form.rawPreference = current ? current + '；' + note : note;
      }
    }

    // Spicy chip.
    if (spicyLevel && SPICY_LEVEL_TO_ENUM[spicyLevel]) {
      form.spicyPreference = SPICY_LEVEL_TO_ENUM[spicyLevel];
    }

    // Budget chip — approximate from profile.budget string.
    if (profileBudget && !form.budgetTag) {
      const guess = guessBudgetTag(profileBudget);
      if (guess) { form.budgetTag = guess; }
    }

    // Taste hints → append to NL preference.
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

  // ─── Submit ───────────────────────────────────────────────────────────

  handleSubmitPreference() {
    if (this.data.isSubmitting) { return; }
    const taskId = this.data.taskId;
    if (!taskId) {
      wx.showToast({ title: '缺少 taskId，请使用分享链接进入', icon: 'none' });
      return;
    }

    const form = this.data.form;
    if (!form.nickname || !form.nickname.trim()) {
      wx.showToast({ title: '先填一下昵称', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交偏好…', mask: true });

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
      // Explicit priority lists (the same shape preview renders) so the
      // backend doesn't have to re-derive them from chip selections.
      hardRequirements: buildHardRequirements(form),
      softPreferences: buildSoftPreferences(form)
    };

    const self = this;
    groupDiningAdapter.submitPreference(taskId, this.data.inviteToken, payload).then(function () {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      wx.showToast({ title: '已提交', icon: 'success' });
      wx.navigateTo({
        url: '/pages/group/board/board' +
             '?taskId=' + encodeURIComponent(taskId) +
             '&inviteToken=' + encodeURIComponent(self.data.inviteToken || '')
      });
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isSubmitting: false });
      console.error('submitPreference failed', err);
      wx.showToast({
        title: '提交失败：' + ((err && (err.errMsg || err.message)) || 'unknown'),
        icon: 'none'
      });
    });
  }
});

// ─── Module-level helpers ────────────────────────────────────────────────

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

// Toggle value in a list. Has-toggle-on-exclusive behaviour: tapping a tag
// removes the supplied `exclusive` value (e.g. selecting "周三" clears "随时";
// selecting "随时" clears everything else and keeps only "随时").
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
  return arr.filter(function (item) { return item !== exclusive; }).concat([value]);
}

function toggleValue(list, value) {
  const arr = (list || []).slice();
  const index = arr.indexOf(value);
  if (index >= 0) { arr.splice(index, 1); return arr; }
  arr.push(value);
  return arr;
}

function uniqueList(list) {
  const seen = {};
  const out = [];
  (list || []).forEach(function (item) {
    if (!item || seen[item]) { return; }
    seen[item] = true;
    out.push(item);
  });
  return out;
}

function guessBudgetTag(budgetText) {
  const text = String(budgetText || '');
  if (!text) { return ''; }
  if (/30\s*元?以内/.test(text)) { return '30 以内'; }
  if (/30\s*-\s*60/.test(text)) { return '30-50'; }
  if (/30\s*-\s*50/.test(text)) { return '30-50'; }
  if (/50\s*-\s*80/.test(text)) { return '50-80'; }
  if (/60\s*-\s*100/.test(text)) { return '80-120'; }
  if (/80\s*-\s*120/.test(text)) { return '80-120'; }
  if (/100\s*元?以上|不限/.test(text)) { return '都可以'; }
  return '';
}

// Derive the explicit "must satisfy" list from the form. Same logic the
// submit payload uses, also fed into the preview chips.
function buildHardRequirements(form) {
  const out = [];

  if (form.spicyPreference === 'no_spicy') { out.push('不吃辣'); }
  (form.dietaryRestrictions || []).forEach(function (tag) {
    if (tag && tag !== '无忌口') { out.push(tag); }
  });

  if (form.budgetTag && form.budgetTag !== '都可以') {
    out.push('预算 ' + form.budgetTag);
  }

  const days = form.availableDays || [];
  if (days.length && days.indexOf('随时') < 0) {
    out.push('可参与 · ' + days.join('/'));
  }
  const hours = form.availableHours || [];
  if (hours.length) {
    const display = hours.slice(0, 3).join('/') + (hours.length > 3 ? '…' : '');
    out.push('时段 · ' + display);
  }
  const timeText = (form.availableTimeText || '').trim();
  if (timeText) { out.push(timeText); }

  splitCustomText(form.customHardRequirement).forEach(function (t) { out.push(t); });

  return uniqueList(out);
}

// Derive the "nice to have" list from cuisine chips, the prompt-chip vocab
// detected in the NL preference textarea, and any free-text additions.
function buildSoftPreferences(form) {
  const out = [];

  (form.cuisinePreferences || []).forEach(function (c) {
    if (c && c !== '都可以') { out.push('想吃 ' + c); }
  });

  const text = String(form.rawPreference || '');
  PROMPT_CHIPS.forEach(function (chip) {
    if (text.indexOf(chip) >= 0) { out.push(chip); }
  });

  splitCustomText(form.customSoftPreference).forEach(function (t) { out.push(t); });

  return uniqueList(out);
}

function splitCustomText(text) {
  return String(text || '')
    .split(/[,，;；\n\s]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}
