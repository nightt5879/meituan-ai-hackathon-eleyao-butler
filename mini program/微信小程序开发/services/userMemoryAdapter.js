// Local storage adapter for user preference memory.
// Persists slot values and recent recommendations across sessions using
// wx.getStorageSync / wx.setStorageSync.
//
// OPENCLAW INTEGRATION POINT (module level):
// To sync memory with OpenClaw's user profile service, add an API call
// inside updateUserMemory() and saveRecommendationHistory() after the
// local wx.setStorageSync write. Local storage can remain as a cache
// so the app still works offline.

const STORAGE_KEY = 'userMemory';
const MAX_PREFERENCE_RECORDS = 20;

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
  updatedAt: ''
};

function getUserMemory() {
  const storedMemory = wx.getStorageSync(STORAGE_KEY) || {};
  return Object.assign({}, defaultMemory, storedMemory, {
    preferences: Object.assign({}, defaultMemory.preferences, storedMemory.preferences || {}),
    lastSlots: Object.assign({}, defaultMemory.lastSlots, storedMemory.lastSlots || {}),
    recentRecommendations: Array.isArray(storedMemory.recentRecommendations) ? storedMemory.recentRecommendations : [],
    preferenceRecords: Array.isArray(storedMemory.preferenceRecords) ? storedMemory.preferenceRecords : []
  });
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

  wx.setStorageSync(STORAGE_KEY, nextMemory);
  return nextMemory;
}

function saveRecommendationHistory(recommendations) {
  const currentMemory = getUserMemory();
  const nextMemory = Object.assign({}, currentMemory, {
    recentRecommendations: (recommendations || []).slice(0, 3),
    updatedAt: new Date().toISOString()
  });

  wx.setStorageSync(STORAGE_KEY, nextMemory);
  return nextMemory;
}

function savePreferenceRecord(record) {
  const currentMemory = getUserMemory();
  const nextRecord = normalizePreferenceRecord(record);
  const nextRecords = [nextRecord]
    .concat(currentMemory.preferenceRecords || [])
    .slice(0, MAX_PREFERENCE_RECORDS);
  const nextMemory = Object.assign({}, currentMemory, {
    preferenceRecords: nextRecords,
    updatedAt: nextRecord.createdAt
  });

  wx.setStorageSync(STORAGE_KEY, nextMemory);
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

  wx.setStorageSync(STORAGE_KEY, nextMemory);
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

module.exports = {
  STORAGE_KEY,
  getUserMemory,
  updateUserMemory,
  saveRecommendationHistory,
  savePreferenceRecord,
  getPreferenceRecords,
  clearPreferenceRecords,
  hasUserMemory,
  getLastChoiceForSlot
};
