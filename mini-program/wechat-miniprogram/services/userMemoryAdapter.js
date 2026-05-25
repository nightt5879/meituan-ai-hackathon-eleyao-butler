// Local storage adapter for user preference memory.
// Persists slot values and recent recommendations across sessions using
// wx.getStorageSync / wx.setStorageSync.
//
// OPENCLAW INTEGRATION POINT (module level):
// To sync memory with OpenClaw's user profile service, add an API call
// inside updateUserMemory() and saveRecommendationHistory() after the
// local wx.setStorageSync write. Local storage can remain as a cache
// so the app still works offline.

const userIdentityAdapter = require('./userIdentityAdapter');

const STORAGE_KEY = 'userMemory';
const MAX_PREFERENCE_RECORDS = 20;

// Stable long-term food preferences the user fills manually in the 管家记忆 page.
// Only these two preference fields are stored as stable memory:
//   - avoidTags  (忌口 / 过敏)
//   - spicyLevel (辣度偏好)
// Plus metadata: memoryEnabled (pause/resume), updatedAt, source.
// Nothing else (age, identity, budget, distance, categories, areas,
// chat raw text, precise location, real order history, etc.) is collected here.
const defaultStableFoodPreferences = {
  avoidTags: [],
  spicyLevel: '',
  memoryEnabled: true,
  updatedAt: '',
  source: 'user-settings'
};

// Permission switches the user toggles in the 管家记忆 page → Section 2.
// In Step 1 these settings are STORED ONLY — no behavior-learning code
// reads them yet. Future steps will gate learning on these flags.
//
// behaviorLearningEnabled is the master switch. Permission keys default on
// and can be toggled independently from the 管家记忆 page.
const defaultMemoryPermissions = {
  behaviorLearningEnabled: true,
  rememberTastePattern: true,
  rememberBudgetByMeal: true,
  rememberCommonCategories: true,
  rememberDeliveryDineInPreference: true,
  rememberDistancePreference: true,
  rememberExplorationStyle: true,
  rememberAdjustmentPatterns: true,
  rememberDiningReport: true,
  rememberFrequentArea: false,
  rememberGroupPreference: false,
  updatedAt: ''
};

// Placeholder shape for behavior-learned preferences. Step 1 does NOT
// populate any field here. Provided so consumers (and Section 3 of the
// memory page) can read a stable shape without null-checks.
const defaultLearnedFoodPreferences = {
  byMealPurpose: {
    '早餐': { delivery: {}, dineIn: {} },
    '午餐': { delivery: {}, dineIn: {} },
    '晚餐': { delivery: {}, dineIn: {} },
    '下午茶': { delivery: {}, dineIn: {} },
    '夜宵': { delivery: {}, dineIn: {} }
  },
  deliveryPreference: {},
  dineInPreference: {},
  explorationStyle: {},
  adjustmentPatterns: {},
  updatedAt: ''
};

const defaultMemory = {
  preferredTaste: '',
  commonBudget: '',
  commonDistance: '',
  preferences: {
    tasteTags: [],
    needTags: [],
    avoidTags: [],
    spicyLevel: ''
  },
  lastSlots: {
    mealPurpose: '',
    branchPreference: '',
    taste: '',
    budget: '',
    distance: '',
    people: '',
    taboo: ''
  },
  recentRecommendations: [],
  preferenceRecords: [],
  stableFoodPreferences: Object.assign({}, defaultStableFoodPreferences),
  memoryPermissions: Object.assign({}, defaultMemoryPermissions),
  learnedFoodPreferences: cloneLearnedFoodPreferences(defaultLearnedFoodPreferences),
  updatedAt: ''
};

function getUserMemory() {
  const storedMemory = wx.getStorageSync(getStorageKey()) || {};
  return Object.assign({}, defaultMemory, storedMemory, {
    preferences: Object.assign({}, defaultMemory.preferences, storedMemory.preferences || {}),
    lastSlots: Object.assign({}, defaultMemory.lastSlots, storedMemory.lastSlots || {}),
    recentRecommendations: Array.isArray(storedMemory.recentRecommendations) ? storedMemory.recentRecommendations : [],
    preferenceRecords: Array.isArray(storedMemory.preferenceRecords) ? storedMemory.preferenceRecords : [],
    stableFoodPreferences: normalizeStableFoodPreferences(storedMemory.stableFoodPreferences),
    memoryPermissions: normalizeMemoryPermissions(storedMemory.memoryPermissions),
    learnedFoodPreferences: normalizeLearnedFoodPreferences(storedMemory.learnedFoodPreferences)
  });
}

