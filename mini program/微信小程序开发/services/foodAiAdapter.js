// Mock adapter for the "今天吃什么" question flow and shop recommendations.
// All logic here is self-contained and uses local mock data.
//
// OPENCLAW INTEGRATION POINT (module level):
// To connect OpenClaw, replace this file with an OpenClaw adapter that
// implements the same exported interface:
//   createInitialSession()
//   getNextQuestion(session)
//   answerQuestion(session, answer)
//   generateRecommendations(slots, preferences)
// The page layer (pages/food/food.js) calls only these four functions
// and does not need to change when the adapter is swapped.

const tagConfig = require('../data/tasteTags');
const mockShopData = require('../data/mockShops');

const defaultPreferences = {
  tasteTags: [],
  needTags: [],
  avoidTags: [],
  spicyLevel: ''
};

// ─── Question Definitions ──────────────────────────────────────────────────

const mealPurposeQuestion = {
  id: 'mealPurpose',
  kind: 'choice',
  slot: 'mealPurpose',
  label: '就餐场景',
  title: '这次你想解决什么吃饭场景？',
  options: ['早餐', '午餐', '晚餐', '下午茶', '夜宵', '随便吃点', '轻食/减脂', '没想法']
};

// Shared tag question reused by 午餐 and 晚餐 branches.
const tasteNeedQuestion = {
  id: 'tag-preferences',
  kind: 'tag',
  label: '口味/感觉',
  title: '今天想吃什么口味/感觉？',
  allowEmpty: true,
  groups: [
    {
      title: '口味偏好',
      type: 'taste',
      mode: 'multiple',
      tags: tagConfig.getTagsByType('taste')
    },
    {
      title: '当前想吃的感觉',
      type: 'need',
      mode: 'multiple',
      tags: tagConfig.getTagsByType('need')
    }
  ]
};

const cuisineQuestion = {
  id: 'cuisine-type',
  kind: 'multi-choice',
  slot: 'branchPreference',
  label: '菜系偏好',
  title: '想吃哪类菜？',
  allowEmpty: true,
  options: ['都可以', '中式简餐', '家常菜', '粉面', '米饭套餐', '火锅/冒菜', '麻辣烫', '烧烤/炸物', '西餐', '日料', '韩餐', '东南亚菜', '轻食']
};

// Branch-specific questions keyed by mealPurpose value.
// '没想法' has no branch questions — goes straight to common questions.
const branchQuestionsMap = {
  '早餐': [
    {
      id: 'breakfast-type',
      kind: 'multi-choice',
      slot: 'branchPreference',
      label: '早餐类型',
      title: '早餐想吃哪一类？',
      allowEmpty: true,
      options: ['都可以', '包子/点心', '粥', '面条/粉', '三明治', '咖啡', '豆浆', '轻食']
    }
  ],
  '午餐': [tasteNeedQuestion, cuisineQuestion],
  '晚餐': [tasteNeedQuestion, cuisineQuestion],
  '下午茶': [
    {
      id: 'afternoon-tea-type',
      kind: 'multi-choice',
      slot: 'branchPreference',
      label: '下午茶类型',
      title: '下午茶想来点什么？',
      allowEmpty: true,
      options: ['都可以', '咖啡', '奶茶', '甜品', '面包/烘焙', '轻食', '水果/酸奶']
    }
  ],
  '夜宵': [
    {
      id: 'supper-type',
      kind: 'multi-choice',
      slot: 'branchPreference',
      label: '夜宵类型',
      title: '夜宵想吃哪一类？',
      allowEmpty: true,
      options: ['都可以', '烧烤', '炸串/炸鸡', '粉面', '麻辣烫', '小吃', '甜品', '粥']
    }
  ],
  '随便吃点': [
    {
      id: 'casual-preference',
      kind: 'multi-choice',
      slot: 'branchPreference',
      label: '就餐偏好',
      title: '更希望这顿饭怎么样？',
      allowEmpty: true,
      options: ['都可以', '近一点', '便宜一点', '快一点', '清淡点', '管饱', '不油腻']
    }
  ],
  '轻食/减脂': [
    {
      id: 'light-meal-type',
      kind: 'multi-choice',
      slot: 'branchPreference',
      label: '轻食偏向',
      title: '轻食/减脂更偏向什么？',
      allowEmpty: true,
      options: ['都可以', '沙拉', '粥', '高蛋白', '少油少盐', '不油腻', '轻负担', '清淡']
    }
  ],
  '没想法': []
};

