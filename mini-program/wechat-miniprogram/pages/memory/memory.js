const userMemoryAdapter = require('../../services/userMemoryAdapter');
const themeAdapter = require('../../services/themeAdapter');

// 管家记忆 page — Step 1 scope.
//
// Section 1  我主动告诉管家的     → stableFoodPreferences (avoidTags + spicyLevel)
// Section 2  允许管家记住          → memoryPermissions (instant-save switches)
// Section 3  管家从使用中学到的   → learnedFoodPreferences (placeholder only)
// Section 4  记忆控制              → save / clear / pause
//
// Step 1 does NOT connect any of this to the food recommendation flow.

const AVOID_OPTIONS = ['无', '香菜', '葱蒜', '花生', '海鲜', '牛羊肉', '乳制品', '其他'];
const SPICY_OPTIONS = ['不吃辣', '微辣', '中辣', '重辣', '看当天心情'];
const AVOID_NONE_LABEL = '无';
const AVOID_OTHER_LABEL = '其他';

// Tokens splittable by , ，  / and any whitespace.
const AVOID_SEPARATOR = /[,，/\s]+/;

// Permission rows shown in Section 2. All rows are currently editable and
// save immediately through saveMemoryPermissions().
const PERMISSION_ROWS = [
  { key: 'rememberTastePattern',             title: '口味倾向',           desc: '记录你常选哪类口味/感觉',        disabled: false },
  { key: 'rememberBudgetByMeal',             title: '不同用餐场景的预算', desc: '区分午餐 / 晚餐 / 下午茶等的预算', disabled: false },
  { key: 'rememberCommonCategories',         title: '常吃餐品 / 品类',    desc: '你最常被推中的菜系或品类',         disabled: false },
  { key: 'rememberDeliveryDineInPreference', title: '外卖 or 到店偏好',   desc: '你更常选外卖还是堂食',             disabled: false },
  { key: 'rememberDistancePreference',       title: '常用距离 / 配送接受度', desc: '你愿意走多远或等多久',         disabled: false },
  { key: 'rememberExplorationStyle',         title: '探索新店 or 常吃熟店', desc: '你更爱回头店还是新店',          disabled: false },
  { key: 'rememberAdjustmentPatterns',       title: '调整反馈习惯',       desc: '经常觉得太贵、太远、想换品类',     disabled: false },
  { key: 'rememberDiningReport',             title: '用餐报告与花销估算', desc: '允许管家根据你的推荐记录生成周报/月报，不读取真实支付记录。', disabled: false },
  { key: 'rememberFrequentArea',             title: '常去区域',           desc: '记录你常用的学校周边、商圈或出发区域', disabled: false },
  { key: 'rememberGroupPreference',          title: '群聊偏好',           desc: '记录你授权的小团体共同偏好，用于多人约饭折中', disabled: false }
];

// Static placeholder rows shown in Section 3. Step 1 has no learning.
const LEARNED_PLACEHOLDER_ROWS = [
  { label: '午餐常选', value: '待学习', desc: '完成几次午餐推荐后生成' },
  { label: '晚餐预算', value: '待学习', desc: '完成几次晚餐推荐后生成' },
  { label: '外卖偏好', value: '待学习', desc: '会学习预算、常点品类、配送接受度' },
  { label: '到店偏好', value: '待学习', desc: '会学习距离、环境、是否愿意探索新店' },
  { label: '探索倾向', value: '待学习', desc: '会判断你更爱熟悉店还是新店' }
];

