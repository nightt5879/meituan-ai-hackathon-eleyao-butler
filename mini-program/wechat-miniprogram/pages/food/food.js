const foodAiAdapter = require('../../services/foodAiAdapter');
const userMemoryAdapter = require('../../services/userMemoryAdapter');
const tagConfig = require('../../data/tasteTags');
const themeAdapter = require('../../services/themeAdapter');
const userIdentityAdapter = require('../../services/userIdentityAdapter');
const navMetrics = require('../../utils/navMetrics');

const emptySelectedTags = {
  taste: [],
  need: [],
  temporaryAvoid: [],
  avoid: [],
  spicyLevel: []
};

// Adjustment chips — used inside the 调整一下 panel.
// 重新开始 is now a top-level result action, not a chip in this list.
const adjustmentOptions = [
  { label: '太贵了', action: 'budget' },
  { label: '太远了', action: 'distance' },
  { label: '不想吃这个口味', action: 'taste' },
  { label: '想清淡一点', action: 'taste-light' },
  { label: '想重口一点', action: 'taste-heavy' },
  { label: '想换个品类', action: 'category' },
  { label: '忌口没说清', action: 'avoid' }
];

const prefModificationOptions = [
  { label: '想吃', action: 'branch-preference' },
  { label: '口味/感觉', action: 'taste-feeling' },
  { label: '这次不想吃', action: 'temporary-avoid' },
  { label: '忌口', action: 'restriction' },
  { label: '辣度', action: 'spice' },
  { label: '预算', action: 'budget' },
  { label: '距离', action: 'distance' },
  { label: '用餐场景', action: 'meal-purpose' },
  { label: '其他补充', action: 'notes' }
];

const prefModificationOrder = [
  'meal-purpose',
  'branch-preference',
  'taste-feeling',
  'temporary-avoid',
  'restriction',
  'spice',
  'budget',
  'distance',
  'notes'
];

const userNotesQuestion = {
  id: 'user-notes',
  kind: 'choice',
  slot: 'userNotes',
  label: '其他补充',
  title: '还有什么想补充的吗？',
  optional: true,
  allowEmpty: true,
  options: ['没有补充']
};

// Normalize per-capita price for display on shop cards. Tolerates:
//   - numbers (e.g. 48)                         → "人均 48元"
//   - "48"                                      → "人均 48元"
//   - "48元" / "48 元/人" / "48 yuan/person"      → "人均 48元"
//   - "人均 48元" (already formatted)             → "人均 48元" (no double prefix)
//   - undefined / null / "" / non-numeric junk  → "人均待确认"
// Render-time only — never mutates the raw .perCapita value so adapters,
// history persistence, and any future consumer keep the original payload.
function formatAveragePrice(value) {
  if (value === undefined || value === null || value === '') {
    return '人均待确认';
  }
  const raw = String(value).trim();
  if (!raw) {
    return '人均待确认';
  }
  if (raw.indexOf('人均') >= 0 && raw.indexOf('元') >= 0) {
    return raw;
  }
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (match) {
    return '人均 ' + match[0] + '元';
  }
  const cleaned = raw.replace(/yuan\/person|yuan|元\/人|\/person|person/gi, '').trim();
  return cleaned ? '人均 ' + cleaned + '元' : '人均待确认';
}

// Add a derived perCapitaDisplay field to each recommendation so WXML can
// render the normalized "人均 xx元" string directly. The original perCapita
// field is preserved on every item.
function decorateRecommendationsForDisplay(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(function (item) {
    const safe = item || {};
    return Object.assign({}, safe, {
      perCapitaDisplay: formatAveragePrice(safe.perCapita)
    });
  });
}

// Real preference history only. The food "recent preference" pre-check card
// may surface ONLY when a genuine profile exists — long-term memory, stable
// 管家记忆 settings, or authorized behavior records (source 'memory' /
// 'stable' / 'record'). The V0 MOCK_PREFERENCE_PROFILE (source === 'mock')
// must never trigger it, so a cache-cleared / brand-new user is never shown
// fabricated "recent" history.
function hasRealPreferenceProfile(profile) {
  if (!profile || profile.isMock || profile.source === 'mock') {
    return false;
  }
  return userMemoryAdapter.hasUsefulPreferenceProfile(profile);
}