// Common questions appended to every branch.
const avoidQuestion = {
  id: 'avoid-preferences',
  kind: 'tag',
  label: '忌口/辣度',
  title: '有什么不吃的吗？',
  optional: true,
  allowEmpty: true,
  groups: [
    {
      title: '忌口/不想吃',
      type: 'avoid',
      mode: 'multiple',
      tags: tagConfig.getTagsByType('avoid')
    },
    {
      title: '辣度偏好',
      type: 'spicyLevel',
      mode: 'single',
      tags: tagConfig.getTagsByType('spicyLevel')
    }
  ]
};

const budgetOptionsByMealPurpose = {
  '早餐': ['10 元以内', '10-20 元', '20-30 元', '30 元以上'],
  '午餐': ['20 元以内', '20-40 元', '40-60 元', '60 元以上'],
  '晚餐': ['30 元以内', '30-60 元', '60-100 元', '100 元以上'],
  '下午茶': ['15 元以内', '15-30 元', '30-50 元', '50 元以上'],
  '夜宵': ['20 元以内', '20-40 元', '40-70 元', '70 元以上'],
  '随便吃点': ['15 元以内', '15-30 元', '30-50 元', '50 元以上'],
  '轻食/减脂': ['20 元以内', '20-40 元', '40-70 元', '70 元以上'],
  '没想法': ['20 元以内', '20-40 元', '40-70 元', '预算不重要']
};

const distanceQuestion = {
  id: 'distance',
  kind: 'choice',
  slot: 'distance',
  label: '想走多远',
  title: '想走多远？',
  options: ['500 米以内', '1 公里以内', '2 公里以内', '远一点也行']
};

function createBudgetQuestion(mealPurpose) {
  return {
    id: 'budget',
    kind: 'choice',
    slot: 'budget',
    label: '预算多少',
    title: '预算大概多少？',
    options: budgetOptionsByMealPurpose[mealPurpose] || budgetOptionsByMealPurpose['晚餐']
  };
}

// ─── Session Management ────────────────────────────────────────────────────

// Builds the full ordered question list for a given mealPurpose value.
// totalQuestions is always resolvedQuestions.length — never manually counted.
function resolveBranchQuestions(mealPurpose) {
  var branchQs = branchQuestionsMap[mealPurpose] || [];
  var skipAvoid = mealPurpose === '早餐' || mealPurpose === '下午茶';
  var budgetQuestion = createBudgetQuestion(mealPurpose);
  var trailingQs = skipAvoid ? [budgetQuestion, distanceQuestion] : [avoidQuestion, budgetQuestion, distanceQuestion];
  return [mealPurposeQuestion].concat(branchQs).concat(trailingQs);
}

function createInitialSession() {
  return {
    questionIndex: 0,
    resolvedQuestions: null,  // populated after mealPurpose is answered
    totalQuestions: null,     // populated after branch is resolved
    slots: {
      mealPurpose: '',
      branchPreference: '',
      taste: '',
      budget: '',
      distance: '',
      taboo: ''
    },
    preferences: clonePreferences(defaultPreferences),
    answers: []
  };
}

