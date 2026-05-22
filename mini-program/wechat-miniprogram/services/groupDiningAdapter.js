// Group dining adapter — Promise-based mock implementation.
//
// PUBLIC CONTRACT (stable — replace internals with wx.request later):
//   createTask(payload)                          → Promise<Board>
//   getTaskBoard(taskId, inviteToken)            → Promise<Board>
//   submitPreference(taskId, inviteToken, body)  → Promise<Board>
//   generateRecommendation(taskId, inviteToken)  → Promise<Board>
//
// Pages MUST go through these methods — never call wx.request directly.
// The mock stores everything in memory; data is reset on app restart.
// Conflicts, recommendations, audits, final choice and group_message are
// computed below as fixed mock heuristics — the frontend never derives any
// of this, so swapping to a real backend later is a drop-in change.

const ARTIFICIAL_DELAY_MS = 120;
const STATUS_WAITING = 'waiting_preferences';
const STATUS_READY = 'ready_to_recommend';
const STATUS_DONE = 'done';

const tasks = Object.create(null);

// A small fixed seed task so the board can be opened without going through
// create — useful for QA. Open `/pages/group/board/board?taskId=demo_task`.
seedDemoTask();

// ─── Public methods ─────────────────────────────────────────────────────

function createTask(payload) {
  return delay(ARTIFICIAL_DELAY_MS).then(function () {
    const safe = payload || {};
    const taskId = generateId('task');
    const inviteToken = generateId('invite');
    const expected = parseIntLoose(safe.peopleCount || safe.expectedPeopleCount);

    const task = {
      id: taskId,
      title: buildTitle(safe),
      creatorName: trim(safe.creatorName),
      rawRequest: trim(safe.rawRequest),
      locationText: trim(safe.location || safe.locationText),
      expectedPeopleCount: expected > 0 ? expected : 5,
      dinnerTime: trim(safe.dinnerTime),
      status: STATUS_WAITING,
      createdAt: nowIso()
    };

    const board = {
      taskId: taskId,
      inviteToken: inviteToken,
      sharePath: buildSharePath(taskId, inviteToken),
      task: task,
      participants: [],
      conflicts: [],
      recommendationState: {
        status: STATUS_WAITING,
        hasGenerated: false,
        updatedAt: nowIso(),
        dirtyReason: ''
      },
      recommendationResult: null,
      submittedCount: 0,
      expectedCount: task.expectedPeopleCount
    };

    tasks[taskId] = board;
    return cloneBoard(board);
  });
}

function getTaskBoard(taskId, inviteToken) {
  return delay(80).then(function () {
    const board = requireBoard(taskId);
    validateInvite(board, inviteToken);
    return cloneBoard(board);
  });
}

function submitPreference(taskId, inviteToken, payload) {
  return delay(ARTIFICIAL_DELAY_MS).then(function () {
    const board = requireBoard(taskId);
    validateInvite(board, inviteToken);
    const safe = payload || {};

    const nickname = trim(safe.nickname);
    if (!nickname) {
      throw makeError('invalid_payload', '请先填写昵称');
    }

    const participant = {
      id: generateId('p'),
      nickname: nickname,
      rawPreference: trim(safe.rawPreference),
      manualFields: buildManualFields(safe),
      extractedConstraints: extractConstraints(safe),
      createdAt: nowIso()
    };

    board.participants.push(participant);
    board.submittedCount = board.participants.length;
    board.conflicts = detectConflicts(board.participants);
    board.recommendationState = recomputeState(board);
    // Submitting after a recommendation marks it as stale.
    if (board.recommendationResult) {
      board.recommendationState.dirtyReason = 'participants_changed';
    }
    return cloneBoard(board);
  });
}

function generateRecommendation(taskId, inviteToken) {
  return delay(380).then(function () {
    const board = requireBoard(taskId);
    validateInvite(board, inviteToken);

    board.recommendationResult = synthesizeRecommendation(board);
    board.recommendationState = {
      status: STATUS_DONE,
      hasGenerated: true,
      updatedAt: nowIso(),
      dirtyReason: ''
    };
    if (board.task) { board.task.status = STATUS_DONE; }
    return cloneBoard(board);
  });
}

// ─── Internal helpers ───────────────────────────────────────────────────

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function nowIso() { return new Date().toISOString(); }

function generateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
}

function trim(value) {
  if (typeof value === 'string') { return value.trim(); }
  if (value == null) { return ''; }
  return String(value);
}