Page({
  data: {
    session: foodAiAdapter.createInitialSession(),
    currentQuestion: null,
    currentOptions: [],
    tagGroups: [],
    isTagQuestion: false,
    showManualInput: true,
    selectedOptions: [],
    selectedTags: emptySelectedTags,
    manualAnswer: '',
    manualInputs: {},
    selectionHistory: [],
    answerHistory: [],
    isFinished: false,
    chatMessages: [],
    showSlotSummaryDetail: false,
    slotSummaryText: '',
    summaryFields: [],
    slotItems: [],
    recommendations: [],
    isRecommendationLoading: false,
    recommendationBatchIndex: 0,
    recommendationNotice: '',
    showAdjustmentOptions: false,
    adjustmentManualInput: '',
    adjustmentMessages: [],
    adjustmentOptions,
    currentTheme: themeAdapter.DEFAULT_THEME_ID,
    statusBarHeight: 0,
    navBarHeight: 44,
    navRightPadding: 16,
    navTitleSidePadding: 48,
    customNavTotalHeight: 44,
    hasSavedCurrentRecord: false,
    memoryDecision: '',
    progressPercent: 0,
    connectionStatus: buildConnectionStatusView({
      state: 'checking',
      text: '检测 OpenClaw 中',
      detail: ''
    }),

    // ─── Preference pre-check state ─────────────────────────────────────
    // prefCheckActive   — true after mealPurpose when a real matching record exists.
    // prefCheckChips    — structured preference chips from that record.
    // pendingPrefill    — non-null after the user opts in; carries autoAnswerIds
    //                     which questions should be auto-filled from the record.
    // autoAnsweredIndexes — answer-array indexes that were auto-filled (hidden
    //                     from the chat thread).
    // chatPreamble      — extra bubbles inserted ahead of session.answers,
    //                     used for the "好，已应用：…" confirmation after
    //                     the user picks a pre-check option.
    prefCheckActive: false,
    prefCheckTitle: '',
    prefCheckSummary: '',
    prefCheckPrompt: '',
    prefCheckChips: [],
    prefCheckDisclaimer: '',
    // Structured label/value rows of the reused preference, shown in both the
    // pre-check card and the "部分修改" panel so the user can see exactly what
    // is being carried over (用餐场景 / 想吃 / 口味 / 忌口 / 辣度 / 预算 / 距离 …).
    prefSummaryRows: [],
    // Number of toggleable rows currently marked 要修改 — drives the
    // enabled/disabled state of the "确定修改这些" button.
    prefModifyCount: 0,
    prefCheckOptions: [
      { label: '全都按这个来', action: 'use-all' },
      { label: '这次不用历史偏好', action: 'skip' },
      { label: '部分修改', action: 'partial' }
    ],
    prefModifyActive: false,
    prefModifyOptions: prefModificationOptions,
    selectedPrefModifyActions: [],
    prefModificationActions: [],
    pendingPrefill: null,
    autoAnsweredIndexes: [],
    chatPreamble: [],
    favoriteShops: []
  },

  onLoad() {
    this.initNavMetrics();
    this.syncTheme();

    if (!userIdentityAdapter.hasSession()) {
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return;
    }

    this.startSession();
    this.refreshConnectionStatus();
  },

  onShow() {
    this.syncTheme();
    this.refreshConnectionStatus();
    const recs = this.data.recommendations;
    if (recs && recs.length) {
      const favorites = loadFavoriteShops();
      this.setData({
        recommendations: recs.map(function (item) {
          return Object.assign({}, item, { isFavorited: isShopFavorited(item, favorites) });
        }),
        favoriteShops: favorites
      });
    }
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

  startSession() {
    const session = foodAiAdapter.createInitialSession();
    this.hasSavedCurrentRecordFlag = false;
    this._activeProfile = null;
    this._pendingProfileAfterMealPurpose = null;
    this._skipPreferenceCheckForScenario = '';
    this._emptyPrefNoticeScenario = '';
    this.setData({
      hasSavedCurrentRecord: false,
      prefCheckActive: false,
      prefCheckTitle: '',
      prefCheckSummary: '',
      prefCheckPrompt: '',
      prefCheckChips: [],
      prefCheckDisclaimer: '',
      prefModifyActive: false,
      prefModifyOptions: this.formatPrefModifyOptions([]),
      selectedPrefModifyActions: [],
      prefModificationActions: [],
      pendingPrefill: null,
      autoAnsweredIndexes: [],
      chatPreamble: []
    });
    this.updateQuestionState(session);
  },

  handleBackToHome() {
    wx.navigateBack({
      fail: function () {
        wx.reLaunch({
          url: '/pages/home/home'
        });
      }
    });
  },

  async refreshConnectionStatus() {
    this.setData({
      connectionStatus: buildConnectionStatusView({
        state: 'checking',
        text: '检测 OpenClaw 中',
        detail: this.data.connectionStatus.detail || ''
      })
    });

    const status = await foodAiAdapter.getFoodConnectionStatus();
    this.setData({
      connectionStatus: buildConnectionStatusView(status)
    });
  },

  handleConnectionStatusTap() {
    const status = this.data.connectionStatus || {};

    wx.showModal({
      title: status.text || '连接状态',
      content: status.detail || '暂无连接详情',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  handleOptionTap(event) {
    const value = event.currentTarget.dataset.value;

    this.toggleOption(value);
  },

  handleTagTap(event) {
    const tagId = event.currentTarget.dataset.id;
    const tagType = event.currentTarget.dataset.type;
    const mode = event.currentTarget.dataset.mode;
    const selectedTags = this.cloneSelectedTags(this.data.selectedTags);
    const currentValues = selectedTags[tagType] || [];
    const selectedIndex = currentValues.indexOf(tagId);

    if (mode === 'single') {
      selectedTags[tagType] = selectedIndex >= 0 ? [] : [tagId];
    } else if (tagType === 'avoid') {
      selectedTags[tagType] = this.toggleAvoidTag(currentValues, tagId, selectedIndex);
    } else if (selectedIndex >= 0) {
      currentValues.splice(selectedIndex, 1);
      selectedTags[tagType] = currentValues;
    } else {
      currentValues.push(tagId);
      selectedTags[tagType] = currentValues;
    }

    this.setData({
      selectedTags,
      tagGroups: this.formatTagGroups(this.data.currentQuestion, selectedTags)
    });
  },

  handleManualInput(event) {
    const val = event.detail.value;
    const currentQuestion = this.data.currentQuestion;
    const manualInputs = Object.assign({}, this.data.manualInputs);
    if (currentQuestion) {
      manualInputs[currentQuestion.id] = val;
    }
    this.setData({ manualAnswer: val, manualInputs });
  },

  handleConfirm() {
    const manualAnswer = this.data.manualAnswer.trim();
    const currentQuestion = this.data.currentQuestion;
    const selectedOptions = this.data.selectedOptions.slice();

    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.kind === 'tag') {
      if (!currentQuestion.optional && !currentQuestion.allowEmpty) {
        const hasTagSelection =
          this.data.selectedTags.taste.length > 0 ||
          this.data.selectedTags.need.length > 0 ||
          this.data.selectedTags.temporaryAvoid.length > 0 ||
          this.data.selectedTags.avoid.length > 0 ||
          this.data.selectedTags.spicyLevel.length > 0;
        if (!hasTagSelection && !manualAnswer) {
          wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
          return;
        }
      }
      this.submitAnswer({
        preferences: this.buildPreferencesFromSelectedTags(currentQuestion, manualAnswer)
      });
      return;
    }

    if (currentQuestion.kind === 'multi-choice') {
      if (!selectedOptions.length && !manualAnswer) {
        if (currentQuestion.allowEmpty) {
          this.submitAnswer('未选择');
          return;
        }
        wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
        return;
      }
      this.submitAnswer(selectedOptions.length ? selectedOptions.join('、') : manualAnswer);
      return;
    }

    // choice question — required
    if (!selectedOptions.length && !manualAnswer) {
      if (currentQuestion.allowEmpty || currentQuestion.optional) {
        this.submitAnswer('未选择');
        return;
      }
      wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
      return;
    }

    // mealPurpose-only: canonicalize manual input and detect conflicts with selected option.
    if (currentQuestion.id === 'mealPurpose') {
      const detected = detectMealPurposeFromText(manualAnswer);

      if (selectedOptions.length) {
        const pickedOption = selectedOptions[0];

        if (detected && detected.canonical !== pickedOption) {
          const self = this;
          wx.showModal({
            title: '确认就餐场景',
            content: '你选择了"' + pickedOption + '"，但补充里提到了"' + detected.keyword + '"。你想把就餐场景改成"' + detected.canonical + '"吗？',
            confirmText: '确认修改',
            cancelText: '保持原选',
            success: function (res) {
              if (res.confirm) {
                // Adopt the manual keyword: clear conflicting manual text, submit canonical.
                const nextManualInputs = Object.assign({}, self.data.manualInputs);
                nextManualInputs[currentQuestion.id] = '';
                self.setData({ manualAnswer: '', manualInputs: nextManualInputs });
                self.submitAnswer(detected.canonical);
              } else {
                // Keep the selected option; manual input stays as a supplementary note.
                self.submitAnswer(pickedOption);
              }
            }
          });
          return;
        }

        // No conflict (no keyword in manual, or its canonical matches the selected option).
        this.submitAnswer(pickedOption);
        return;
      }

      // No option selected — submit canonical mealPurpose if manual text contains a keyword.
      if (detected) {
        this.submitAnswer(detected.canonical);
        return;
      }
      this.submitAnswer(manualAnswer);
      return;
    }

    this.submitAnswer(selectedOptions.length ? selectedOptions.join('、') : manualAnswer);
  },

  restartSession() {
    this.hasSavedCurrentRecordFlag = false;
    this._activeProfile = null;
    this._pendingProfileAfterMealPurpose = null;
    this._skipPreferenceCheckForScenario = '';
    this._emptyPrefNoticeScenario = '';
    this.setData({
      manualInputs: {},
      selectionHistory: [],
      answerHistory: [],
      showSlotSummaryDetail: false,
      recommendationBatchIndex: 0,
      recommendationNotice: '',
      showAdjustmentOptions: false,
      adjustmentManualInput: '',
      adjustmentMessages: [],
      hasSavedCurrentRecord: false,
      memoryDecision: '',
      prefCheckActive: false,
      prefCheckTitle: '',
      prefCheckSummary: '',
      prefCheckPrompt: '',
      prefCheckChips: [],
      prefCheckDisclaimer: '',
      prefModifyActive: false,
      prefModifyOptions: this.formatPrefModifyOptions([]),
      selectedPrefModifyActions: [],
      prefModificationActions: [],
      pendingPrefill: null,
      autoAnsweredIndexes: [],
      chatPreamble: []
    });
    this.startSession();
  },

  // Top-level result action — clear current flow and start over.
  handleStartOver() {
    this.restartSession();
  },

  // Top-level result action — explicitly write session slots + preferences
  // into long-term memory and a reusable preference record. Session-only
  // completions intentionally skip this path.
  handleSavePreference() {
    if (this.data.memoryDecision) {
      return;
    }
    const session = this.data.session;
    const recommendations = this.data.recommendations || [];
    userMemoryAdapter.updateUserMemory({
      slots: session.slots,
      preferences: session.preferences
    });
    userMemoryAdapter.savePreferenceRecord(
      this.buildPreferenceRecord(session, recommendations),
      { force: true }
    );
    this.hasSavedCurrentRecordFlag = true;
    this.setData({
      memoryDecision: 'kept',
      hasSavedCurrentRecord: true
    });
    wx.showToast({
      title: '已记住，下次会优先参考这些偏好',
      icon: 'none'
    });
  },

  // Top-level result action — explicit "this session only". Long-term memory
  // and reusable preference records are NOT touched. Recommendation history is
  // still updated separately when behavior-learning permission allows it.
  handleSessionOnly() {
    if (this.data.memoryDecision) {
      return;
    }
    this.setData({ memoryDecision: 'session-only' });
    wx.showToast({
      title: '好的，本次条件不会额外记入长期偏好',
      icon: 'none'
    });
  },

  toggleFavoriteShop(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const recommendations = this.data.recommendations;
    const shop = recommendations[idx];
    if (!shop) {
      return;
    }

    const favorites = loadFavoriteShops();
    const key = buildFavoriteShopKey(shop);
    const existingIndex = favorites.findIndex(function (f) {
      return buildFavoriteShopKey(f) === key;
    });

    let newFavorited;
    if (existingIndex >= 0) {
      favorites.splice(existingIndex, 1);
      newFavorited = false;
    } else {
      favorites.unshift(buildFavoriteObject(shop));
      newFavorited = true;
    }

    saveFavoriteShops(favorites);

    this.setData({
      recommendations: recommendations.map(function (item, i) {
        return i === idx ? Object.assign({}, item, { isFavorited: newFavorited }) : item;
      })
    });
  },

  // ─── Preference pre-check helpers ───────────────────────────────────────

  buildPrefCheckTitle(profile) {
    return '我找到你上次「' + (profile.mealPurpose || '这类场景') + '」的偏好：';
  },

  buildPrefCheckChips(profile) {
    const chips = [];
    const addChip = function (label) {
      if (label && chips.indexOf(label) < 0) {
        chips.push(label);
      }
    };

    addChip(profile.mealPurpose);
    splitPreferenceText(profile.branchPreference).forEach(addChip);
    (profile.tasteTags || []).forEach(addChip);
    (profile.needTags || []).forEach(addChip);
    (profile.temporaryAvoidTags || []).forEach(addChip);
    (profile.avoidTags || []).forEach(addChip);
    addChip(profile.spicyLevel);
    addChip(formatCompactPreferenceValue(profile.budget));
    addChip(formatCompactPreferenceValue(profile.distance));
    addChip(profile.userNotes);

    return chips;
  },

  // Build labeled rows of the reused preference for on-screen display.
  // Each row carries a stable `key` and the matching modify-action so the
  // row-level keep/modify toggle can drive startHistoryPreferenceFlow without
  // relying on display labels. `toggleable: false` rows (用餐场景 — already
  // chosen this session) are shown for context but cannot be marked to modify.
  // Empty / 未选择 fields are skipped so the table stays compact. Rows default
  // to keep === true (reuse the value).
  buildPrefSummaryRows(profile) {
    const safe = profile || {};
    const joinTags = function (list) {
      return (list || []).filter(function (tag) { return !!tag; }).join('、');
    };
    // One row per fine-grained field, each mapping to exactly ONE modify
    // action. When a single field is marked 要修改, prefModificationActions
    // carries just that action; getVisibleTagGroupTypes() then renders only
    // that field's group inside its question, so the user is asked only the
    // field they picked — never its neighbours in the same grouped question.
    const defs = [
      { key: 'mealScene', label: '用餐场景', value: safe.mealPurpose, action: '', toggleable: false },
      { key: 'cravings', label: '想吃', value: joinTags(splitPreferenceText(safe.branchPreference)), action: 'branch-preference', toggleable: true },
      { key: 'taste', label: '口味/感觉', value: joinTags((safe.tasteTags || []).concat(safe.needTags || [])), action: 'taste-feeling', toggleable: true },
      { key: 'tempAvoid', label: '这次不想吃', value: joinTags(safe.temporaryAvoidTags), action: 'temporary-avoid', toggleable: true },
      { key: 'taboo', label: '忌口', value: joinTags(safe.avoidTags), action: 'restriction', toggleable: true },
      { key: 'spiceLevel', label: '辣度', value: safe.spicyLevel, action: 'spice', toggleable: true },
      { key: 'budget', label: '预算', value: formatCompactPreferenceValue(safe.budget), action: 'budget', toggleable: true },
      { key: 'distance', label: '距离', value: formatCompactPreferenceValue(safe.distance), action: 'distance', toggleable: true },
      { key: 'notes', label: '其他补充', value: safe.userNotes, action: 'notes', toggleable: true }
    ];

    return defs.map(function (def) {
      const text = String(def.value == null ? '' : def.value).trim();
      return Object.assign({}, def, { value: text, keep: true });
    }).filter(function (def) {
      return def.value && def.value !== '未选择';
    });
  },

  // Modify-action keys for rows the user toggled to "要修改", ordered by
  // prefModificationOrder so downstream re-asking is deterministic.
  collectUnselectedActions() {
    const rows = this.data.prefSummaryRows || [];
    const actions = [];
    rows.forEach(function (row) {
      if (!row || !row.toggleable || row.keep !== false) {
        return;
      }
      // Each row maps to exactly one action; the `row.actions` array form is
      // kept only as a tolerant fallback for any future multi-action row.
      const rowActions = row.actions || (row.action ? [row.action] : []);
      rowActions.forEach(function (action) {
        if (action && actions.indexOf(action) < 0) {
          actions.push(action);
        }
      });
    });
    return this.sortPrefModificationActions(actions);
  },

  // Flip a single row between 保留 (keep/reuse) and 要修改 (re-ask this field).
  handlePrefRowToggle(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) {
      return;
    }
    let modifyCount = 0;
    const rows = (this.data.prefSummaryRows || []).map(function (row) {
      if (row.key === key && row.toggleable) {
        return Object.assign({}, row, { keep: !row.keep });
      }
      return row;
    });
    rows.forEach(function (row) {
      if (row.toggleable && row.keep === false) {
        modifyCount += 1;
      }
    });
    this.setData({ prefSummaryRows: rows, prefModifyCount: modifyCount });
  },

  // Tapped one of the pre-check actions after a real scene-matched record.
  handlePrefCheckOptionTap(event) {
    const action = event.currentTarget.dataset.action;
    const label = event.currentTarget.dataset.label;
    const profile = this._activeProfile || null;

    if (action === 'use-all') {
      this.startHistoryPreferenceFlow([], label, this.buildPrefillReplyText(profile, []));
      return;
    }

    if (action === 'partial') {
      this.setData({
        prefCheckActive: false,
        prefModifyActive: true,
        prefSummaryRows: this.buildPrefSummaryRows(profile),
        prefModifyCount: 0,
        prefModifyOptions: this.formatPrefModifyOptions([]),
        selectedPrefModifyActions: [],
        chatPreamble: this.data.chatPreamble.concat(
          this.buildChatMessagePair(label, '好的，我把你上次的偏好带进来了。', 'prefcheck-partial')
        )
      });
      return;
    }

    this._activeProfile = null;
    this._skipPreferenceCheckForScenario = (this.data.session.slots || {}).mealPurpose || '';

    this.setData({
      prefCheckActive: false,
      prefCheckTitle: '',
      prefCheckSummary: '',
      prefCheckPrompt: '',
      prefCheckChips: [],
      prefCheckDisclaimer: '',
      prefModifyActive: false,
      prefModifyOptions: this.formatPrefModifyOptions([]),
      selectedPrefModifyActions: [],
      prefModificationActions: [],
      pendingPrefill: null,
      chatPreamble: this.data.chatPreamble.concat(
        this.buildChatMessagePair(label, '好的，这次不用历史偏好，我们从当前场景继续。', 'prefcheck-skip')
      )
    });

    this.updateQuestionState(this.data.session);
  },

  handlePrefModifyOptionTap(event) {
    const action = event.currentTarget.dataset.action;
    const selected = this.data.selectedPrefModifyActions.slice();
    const index = selected.indexOf(action);

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(action);
    }

    this.setData({
      selectedPrefModifyActions: selected,
      prefModifyOptions: this.formatPrefModifyOptions(selected)
    });
  },

  // "确定修改这些" — re-ask ONLY the rows the user toggled to 要修改, via the
  // dedicated exact-field flow. Disabled in the UI when nothing is unselected;
  // this guard is a safety net.
  handlePrefModifyConfirm() {
    const selected = this.collectUnselectedActions();

    if (!selected.length) {
      wx.showToast({ title: '点行右侧的「保留」标记要修改的项，或点「直接按这些推荐」', icon: 'none' });
      return;
    }

    this.startModifyOnlyFlow(
      selected,
      '修改这些',
      '好的，只调整：' + this.formatPrefActionLabels(selected) + '，其他沿用上次偏好。'
    );
  },

  // "直接按这些推荐" — if nothing is marked, go straight to recommendations
  // with the kept profile; if some rows are marked, ask only those first.
  handlePrefUseAllFromModify() {
    const profile = this._activeProfile || null;
    const selected = this.collectUnselectedActions();

    if (!selected.length) {
      this.startModifyOnlyFlow([], '直接按这些推荐', this.buildPrefillReplyText(profile, []));
      return;
    }

    this.startModifyOnlyFlow(
      selected,
      '直接按这些推荐',
      '好的，先补充：' + this.formatPrefActionLabels(selected) + '，其余沿用上次偏好。'
    );
  },

  // Dedicated, exact-field modification flow. Builds a session whose question
  // list contains ONLY the single-field questions for the selected actions, so
  // unselected fields can never be rendered. Kept fields are filled from the
  // profile up front (applyProfileToSession) and never appear as questions.
  // The normal new-user flow and the pre-check "全都按这个来" path are untouched.
  startModifyOnlyFlow(modificationActions, userLabel, replyText) {
    const profile = this._activeProfile || null;
    const actions = this.sortPrefModificationActions(modificationActions);

    if (!profile) {
      this.setData({ prefCheckActive: false, prefModifyActive: false, pendingPrefill: null });
      this.updateQuestionState(this.data.session);
      return;
    }

    const baseSession = this.applyProfileToSession(this.data.session, profile);
    const mealPurpose = (baseSession.slots || {}).mealPurpose;
    const modifyQuestions = actions.map(function (action) {
      return foodAiAdapter.buildModifyQuestion(action, mealPurpose);
    }).filter(function (question) { return !!question; });

    const session = Object.assign({}, baseSession, {
      resolvedQuestions: modifyQuestions,
      totalQuestions: modifyQuestions.length,
      questionIndex: 0,
      answers: [],
      // Block dynamic-question prefetch during the modify sub-flow.
      dynamicQuestionPlan: { requested: true, status: 'done', source: 'modify-only' }
    });

    this._skipPreferenceCheckForScenario = profile.mealPurpose || '';

    this.setData({
      session,
      prefCheckActive: false,
      prefCheckTitle: '',
      prefCheckSummary: '',
      prefCheckPrompt: '',
      prefCheckChips: [],
      prefCheckDisclaimer: '',
      prefModifyActive: false,
      prefModifyCount: 0,
      prefModificationActions: actions,
      pendingPrefill: null,
      autoAnsweredIndexes: [],
      selectedOptions: [],
      selectedTags: this.cloneSelectedTags(emptySelectedTags),
      manualInputs: {},
      manualAnswer: '',
      chatPreamble: this.data.chatPreamble.concat(
        this.buildChatMessagePair(userLabel, replyText, 'prefmodify-' + Date.now())
      )
    });

    this.updateQuestionState(session);
  },

  formatPrefModifyOptions(selectedActions) {
    const selected = selectedActions || [];
    return prefModificationOptions.map(function (item) {
      return Object.assign({}, item, {
        isSelected: selected.indexOf(item.action) >= 0
      });
    });
  },

  sortPrefModificationActions(actions) {
    const selected = actions || [];
    return prefModificationOrder.filter(function (action) {
      return selected.indexOf(action) >= 0;
    });
  },

  formatPrefActionLabels(actions) {
    const labelMap = {};
    prefModificationOptions.forEach(function (item) {
      labelMap[item.action] = item.label;
    });
    return (actions || []).map(function (action) {
      return labelMap[action] || action;
    }).join('、');
  },

  startHistoryPreferenceFlow(modificationActions, userLabel, replyText) {
    const profile = this._activeProfile || null;
    const actions = this.sortPrefModificationActions(modificationActions);

    if (!profile) {
      this.setData({
        prefCheckActive: false,
        prefModifyActive: false,
        pendingPrefill: null
      });
      this.updateQuestionState(this.data.session);
      return;
    }

    const modifiesMealPurpose = actions.indexOf('meal-purpose') >= 0;
    const pendingPrefill = {
      autoAnswerIds: this.buildHistoryAutoAnswerIds(actions)
    };
    const chatPreamble = this.data.chatPreamble.concat(
      this.buildChatMessagePair(userLabel, replyText, 'prefcheck-apply-' + Date.now())
    );

    this._skipPreferenceCheckForScenario = profile.mealPurpose || '';

    if (modifiesMealPurpose) {
      const initialSession = foodAiAdapter.createInitialSession();
      this._pendingProfileAfterMealPurpose = profile;
      this.setData({
        session: initialSession,
        prefCheckActive: false,
        prefCheckTitle: '',
        prefCheckSummary: '',
        prefCheckPrompt: '',
        prefCheckChips: [],
        prefModifyActive: false,
        prefModifyOptions: this.formatPrefModifyOptions([]),
        selectedPrefModifyActions: [],
        prefModificationActions: actions,
        pendingPrefill,
        autoAnsweredIndexes: [],
        manualInputs: {},
        manualAnswer: '',
        selectedOptions: [],
        selectedTags: this.cloneSelectedTags(emptySelectedTags),
        selectionHistory: [],
        answerHistory: [],
        chatPreamble
      });
      this.updateQuestionState(initialSession);
      return;
    }

    let session = this.applyProfileToSession(this.data.session, profile);
    if (actions.indexOf('notes') >= 0) {
      session = this.appendUserNotesQuestion(session);
    }

    this.setData({
      session,
      prefCheckActive: false,
      prefCheckTitle: '',
      prefCheckSummary: '',
      prefCheckPrompt: '',
      prefCheckChips: [],
      prefModifyActive: false,
      prefModifyOptions: this.formatPrefModifyOptions([]),
      selectedPrefModifyActions: [],
      prefModificationActions: actions,
      pendingPrefill,
      chatPreamble
    });

    this.updateQuestionState(session);
  },

  buildHistoryAutoAnswerIds(modificationActions) {
    const actions = modificationActions || [];
    const autoAnswerIds = [];

    // Reuse (auto-answer) branchPreference unless the user marked 想吃 to modify.
    if (actions.indexOf('branch-preference') < 0) {
      autoAnswerIds.push('branchPreference');
    }
    if (actions.indexOf('taste-feeling') < 0 && actions.indexOf('temporary-avoid') < 0) {
      autoAnswerIds.push('tag-preferences');
    }
    if (actions.indexOf('restriction') < 0 && actions.indexOf('spice') < 0) {
      autoAnswerIds.push('avoid-preferences');
    }
    if (actions.indexOf('budget') < 0) {
      autoAnswerIds.push('budget');
    }
    if (actions.indexOf('distance') < 0) {
      autoAnswerIds.push('distance');
    }

    return autoAnswerIds;
  },

  buildPrefillReplyText(profile, autoAnswerIds) {
    if (!profile) {
      return '好，已使用上次的偏好。';
    }
    const tokens = this.buildPrefCheckChips(profile);
    if (!tokens.length) {
      return '好，已使用上次的偏好。';
    }
    return '好，已沿用：' + tokens.join(' · ') + '。';
  },

  buildChatMessagePair(userText, butlerText, baseId) {
    const id = baseId || ('prefcheck-' + Date.now());
    return [
      {
        id: id + '-user',
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: userText
      },
      {
        id: id + '-butler',
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: '幺',
        showQuickReplies: false,
        text: butlerText
      }
    ];
  },

  applyProfileToSession(session, profile) {
    const safeSession = session || foodAiAdapter.createInitialSession();
    const safeProfile = profile || {};
    const slots = Object.assign({}, safeSession.slots || {}, {
      mealPurpose: (safeSession.slots && safeSession.slots.mealPurpose) || safeProfile.mealPurpose || '',
      branchPreference: safeProfile.branchPreference || ((safeSession.slots || {}).branchPreference || ''),
      budget: safeProfile.budget || ((safeSession.slots || {}).budget || ''),
      distance: safeProfile.distance || ((safeSession.slots || {}).distance || ''),
      userNotes: safeProfile.userNotes || ((safeSession.slots || {}).userNotes || '')
    });
    const preferences = Object.assign(clonePagePreferences(safeSession.preferences), {
      tasteTags: (safeProfile.tasteTags || []).slice(),
      needTags: (safeProfile.needTags || []).slice(),
      temporaryAvoidTags: (safeProfile.temporaryAvoidTags || []).slice(),
      avoidTags: (safeProfile.avoidTags || []).slice(),
      spicyLevel: safeProfile.spicyLevel || ''
    });

    return Object.assign({}, safeSession, {
      slots,
      preferences
    });
  },

  appendUserNotesQuestion(session) {
    if (!session || !session.resolvedQuestions) {
      return session;
    }
    const hasNotesQuestion = session.resolvedQuestions.some(function (question) {
      return question.id === userNotesQuestion.id;
    });

    if (hasNotesQuestion) {
      return session;
    }

    const resolvedQuestions = session.resolvedQuestions.concat([userNotesQuestion]);
    return Object.assign({}, session, {
      resolvedQuestions,
      totalQuestions: resolvedQuestions.length
    });
  },

  // After updateQuestionState renders a new currentQuestion, try to silently
  // auto-answer it from the active profile. Removes the id from
  // pendingPrefill.autoAnswerIds BEFORE submitAnswer so a single question is
  // never auto-answered twice — that prevents any infinite recursion even if
  // the adapter were to fail to advance.
  applyPendingPrefill() {
    const pendingPrefill = this.data.pendingPrefill;
    const currentQuestion = this.data.currentQuestion;
    const profile = this._activeProfile;

    if (!pendingPrefill || !profile || !currentQuestion || this.data.isFinished) {
      return;
    }
    const autoAnswerIds = pendingPrefill.autoAnswerIds || [];
    const questionKey = currentQuestion.slot || currentQuestion.id;
    if (autoAnswerIds.indexOf(currentQuestion.id) < 0 && autoAnswerIds.indexOf(questionKey) < 0) {
      return;
    }

    const answer = this.synthesizePrefillAnswer(currentQuestion, profile);
    const remainingIds = autoAnswerIds.filter(function (id) {
      return id !== currentQuestion.id && id !== questionKey;
    });
    const nextPendingPrefill = remainingIds.length
      ? Object.assign({}, pendingPrefill, { autoAnswerIds: remainingIds })
      : null;

    if (answer === null) {
      // Validity check failed (e.g. stored budget string doesn't match this
      // session's options). Leave the question for the user.
      this.setData({ pendingPrefill: nextPendingPrefill });
      return;
    }

    const autoAnsweredIndexes = (this.data.autoAnsweredIndexes || []).slice();
    autoAnsweredIndexes.push(this.data.session.questionIndex);

    this.setData({
      pendingPrefill: nextPendingPrefill,
      autoAnsweredIndexes
    });

    this.submitAnswer(answer);
  },

  // Build a payload for foodAiAdapter.answerQuestion from the profile.
  // Returns null if the profile cannot answer this question safely.
  // mealPurpose is never auto-answered; branch preference can be reused when it matches.
  synthesizePrefillAnswer(currentQuestion, profile) {
    if (!profile || !currentQuestion) { return null; }

    if (currentQuestion.id === 'tag-preferences') {
      const tasteTags = (profile.tasteTags || []).slice();
      const needTags = (profile.needTags || []).slice();
      const temporaryAvoidTags = (profile.temporaryAvoidTags || []).slice();
      if (!tasteTags.length && !needTags.length && !temporaryAvoidTags.length && currentQuestion.allowEmpty) {
        return {
          preferences: {
            tasteTags: [],
            needTags: [],
            temporaryAvoidTags: []
          }
        };
      }
      if (!tasteTags.length && !needTags.length && !temporaryAvoidTags.length) { return null; }
      return {
        preferences: {
          tasteTags: tasteTags,
          needTags: needTags,
          temporaryAvoidTags: temporaryAvoidTags
        }
      };
    }

    if (currentQuestion.id === 'avoid-preferences') {
      const avoidTags = (profile.avoidTags || []).slice();
      const spicyLevel = profile.spicyLevel || '';
      if (!avoidTags.length && !spicyLevel && currentQuestion.allowEmpty) {
        return {
          preferences: {
            avoidTags: [],
            spicyLevel: ''
          }
        };
      }
      if (!avoidTags.length && !spicyLevel) { return null; }
      return {
        preferences: {
          avoidTags: avoidTags,
          spicyLevel: spicyLevel
        }
      };
    }

    if (currentQuestion.slot === 'branchPreference') {
      const value = String(profile.branchPreference || '');
      const matchedValue = this.matchQuestionOption(value, currentQuestion.options || []);
      if (matchedValue) { return matchedValue; }
      // Kept field: reuse the stored value as-is so the question advances
      // (answerChoiceQuestion accepts any non-empty value) instead of being
      // shown to the user. Fall back to 未选择 only when nothing was stored.
      if (value) { return value; }
      return currentQuestion.allowEmpty ? '未选择' : null;
    }

    // Budget / distance — kind 'choice'. Prefer an exact option match, but
    // fall back to the stored value so a KEPT field is always auto-answered
    // (answerChoiceQuestion accepts any non-empty value and advances) rather
    // than being shown to the user.
    if (currentQuestion.id === 'budget' || currentQuestion.slot === 'budget') {
      const value = String(profile.budget || '');
      if (!value) { return null; }
      return this.matchQuestionOption(value, currentQuestion.options || []) || value;
    }

    if (currentQuestion.id === 'distance' || currentQuestion.slot === 'distance') {
      const value = String(profile.distance || '');
      if (!value) { return null; }
      return this.matchQuestionOption(value, currentQuestion.options || []) || value;
    }

    if (currentQuestion.id === 'user-notes') {
      return profile.userNotes || '没有补充';
    }

    return null;
  },

  matchQuestionOption(value, options) {
    const normalizedValue = normalizeComparableText(value);
    const matched = (options || []).find(function (option) {
      return normalizeComparableText(option) === normalizedValue;
    });

    return matched || null;
  },

  toggleSlotSummary() {
    this.setData({
      showSlotSummaryDetail: !this.data.showSlotSummaryDetail
    });
  },

  handleSummaryFieldTap(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const isAvailable = event.currentTarget.dataset.available;

    if (isAvailable === false || isAvailable === 'false') {
      return;
    }

    this.jumpToQuestionById(questionId);
  },

  handleRecommendationError(error) {
    if (isAuthRequiredError(error)) {
      userIdentityAdapter.clearIdentity();
      this.setData({
        isRecommendationLoading: false,
        recommendationNotice: '登录已过期，请重新登录后再生成推荐。',
        connectionStatus: buildConnectionStatusView({
          state: 'degraded',
          text: '登录已过期',
          detail: '服务端 session 已失效，需要重新登录。'
        })
      });
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      userIdentityAdapter.requireLoginRedirect('/pages/food/food');
      return true;
    }

    const message = error && error.message ? error.message : String(error || '生成失败');
    this.setData({
      isRecommendationLoading: false,
      recommendationNotice: '生成推荐失败，请稍后重试。',
      connectionStatus: buildConnectionStatusView({
        state: 'degraded',
        text: '推荐生成失败',
        detail: message
      })
    });
    wx.showToast({ title: '生成推荐失败，请稍后重试', icon: 'none' });
    return true;
  },

  async handleRefreshRecommendations() {
    const currentRecommendations = this.data.recommendations || [];
    const currentIds = currentRecommendations.map(function (item) {
      return item.id;
    });
    const nextBatchIndex = this.data.recommendationBatchIndex + 1;
    this.setData({ isRecommendationLoading: true });
    wx.showLoading({ title: '生成推荐中' });

    let nextRecommendations;
    try {
      nextRecommendations = await foodAiAdapter.generateRecommendations(
        this.data.session.slots,
        this.data.session.preferences,
        {
          excludeIds: currentIds,
          batchIndex: nextBatchIndex,
          decisionSheet: this.data.session.decisionSheet
        }
      );
      nextRecommendations = decorateRecommendationsForDisplay(nextRecommendations);
      nextRecommendations = decorateWithFavoriteStatus(nextRecommendations);
    } catch (error) {
      this.handleRecommendationError(error);
      return;
    } finally {
      wx.hideLoading();
    }

    const nextIds = nextRecommendations.map(function (item) {
      return item.id;
    });
    const isSameBatch = areSameRecommendationIds(currentIds, nextIds);
    const recommendationMeta = foodAiAdapter.getLastRecommendationMeta();

    this.setData({
      recommendations: nextRecommendations,
      isRecommendationLoading: false,
      recommendationBatchIndex: nextBatchIndex,
      recommendationNotice: recommendationMeta.fallback
        ? recommendationMeta.message
        : isSameBatch
        ? '暂时没有更多合适方案，我再帮你放宽一点条件试试'
        : '我换了一批，你可以看看有没有更顺眼的方案。',
      connectionStatus: recommendationMeta.fallback
        ? buildConnectionStatusView({
            state: 'degraded',
            text: 'OpenClaw 推荐未返回',
            detail: recommendationMeta.error || recommendationMeta.message
          })
        : this.data.connectionStatus,
      showAdjustmentOptions: false
    });
  },

  handleStartAdjustment() {
    this.setData({
      showAdjustmentOptions: true,
      recommendationNotice: '',
      adjustmentManualInput: ''
    });
  },

  handleAdjustmentOptionTap(event) {
    const action = event.currentTarget.dataset.action;
    const label = event.currentTarget.dataset.label;

    if (action === 'avoid') {
      this.appendAdjustmentMessages(label, '可以直接告诉我不吃什么，我会避开。');
      wx.showToast({
        title: '可以在输入框补充具体忌口',
        icon: 'none'
      });
      return;
    }

    this.refreshRecommendationsWithAdjustment(this.buildAdjustmentFromAction(action, label));
  },

  handleAdjustmentManualInput(event) {
    this.setData({
      adjustmentManualInput: event.detail.value
    });
  },

  handleAdjustmentManualSubmit() {
    const feedbackText = String(this.data.adjustmentManualInput || '').trim();

    if (!feedbackText) {
      wx.showToast({
        title: '先告诉我哪里不满意',
        icon: 'none'
      });
      return;
    }

    this.setData({
      adjustmentManualInput: ''
    });

    this.refreshRecommendationsWithAdjustment(this.resolveAdjustmentFromText(feedbackText));
  },

  appendAdjustmentMessages(feedbackText, noticeText) {
    this.setData({
      adjustmentMessages: this.data.adjustmentMessages.concat(
        this.buildAdjustmentMessagePair(feedbackText, noticeText)
      )
    });
  },

  buildAdjustmentMessagePair(feedbackText, noticeText) {
    const baseId = 'adjustment-' + this.data.adjustmentMessages.length + '-' + Date.now();

    return [
      {
        id: baseId + '-user',
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: feedbackText
      },
      {
        id: baseId + '-butler',
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: '幺',
        showQuickReplies: false,
        text: noticeText
      }
    ];
  },

  async refreshRecommendationsWithAdjustment(adjustment) {
    const currentRecommendations = this.data.recommendations || [];
    const currentIds = currentRecommendations.map(function (item) {
      return item.id;
    });
    const nextBatchIndex = this.data.recommendationBatchIndex + 1;
    const adjustedPreferences = this.buildAdjustedPreferences(adjustment);
    const adapterOptions = {
      excludeIds: currentIds,
      batchIndex: nextBatchIndex,
      adjustment: Object.assign({}, adjustment, {
        avoidCategories: this.getCurrentRecommendationCategories()
      })
    };
    this.setData({ isRecommendationLoading: true });
    wx.showLoading({ title: '生成推荐中' });

    let nextRecommendations;
    try {
      nextRecommendations = await foodAiAdapter.generateRecommendations(
        this.data.session.slots,
        adjustedPreferences,
        Object.assign({}, adapterOptions, {
          decisionSheet: this.data.session.decisionSheet
        })
      );
      nextRecommendations = decorateRecommendationsForDisplay(nextRecommendations);
      nextRecommendations = decorateWithFavoriteStatus(nextRecommendations);
    } catch (error) {
      this.handleRecommendationError(error);
      return;
    } finally {
      wx.hideLoading();
    }

    const nextIds = nextRecommendations.map(function (item) {
      return item.id;
    });
    const isSameBatch = areSameRecommendationIds(currentIds, nextIds);
    const recommendationMeta = foodAiAdapter.getLastRecommendationMeta();
    const noticeText = isSameBatch
      ? '符合条件的方案有限，我先帮你换了更接近的一批。'
      : '已根据「' + adjustment.text + '」重新调整推荐';

    this.setData({
      recommendations: nextRecommendations,
      isRecommendationLoading: false,
      recommendationBatchIndex: nextBatchIndex,
      recommendationNotice: recommendationMeta.fallback ? recommendationMeta.message : noticeText,
      connectionStatus: recommendationMeta.fallback
        ? buildConnectionStatusView({
            state: 'degraded',
            text: 'OpenClaw 推荐未返回',
            detail: recommendationMeta.error || recommendationMeta.message
          })
        : this.data.connectionStatus,
      showAdjustmentOptions: false,
      adjustmentManualInput: '',
      adjustmentMessages: this.data.adjustmentMessages.concat(
        this.buildAdjustmentMessagePair(
          adjustment.text,
          adjustment.replyText || '收到，我按这个方向帮你重新筛一批。'
        )
      )
    });
  },

  handleGoBack() {
    const session = this.data.session;
    const currentQuestion = this.data.currentQuestion;

    if (!currentQuestion || session.questionIndex <= 0) { return; }

    // Save current selection state before navigating back
    let selectionHistory = this.data.selectionHistory.slice();
    selectionHistory[session.questionIndex] = {
      selectedOptions: this.data.selectedOptions.slice(),
      selectedTags: this.cloneSelectedTags(this.data.selectedTags)
    };

    const prevSession = foodAiAdapter.goBack(session);
    const prevQuestion = foodAiAdapter.getNextQuestion(prevSession);

    if (!prevQuestion) { return; }

    // When returning to mealPurpose, clear branch-specific history so stale
    // branch answers from the old branch are not restored if the user picks differently.
    if (prevSession.questionIndex === 0) {
      selectionHistory = selectionHistory.slice(0, 1);
    }

    const restored = selectionHistory[prevSession.questionIndex] || {};
    const selectedOptions = restored.selectedOptions || [];
    const selectedTags = restored.selectedTags || this.cloneSelectedTags(emptySelectedTags);
    const manualAnswer = this.data.manualInputs[prevQuestion.id] || '';

    this.setData({
      session: prevSession,
      currentQuestion: prevQuestion,
      selectionHistory,
      answerHistory: this.data.answerHistory.slice(0, prevSession.questionIndex),
      selectedOptions,
      selectedTags,
      manualAnswer,
      currentOptions: (prevQuestion.kind === 'choice' || prevQuestion.kind === 'multi-choice')
        ? this.formatQuestionOptions(prevQuestion, selectedOptions)
        : [],
      tagGroups: prevQuestion.kind === 'tag'
        ? this.formatTagGroups(prevQuestion, selectedTags)
        : [],
      isTagQuestion: prevQuestion.kind === 'tag',
      showManualInput: true,
      isFinished: false,
      chatMessages: this.buildChatMessages(prevSession, prevQuestion),
      slotSummaryText: this.buildSlotSummaryText(prevSession.slots, prevSession.preferences),
      summaryFields: this.buildSummaryFields(prevSession),
      slotItems: this.formatSlotItems(prevSession.slots, prevSession.preferences, prevSession.decisionSheet)
    });
  },

  submitAnswer(answer) {
    const prevIndex = this.data.session.questionIndex;
    const prevSession = this.data.session;
    const currentQuestion = this.data.currentQuestion;
    const session = foodAiAdapter.answerQuestion(prevSession, answer);
    let answerHistory = this.data.answerHistory;

    if (session !== prevSession && session.questionIndex > prevIndex) {
      answerHistory = this.data.answerHistory.slice(0, prevIndex);
      answerHistory[prevIndex] = cloneAnswerForHistory(answer);
    }

    if (session !== prevSession && currentQuestion && currentQuestion.id === 'mealPurpose') {
      if (this.handleMealPurposeAnswered(session, prevIndex, answerHistory)) {
        return;
      }
    }

    this.updateQuestionState(session, prevIndex, answerHistory);
    this.prefetchDynamicQuestions(session);
  },

  handleMealPurposeAnswered(session, savedFromIndex, answerHistory) {
    const scenario = session && session.slots ? session.slots.mealPurpose : '';
    const pendingProfile = this._pendingProfileAfterMealPurpose;

    if (pendingProfile) {
      this._pendingProfileAfterMealPurpose = null;
      let nextSession = this.applyProfileToSession(session, pendingProfile);
      if ((this.data.prefModificationActions || []).indexOf('notes') >= 0) {
        nextSession = this.appendUserNotesQuestion(nextSession);
      }
      this.updateQuestionState(nextSession, savedFromIndex, answerHistory);
      return true;
    }

    if (!scenario || this._skipPreferenceCheckForScenario === scenario) {
      return false;
    }

    const record = this.findLatestRealPreferenceRecordForScenario(scenario);
    if (!record) {
      this._activeProfile = null;
      // No reusable preference for this scene — say so once (per scene) instead
      // of silently jumping into questions, then fall through to the normal flow.
      if (this._emptyPrefNoticeScenario !== scenario) {
        this._emptyPrefNoticeScenario = scenario;
        this.setData({
          chatPreamble: this.data.chatPreamble.concat([{
            id: 'prefcheck-empty-' + Date.now(),
            role: 'butler',
            messageClass: 'butler-message',
            bubbleClass: 'butler-bubble',
            contentClass: 'butler-content',
            showAvatar: true,
            avatarText: '幺',
            showQuickReplies: false,
            text: '还没有可沿用的偏好，我会先问你几个问题。'
          }])
        });
      }
      return false;
    }

    const profile = this.normalizePreferenceRecordProfile(record, scenario);
    const selectionHistory = this.data.selectionHistory.slice();
    selectionHistory[savedFromIndex] = {
      selectedOptions: this.data.selectedOptions.slice(),
      selectedTags: this.cloneSelectedTags(this.data.selectedTags)
    };

    this._activeProfile = profile;
    this.setData({
      session,
      currentQuestion: null,
      currentOptions: [],
      tagGroups: [],
      isTagQuestion: false,
      showManualInput: false,
      selectedOptions: [],
      selectedTags: this.cloneSelectedTags(emptySelectedTags),
      answerHistory,
      selectionHistory,
      manualAnswer: '',
      isFinished: false,
      chatMessages: this.buildChatMessages(session, null),
      slotSummaryText: this.buildSlotSummaryText(session.slots, session.preferences),
      summaryFields: this.buildSummaryFields(session),
      slotItems: this.formatSlotItems(session.slots, session.preferences, session.decisionSheet),
      prefCheckActive: true,
      prefCheckTitle: this.buildPrefCheckTitle(profile),
      prefCheckSummary: '',
      prefCheckPrompt: '这次要沿用这些偏好吗？',
      prefCheckChips: this.buildPrefCheckChips(profile),
      prefSummaryRows: this.buildPrefSummaryRows(profile),
      prefModifyCount: 0,
      prefCheckDisclaimer: '',
      prefModifyActive: false,
      prefModifyOptions: this.formatPrefModifyOptions([]),
      selectedPrefModifyActions: [],
      prefModificationActions: [],
      pendingPrefill: null,
      progressPercent: this.buildProgressPercent(session, null)
    });
    return true;
  },

  findLatestRealPreferenceRecordForScenario(scenario) {
    const records = userMemoryAdapter.getPreferenceRecords();

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index] || {};
      if (this.isRealPreferenceRecordForScenario(record, scenario)) {
        return record;
      }
    }

    return null;
  },

  isRealPreferenceRecordForScenario(record, scenario) {
    if (!record || record.isMock || record.source === 'mock' || record.source === 'demo' || record.source === 'default') {
      return false;
    }
    if (record.mealPurpose !== scenario) {
      return false;
    }
    return !!(
      record.budget &&
      record.distance &&
      ((record.tasteTags || []).length || (record.needTags || []).length)
    );
  },

  normalizePreferenceRecordProfile(record, scenario) {
    const manualInputs = record.manualInputs || {};
    return {
      source: 'record',
      mealPurpose: record.mealPurpose || scenario,
      branchPreference: record.branchPreference || '',
      taste: (record.tasteTags || []).concat(record.needTags || []).join('、'),
      tasteTags: (record.tasteTags || []).slice(),
      needTags: (record.needTags || []).slice(),
      temporaryAvoidTags: (record.temporaryAvoidTags || []).slice(),
      avoidTags: (record.avoidTags || []).slice(),
      spicyLevel: record.spicyLevel || '',
      budget: record.budget || '',
      distance: record.distance || '',
      userNotes: record.userNotes || manualInputs['user-notes'] || ''
    };
  },

  prefetchDynamicQuestions(session) {
    if (!foodAiAdapter.shouldPrefetchDynamicQuestions(session)) {
      return;
    }

    const loadingSession = foodAiAdapter.markDynamicQuestionPlanLoading(session);
    this.setData({ session: loadingSession });

    foodAiAdapter.requestDynamicQuestionPlan(loadingSession).then((plan) => {
      if (this.data.isFinished) {
        return;
      }

      const currentSession = this.data.session;
      const mergedSession = foodAiAdapter.mergeDynamicQuestionPlan(currentSession, plan);

      if (mergedSession === currentSession) {
        return;
      }

      const currentQuestion = foodAiAdapter.getNextQuestion(mergedSession);
      const selectedTags = this.cloneSelectedTags(emptySelectedTags);
      const keepCurrentInput = this.data.currentQuestion &&
        currentQuestion &&
        this.data.currentQuestion.id === currentQuestion.id;

      this.setData({
        session: mergedSession,
        currentQuestion,
        currentOptions: keepCurrentInput
          ? this.data.currentOptions
          : currentQuestion && (currentQuestion.kind === 'choice' || currentQuestion.kind === 'multi-choice')
          ? this.formatQuestionOptions(currentQuestion, [])
          : [],
        tagGroups: keepCurrentInput
          ? this.data.tagGroups
          : currentQuestion && currentQuestion.kind === 'tag'
          ? this.formatTagGroups(currentQuestion, selectedTags)
          : [],
        isTagQuestion: !!currentQuestion && currentQuestion.kind === 'tag',
        showManualInput: !!currentQuestion,
        selectedOptions: keepCurrentInput ? this.data.selectedOptions : [],
        selectedTags: keepCurrentInput ? this.data.selectedTags : selectedTags,
        manualAnswer: keepCurrentInput ? this.data.manualAnswer : '',
        chatMessages: this.buildChatMessages(mergedSession, currentQuestion),
        slotSummaryText: this.buildSlotSummaryText(mergedSession.slots, mergedSession.preferences),
        summaryFields: this.buildSummaryFields(mergedSession),
        slotItems: this.formatSlotItems(mergedSession.slots, mergedSession.preferences, mergedSession.decisionSheet),
        progressPercent: this.buildProgressPercent(mergedSession, currentQuestion)
      });
    }).catch((error) => {
      if (isAuthRequiredError(error)) {
        this.handleRecommendationError(error);
        return;
      }

      const currentSession = this.data.session;
      if (!currentSession || !currentSession.dynamicQuestionPlan) {
        return;
      }

      this.setData({
        session: Object.assign({}, currentSession, {
          dynamicQuestionPlan: {
            status: 'failed',
            requested: true,
            source: '',
            message: error && error.message ? error.message : String(error || '')
          }
        })
      });
    });
  },

  toggleOption(value) {
    const currentQuestion = this.data.currentQuestion;
    const isTasteQuestion = currentQuestion && currentQuestion.slot === 'taste';
    const isMultiChoice = currentQuestion && currentQuestion.kind === 'multi-choice';
    let selectedOptions = this.data.selectedOptions.slice();
    const selectedIndex = selectedOptions.indexOf(value);

    if (isTasteQuestion || isMultiChoice) {
      if (value === '都可以') {
        selectedOptions = selectedIndex >= 0 ? [] : ['都可以'];
      } else if (selectedIndex >= 0) {
        selectedOptions.splice(selectedIndex, 1);
      } else {
        selectedOptions = selectedOptions.filter(function (item) {
          return item !== '都可以';
        });
        selectedOptions.push(value);
      }
    } else {
      selectedOptions = selectedIndex >= 0 ? [] : [value];
    }

    this.setData({
      selectedOptions,
      currentOptions: this.formatQuestionOptions(currentQuestion, selectedOptions)
    });
  },

  async updateQuestionState(session, savedFromIndex, nextAnswerHistory) {
    const currentQuestion = foodAiAdapter.getNextQuestion(session);
    let recommendations = [];
    let recommendationNotice = '';
    let nextConnectionStatus = this.data.connectionStatus;
    const hasSavedCurrentRecord = this.hasSavedCurrentRecordFlag || this.data.hasSavedCurrentRecord;

    if (!currentQuestion) {
      this.setData({ isRecommendationLoading: true });
      wx.showLoading({ title: '生成推荐中' });
      try {
        recommendations = await foodAiAdapter.generateRecommendations(session.slots, session.preferences, {
          decisionSheet: session.decisionSheet
        });
        recommendations = decorateRecommendationsForDisplay(recommendations);
        recommendations = decorateWithFavoriteStatus(recommendations);
      } catch (error) {
        this.handleRecommendationError(error);
        return;
      } finally {
        wx.hideLoading();
      }

      const recommendationMeta = foodAiAdapter.getLastRecommendationMeta();
      recommendationNotice = recommendationMeta.fallback ? recommendationMeta.message : '';
      nextConnectionStatus = recommendationMeta.fallback
        ? buildConnectionStatusView({
            state: 'degraded',
            text: 'OpenClaw 推荐未返回',
            detail: [
              this.data.connectionStatus.detail || '',
              recommendationMeta.error ? '推荐失败原因：' + recommendationMeta.error : ''
            ].filter(function (line) { return !!line; }).join('\n')
          })
        : buildConnectionStatusView({
            state: 'connected',
            text: 'OpenClaw 推荐成功',
            detail: this.data.connectionStatus.detail || '远端 OpenClaw 已成功返回推荐。'
          });

      // Auto-save only lightweight recommendation history when behavior-learning
      // permission allows it. Reusable preference records and long-term memory
      // are written only when the user explicitly taps 「记住这个偏好」.
      userMemoryAdapter.saveRecommendationHistory(recommendations);
    }

    const selectedTags = this.cloneSelectedTags(emptySelectedTags);

    // Save the just-confirmed question's selection to history (single setData call).
    const selectionHistory = this.data.selectionHistory.slice();
    if (savedFromIndex !== undefined) {
      selectionHistory[savedFromIndex] = {
        selectedOptions: this.data.selectedOptions.slice(),
        selectedTags: this.cloneSelectedTags(this.data.selectedTags)
      };
    }

    this.setData({
      session,
      currentQuestion,
      currentOptions: currentQuestion && (currentQuestion.kind === 'choice' || currentQuestion.kind === 'multi-choice')
        ? this.formatQuestionOptions(currentQuestion, [])
        : [],
      tagGroups: currentQuestion && currentQuestion.kind === 'tag'
        ? this.formatTagGroups(currentQuestion, selectedTags)
        : [],
      isTagQuestion: !!currentQuestion && currentQuestion.kind === 'tag',
      showManualInput: !!currentQuestion,
      selectedOptions: [],
      selectedTags,
      answerHistory: nextAnswerHistory || this.data.answerHistory,
      selectionHistory,
      manualAnswer: currentQuestion ? (this.data.manualInputs[currentQuestion.id] || '') : '',
      isFinished: !currentQuestion,
      chatMessages: this.buildChatMessages(session, currentQuestion),
      slotSummaryText: this.buildSlotSummaryText(session.slots, session.preferences),
      summaryFields: this.buildSummaryFields(session),
      slotItems: this.formatSlotItems(session.slots, session.preferences, session.decisionSheet),
      recommendations,
      isRecommendationLoading: false,
      progressPercent: this.buildProgressPercent(session, currentQuestion),
      recommendationBatchIndex: 0,
      recommendationNotice,
      connectionStatus: nextConnectionStatus,
      showAdjustmentOptions: false,
      adjustmentMessages: [],
      memoryDecision: !currentQuestion ? '' : this.data.memoryDecision,
      hasSavedCurrentRecord: !currentQuestion
        ? hasSavedCurrentRecord
        : this.data.hasSavedCurrentRecord
    });

    // After the new question state is in place, see if it can be filled
    // silently from the pre-check profile. Safe to call unconditionally —
    // applyPendingPrefill bails out when pendingPrefill is null.
    this.applyPendingPrefill();
  },

  buildChatMessages(session, currentQuestion) {
    // Preamble carries the pre-check user choice + butler confirmation, so
    // those bubbles appear at the top of the chat thread above the real
    // question/answer log.
    const messages = (this.data.chatPreamble || []).slice();
    const answers = session.answers || [];
    const questionList = this.getQuestionList(session);
    const manualInputs = this.data.manualInputs || {};
    // Auto-answered question indexes are hidden so the chat doesn't show
    // bubbles for things the user never actually answered.
    const autoAnsweredIndexes = this.data.autoAnsweredIndexes || [];

    answers.forEach(function (answer, index) {
      if (autoAnsweredIndexes.indexOf(index) >= 0) {
        return;
      }
      const question = questionList[index] || null;
      const manualText = question ? (manualInputs[question.id] || '') : '';
      const isTagAnswer = !!question && question.kind === 'tag';
      messages.push({
        id: 'answer-' + index,
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: formatAnswerBubbleText(answer, manualText, isTagAnswer)
      });
    });

    if (currentQuestion) {
      messages.push({
        id: 'question-' + session.questionIndex,
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: '幺',
        showQuickReplies: true,
        text: this.getQuestionBubbleText(currentQuestion, session)
      });
    }

    return messages;
  },

  buildProgressPercent(session, currentQuestion) {
    if (!currentQuestion) {
      return 100;
    }

    const totalQuestions = session.totalQuestions || this.getQuestionList(session).length || 1;
    const currentIndex = session.questionIndex || 0;

    return Math.max(8, Math.min(100, Math.round(((currentIndex + 1) / totalQuestions) * 100)));
  },

  getQuestionBubbleText(question, session) {
    if (question.id === 'mealPurpose' && !(session.answers || []).length) {
      return '这次是什么用餐场景？';
    }

    // In modify mode a grouped tag question can render only one of its groups
    // (via getVisibleTagGroupTypes). Show a prompt matching the visible group
    // so it isn't misleading — e.g. only 这次不想吃 shown under a 口味/感觉 title.
    if (question && question.kind === 'tag') {
      const visibleTypes = this.getVisibleTagGroupTypes(question);
      if (visibleTypes && visibleTypes.length) {
        const titleByType = {
          taste: '这次想吃什么口味/感觉？',
          need: '这次想吃什么口味/感觉？',
          temporaryAvoid: '这次有什么不想吃的吗？',
          avoid: '有什么忌口吗？',
          spicyLevel: '辣度有什么要求吗？'
        };
        const titles = [];
        visibleTypes.forEach(function (type) {
          const text = titleByType[type];
          if (text && titles.indexOf(text) < 0) {
            titles.push(text);
          }
        });
        if (titles.length === 1) {
          return titles[0];
        }
      }
    }

    return question.title;
  },

  formatQuestionOptions(question, selectedOptions) {
    return question.options.map(function (option) {
      return {
        value: option,
        isSelected: selectedOptions.indexOf(option) >= 0
      };
    });
  },

  formatTagGroups(question, selectedTags) {
    const visibleTypes = this.getVisibleTagGroupTypes(question);
    const groups = visibleTypes
      ? (question.groups || []).filter(function (group) {
          return visibleTypes.indexOf(group.type) >= 0;
        })
      : (question.groups || []);

    return groups.map(function (group) {
      const selectedIds = selectedTags[group.type] || [];

      return {
        title: group.title,
        type: group.type,
        mode: group.mode,
        tags: group.tags.map(function (tag) {
          return Object.assign({}, tag, {
            isSelected: selectedIds.indexOf(tag.id) >= 0
          });
        })
      };
    });
  },

  getVisibleTagGroupTypes(question) {
    const actions = this.data.prefModificationActions || [];

    if (!question || !actions.length) {
      return null;
    }

    if (question.id === 'tag-preferences') {
      const types = [];
      if (actions.indexOf('taste-feeling') >= 0) {
        types.push('taste', 'need');
      }
      if (actions.indexOf('temporary-avoid') >= 0) {
        types.push('temporaryAvoid');
      }
      return types.length ? types : null;
    }

    if (question.id === 'avoid-preferences') {
      const types = [];
      if (actions.indexOf('restriction') >= 0) {
        types.push('avoid');
      }
      if (actions.indexOf('spice') >= 0) {
        types.push('spicyLevel');
      }
      return types.length ? types : null;
    }

    return null;
  },

  jumpToQuestionById(questionId, jumpOptions) {
    if (!questionId) {
      return;
    }

    const questionList = this.getQuestionList(this.data.session);
    const targetIndex = questionList.findIndex(function (question) {
      return question.id === questionId;
    });

    if (targetIndex < 0 || targetIndex > this.data.session.questionIndex) {
      return;
    }

    if (targetIndex === this.data.session.questionIndex) {
      return;
    }

    const replayResult = this.replaySessionToIndex(targetIndex);
    const targetQuestion = foodAiAdapter.getNextQuestion(replayResult.session);

    if (!targetQuestion || targetQuestion.id !== questionId) {
      return;
    }

    const replayQuestions = this.getQuestionList(replayResult.session);
    const manualInputs = this.pruneManualInputs(this.data.manualInputs, replayQuestions, targetIndex);
    const selectionHistory = this.data.selectionHistory.slice(0, targetIndex + 1);
    const restored = selectionHistory[targetIndex] || {};
    const selectedOptions = restored.selectedOptions || [];
    const selectedTags = restored.selectedTags || this.cloneSelectedTags(emptySelectedTags);
    const manualAnswer = manualInputs[targetQuestion.id] || '';
    const restoredState = this.restoreQuestionUiState(targetQuestion, selectedOptions, selectedTags);

    const chatMessages = this.buildChatMessages(replayResult.session, targetQuestion);
    const extraMessages = this.buildAdjustmentJumpMessages(jumpOptions);

    if (extraMessages.length) {
      // Insert extraMessages before the last element (the current question bubble).
      // Written without spread-in-splice for broader WeChat runtime compatibility.
      Array.prototype.splice.apply(
        chatMessages,
        [Math.max(chatMessages.length - 1, 0), 0].concat(extraMessages)
      );
    }

    this.hasSavedCurrentRecordFlag = false;

    this.setData(Object.assign({
      session: replayResult.session,
      currentQuestion: targetQuestion,
      selectionHistory,
      answerHistory: replayResult.answerHistory,
      manualInputs,
      selectedOptions,
      selectedTags,
      manualAnswer,
      isFinished: false,
      showManualInput: true,
      chatMessages,
      slotSummaryText: this.buildSlotSummaryText(replayResult.session.slots, replayResult.session.preferences),
      summaryFields: this.buildSummaryFields(replayResult.session),
      slotItems: this.formatSlotItems(replayResult.session.slots, replayResult.session.preferences, replayResult.session.decisionSheet),
      recommendations: [],
      recommendationBatchIndex: 0,
      recommendationNotice: '',
      showAdjustmentOptions: false,
      adjustmentMessages: [],
      hasSavedCurrentRecord: false
    }, restoredState));
  },

  buildAdjustmentJumpMessages(jumpOptions) {
    const safeOptions = jumpOptions || {};
    const messages = [];

    if (safeOptions.feedbackText) {
      messages.push({
        id: 'adjustment-feedback',
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: safeOptions.feedbackText
      });
    }

    if (safeOptions.noticeText) {
      messages.push({
        id: 'adjustment-notice',
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: '幺',
        showQuickReplies: false,
        text: safeOptions.noticeText
      });
    }

    return messages;
  },

  getAdjustmentTargetQuestionId(action) {
    if (action === 'budget') {
      return this.findQuestionIdBySlot('budget');
    }

    if (action === 'distance') {
      return this.findQuestionIdBySlot('distance');
    }

    if (action === 'category') {
      return this.findBranchPreferenceQuestionId();
    }

    if (action === 'avoid') {
      return this.findQuestionIdById('avoid-preferences');
    }

    if (action === 'taste' || action === 'taste-light' || action === 'taste-heavy') {
      return this.findQuestionIdById('tag-preferences') || this.findBranchPreferenceQuestionId();
    }

    return '';
  },

  getAdjustmentNoticeText(action) {
    if (action === 'budget') {
      return '好呀，我带你回到预算这里调整一下～';
    }

    if (action === 'distance') {
      return '明白，我带你回到距离这里重新选一下～';
    }

    if (action === 'category') {
      return '好，我们回到品类偏好这里重新挑一下～';
    }

    if (action === 'avoid') {
      return '收到，我带你回到忌口这里补充清楚～';
    }

    return '好呀，我带你回到口味偏好这里调整一下～';
  },

  buildAdjustmentFromAction(action, label) {
    const adjustment = {
      action,
      text: label,
      types: ['general'],
      avoidTags: []
    };

    if (action === 'budget') {
      adjustment.types = ['cheaper'];
    } else if (action === 'distance') {
      adjustment.types = ['nearer'];
    } else if (action === 'taste') {
      adjustment.types = ['differentTaste'];
    } else if (action === 'taste-light') {
      adjustment.types = ['light'];
    } else if (action === 'taste-heavy') {
      adjustment.types = ['heavy'];
    } else if (action === 'category') {
      adjustment.types = ['category'];
    }

    return adjustment;
  },

  resolveAdjustmentFromText(text) {
    const feedbackText = String(text || '');
    const types = [];
    const avoidTags = parseAvoidTagsFromText(feedbackText);

    if (containsAnyKeyword(feedbackText, ['贵', '便宜', '预算', '价格'])) {
      types.push('cheaper');
    }

    if (containsAnyKeyword(feedbackText, ['远', '近', '距离', '走路'])) {
      types.push('nearer');
    }

    if (containsAnyKeyword(feedbackText, ['不吃', '忌口', '过敏', '香菜', '葱', '蒜'])) {
      types.push('avoid');
    }

    if (containsAnyKeyword(feedbackText, ['清淡', '少油', '轻', '不油腻'])) {
      types.push('light');
    } else if (containsAnyKeyword(feedbackText, ['重口', '香辣', '麻辣', '浓郁'])) {
      types.push('heavy');
    } else if (containsAnyKeyword(feedbackText, ['辣', '油', '口味'])) {
      types.push('differentTaste');
    }

    if (containsAnyKeyword(feedbackText, ['品类', '换个', '不想吃这个', '饭', '面', '粉', '火锅', '奶茶'])) {
      types.push('category');
    }

    return {
      action: 'manual',
      text: feedbackText,
      types: uniqueList(types.length ? types : ['general']),
      avoidTags,
      replyText: types.length
        ? '收到，我按这个方向帮你重新筛一批。'
        : '我先帮你换一批更接近这个方向的方案。'
    };
  },

  buildAdjustedPreferences(adjustment) {
    const preferences = clonePagePreferences(this.data.session.preferences);
    const types = adjustment.types || [];

    if (types.indexOf('light') >= 0) {
      addUniqueItems(preferences.tasteTags, ['清淡', '爽口']);
      addUniqueItems(preferences.needTags, ['不油腻', '轻负担']);
    }

    if (types.indexOf('heavy') >= 0) {
      addUniqueItems(preferences.tasteTags, ['香辣', '麻辣', '浓郁']);
      addUniqueItems(preferences.needTags, ['解馋', '下饭']);
    }

    if (types.indexOf('avoid') >= 0 && adjustment.avoidTags && adjustment.avoidTags.length) {
      addUniqueItems(preferences.avoidTags, adjustment.avoidTags);
      if (adjustment.avoidTags.indexOf('不吃辣') >= 0) {
        preferences.spicyLevel = '不吃辣';
      }
    }

    return preferences;
  },

  getCurrentRecommendationCategories() {
    const categories = (this.data.recommendations || []).map(function (item) {
      return item.category || item.type || '';
    }).filter(function (item) {
      return !!item;
    });

    return uniqueList(categories);
  },

  findQuestionIdById(questionId) {
    const question = this.getQuestionList(this.data.session).find(function (item) {
      return item.id === questionId;
    });

    return question ? question.id : '';
  },

  findQuestionIdBySlot(slot) {
    const question = this.getQuestionList(this.data.session).find(function (item) {
      return item.slot === slot;
    });

    return question ? question.id : '';
  },

  findBranchPreferenceQuestionId() {
    return this.findQuestionIdBySlot('branchPreference');
  },

  replaySessionToIndex(targetIndex) {
    let session = foodAiAdapter.createInitialSession();
    const answerHistory = this.data.answerHistory.slice(0, targetIndex);

    for (let index = 0; index < targetIndex; index += 1) {
      if (answerHistory[index] === undefined) {
        break;
      }
      session = foodAiAdapter.answerQuestion(session, cloneAnswerForHistory(answerHistory[index]));
    }

    return { session, answerHistory };
  },

  getQuestionList(session) {
    if (session && session.resolvedQuestions && session.resolvedQuestions.length) {
      return session.resolvedQuestions;
    }

    const currentQuestion = foodAiAdapter.getNextQuestion(session);
    return currentQuestion ? [currentQuestion] : [];
  },

  restoreQuestionUiState(question, selectedOptions, selectedTags) {
    return {
      currentOptions: (question.kind === 'choice' || question.kind === 'multi-choice')
        ? this.formatQuestionOptions(question, selectedOptions)
        : [],
      tagGroups: question.kind === 'tag'
        ? this.formatTagGroups(question, selectedTags)
        : [],
      isTagQuestion: question.kind === 'tag'
    };
  },

  pruneManualInputs(manualInputs, questions, targetIndex) {
    const nextManualInputs = {};
    const safeManualInputs = manualInputs || {};

    questions.slice(0, targetIndex + 1).forEach(function (question) {
      if (safeManualInputs[question.id] !== undefined) {
        nextManualInputs[question.id] = safeManualInputs[question.id];
      }
    });

    return nextManualInputs;
  },

  buildPreferencesFromSelectedTags(question, manualAnswer) {
    const selectedTags = this.data.selectedTags;
    const visibleTypes = this.getVisibleTagGroupTypes(question);
    const questionTypes = ((question && question.groups) || []).map(function (group) { return group.type; });
    // A field is included only if THIS question actually has a group for it
    // (and, when a visibility filter is active, that group is visible). This
    // works for both the grouped questions and the single-field modify
    // questions, so mergePreferencePatch preserves every field this question
    // does not ask about.
    const asksType = function (type) {
      if (questionTypes.indexOf(type) < 0) {
        return false;
      }
      return !visibleTypes || visibleTypes.indexOf(type) >= 0;
    };
    const tasteTags = asksType('taste') ? this.getTagLabelsForQuestion(question, 'taste', selectedTags.taste) : [];
    const needTags = asksType('need') ? this.getTagLabelsForQuestion(question, 'need', selectedTags.need) : [];
    const temporaryAvoidTags = asksType('temporaryAvoid')
      ? this.getTagLabelsForQuestion(question, 'temporaryAvoid', selectedTags.temporaryAvoid)
      : [];
    const avoidTags = asksType('avoid') ? this.getTagLabelsForQuestion(question, 'avoid', selectedTags.avoid) : [];
    const spicyLevel = asksType('spicyLevel')
      ? this.getTagLabelsForQuestion(question, 'spicyLevel', selectedTags.spicyLevel)[0] || ''
      : '';
    const manualTags = String(manualAnswer || '').split(/[、,，/ ]+/).filter(function (item) {
      return !!item;
    });
    const preferences = {};

    // Route free-text manual tags into the most relevant field this question asks.
    manualTags.forEach(function (tag) {
      if (asksType('temporaryAvoid') && !asksType('taste') && !asksType('need') && !asksType('avoid')) {
        if (temporaryAvoidTags.indexOf(tag) < 0) { temporaryAvoidTags.push(tag); }
      } else if (asksType('avoid') && !asksType('taste') && !asksType('need')) {
        if (avoidTags.indexOf(tag) < 0) { avoidTags.push(tag); }
      } else if (asksType('need')) {
        if (needTags.indexOf(tag) < 0) { needTags.push(tag); }
      } else if (asksType('taste')) {
        if (tasteTags.indexOf(tag) < 0) { tasteTags.push(tag); }
      }
    });

    if (asksType('taste')) { preferences.tasteTags = tasteTags; }
    if (asksType('need')) { preferences.needTags = needTags; }
    if (asksType('temporaryAvoid')) { preferences.temporaryAvoidTags = temporaryAvoidTags; }
    if (asksType('avoid')) { preferences.avoidTags = avoidTags; }
    if (asksType('spicyLevel')) { preferences.spicyLevel = spicyLevel || ''; }

    return preferences;
  },

  getTagLabelsForQuestion(question, type, ids) {
    const matchedGroup = ((question && question.groups) || []).find(function (group) {
      return group.type === type;
    });
    const tags = matchedGroup ? matchedGroup.tags || [] : [];
    const labels = [];

    (ids || []).forEach(function (id) {
      const matchedTag = tags.find(function (tag) {
        return tag.id === id;
      });
      const fallbackLabel = tagConfig.getLabelsByIds([id])[0] || '';
      const label = matchedTag ? matchedTag.label : fallbackLabel;
      if (label) {
        labels.push(label);
      }
    });

    return labels;
  },

  toggleAvoidTag(currentValues, tagId, selectedIndex) {
    const avoidNoneId = 'avoid_none';

    if (tagId === avoidNoneId) {
      return selectedIndex >= 0 ? [] : [avoidNoneId];
    }

    if (selectedIndex >= 0) {
      currentValues.splice(selectedIndex, 1);
      return currentValues;
    }

    return currentValues.filter(function (id) {
      return id !== avoidNoneId;
    }).concat([tagId]);
  },

  cloneSelectedTags(selectedTags) {
    return {
      taste: (selectedTags.taste || []).slice(),
      need: (selectedTags.need || []).slice(),
      temporaryAvoid: (selectedTags.temporaryAvoid || []).slice(),
      avoid: (selectedTags.avoid || []).slice(),
      spicyLevel: (selectedTags.spicyLevel || []).slice()
    };
  },

  buildSlotSummaryText(slots, preferences) {
    const summaryItems = this.buildSummaryItems(slots, preferences);
    const collectedItems = summaryItems.filter(function (item) {
      return hasUsefulSlotValue(item.value);
    });
    const missingLabels = summaryItems.filter(function (item) {
      return !hasUsefulSlotValue(item.value);
    }).map(function (item) {
      return item.label;
    });

    if (!collectedItems.length) {
      return '需求状态：已收集 0/' + summaryItems.length;
    }

    const leadValue = slots.mealPurpose || collectedItems[0].value;
    const keyMissingLabels = ['预算', '距离'].filter(function (label) {
      return missingLabels.indexOf(label) >= 0;
    });
    const visibleMissingLabels = keyMissingLabels.length ? keyMissingLabels : missingLabels.slice(0, 2);

    if (visibleMissingLabels.length) {
      return '已记下：' + leadValue + ' · 还差' + visibleMissingLabels.join('、');
    }

    return '需求状态：已收集 ' + collectedItems.length + '/' + summaryItems.length;
  },

  buildSummaryItems(slots, preferences) {
    const safePreferences = preferences || {};

    return [
      {
        label: '就餐场景',
        value: slots.mealPurpose || ''
      },
      {
        label: '就餐偏好',
        value: slots.branchPreference || ''
      },
      {
        label: '口味偏好',
        value: (safePreferences.tasteTags || []).join('、')
      },
      {
        label: '想吃感觉',
        value: (safePreferences.needTags || []).join('、')
      },
      {
        label: '这次不想吃',
        value: (safePreferences.temporaryAvoidTags || []).join('、')
      },
      {
        label: '忌口',
        value: (safePreferences.avoidTags || []).join('、')
      },
      {
        label: '辣度',
        value: safePreferences.spicyLevel || ''
      },
      {
        label: '预算',
        value: slots.budget || ''
      },
      {
        label: '距离',
        value: slots.distance || ''
      },
      {
        label: '其他补充',
        value: slots.userNotes || ''
      }
    ];
  },

  buildSummaryFields(session) {
    const slots = session.slots || {};
    const preferences = session.preferences || {};
    const manualInputs = this.data.manualInputs || {};
    const currentIndex = session.questionIndex || 0;

    return this.getQuestionList(session).map(function (question, index) {
      return buildSummaryField(
        question,
        index,
        currentIndex,
        slots,
        preferences,
        manualInputs,
        session.decisionSheet
      );
    }).filter(function (field) {
      return !!field;
    });
  },

  formatSlotItems(slots, preferences, decisionSheet) {
    const safePreferences = preferences || {};

    const items = [
      {
        label: '就餐场景',
        value: slots.mealPurpose || '待补充'
      },
      {
        label: '就餐偏好',
        value: slots.branchPreference || '待补充'
      },
      {
        label: '口味偏好',
        value: (safePreferences.tasteTags || []).join('、') || '未选择'
      },
      {
        label: '想吃感觉',
        value: (safePreferences.needTags || []).join('、') || '未选择'
      },
      {
        label: '这次不想吃',
        value: (safePreferences.temporaryAvoidTags || []).join('、') || '未选择'
      },
      {
        label: '忌口',
        value: (safePreferences.avoidTags || []).join('、') || '未选择'
      },
      {
        label: '辣度',
        value: safePreferences.spicyLevel || '未选择'
      },
      {
        label: '预算',
        value: slots.budget || '待补充'
      },
      {
        label: '距离',
        value: slots.distance || '待补充'
      },
      {
        label: '其他补充',
        value: slots.userNotes || '未填写'
      }
    ];
    const dynamicItems = decisionSheet && Array.isArray(decisionSheet.dynamic)
      ? decisionSheet.dynamic.map(function (dimension) {
          return {
            label: dimension.label || '补充偏好',
            value: dimension.value || '待补充'
          };
        })
      : [];

    return items.concat(dynamicItems);
  },

  buildPreferenceRecord(session, recommendations) {
    const slots = session.slots || {};
    const preferences = session.preferences || {};

    return {
      createdAt: new Date().toISOString(),
      mealPurpose: slots.mealPurpose || '',
      branchPreference: slots.branchPreference || '',
      tasteTags: (preferences.tasteTags || []).slice(),
      needTags: (preferences.needTags || []).slice(),
      temporaryAvoidTags: (preferences.temporaryAvoidTags || []).slice(),
      avoidTags: (preferences.avoidTags || []).slice(),
      spicyLevel: preferences.spicyLevel || '',
      budget: slots.budget || '',
      distance: slots.distance || '',
      userNotes: slots.userNotes || '',
      manualInputs: Object.assign({}, this.data.manualInputs || {}),
      summaryText: buildPreferenceRecordSummary(slots, preferences, this.data.manualInputs || {})
    };
  }
});