// OPENCLAW INTEGRATION POINT:
// Replace this function with an OpenClaw API call that returns the next
// question based on the conversation context. The returned object must
// include at minimum: { id, kind, title } and optionally { options, groups }.
function getNextQuestion(session) {
  if (!session) { return null; }

  // resolvedQuestions is null until mealPurpose is answered — only Q0 is available.
  if (!session.resolvedQuestions) {
    return session.questionIndex === 0 ? mealPurposeQuestion : null;
  }

  if (session.questionIndex >= session.resolvedQuestions.length) { return null; }
  return session.resolvedQuestions[session.questionIndex];
}

// OPENCLAW INTEGRATION POINT:
// Replace this function with an OpenClaw API call that sends the user's
// answer and receives an updated session (next question index, extracted
// slots, and inferred preferences). The returned session shape must be
// compatible with what getNextQuestion() and generateRecommendations() expect.
function answerQuestion(session, answer) {
  var currentQuestion = getNextQuestion(session);
  if (!currentQuestion) { return session; }

  var nextSession;
  if (currentQuestion.kind === 'tag') {
    nextSession = answerTagQuestion(session, currentQuestion, answer);
  } else {
    nextSession = answerChoiceQuestion(session, currentQuestion, answer);
  }

  // If session did not advance (empty answer on a required question), return unchanged.
  if (nextSession === session) { return session; }

  // After mealPurpose is answered, resolve the full branch question list.
  // Clear any stale branch-specific slots and preferences so old answers
  // from a prior branch do not leak into recommendations when mealPurpose changes.
  if (currentQuestion.id === 'mealPurpose') {
    var resolved = resolveBranchQuestions(nextSession.slots.mealPurpose);
    var clearedSlots = Object.assign({}, nextSession.slots, {
      branchPreference: '',
      taste: '',
      taboo: ''
    });
    return Object.assign({}, nextSession, {
      slots: clearedSlots,
      preferences: clonePreferences(defaultPreferences),
      resolvedQuestions: resolved,
      totalQuestions: resolved.length
    });
  }

  // Carry forward resolvedQuestions and totalQuestions for all subsequent answers.
  return Object.assign({}, nextSession, {
    resolvedQuestions: session.resolvedQuestions,
    totalQuestions: session.totalQuestions
  });
}

function answerTagQuestion(session, question, answer) {
  const answerPreferences = normalizePreferences(answer && answer.preferences);
  const nextPreferences = Object.assign(clonePreferences(session.preferences), answerPreferences);
  const nextSlots = Object.assign({}, session.slots, {
    taste: buildTasteSlot(nextPreferences),
    taboo: buildAvoidSlot(nextPreferences)
  });
  const value = buildTagAnswerText(question, answerPreferences);

  return advanceSession(session, nextSlots, nextPreferences, {
    slot: question.id,
    label: question.label,
    value: value || '未选择'
  });
}

function answerChoiceQuestion(session, question, answer) {
  const value = String(answer || '').trim();

  if (!value) {
    return session;
  }

  const nextSlots = Object.assign({}, session.slots);
  nextSlots[question.slot] = value;

  return advanceSession(session, nextSlots, session.preferences, {
    slot: question.slot,
    label: question.label,
    value: value
  });
}

function advanceSession(session, slots, preferences, answerRecord) {
  return {
    questionIndex: session.questionIndex + 1,
    slots: slots,
    preferences: clonePreferences(preferences),
    answers: session.answers.concat([answerRecord])
  };
}

// ─── Recommendations ───────────────────────────────────────────────────────

// OPENCLAW INTEGRATION POINT:
// Replace this function with an OpenClaw API call that sends slots and
// preferences to the recommendation engine and returns a list of shop
// objects. Each object must include: { id, name, type, perCapita, distance,
// rating, matchedTags, matchedTagsText, reason, riskTip }.
// Note: preferences is passed separately from slots because tag-based
// preferences (taste, need, avoid, spicyLevel) are collected via a
// dedicated tag UI step and are not stored as plain slot strings.
function generateRecommendations(slots, preferences, options) {
  const safeSlots = slots || {};
  const safePreferences = normalizePreferences(preferences);
  const safeOptions = options || {};
  const excludeIds = safeOptions.excludeIds || [];
  const eligibleShops = getEligibleShops(safePreferences);
  const scoredShops = eligibleShops
    .map(function (shop) {
      return Object.assign({}, shop, {
        score: getShopScore(shop, safeSlots, safePreferences),
        matchedTags: getMatchedTags(shop, safePreferences)
      });
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });

  const picked = pickRecommendations(scoredShops, safeSlots, excludeIds);

  return picked.slice(0, 3).map(function (shop) {
    return formatRecommendation(shop, safeSlots, safePreferences);
  });
}