function parseIntLoose(value) {
  if (typeof value === 'number' && isFinite(value)) { return Math.max(0, Math.floor(value)); }
  if (typeof value === 'string') {
    const match = value.match(/-?\d+/);
    if (match) { return parseInt(match[0], 10); }
  }
  return 0;
}

function buildTitle(payload) {
  const dinner = trim(payload.dinnerTime);
  const people = parseIntLoose(payload.peopleCount || payload.expectedPeopleCount);
  if (dinner && people) { return dinner + ' · ' + people + ' 人聚餐'; }
  if (dinner) { return dinner + ' · 多人聚餐'; }
  return '一次多人约饭';
}

function buildSharePath(taskId, inviteToken) {
  return '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) +
         '&inviteToken=' + encodeURIComponent(inviteToken);
}

function requireBoard(taskId) {
  const board = tasks[taskId];
  if (!board) { throw makeError('not_found', '任务不存在或已过期'); }
  return board;
}

// Mock is lenient: any inviteToken (or none) is accepted. Real backend
// would compare token against the creator session or share signature.
function validateInvite(board, inviteToken) {
  return true;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.errMsg = message;
  return err;
}

function buildManualFields(payload) {
  const budgetMax = parseIntLoose(payload.budget != null ? payload.budget : payload.budgetMax);
  const spicyPreference = mapSpicyToEnum(payload.spicy || payload.spicyPreference);
  return {
    budgetMax: budgetMax > 0 ? budgetMax : null,
    spicyPreference: spicyPreference,
    spicyLabel: spicyLabelOf(spicyPreference),
    leaveBefore: trim(payload.leaveBefore)
  };
}

function mapSpicyToEnum(input) {
  if (input === 'spicy' || input === 'no_spicy' || input === 'any') { return input; }
  if (input === '不吃辣') { return 'no_spicy'; }
  if (input === '中辣' || input === '重辣') { return 'spicy'; }
  if (input === '微辣') { return 'any'; }
  return '';
}

function spicyLabelOf(enumValue) {
  if (enumValue === 'no_spicy') { return '不吃辣'; }
  if (enumValue === 'spicy') { return '能吃辣'; }
  if (enumValue === 'any') { return '都行'; }
  return '';
}

// Tiny rule-based extractor for the mock; real backend would use an LLM.
function extractConstraints(payload) {
  const text = trim(payload.rawPreference).toLowerCase();
  const hard = [];
  const soft = [];

  if (text.indexOf('不吃辣') >= 0 || mapSpicyToEnum(payload.spicy) === 'no_spicy') {
    hard.push('不吃辣');
  }
  ['牛羊肉', '海鲜', '花生', '香菜', '葱蒜', '乳制品'].forEach(function (tag) {
    if (text.indexOf(tag) >= 0) { hard.push('不吃' + tag); }
  });
  if (text.indexOf('素') >= 0) { hard.push('要有素食'); }

  if (text.indexOf('便宜') >= 0 || text.indexOf('实惠') >= 0) { soft.push('偏好平价'); }
  if (text.indexOf('近') >= 0 || text.indexOf('附近') >= 0) { soft.push('偏好近一点'); }
  if (text.indexOf('安静') >= 0 || text.indexOf('清净') >= 0) { soft.push('偏好安静'); }
  if (text.indexOf('热闹') >= 0) { soft.push('偏好热闹'); }
  if (text.indexOf('快') >= 0) { soft.push('偏好出餐快'); }
  if (mapSpicyToEnum(payload.spicy) === 'spicy') { soft.push('能吃辣'); }

  return { hardConstraints: hard, softPreferences: soft };
}

function detectConflicts(participants) {
  const conflicts = [];

  // Taste conflict — at least one wants spicy, at least one rejects it.
  const hasSpicy = participants.some(function (p) {
    return p.manualFields && p.manualFields.spicyPreference === 'spicy';
  });
  const hasNoSpicy = participants.some(function (p) {
    return p.manualFields && p.manualFields.spicyPreference === 'no_spicy';
  });
  if (hasSpicy && hasNoSpicy) {
    conflicts.push({
      type: 'taste',
      severity: 'medium',
      description: '有人能吃辣，有人不吃辣',
      resolutionStrategy: '推荐鸳鸯锅或可分餐厅型，确保两边都能吃'
    });
  }

  // Budget conflict — spread between min and max budgets > 50 yuan.
  const budgets = participants
    .map(function (p) { return p.manualFields && p.manualFields.budgetMax; })
    .filter(function (n) { return typeof n === 'number' && n > 0; });
  if (budgets.length >= 2) {
    const min = Math.min.apply(null, budgets);
    const max = Math.max.apply(null, budgets);
    if (max - min > 50) {
      conflicts.push({
        type: 'budget',
        severity: 'medium',
        description: '预算分歧 ' + min + ' 到 ' + max + ' 元',
        resolutionStrategy: '推荐人均 ' + Math.round((min + max) / 2) + ' 元上下的中间档'
      });
    }
  }

  // Time conflict — someone needs to leave before a clearly-early time.
  const leaves = participants
    .map(function (p) { return p.manualFields && p.manualFields.leaveBefore; })
    .filter(function (s) { return s; });
  if (leaves.length) {
    const earliest = leaves.sort()[0];
    if (earliest && earliest < '20:30') {
      conflicts.push({
        type: 'time',
        severity: 'low',
        description: '有人需要 ' + earliest + ' 前离开',
        resolutionStrategy: '推荐出餐快或可预订的店'
      });
    }
  }

  return conflicts;
}