function formatAnswerBubbleText(answer, manualText, isTagAnswer) {
  const label = answer.label || '你的选择';
  const value = answer.value || '未选择';
  // Tag answers already have manual text merged into their structured value
  // via buildPreferencesFromSelectedTags — skip appending to avoid duplication.
  const displayValue = isTagAnswer ? value : combineWithManualNote(value, manualText);
  return label + '：' + displayValue;
}

function hasUsefulSlotValue(value) {
  return !!value && value !== '待补充' && value !== '未选择';
}

function splitPreferenceText(text) {
  return String(text || '').split(/[、,，/ ]+/).filter(function (item) {
    return !!item && item !== '都可以' && item !== '未选择';
  });
}

function formatCompactPreferenceValue(value) {
  return String(value || '').replace(/\s+/g, '');
}

function normalizeComparableText(value) {
  return String(value || '').replace(/\s+/g, '');
}

function buildConnectionStatusView(status) {
  const safeStatus = status || {};
  const state = safeStatus.state || 'checking';
  const textMap = {
    checking: '检测 OpenClaw 中',
    connected: 'OpenClaw 已连接',
    'backend-only': '后端在线 · OpenClaw 未确认',
    degraded: 'OpenClaw 推荐未返回',
    mock: '本地推荐模式',
    error: '后端未连接'
  };

  return {
    state,
    statusClass: 'status-' + state,
    text: safeStatus.text || textMap[state] || '连接状态未知',
    detail: safeStatus.detail || '',
    baseUrl: safeStatus.baseUrl || '',
    checkedAt: safeStatus.checkedAt || ''
  };
}