function pickRecommendations(scoredShops, slots, excludeIds) {
  const preferredShops = excludeIds.length
    ? scoredShops.filter(function (shop) {
      return excludeIds.indexOf(shop.id) < 0;
    })
    : scoredShops;
  const fallbackShops = excludeIds.length
    ? scoredShops.filter(function (shop) {
      return excludeIds.indexOf(shop.id) >= 0;
    })
    : [];
  let picked = slots.mealPurpose === '没想法'
    ? pickDiverse(preferredShops, 3)
    : preferredShops.slice(0, 3);

  picked = fillRecommendations(picked, fallbackShops, slots);
  picked = fillRecommendations(picked, scoredShops, slots);

  return picked.slice(0, 3);
}

function fillRecommendations(picked, candidates, slots) {
  const pickedIds = picked.map(function (shop) {
    return shop.id;
  });
  const nextPicked = picked.slice();
  const orderedCandidates = slots.mealPurpose === '没想法'
    ? pickDiverse(candidates, candidates.length)
    : candidates;

  orderedCandidates.forEach(function (shop) {
    if (nextPicked.length >= 3 || pickedIds.indexOf(shop.id) >= 0) {
      return;
    }

    nextPicked.push(shop);
    pickedIds.push(shop.id);
  });

  return nextPicked;
}

// Picks up to `count` shops from a scored+sorted list, preferring category diversity.
// Used for '没想法' to avoid surfacing three nearly-identical shops.
// Hard risks (avoidTags) are already filtered out before this is called.
function pickDiverse(scoredShops, count) {
  var picked = [];
  var usedCategories = [];

  scoredShops.forEach(function (shop) {
    if (picked.length >= count) { return; }
    if (usedCategories.indexOf(shop.category) < 0) {
      picked.push(shop);
      usedCategories.push(shop.category);
    }
  });

  scoredShops.forEach(function (shop) {
    if (picked.length >= count) { return; }
    if (picked.indexOf(shop) < 0) {
      picked.push(shop);
    }
  });

  return picked.slice(0, count);
}

function getEligibleShops(preferences) {
  return mockShopData.mockShops.filter(function (shop) {
    return !hasHardRisk(shop, preferences);
  });
}

function hasHardRisk(shop, preferences) {
  const avoidTags = getEffectiveAvoidTags(preferences);
  const hasAvoidRisk = avoidTags.some(function (tag) {
    return shop.avoidRisk.indexOf(tag) >= 0;
  });

  if (hasAvoidRisk) {
    return true;
  }

  if (shouldAvoidSpicy(preferences)) {
    return isSpicyShop(shop);
  }

  return false;
}

// ─── Scoring ───────────────────────────────────────────────────────────────

// Scoring bonuses by mealPurpose, keyed on existing shop.category and shop.tags fields.
// 没想法 returns 0 (diversity is handled in generateRecommendations instead).
const mealPurposeScoringMap = {
  '早餐':      { categories: ['粥店', '粉面', '轻食'],              tags: ['热乎的', '汤汤水水', '清淡', '轻负担'] },
  '午餐':      { categories: ['简餐', '快餐', '湘菜'],              tags: ['饱腹感强', '下饭', '咸香'] },
  '晚餐':      { categories: ['湘菜', '粉面', '粥店', '麻辣烫'],    tags: ['下饭', '饱腹感强', '热乎的', '浓郁'] },
  '下午茶':    { categories: ['轻食'],                               tags: ['清淡', '轻负担', '爽口', '酸甜'] },
  '夜宵':      { categories: ['粉面', '麻辣烫', '快餐'],            tags: ['香辣', '麻辣', '解馋', '热乎的'] },
  '轻食/减脂': { categories: ['轻食', '粥店'],                      tags: ['清淡', '不油腻', '轻负担', '少油少盐', '爽口'] }
};