function getStorageKey() {
  const userId = userIdentityAdapter.getCurrentUserId();
  return userId ? STORAGE_KEY + ':' + userId : STORAGE_KEY + ':anonymous';
}

function normalizeStableFoodPreferences(input) {
  const safe = input || {};
  return {
    avoidTags: Array.isArray(safe.avoidTags) ? safe.avoidTags.slice() : [],
    spicyLevel: typeof safe.spicyLevel === 'string' ? safe.spicyLevel : '',
    memoryEnabled: safe.memoryEnabled === false ? false : true,
    updatedAt: safe.updatedAt || '',
    source: safe.source || 'user-settings'
  };
}

function normalizeMemoryPermissions(input) {
  const safe = input || {};
  const out = {};
  Object.keys(defaultMemoryPermissions).forEach(function (key) {
    if (key === 'updatedAt') {
      out.updatedAt = safe.updatedAt || '';
      return;
    }
    if (typeof safe[key] === 'boolean') {
      out[key] = safe[key];
    } else {
      out[key] = defaultMemoryPermissions[key];
    }
  });
  return out;
}

function normalizeLearnedFoodPreferences(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const out = cloneLearnedFoodPreferences(defaultLearnedFoodPreferences);
  // byMealPurpose: preserve any existing keys, fall back to defaults.
  if (safe.byMealPurpose && typeof safe.byMealPurpose === 'object') {
    Object.keys(out.byMealPurpose).forEach(function (mealKey) {
      if (safe.byMealPurpose[mealKey] && typeof safe.byMealPurpose[mealKey] === 'object') {
        out.byMealPurpose[mealKey] = normalizeMealPurposeLearnedPreference(safe.byMealPurpose[mealKey]);
      }
    });
  }
  ['deliveryPreference', 'dineInPreference', 'explorationStyle', 'adjustmentPatterns'].forEach(function (key) {
    if (safe[key] && typeof safe[key] === 'object') {
      out[key] = Object.assign({}, safe[key]);
    }
  });
  out.updatedAt = safe.updatedAt || '';
  return out;
}

function normalizeMealPurposeLearnedPreference(input) {
  const safe = input && typeof input === 'object' ? input : {};
  return {
    delivery: safe.delivery && typeof safe.delivery === 'object' ? Object.assign({}, safe.delivery) : {},
    dineIn: safe.dineIn && typeof safe.dineIn === 'object' ? Object.assign({}, safe.dineIn) : {}
  };
}

function cloneLearnedFoodPreferences(source) {
  return {
    byMealPurpose: {
      '早餐': normalizeMealPurposeLearnedPreference(source.byMealPurpose['早餐']),
      '午餐': normalizeMealPurposeLearnedPreference(source.byMealPurpose['午餐']),
      '晚餐': normalizeMealPurposeLearnedPreference(source.byMealPurpose['晚餐']),
      '下午茶': normalizeMealPurposeLearnedPreference(source.byMealPurpose['下午茶']),
      '夜宵': normalizeMealPurposeLearnedPreference(source.byMealPurpose['夜宵'])
    },
    deliveryPreference: Object.assign({}, source.deliveryPreference),
    dineInPreference: Object.assign({}, source.dineInPreference),
    explorationStyle: Object.assign({}, source.explorationStyle),
    adjustmentPatterns: Object.assign({}, source.adjustmentPatterns),
    updatedAt: source.updatedAt || ''
  };
}

function isStableFoodMemoryEnabled(memory) {
  const safeMemory = memory || getUserMemory();
  const stablePreferences = normalizeStableFoodPreferences(safeMemory.stableFoodPreferences);
  return stablePreferences.memoryEnabled !== false;
}