function recomputeState(board) {
  const submitted = board.participants.length;
  const expected = board.expectedCount || (board.task && board.task.expectedPeopleCount) || 0;
  const ready = expected > 0 && submitted >= expected;
  return {
    status: ready ? STATUS_READY : STATUS_WAITING,
    hasGenerated: !!board.recommendationResult,
    updatedAt: nowIso(),
    dirtyReason: ''
  };
}

// ─── Recommendation synthesis (mock) ────────────────────────────────────

const MOCK_RESTAURANTS = [
  {
    id: 'r_yuanyang',
    name: '老灶坊·鸳鸯锅',
    category: '火锅',
    avgPrice: 88,
    distanceM: 420,
    walkMinutes: 6,
    rating: 4.6,
    tags: ['鸳鸯锅', '可分餐', '热闹'],
    supportsSpicy: true,
    supportsNonSpicy: true
  },
  {
    id: 'r_homestyle',
    name: '阿姐家常菜',
    category: '家常菜',
    avgPrice: 56,
    distanceM: 280,
    walkMinutes: 4,
    rating: 4.5,
    tags: ['平价', '出餐快', '素菜多'],
    supportsSpicy: true,
    supportsNonSpicy: true
  },
  {
    id: 'r_combo',
    name: '七点小聚·套餐厅',
    category: '简餐套餐',
    avgPrice: 75,
    distanceM: 540,
    walkMinutes: 8,
    rating: 4.4,
    tags: ['套餐', '安静', '可预订'],
    supportsSpicy: false,
    supportsNonSpicy: true
  },
  {
    id: 'r_hunan',
    name: '辣巷子湘菜',
    category: '湘菜',
    avgPrice: 78,
    distanceM: 650,
    walkMinutes: 9,
    rating: 4.5,
    tags: ['下饭', '香辣', '人多热闹'],
    supportsSpicy: true,
    supportsNonSpicy: false
  }
];

function synthesizeRecommendation(board) {
  const conflicts = board.conflicts || [];
  const hasTasteConflict = conflicts.some(function (c) { return c.type === 'taste'; });
  const hasBudgetConflict = conflicts.some(function (c) { return c.type === 'budget'; });
  const hasTimeConflict = conflicts.some(function (c) { return c.type === 'time'; });
  const participants = board.participants || [];

  // Pick a primary + 2 alternates based on detected conflicts.
  let primary;
  if (hasTasteConflict) {
    primary = pickRestaurant('r_yuanyang');
  } else if (hasBudgetConflict) {
    primary = pickRestaurant('r_homestyle');
  } else if (hasTimeConflict) {
    primary = pickRestaurant('r_combo');
  } else {
    primary = pickRestaurant('r_hunan');
  }
  const others = MOCK_RESTAURANTS
    .filter(function (r) { return r.id !== primary.id; })
    .slice(0, 2);

  const candidates = [primary].concat(others).map(function (r) {
    return formatCandidate(r, board, primary.id === r.id);
  });

  const risks = [];
  if (hasTasteConflict) { risks.push('口味分歧已通过鸳鸯锅化解'); }
  if (hasBudgetConflict) { risks.push('预算分歧已选中间档'); }
  if (hasTimeConflict) { risks.push('已选出餐较快的店'); }
  if (!participants.length) { risks.push('尚无成员偏好，结果为默认方案'); }

  const dinner = (board.task && board.task.dinnerTime) || '今晚';
  const location = (board.task && board.task.locationText) || '附近';
  const groupMessage =
    '今晚 ' + dinner + ' 一起吃 ' + primary.name +
    '（人均 ¥' + primary.avgPrice + '，' + primary.walkMinutes + ' 分钟到 ' + location + '）。' +
    (risks.length ? '风险：' + risks.join('；') + '。' : '') +
    '到了我会发位置。';

  const normalAiMessage =
    '已根据 ' + participants.length + ' 位成员偏好挑出 ' + primary.name +
    '，理由：' + primary.tags.join('、') + '。';

  return {
    candidates: candidates,
    finalChoice: {
      restaurantId: primary.id,
      name: primary.name,
      reason: primary.tags.join('、') + '，最适合本次需求',
      risks: risks,
      backup: others[0] ? others[0].name : ''
    },
    groupMessage: groupMessage,
    normalAiMessage: normalAiMessage
  };
}