// Branch option → shop category (soft scoring only, never hard filter).
const branchOptionCategoryMap = {
  '粥':        ['粥店'],
  '面条/粉':   ['粉面'],
  '粉面':      ['粉面'],
  '轻食':      ['轻食'],
  '中式简餐':  ['简餐'],
  '米饭套餐':  ['简餐', '湘菜'],
  '家常菜':    ['湘菜'],
  '火锅/冒菜': ['麻辣烫'],
  '麻辣烫':    ['麻辣烫'],
  '烧烤/炸物': ['快餐'],
  '烧烤':      ['快餐'],
  '炸串/炸鸡': ['快餐']
};

// Branch option → shop tag (soft scoring only, never hard filter).
const branchOptionTagMap = {
  '管饱':    ['饱腹感强'],
  '清淡点':  ['清淡', '不油腻'],
  '不油腻':  ['不油腻'],
  '少油少盐':['少油少盐'],
  '轻负担':  ['轻负担'],
  '清淡':    ['清淡'],
  '高蛋白':  ['饱腹感强'],
  '甜品':    ['酸甜'],
  '小吃':    ['解馋'],
  '沙拉':    ['清淡', '爽口']
};

function getMealPurposeScore(shop, slots) {
  var mealPurpose = slots.mealPurpose;
  var branchPreference = slots.branchPreference || '';
  var score = 0;

  if (mealPurpose && mealPurpose !== '没想法') {
    if (mealPurpose === '随便吃点') {
      if (shop.price <= 35) { score += 15; }
      if (shop.distanceMeters <= 600) { score += 15; }
    } else {
      var mapping = mealPurposeScoringMap[mealPurpose];
      if (mapping) {
        if (mapping.categories.indexOf(shop.category) >= 0) { score += 20; }
        mapping.tags.forEach(function (tag) {
          if (shop.tags.indexOf(tag) >= 0) { score += 8; }
        });
      }
    }
  }

  score += getBranchPreferenceScore(shop, branchPreference);
  return score;
}

// Parses the joined branchPreference string and adds bonuses per token.
function getBranchPreferenceScore(shop, branchPreference) {
  if (!branchPreference || branchPreference === '都可以') { return 0; }

  var tokens = branchPreference.split('、');
  var score = 0;

  tokens.forEach(function (token) {
    var cats = branchOptionCategoryMap[token];
    if (cats && cats.indexOf(shop.category) >= 0) { score += 15; }

    var tags = branchOptionTagMap[token];
    if (tags) {
      tags.forEach(function (tag) {
        if (shop.tags.indexOf(tag) >= 0) { score += 8; }
      });
    }

    if (token === '近一点' || token === '快一点') {
      if (shop.distanceMeters <= 500) { score += 20; }
      else if (shop.distanceMeters <= 800) { score += 10; }
    }

    if (token === '便宜一点') {
      if (shop.price <= 30) { score += 20; }
      else if (shop.price <= 40) { score += 10; }
    }
  });

  return score;
}

function getShopScore(shop, slots, preferences) {
  let score = shop.rating * 2;
  const matchedTasteTags = intersect(shop.tags, preferences.tasteTags);
  const matchedNeedTags = intersect(shop.tags, preferences.needTags);

  score += matchedTasteTags.length * 30;
  score += matchedNeedTags.length * 18;

  if (isBudgetMatch(shop, slots.budget)) {
    score += 15;
  }

  if (isDistanceMatch(shop, slots.distance)) {
    score += 12;
  }

  if (isSpicyLevelMatch(shop, preferences.spicyLevel)) {
    score += 8;
  }

  score += getMealPurposeScore(shop, slots);

  return score;
}