function getBehaviorProfilePermissions(memory) {
  const safeMemory = memory || getUserMemory();
  const permissions = normalizeMemoryPermissions(safeMemory.memoryPermissions);
  const enabled = permissions.behaviorLearningEnabled !== false;

  return {
    enabled,
    taste: enabled && permissions.rememberTastePattern !== false,
    budget: enabled && permissions.rememberBudgetByMeal !== false,
    distance: enabled && permissions.rememberDistancePreference !== false,
    category: enabled && permissions.rememberCommonCategories !== false,
    diningMode: enabled && permissions.rememberDeliveryDineInPreference !== false,
    exploration: enabled && permissions.rememberExplorationStyle !== false,
    adjustment: enabled && permissions.rememberAdjustmentPatterns !== false,
    report: enabled && permissions.rememberDiningReport !== false
  };
}

function canUseBehaviorPreferenceProfile(memory) {
  const gates = getBehaviorProfilePermissions(memory);
  return !!(
    gates.enabled &&
    (gates.taste || gates.budget || gates.distance || gates.category ||
      gates.diningMode || gates.exploration || gates.adjustment)
  );
}

function canRememberPreferenceRecords(memory) {
  return canUseBehaviorPreferenceProfile(memory);
}

function canRememberRecommendationHistory(memory) {
  const gates = getBehaviorProfilePermissions(memory);
  return gates.enabled && gates.report;
}

function buildProfileFromBehaviorSource(source, gates, sourceName) {
  const safeSource = source || {};
  const safeGates = gates || getBehaviorProfilePermissions();
  const tasteTags = safeGates.taste ? (safeSource.tasteTags || []).slice() : [];
  const needTags = safeGates.taste ? (safeSource.needTags || []).slice() : [];

  return {
    taste: safeGates.taste
      ? (safeSource.taste || tasteTags.concat(needTags).join('、') || '')
      : '',
    tasteTags,
    needTags,
    avoidTags: safeGates.taste ? (safeSource.avoidTags || []).slice() : [],
    spicyLevel: safeGates.taste ? (safeSource.spicyLevel || '') : '',
    budget: safeGates.budget ? (safeSource.budget || '') : '',
    distance: safeGates.distance ? (safeSource.distance || '') : '',
    source: sourceName
  };
}

function buildStablePreferenceProfile(stablePreferences) {
  const stable = normalizeStableFoodPreferences(stablePreferences);
  return {
    taste: '',
    tasteTags: [],
    needTags: [],
    avoidTags: normalizeAvoidTagsForRecommendation(stable.avoidTags),
    spicyLevel: stable.spicyLevel || '',
    budget: '',
    distance: '',
    source: 'stable'
  };
}

function buildLongTermPreferenceProfile(memory, stablePreferences) {
  const safeMemory = memory || getUserMemory();
  const prefs = safeMemory.preferences || {};
  const slots = safeMemory.lastSlots || {};
  const stable = normalizeStableFoodPreferences(stablePreferences || safeMemory.stableFoodPreferences);
  const stableAvoidTags = normalizeAvoidTagsForRecommendation(stable.avoidTags);
  const stableSpicyLevel = stable.spicyLevel || '';
  const hasLongTermMemory = !!(
    safeMemory.preferredTaste ||
    safeMemory.commonBudget ||
    safeMemory.commonDistance ||
    (prefs.tasteTags || []).length ||
    (prefs.needTags || []).length ||
    (prefs.avoidTags || []).length ||
    prefs.spicyLevel ||
    slots.budget ||
    slots.distance
  );

  if (!hasLongTermMemory) {
    return null;
  }

  return {
    taste: (prefs.tasteTags || []).concat(prefs.needTags || []).join('、') || safeMemory.preferredTaste || '',
    tasteTags: (prefs.tasteTags || []).slice(),
    needTags: (prefs.needTags || []).slice(),
    avoidTags: stableAvoidTags.length ? stableAvoidTags : (prefs.avoidTags || []).slice(),
    spicyLevel: stableSpicyLevel || prefs.spicyLevel || '',
    budget: slots.budget || safeMemory.commonBudget || '',
    distance: slots.distance || safeMemory.commonDistance || '',
    source: 'memory'
  };
}