function pickRestaurant(id) {
  for (let i = 0; i < MOCK_RESTAURANTS.length; i++) {
    if (MOCK_RESTAURANTS[i].id === id) { return MOCK_RESTAURANTS[i]; }
  }
  return MOCK_RESTAURANTS[0];
}

function formatCandidate(r, board, isPrimary) {
  const participants = board.participants || [];
  const hasNoSpicyMember = participants.some(function (p) {
    return p.manualFields && p.manualFields.spicyPreference === 'no_spicy';
  });
  const hasSpicyMember = participants.some(function (p) {
    return p.manualFields && p.manualFields.spicyPreference === 'spicy';
  });
  const budgets = participants
    .map(function (p) { return p.manualFields && p.manualFields.budgetMax; })
    .filter(function (n) { return typeof n === 'number' && n > 0; });
  const tightestBudget = budgets.length ? Math.min.apply(null, budgets) : 0;

  const hardRules = {
    spicy: (hasNoSpicyMember && !r.supportsNonSpicy) ? 'fail'
         : (hasSpicyMember && !r.supportsSpicy)     ? 'risk'
         : 'pass',
    budget: tightestBudget && r.avgPrice > tightestBudget ? 'risk' : 'pass',
    distance: r.distanceM > 1500 ? 'risk' : 'pass'
  };
  const softChecks = {
    atmosphere: r.tags.indexOf('安静') >= 0 || r.tags.indexOf('热闹') >= 0 ? 'pass' : 'risk',
    speed: r.tags.indexOf('出餐快') >= 0 ? 'pass' : 'risk'
  };
  const passed = hardRules.spicy !== 'fail' && hardRules.budget !== 'fail';

  return {
    id: r.id,
    name: r.name,
    category: r.category,
    avgPrice: r.avgPrice,
    distanceM: r.distanceM,
    walkMinutes: r.walkMinutes,
    rating: r.rating,
    score: isPrimary ? 92 : 80,
    tags: r.tags.slice(),
    reason: isPrimary
      ? '综合 ' + r.tags.join('、') + '，覆盖大多数偏好'
      : '作为备选：' + r.tags.join('、'),
    audit: {
      passed: passed,
      hardRules: hardRules,
      softChecks: softChecks,
      llmExplanation: isPrimary
        ? '该方案在硬约束上全部通过，软偏好覆盖率较高。'
        : '作为备选方案，仍满足关键硬约束。'
    }
  };
}

// ─── Cloning helpers (so callers can't mutate the in-memory store) ──────

function cloneBoard(board) {
  return JSON.parse(JSON.stringify(board));
}

// ─── Demo seed (only for QA — replaceable when real backend is wired) ──

function seedDemoTask() {
  const taskId = 'demo_task';
  const inviteToken = 'demo_invite';
  const task = {
    id: taskId,
    title: '周六 18:30 · 5 人聚餐',
    creatorName: '小幺',
    rawRequest: '周末晚上 5 个人聚餐，1 个吃素，1 个不吃辣，预算控制在人均 80 以内。',
    locationText: '学校东门',
    expectedPeopleCount: 5,
    dinnerTime: '周六 18:30',
    status: STATUS_WAITING,
    createdAt: nowIso()
  };
  tasks[taskId] = {
    taskId: taskId,
    inviteToken: inviteToken,
    sharePath: buildSharePath(taskId, inviteToken),
    task: task,
    participants: [],
    conflicts: [],
    recommendationState: {
      status: STATUS_WAITING,
      hasGenerated: false,
      updatedAt: nowIso(),
      dirtyReason: ''
    },
    recommendationResult: null,
    submittedCount: 0,
    expectedCount: task.expectedPeopleCount
  };
}

module.exports = {
  createTask,
  getTaskBoard,
  submitPreference,
  generateRecommendation
};