function getMatchedTags(shop, preferences) {
  return intersect(shop.tags, preferences.tasteTags.concat(preferences.needTags));
}

function formatRecommendation(shop, slots, preferences) {
  const matchedTags = shop.matchedTags || getMatchedTags(shop, preferences);

  return {
    id: shop.id,
    name: shop.name,
    type: shop.category,
    category: shop.category,
    perCapita: shop.price + ' 元/人',
    distance: formatDistance(shop.distanceMeters),
    rating: shop.rating,
    matchedTags: matchedTags,
    matchedTagsText: matchedTags.length ? matchedTags.join('、') : '默认推荐',
    reason: buildReason(shop, slots, matchedTags),
    riskTip: buildRiskTip(shop, slots, preferences)
  };
}

function buildReason(shop, slots, matchedTags) {
  const parts = [];

  if (matchedTags.length) {
    parts.push('匹配了你选择的' + quoteTags(matchedTags));
  } else {
    parts.push('作为低风险默认备选');
  }

  if (isBudgetMatch(shop, slots.budget)) {
    parts.push('价格也在预算范围内');
  }

  if (isDistanceMatch(shop, slots.distance)) {
    parts.push('距离也比较合适');
  }

  return parts.join('，') + '。';
}

function buildRiskTip(shop, slots, preferences) {
  const riskTips = [];
  const maxBudget = getBudgetLimit(slots.budget);
  const maxDistance = getDistanceLimit(slots.distance);

  (shop.riskTips || []).forEach(function (tip) {
    addRiskTip(riskTips, tip);
  });

  if (maxBudget) {
    if (shop.price > maxBudget) {
      addRiskTip(riskTips, '预算可能略高');
    } else if (shop.price >= maxBudget * 0.9) {
      addRiskTip(riskTips, '接近预算上限');
    }
  }

  if (maxDistance && shop.distanceMeters > maxDistance) {
    addRiskTip(riskTips, '距离略远，可能需要多走一段');
  }

  if (hasLightPreference(slots, preferences) && isHeavyTasteShop(shop)) {
    addRiskTip(riskTips, '口味可能偏重');
  }

  if (!riskTips.length) {
    return '暂无明显风险';
  }

  return riskTips.slice(0, 3).join('，');
}

function addRiskTip(riskTips, tip) {
  if (tip && riskTips.indexOf(tip) < 0) {
    riskTips.push(tip);
  }
}

function hasLightPreference(slots, preferences) {
  const preferenceText = [
    slots.branchPreference,
    (preferences.tasteTags || []).join('、'),
    (preferences.needTags || []).join('、')
  ].join('、');

  return ['清淡', '清淡点', '轻负担', '不油腻', '少油少盐'].some(function (tag) {
    return preferenceText.indexOf(tag) >= 0;
  });
}

function isHeavyTasteShop(shop) {
  const heavyTags = ['麻辣', '香辣', '酸辣', '浓郁'];

  return shop.spicyLevel === '中辣' || shop.spicyLevel === '重辣' || heavyTags.some(function (tag) {
    return shop.tags.indexOf(tag) >= 0;
  });
}

function buildTasteSlot(preferences) {
  return preferences.tasteTags.concat(preferences.needTags).join('、');
}

function buildAvoidSlot(preferences) {
  const avoidText = preferences.avoidTags.join('、');
  const spicyText = preferences.spicyLevel ? '辣度：' + preferences.spicyLevel : '';

  return [avoidText, spicyText].filter(function (item) {
    return !!item;
  }).join('，');
}

function buildTagAnswerText(question, preferences) {
  if (question.id === 'tag-preferences') {
    return preferences.tasteTags.concat(preferences.needTags).join('、');
  }

  return buildAvoidSlot(preferences);
}