function normalizeAvoidTagsForRecommendation(avoidTags) {
  const tagMap = {
    '香菜': '不要香菜',
    '葱蒜': '不要葱蒜',
    '海鲜': '不吃海鲜',
    '牛羊肉': '不吃牛羊肉',
    '油炸': '不吃油炸',
    '辣': '不吃辣',
    '无': '',
    '没有忌口': ''
  };
  const result = [];

  (avoidTags || []).forEach(function (tag) {
    const normalizedTag = tagMap[tag] !== undefined ? tagMap[tag] : tag;
    if (normalizedTag && result.indexOf(normalizedTag) < 0) {
      result.push(normalizedTag);
    }
  });

  return result;
}

// OPENCLAW INTEGRATION POINT:
// After wx.setStorageSync, call the OpenClaw user profile API to persist
// the updated slots remotely, e.g.: OpenClaw.updateProfile({ slots: nextMemory.lastSlots })
function updateUserMemory(answerOrSlots) {
  const payload = answerOrSlots || {};
  const slots = payload.slots || payload;
  const preferences = payload.preferences || {};
  const currentMemory = getUserMemory();
  const nextPreferences = Object.assign({}, currentMemory.preferences, {
    tasteTags: preferences.tasteTags || currentMemory.preferences.tasteTags,
    needTags: preferences.needTags || currentMemory.preferences.needTags,
    avoidTags: preferences.avoidTags || currentMemory.preferences.avoidTags,
    spicyLevel: preferences.spicyLevel || currentMemory.preferences.spicyLevel
  });
  const nextMemory = Object.assign({}, currentMemory, {
    preferredTaste: nextPreferences.tasteTags.concat(nextPreferences.needTags).join('、') || slots.taste || currentMemory.preferredTaste,
    commonBudget: slots.budget || currentMemory.commonBudget,
    commonDistance: slots.distance || currentMemory.commonDistance,
    preferences: nextPreferences,
    lastSlots: Object.assign({}, currentMemory.lastSlots, {
      mealPurpose: slots.mealPurpose || currentMemory.lastSlots.mealPurpose,
      branchPreference: slots.branchPreference || currentMemory.lastSlots.branchPreference,
      taste: slots.taste || currentMemory.lastSlots.taste,
      budget: slots.budget || currentMemory.lastSlots.budget,
      distance: slots.distance || currentMemory.lastSlots.distance,
      people: slots.people || currentMemory.lastSlots.people,
      taboo: slots.taboo || currentMemory.lastSlots.taboo
    }),
    updatedAt: new Date().toISOString()
  });

  wx.setStorageSync(getStorageKey(), nextMemory);
  return nextMemory;
}

function saveRecommendationHistory(recommendations) {
  const currentMemory = getUserMemory();

  if (!canRememberRecommendationHistory(currentMemory)) {
    return currentMemory;
  }

  const nextMemory = Object.assign({}, currentMemory, {
    recentRecommendations: (recommendations || []).slice(0, 3),
    updatedAt: new Date().toISOString()
  });

  wx.setStorageSync(getStorageKey(), nextMemory);
  return nextMemory;
}

function savePreferenceRecord(record, options) {
  const opts = options || {};
  const currentMemory = getUserMemory();

  if (!opts.force && !canRememberPreferenceRecords(currentMemory)) {
    return null;
  }

  const nextRecord = normalizePreferenceRecord(record);
  const nextRecords = [nextRecord]
    .concat(currentMemory.preferenceRecords || [])
    .slice(0, MAX_PREFERENCE_RECORDS);
  const nextMemory = Object.assign({}, currentMemory, {
    preferenceRecords: nextRecords,
    updatedAt: nextRecord.createdAt
  });

  wx.setStorageSync(getStorageKey(), nextMemory);
  return nextRecord;
}

function getPreferenceRecords() {
  const records = getUserMemory().preferenceRecords;
  return Array.isArray(records) ? records : [];
}