// Display-only helper. Combines a structured slot value with the user's free-form
// manual input as "structured；补充：manual". Submission/scoring code never goes
// through this — it only changes how bubbles, summary chips, and record summaries
// render. The substring check prevents duplication when the structured value
// already contains the manual text (e.g. tag-merged answers).
function combineWithManualNote(structuredValue, manualText) {
  const note = String(manualText || '').trim();
  if (!note) {
    return structuredValue;
  }
  if (!structuredValue || structuredValue === '未选择' || structuredValue === '待补充') {
    return note;
  }
  if (String(structuredValue).indexOf(note) >= 0) {
    return structuredValue;
  }
  return structuredValue + '；补充：' + note;
}

function buildPreferenceRecordSummary(slots, preferences, manualInputs) {
  const safePreferences = preferences || {};
  const baseTokens = [
    slots.mealPurpose,
    slots.branchPreference,
    (safePreferences.tasteTags || []).concat(safePreferences.needTags || []).join('、'),
    (safePreferences.temporaryAvoidTags || []).join('、'),
    (safePreferences.avoidTags || []).join('、'),
    safePreferences.spicyLevel,
    slots.budget,
    slots.distance,
    slots.userNotes
  ]
    .filter(function (item) { return hasUsefulSlotValue(item); });
  const safeManualInputs = manualInputs || {};
  const manualNotes = Object.keys(safeManualInputs).map(function (id) {
    return String(safeManualInputs[id] || '').trim();
  }).filter(function (text) {
    return !!text;
  });

  const baseText = baseTokens.length ? baseTokens.join(' · ') : '';
  if (manualNotes.length) {
    const notesText = manualNotes.join('；');
    return baseText ? baseText + '；补充：' + notesText : '补充：' + notesText;
  }
  return baseText || '一次吃饭偏好';
}