Page({
  data: {
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    avoidOptions: [],
    spicyOptions: [],
    selectedAvoid: [],
    selectedSpicy: '',
    customAvoidInput: '',
    // True while "无" is currently selected — dims the custom input row to
    // signal "you said you have no allergies". Typing into the input will
    // automatically unselect "无" so the user is never blocked.
    isNoneSelected: false,
    memoryEnabled: true,
    updatedAtText: '',

    // Section 2 — permissions
    permissionRows: [],                // computed view-model for the 9 rows
    behaviorLearningEnabled: true,     // master switch

    // Section 3 — placeholder
    learnedRows: LEARNED_PLACEHOLDER_ROWS,
    learnedEmptyCopy: '多用几次后，我会帮你整理出午餐、晚餐、外卖和到店的习惯。你可以随时修改或删除。',

    // Section copy hints
    section1SaveHint: '点「保存记忆」后才会写入。',
    section2SaveHint: '下方开关改动后会立刻生效。',

    privacyCopy: '你可以随时关闭、修改或清空这些记忆。管家不会记录聊天原文、精确位置轨迹或未授权的朋友信息。'
  },

  onLoad() {
    this.syncTheme();
    this.loadStablePreferences();
    this.loadMemoryPermissions();
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

  loadStablePreferences() {
    const prefs = userMemoryAdapter.getStableFoodPreferences();
    const split = splitAvoidForLoad(prefs.avoidTags);
    const selectedAvoid = split.fixedSelections;
    const customAvoidInput = split.customText;
    const selectedSpicy = prefs.spicyLevel || '';
    const isNoneSelected = selectedAvoid.indexOf(AVOID_NONE_LABEL) >= 0;

    this.setData({
      avoidOptions: buildOptionChips(AVOID_OPTIONS, selectedAvoid),
      spicyOptions: buildOptionChips(SPICY_OPTIONS, [selectedSpicy]),
      selectedAvoid,
      selectedSpicy,
      customAvoidInput,
      isNoneSelected,
      memoryEnabled: prefs.memoryEnabled !== false,
      updatedAtText: formatUpdatedAt(prefs.updatedAt)
    });
  },

  handleAvoidTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) { return; }

    let selectedAvoid = (this.data.selectedAvoid || []).slice();
    let customAvoidInput = this.data.customAvoidInput || '';
    const alreadySelected = selectedAvoid.indexOf(value) >= 0;

    if (value === AVOID_NONE_LABEL) {
      // Tapping 无: select it exclusively (or unselect if already on).
      // Selecting also clears the custom input — "no allergies" means no
      // typed allergies either.
      if (alreadySelected) {
        selectedAvoid = [];
      } else {
        selectedAvoid = [AVOID_NONE_LABEL];
        customAvoidInput = '';
      }
    } else if (alreadySelected) {
      selectedAvoid = selectedAvoid.filter(function (tag) { return tag !== value; });
    } else {
      // Selecting any other tag (including 其他) clears 无 and adds this one.
      // 其他 stays selected only as a UI hint pointing to the custom input;
      // it is filtered out at save time.
      selectedAvoid = selectedAvoid
        .filter(function (tag) { return tag !== AVOID_NONE_LABEL; })
        .concat([value]);
    }

    this.setData({
      selectedAvoid,
      customAvoidInput,
      isNoneSelected: selectedAvoid.indexOf(AVOID_NONE_LABEL) >= 0,
      avoidOptions: buildOptionChips(AVOID_OPTIONS, selectedAvoid)
    });
  },

  handleCustomAvoidInput(event) {
    const next = (event && event.detail && event.detail.value) || '';
    let selectedAvoid = (this.data.selectedAvoid || []).slice();

    // Any non-empty typed content auto-unselects 无: typing means the user
    // does have something to avoid, so "无" no longer applies.
    if (next.trim() && selectedAvoid.indexOf(AVOID_NONE_LABEL) >= 0) {
      selectedAvoid = selectedAvoid.filter(function (tag) { return tag !== AVOID_NONE_LABEL; });
      this.setData({
        customAvoidInput: next,
        selectedAvoid,
        isNoneSelected: false,
        avoidOptions: buildOptionChips(AVOID_OPTIONS, selectedAvoid)
      });
      return;
    }

    this.setData({ customAvoidInput: next });
  },

  handleSpicyTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) { return; }

    // Single-select: tapping the active one clears it.
    const selectedSpicy = this.data.selectedSpicy === value ? '' : value;
    this.setData({
      selectedSpicy,
      spicyOptions: buildOptionChips(SPICY_OPTIONS, [selectedSpicy])
    });
  },

  handleSaveMemory() {
    const avoidTags = combineAvoidForSave(this.data.selectedAvoid, this.data.customAvoidInput);
    const next = userMemoryAdapter.saveStableFoodPreferences({
      avoidTags: avoidTags,
      spicyLevel: this.data.selectedSpicy,
      memoryEnabled: this.data.memoryEnabled
    });
    this.setData({ updatedAtText: formatUpdatedAt(next.updatedAt) });
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  handleClearMemory() {
    const self = this;
    wx.showModal({
      title: '清空管家记忆',
      content: '将清空忌口与辣度偏好，操作后无法恢复。是否继续？',
      confirmText: '清空',
      cancelText: '保留',
      success: function (res) {
        if (!res.confirm) { return; }
        const next = userMemoryAdapter.clearStableFoodPreferences();
        self.setData({
          selectedAvoid: [],
          selectedSpicy: '',
          customAvoidInput: '',
          isNoneSelected: false,
          avoidOptions: buildOptionChips(AVOID_OPTIONS, []),
          spicyOptions: buildOptionChips(SPICY_OPTIONS, []),
          memoryEnabled: next.memoryEnabled !== false,
          updatedAtText: formatUpdatedAt(next.updatedAt)
        });
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  },

  handleToggleMemory(event) {
    // bindchange on <switch> passes event.detail.value as boolean.
    const enabled = !!(event && event.detail && event.detail.value);
    const next = enabled
      ? userMemoryAdapter.resumeStableFoodMemory()
      : userMemoryAdapter.pauseStableFoodMemory();
    this.setData({
      memoryEnabled: next.memoryEnabled !== false,
      updatedAtText: formatUpdatedAt(next.updatedAt)
    });
    wx.showToast({
      title: enabled ? '已恢复记忆' : '已暂停记忆',
      icon: 'none'
    });
  },

  // ─── Section 2: 允许管家记住 ──────────────────────────────────────────────

  loadMemoryPermissions() {
    const permissions = userMemoryAdapter.getMemoryPermissions();
    this.setData({
      behaviorLearningEnabled: permissions.behaviorLearningEnabled !== false,
      permissionRows: buildPermissionRows(permissions)
    });
  },

  // Master switch — saves instantly.
  handleMasterPermissionChange(event) {
    const enabled = !!(event && event.detail && event.detail.value);
    const next = userMemoryAdapter.saveMemoryPermissions({ behaviorLearningEnabled: enabled });
    this.setData({
      behaviorLearningEnabled: next.behaviorLearningEnabled !== false,
      permissionRows: buildPermissionRows(next)
    });
  },

  // Per-permission switch — saves instantly.
  handlePermissionRowChange(event) {
    const key = event.currentTarget.dataset.key;
    const isDisabled = !!event.currentTarget.dataset.disabled;
    if (!key || isDisabled) { return; }

    const enabled = !!(event && event.detail && event.detail.value);
    const update = {};
    update[key] = enabled;
    const next = userMemoryAdapter.saveMemoryPermissions(update);
    this.setData({
      behaviorLearningEnabled: next.behaviorLearningEnabled !== false,
      permissionRows: buildPermissionRows(next)
    });
  },

  // ─── Section 4: clear-learned button ──────────────────────────────────────

  handleClearLearnedMemory() {
    const self = this;
    wx.showModal({
      title: '清空行为学习记忆',
      content: '将清空管家从你的使用中学到的偏好。已保存的忌口、辣度和授权设置不受影响。',
      confirmText: '清空',
      cancelText: '保留',
      success: function (res) {
        if (!res.confirm) { return; }
        userMemoryAdapter.clearLearnedFoodPreferences();
        // Step 1 has no real learned data, so the placeholder rows do not
        // need to change. We just toast to acknowledge the action.
        self.setData({ learnedRows: LEARNED_PLACEHOLDER_ROWS });
        wx.showToast({ title: '已清空学习记忆', icon: 'none' });
      }
    });
  }
});

function buildOptionChips(allOptions, selectedValues) {
  const selectedSet = selectedValues || [];
  return allOptions.map(function (value) {
    return {
      value: value,
      isSelected: selectedSet.indexOf(value) >= 0
    };
  });
}

// Build the 9 permission row view-models from the stored permission object.
// Each row carries its current `checked` state, plus the static metadata
// (title, desc, disabled) declared in PERMISSION_ROWS.
function buildPermissionRows(permissions) {
  const safe = permissions || {};
  return PERMISSION_ROWS.map(function (row) {
    return {
      key: row.key,
      title: row.title,
      desc: row.desc,
      disabled: !!row.disabled,
      checked: row.disabled ? false : (safe[row.key] === false ? false : true)
    };
  });
}

// Split avoid-input text by ',  '  '/' or any whitespace. Trims and drops empties.
function parseCustomAvoidTokens(text) {
  return String(text || '')
    .split(AVOID_SEPARATOR)
    .map(function (item) { return item.trim(); })
    .filter(function (item) { return item.length > 0; });
}

// Build the final array to persist into stableFoodPreferences.avoidTags.
// Rules:
//   - If "无" is among the fixed selections → save []
//   - "无" and "其他" are NEVER saved as literal tags ("其他" is a UI hint
//     that points the user to the custom input)
//   - Fixed selections come first, then parsed custom tokens
//   - Duplicates removed, first-seen order preserved
function combineAvoidForSave(selectedFixed, customText) {
  const fixed = (selectedFixed || []).slice();
  if (fixed.indexOf(AVOID_NONE_LABEL) >= 0) {
    return [];
  }
  const filteredFixed = fixed.filter(function (tag) {
    return tag !== AVOID_NONE_LABEL && tag !== AVOID_OTHER_LABEL;
  });
  const customTokens = parseCustomAvoidTokens(customText);
  const combined = filteredFixed.concat(customTokens);
  const seen = {};
  const result = [];
  combined.forEach(function (tag) {
    if (!tag || seen[tag]) { return; }
    seen[tag] = true;
    result.push(tag);
  });
  return result;
}

// Reverse of combineAvoidForSave for page load.
// Saved tags that match a fixed AVOID_OPTIONS label go into selectedAvoid,
// everything else is rejoined (with Chinese comma) into the custom input.
// "无" and "其他" are stripped if they appear in legacy stored data —
// the new save logic should never emit them.
function splitAvoidForLoad(avoidTags) {
  const fixedSelections = [];
  const customParts = [];
  (avoidTags || []).forEach(function (tag) {
    if (!tag) { return; }
    if (tag === AVOID_NONE_LABEL || tag === AVOID_OTHER_LABEL) { return; }
    if (AVOID_OPTIONS.indexOf(tag) >= 0) {
      if (fixedSelections.indexOf(tag) < 0) { fixedSelections.push(tag); }
    } else {
      if (customParts.indexOf(tag) < 0) { customParts.push(tag); }
    }
  });
  return {
    fixedSelections: fixedSelections,
    customText: customParts.join('，')
  };
}

function formatUpdatedAt(iso) {
  if (!iso) { return '尚未保存'; }
  const date = new Date(iso);
  if (isNaN(date.getTime())) { return '尚未保存'; }
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return '上次保存：' + month + '-' + day + ' ' + hour + ':' + minute;
}

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}