function clearPreferenceRecords() {
  const currentMemory = getUserMemory();
  const nextMemory = Object.assign({}, currentMemory, {
    preferenceRecords: [],
    updatedAt: new Date().toISOString()
  });

  wx.setStorageSync(getStorageKey(), nextMemory);
  return nextMemory;
}

function hasUserMemory(memory) {
  const safeMemory = memory || getUserMemory();
  const preferences = safeMemory.preferences || defaultMemory.preferences;
  const lastSlots = safeMemory.lastSlots || defaultMemory.lastSlots;
  const recentRecommendations = Array.isArray(safeMemory.recentRecommendations) ? safeMemory.recentRecommendations : [];
  const preferenceRecords = Array.isArray(safeMemory.preferenceRecords) ? safeMemory.preferenceRecords : [];

  return !!(
    safeMemory.preferredTaste ||
    safeMemory.commonBudget ||
    safeMemory.commonDistance ||
    (preferences.tasteTags || []).length ||
    (preferences.needTags || []).length ||
    (preferences.avoidTags || []).length ||
    preferences.spicyLevel ||
    lastSlots.mealPurpose ||
    lastSlots.branchPreference ||
    lastSlots.taste ||
    lastSlots.budget ||
    lastSlots.distance ||
    lastSlots.people ||
    lastSlots.taboo ||
    recentRecommendations.length ||
    preferenceRecords.length
  );
}

function getLastChoiceForSlot(slot, memory) {
  const safeMemory = memory || getUserMemory();
  const lastSlots = safeMemory.lastSlots || {};

  if (lastSlots[slot]) {
    return lastSlots[slot];
  }

  if (slot === 'taste') {
    return safeMemory.preferredTaste;
  }

  if (slot === 'budget') {
    return safeMemory.commonBudget;
  }

  if (slot === 'distance') {
    return safeMemory.commonDistance;
  }

  return '';
}

function normalizePreferenceRecord(record) {
  const safeRecord = record || {};
  const createdAt = safeRecord.createdAt || new Date().toISOString();

  return {
    id: safeRecord.id || ('record_' + Date.now() + '_' + Math.floor(Math.random() * 10000)),
    createdAt: createdAt,
    mealPurpose: safeRecord.mealPurpose || '',
    branchPreference: safeRecord.branchPreference || '',
    tasteTags: (safeRecord.tasteTags || []).slice(),
    needTags: (safeRecord.needTags || []).slice(),
    avoidTags: (safeRecord.avoidTags || []).slice(),
    spicyLevel: safeRecord.spicyLevel || '',
    budget: safeRecord.budget || '',
    distance: safeRecord.distance || '',
    manualInputs: Object.assign({}, safeRecord.manualInputs || {}),
    recommendations: normalizeRecordRecommendations(safeRecord.recommendations),
    summaryText: safeRecord.summaryText || buildRecordSummaryText(safeRecord)
  };
}

function normalizeRecordRecommendations(recommendations) {
  return (recommendations || []).slice(0, 3).map(function (item) {
    return {
      id: item.id || '',
      name: item.name || '',
      type: item.type || item.category || '',
      price: item.price || item.perCapita || '',
      distanceText: item.distanceText || item.distance || '',
      distanceMeters: item.distanceMeters || ''
    };
  });
}

function buildRecordSummaryText(record) {
  return [
    record.mealPurpose,
    record.branchPreference,
    record.budget,
    record.distance
  ].filter(function (item) {
    return !!item && item !== '未选择';
  }).join(' · ') || '一次吃饭偏好';
}