function buildSummaryField(question, index, currentIndex, slots, preferences, manualInputs, decisionSheet) {
  let label = '';
  let value = '';
  let isTagField = false;

  if (question.id === 'mealPurpose') {
    label = '就餐场景';
    value = slots.mealPurpose || '待补充';
  } else if (question.id === 'tag-preferences') {
    label = '口味/感觉';
    value = buildTasteSummaryValue(preferences) || '未选择';
    isTagField = true;
  } else if (question.id === 'avoid-preferences') {
    label = '忌口';
    value = buildAvoidSummaryValue(preferences) || '未选择';
    isTagField = true;
  } else if (question.id === 'user-notes') {
    label = '其他补充';
    value = slots.userNotes || '未填写';
  } else if (question.slot === 'branchPreference') {
    label = question.label || '就餐偏好';
    value = slots.branchPreference || '待补充';
  } else if (question.slot === 'budget') {
    label = '预算';
    value = slots.budget || '待补充';
  } else if (question.slot === 'distance') {
    label = '距离';
    value = slots.distance || '待补充';
  } else if (String(question.slot || '').indexOf('dynamic.') === 0) {
    label = question.label || '补充偏好';
    value = getDynamicSummaryValue(decisionSheet, question) || '待补充';
  }

  if (!label) {
    return null;
  }

  // Tag fields already have manual tokens merged structurally — skip the suffix.
  const safeManualInputs = manualInputs || {};
  const manualText = question ? (safeManualInputs[question.id] || '') : '';
  const displayValue = isTagField ? value : combineWithManualNote(value, manualText);

  const isAvailable = index <= currentIndex;
  const isCollected = hasUsefulSlotValue(displayValue);
  const stateClass = isCollected ? 'collected' : 'pending';
  const disabledClass = isAvailable ? '' : ' disabled';

  return {
    label,
    value: displayValue,
    questionId: question.id,
    questionIndex: index,
    isAvailable,
    isCollected,
    fieldClass: stateClass + disabledClass,
    rowClass: disabledClass
  };
}