function normalizePreferences(preferences) {
  const safePreferences = preferences || {};

  return {
    tasteTags: safePreferences.tasteTags || [],
    needTags: safePreferences.needTags || [],
    avoidTags: safePreferences.avoidTags || [],
    spicyLevel: safePreferences.spicyLevel || ''
  };
}

function clonePreferences(preferences) {
  const safePreferences = normalizePreferences(preferences);

  return {
    tasteTags: safePreferences.tasteTags.slice(),
    needTags: safePreferences.needTags.slice(),
    avoidTags: safePreferences.avoidTags.slice(),
    spicyLevel: safePreferences.spicyLevel
  };
}

function getEffectiveAvoidTags(preferences) {
  return (preferences.avoidTags || []).filter(function (tag) {
    return tag !== '没有忌口';
  });
}

function shouldAvoidSpicy(preferences) {
  return preferences.spicyLevel === '不吃辣' || getEffectiveAvoidTags(preferences).indexOf('不吃辣') >= 0;
}

function isSpicyShop(shop) {
  const spicyTags = ['香辣', '麻辣', '酸辣'];
  const spicyLevels = ['中辣', '重辣'];

  return spicyLevels.indexOf(shop.spicyLevel) >= 0 || spicyTags.some(function (tag) {
    return shop.tags.indexOf(tag) >= 0;
  });
}

function isSpicyLevelMatch(shop, spicyLevel) {
  if (!spicyLevel || spicyLevel === '不吃辣') {
    return true;
  }

  return shop.spicyLevel === spicyLevel;
}

function isBudgetMatch(shop, budget) {
  const maxBudget = getBudgetLimit(budget);

  if (!maxBudget) {
    return true;
  }

  return shop.price <= maxBudget;
}

function isDistanceMatch(shop, distance) {
  const maxDistance = getDistanceLimit(distance);

  if (!maxDistance) {
    return true;
  }

  return shop.distanceMeters <= maxDistance;
}

function getBudgetLimit(budget) {
  var budgetText = String(budget || '');
  var rangeMatch = budgetText.match(/(\d+)\s*-\s*(\d+)\s*元/);
  var withinMatch = budgetText.match(/(\d+)\s*元以内/);

  if (budgetText === '预算不重要' || budgetText.indexOf('元以上') >= 0) {
    return 0;
  }

  if (rangeMatch) {
    return Number(rangeMatch[2]);
  }

  if (withinMatch) {
    return Number(withinMatch[1]);
  }

  return 0;
}

function getDistanceLimit(distance) {
  if (distance === '500 米以内') { return 500; }
  if (distance === '1 公里以内') { return 1000; }
  if (distance === '2 公里以内') { return 2000; }
  return 0;
}

function formatDistance(distanceMeters) {
  if (distanceMeters >= 1000) {
    return (distanceMeters / 1000).toFixed(1) + ' 公里';
  }

  return distanceMeters + ' 米';
}

function intersect(source, selected) {
  return (selected || []).filter(function (tag) {
    return source.indexOf(tag) >= 0;
  });
}

function quoteTags(tags) {
  return tags.map(function (tag) {
    return '『' + tag + '』';
  }).join('');
}

// Steps the session back one question.
// Resets resolvedQuestions/totalQuestions when returning to mealPurpose (index 0)
// so getNextQuestion correctly returns mealPurposeQuestion via the !resolvedQuestions branch.
function goBack(session) {
  if (!session || session.questionIndex <= 0) { return session; }
  var prevIndex = session.questionIndex - 1;
  var prevSession = Object.assign({}, session, {
    questionIndex: prevIndex,
    answers: session.answers.slice(0, prevIndex)
  });
  if (prevIndex === 0) {
    prevSession = Object.assign({}, prevSession, {
      resolvedQuestions: null,
      totalQuestions: null
    });
  }
  return prevSession;
}

module.exports = {
  createInitialSession,
  getNextQuestion,
  answerQuestion,
  goBack,
  generateRecommendations
};