// ─── V0 preference profile (for the food-flow preference pre-check) ───────
//
// This profile is what the butler reads when deciding whether to ask
// "今天也按这个来吗？" at the start of the 今天吃什么 flow.
//
// Priority order inside getEffectivePreferenceProfile():
//   1. Real long-term memory (only written when user taps "记住这个偏好")
//   2. Stable settings from the 管家记忆 page (avoidTags + spicyLevel)
//   3. The most-recent preferenceRecord, only when behavior-learning permission allows it
//   4. The V0 mock profile below (so the feature is testable on a fresh install)
//
// IMPORTANT:
// - The mock profile is V0/demo only. Real Meituan-style data integration
//   would require explicit user authorisation. The food page surfaces a
//   disclaimer in the butler bubble whenever this fallback is used.
// - To disable the mock fallback (e.g. for production), call
//   getEffectivePreferenceProfile({ useMock: false }).
// - Choosing to reuse this profile for the current session NEVER writes
//   anything to long-term memory. Long-term memory only changes when the
//   user explicitly taps "记住这个偏好" after the recommendation step.
const MOCK_PREFERENCE_PROFILE = {
  taste: '清淡',
  tasteTags: ['清淡'],
  needTags: ['不油腻'],
  avoidTags: [],
  spicyLevel: '',
  budget: '30-60 元',
  distance: '1 公里以内',
  source: 'mock'
};

function getEffectivePreferenceProfile(options) {
  const opts = options || {};
  const useMock = opts.useMock !== false;
  const memory = getUserMemory();
  const stablePreferences = normalizeStableFoodPreferences(memory.stableFoodPreferences);

  if (!isStableFoodMemoryEnabled(memory)) {
    return null;
  }

  // 1) Explicit long-term memory.
  const longTermProfile = buildLongTermPreferenceProfile(memory, stablePreferences);
  if (hasUsefulPreferenceProfile(longTermProfile)) {
    return longTermProfile;
  }

  // 2) User-managed stable settings from the memory page.
  const stableProfile = buildStablePreferenceProfile(stablePreferences);
  if (hasUsefulPreferenceProfile(stableProfile)) {
    return stableProfile;
  }

  if (!canUseBehaviorPreferenceProfile(memory)) {
    return null;
  }

  const behaviorGates = getBehaviorProfilePermissions(memory);

  // 3) Most-recent completed session, only through authorized behavior memory.
  const records = Array.isArray(memory.preferenceRecords) ? memory.preferenceRecords : [];
  if (records.length) {
    const recordProfile = buildProfileFromBehaviorSource(records[0], behaviorGates, 'record');
    if (hasUsefulPreferenceProfile(recordProfile)) {
      return recordProfile;
    }
  }

  // 4) V0 mock fallback (disable with { useMock: false }).
  if (!useMock) {
    return null;
  }

  const mockProfile = buildProfileFromBehaviorSource(MOCK_PREFERENCE_PROFILE, behaviorGates, 'mock');
  return hasUsefulPreferenceProfile(mockProfile) ? mockProfile : null;
}

function hasUsefulPreferenceProfile(profile) {
  if (!profile) { return false; }
  return !!(
    profile.taste ||
    profile.budget ||
    profile.distance ||
    (profile.tasteTags || []).length ||
    (profile.needTags || []).length ||
    (profile.avoidTags || []).length ||
    profile.spicyLevel
  );
}

// ─── Stable food preferences (管家记忆 page) ───────────────────────────────
//
// User-controlled long-term preference data, written ONLY by the
// 管家记忆 page. Read-only consumers should call getStableFoodPreferences().
// The food flow reads it through getEffectivePreferenceProfile() only while
// memoryEnabled is on.

function getStableFoodPreferences() {
  const memory = getUserMemory();
  return normalizeStableFoodPreferences(memory.stableFoodPreferences);
}