function getDynamicSummaryValue(decisionSheet, question) {
  const key = String(question.targetDimension || question.slot || '').replace(/^dynamic\./, '');
  const dynamicDimensions = decisionSheet && Array.isArray(decisionSheet.dynamic)
    ? decisionSheet.dynamic
    : [];
  const matched = dynamicDimensions.find(function (dimension) {
    return dimension.key === key;
  });

  return matched ? matched.value : '';
}

function buildTasteSummaryValue(preferences) {
  const safePreferences = preferences || {};
  return (safePreferences.tasteTags || [])
    .concat(safePreferences.needTags || [])
    .concat(safePreferences.temporaryAvoidTags || [])
    .join('、');
}

function buildAvoidSummaryValue(preferences) {
  const safePreferences = preferences || {};
  const avoidText = (safePreferences.avoidTags || []).join('、');
  const spicyText = safePreferences.spicyLevel ? '辣度：' + safePreferences.spicyLevel : '';

  return [avoidText, spicyText].filter(function (item) {
    return !!item;
  }).join('，');
}

function cloneAnswerForHistory(answer) {
  if (!answer || typeof answer !== 'object') {
    return answer;
  }

  return JSON.parse(JSON.stringify(answer));
}

function areSameRecommendationIds(prevIds, nextIds) {
  if (prevIds.length !== nextIds.length) {
    return false;
  }

  return prevIds.every(function (id, index) {
    return id === nextIds[index];
  });
}