function saveStableFoodPreferences(preferences) {
  const incoming = preferences || {};
  const currentMemory = getUserMemory();
  const current = currentMemory.stableFoodPreferences || defaultStableFoodPreferences;
  const next = normalizeStableFoodPreferences({
    avoidTags: incoming.avoidTags !== undefined ? incoming.avoidTags : current.avoidTags,
    spicyLevel: incoming.spicyLevel !== undefined ? incoming.spicyLevel : current.spicyLevel,
    memoryEnabled: incoming.memoryEnabled !== undefined ? incoming.memoryEnabled : current.memoryEnabled,
    source: incoming.source || current.source || 'user-settings',
    updatedAt: new Date().toISOString()
  });
  const nextMemory = Object.assign({}, currentMemory, {
    stableFoodPreferences: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

function clearStableFoodPreferences() {
  const currentMemory = getUserMemory();
  const current = currentMemory.stableFoodPreferences || defaultStableFoodPreferences;
  // Clears the user-fillable fields only. memoryEnabled is preserved so a
  // paused user who clears does NOT accidentally re-enable memory.
  const next = normalizeStableFoodPreferences({
    avoidTags: [],
    spicyLevel: '',
    memoryEnabled: current.memoryEnabled,
    source: current.source || 'user-settings',
    updatedAt: new Date().toISOString()
  });
  const nextMemory = Object.assign({}, currentMemory, {
    stableFoodPreferences: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

function pauseStableFoodMemory() {
  return setStableFoodMemoryEnabled(false);
}

function resumeStableFoodMemory() {
  return setStableFoodMemoryEnabled(true);
}

function setStableFoodMemoryEnabled(enabled) {
  const currentMemory = getUserMemory();
  const current = currentMemory.stableFoodPreferences || defaultStableFoodPreferences;
  const next = normalizeStableFoodPreferences(Object.assign({}, current, {
    memoryEnabled: !!enabled,
    updatedAt: new Date().toISOString()
  }));
  const nextMemory = Object.assign({}, currentMemory, {
    stableFoodPreferences: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

// ─── Memory permissions (管家记忆 → Section 2: 允许管家记住) ───────────────
//
// Toggles that authorize what the butler is ALLOWED to learn from behavior.
// Step 1: storage only. No learning code reads these yet.

function getMemoryPermissions() {
  const memory = getUserMemory();
  return normalizeMemoryPermissions(memory.memoryPermissions);
}

function saveMemoryPermissions(permissions) {
  const incoming = permissions || {};
  const currentMemory = getUserMemory();
  const current = currentMemory.memoryPermissions || defaultMemoryPermissions;
  const merged = {};
  Object.keys(defaultMemoryPermissions).forEach(function (key) {
    if (key === 'updatedAt') { return; }
    if (typeof incoming[key] === 'boolean') {
      merged[key] = incoming[key];
    } else {
      merged[key] = current[key];
    }
  });
  merged.updatedAt = new Date().toISOString();
  const next = normalizeMemoryPermissions(merged);
  const nextMemory = Object.assign({}, currentMemory, {
    memoryPermissions: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

function resetMemoryPermissions() {
  const currentMemory = getUserMemory();
  const next = normalizeMemoryPermissions(Object.assign({}, defaultMemoryPermissions, {
    updatedAt: new Date().toISOString()
  }));
  const nextMemory = Object.assign({}, currentMemory, {
    memoryPermissions: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

// ─── Learned food preferences (管家记忆 → Section 3: 管家从使用中学到的) ───
//
// Reader returns the placeholder shape in Step 1 (no learning yet).
// The clear method exists so users can wipe behavior-learned data on demand
// — it is a no-op visually in Step 1 but the affordance is always present.

function getLearnedFoodPreferences() {
  const memory = getUserMemory();
  return normalizeLearnedFoodPreferences(memory.learnedFoodPreferences);
}

function clearLearnedFoodPreferences() {
  const currentMemory = getUserMemory();
  const next = cloneLearnedFoodPreferences(defaultLearnedFoodPreferences);
  next.updatedAt = new Date().toISOString();
  const nextMemory = Object.assign({}, currentMemory, {
    learnedFoodPreferences: next,
    updatedAt: next.updatedAt
  });
  wx.setStorageSync(getStorageKey(), nextMemory);
  return next;
}

module.exports = {
  STORAGE_KEY,
  getStorageKey,
  getUserMemory,
  updateUserMemory,
  saveRecommendationHistory,
  savePreferenceRecord,
  getPreferenceRecords,
  clearPreferenceRecords,
  hasUserMemory,
  getLastChoiceForSlot,
  MOCK_PREFERENCE_PROFILE,
  getEffectivePreferenceProfile,
  hasUsefulPreferenceProfile,
  getStableFoodPreferences,
  saveStableFoodPreferences,
  clearStableFoodPreferences,
  pauseStableFoodMemory,
  resumeStableFoodMemory,
  getMemoryPermissions,
  saveMemoryPermissions,
  resetMemoryPermissions,
  getLearnedFoodPreferences,
  clearLearnedFoodPreferences
};