function containsAnyKeyword(text, keywords) {
  return keywords.some(function (keyword) {
    return text.indexOf(keyword) >= 0;
  });
}

function clonePagePreferences(preferences) {
  const safePreferences = preferences || {};

  return {
    tasteTags: (safePreferences.tasteTags || []).slice(),
    needTags: (safePreferences.needTags || []).slice(),
    temporaryAvoidTags: (safePreferences.temporaryAvoidTags || []).slice(),
    avoidTags: (safePreferences.avoidTags || []).slice(),
    spicyLevel: safePreferences.spicyLevel || ''
  };
}

function addUniqueItems(target, items) {
  items.forEach(function (item) {
    if (item && target.indexOf(item) < 0) {
      target.push(item);
    }
  });
}

function uniqueList(items) {
  const result = [];

  (items || []).forEach(function (item) {
    if (item && result.indexOf(item) < 0) {
      result.push(item);
    }
  });

  return result;
}

function isAuthRequiredError(error) {
  if (!error) { return false; }
  const statusCode = error.statusCode || error.status || error.code;
  if (statusCode === 401 || statusCode === '401' || statusCode === 'AUTH_REQUIRED') {
    return true;
  }
  const message = String(error.message || error.errMsg || '');
  return /AUTH_REQUIRED|Wechat login required|login required|401/i.test(message);
}

function parseAvoidTagsFromText(text) {
  const feedbackText = String(text || '');
  const avoidTags = [];

  if (containsAnyKeyword(feedbackText, ['不吃辣', '不要辣', '不能吃辣', '忌辣'])) {
    avoidTags.push('不吃辣');
  }
  if (feedbackText.indexOf('香菜') >= 0) {
    avoidTags.push('不要香菜');
  }
  if (feedbackText.indexOf('葱') >= 0 || feedbackText.indexOf('蒜') >= 0) {
    avoidTags.push('不要葱蒜');
  }
  if (feedbackText.indexOf('海鲜') >= 0) {
    avoidTags.push('不吃海鲜');
  }
  if (feedbackText.indexOf('内脏') >= 0) {
    avoidTags.push('不吃内脏');
  }
  if (feedbackText.indexOf('牛羊肉') >= 0 || feedbackText.indexOf('牛肉') >= 0 || feedbackText.indexOf('羊肉') >= 0) {
    avoidTags.push('不吃牛羊肉');
  }
  if (feedbackText.indexOf('油炸') >= 0 || feedbackText.indexOf('炸') >= 0) {
    avoidTags.push('不吃油炸');
  }

  return uniqueList(avoidTags);
}

// mealPurpose keyword → canonical option (must match one of mealPurposeQuestion.options
// in services/foodAiAdapter.js). Aliases like 轻食/减脂 collapse to the same canonical
// so they are not flagged as conflicts when the user already selected that option.
var MEAL_PURPOSE_KEYWORD_MAP = {
  '早餐': '早餐',
  '午餐': '午餐',
  '晚餐': '晚餐',
  '下午茶': '下午茶',
  '夜宵': '夜宵',
  '一个人': '一个人随便吃',
  '随便吃': '一个人随便吃',
  '随便吃点': '一个人随便吃',
  '朋友': '和朋友一起吃',
  '一起吃': '和朋友一起吃',
  '快餐': '工作日快餐',
  '工作日': '工作日快餐',
  '周末': '周末放松吃',
  '放松': '周末放松吃'
};
var MEAL_PURPOSE_KEYWORDS = Object.keys(MEAL_PURPOSE_KEYWORD_MAP);

// Returns { keyword, canonical } for the first mealPurpose keyword found in text,
// or null if none matches. keyword is the raw substring (shown in modal text);
// canonical is the option-aligned value (used for structured submission).
function detectMealPurposeFromText(text) {
  if (!text) { return null; }
  for (var i = 0; i < MEAL_PURPOSE_KEYWORDS.length; i++) {
    var kw = MEAL_PURPOSE_KEYWORDS[i];
    if (text.indexOf(kw) >= 0) {
      return { keyword: kw, canonical: MEAL_PURPOSE_KEYWORD_MAP[kw] };
    }
  }
  return null;
}

function loadFavoriteShops() {
  try {
    return wx.getStorageSync('yelema_favorite_shops') || [];
  } catch (e) {
    return [];
  }
}

function saveFavoriteShops(shops) {
  try {
    wx.setStorageSync('yelema_favorite_shops', shops || []);
  } catch (e) {}
}

function buildFavoriteShopKey(shop) {
  const name = String(shop.name || '').trim();
  const addr = String(shop.address || '').trim();
  if (addr) { return name + '|' + addr; }
  return name + '|' + String(shop.type || '').trim();
}

function isShopFavorited(shop, favorites) {
  const key = buildFavoriteShopKey(shop);
  return (favorites || []).some(function (f) {
    return buildFavoriteShopKey(f) === key;
  });
}

function buildFavoriteObject(shop) {
  const obj = { favoritedAt: new Date().toISOString() };
  if (shop.name) { obj.name = shop.name; }
  if (shop.type) { obj.type = shop.type; }
  if (shop.address) { obj.address = shop.address; }
  if (shop.perCapita !== undefined && shop.perCapita !== null && shop.perCapita !== '') {
    obj.perCapita = shop.perCapita;
  }
  if (shop.perCapitaDisplay) { obj.perCapitaDisplay = shop.perCapitaDisplay; }
  if (shop.distance) { obj.distance = shop.distance; }
  if (shop.reason) { obj.reason = shop.reason; }
  if (shop.matchedTags && shop.matchedTags.length) { obj.matchedTags = shop.matchedTags.slice(); }
  return obj;
}

function decorateWithFavoriteStatus(list) {
  const favorites = loadFavoriteShops();
  return (list || []).map(function (item) {
    return Object.assign({}, item, { isFavorited: isShopFavorited(item, favorites) });
  });
}
