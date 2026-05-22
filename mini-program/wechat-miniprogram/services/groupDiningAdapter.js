// Group dining adapter — dispatches between mock and API implementations.
//
// PUBLIC CONTRACT (stable):
//   createTask(payload)                          → Promise<Board>
//   getTaskBoard(taskId, inviteToken)            → Promise<Board>
//   submitPreference(taskId, inviteToken, body)  → Promise<Board>
//   generateRecommendation(taskId, inviteToken)  → Promise<Board>
//
// Pages MUST go through these — never call wx.request directly.

// ─── Runtime configuration ──────────────────────────────────────────────
// Switch ADAPTER_MODE to flip the whole app between mock and real backend.
//   'mock'     — local Promise mock; no backend required
//   'api'      — real backend via wx.request
//   'fallback' — try API first; on failure warn the user and fall back to mock
const ADAPTER_MODE = 'mock';
const API_BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/group-tasks'; // easy to switch to '/api/tasks'
const API_TIMEOUT_MS = 15000;

// ─── In-memory mock store (mock + fallback modes) ───────────────────────
const tasks = Object.create(null);
const MOCK_DB_STORAGE_KEY = '__GROUP_DINING_MOCK_DB__';
let mockDbHydrated = false;
const ARTIFICIAL_DELAY_MS = 120;
const STATUS_WAITING = 'waiting_preferences';
const STATUS_READY = 'ready_to_recommend';
const STATUS_DONE = 'done';

// Reason types accepted by submitAdjustmentRequest. Labels surface in the
// board UI; mock + API impls both pass the type through as-is.
const ADJUSTMENT_REASON_LABELS = {
  cannot_eat: '吃不了',
  over_budget: '超预算',
  time_mismatch: '时间不合',
  too_far: '太远',
  prefer_other_cuisine: '想换品类',
  other: '其他'
};

seedDemoTask();

// ─── Public dispatchers ─────────────────────────────────────────────────

function createTask(payload) {
  return dispatch('createTask', mockCreateTask, apiCreateTask, [payload]);
}

function getTaskBoard(taskId, inviteToken) {
  return dispatch('getTaskBoard', mockGetTaskBoard, apiGetTaskBoard, [taskId, inviteToken]);
}

function submitPreference(taskId, inviteToken, payload) {
  return dispatch('submitPreference', mockSubmitPreference, apiSubmitPreference,
                  [taskId, inviteToken, payload]);
}

function generateRecommendation(taskId, inviteToken) {
  return dispatch('generateRecommendation', mockGenerateRecommendation, apiGenerateRecommendation,
                  [taskId, inviteToken]);
}

// Members can submit a "not satisfied" signal against a specific candidate.
// Returns the updated normalized board. Marks the recommendation state as
// dirty so the organizer is prompted to regenerate.
function submitAdjustmentRequest(taskId, inviteToken, payload) {
  return dispatch('submitAdjustmentRequest', mockSubmitAdjustmentRequest, apiSubmitAdjustmentRequest,
                  [taskId, inviteToken, payload]);
}

function dispatch(name, mockFn, apiFn, args) {
  if (ADAPTER_MODE === 'mock') {
    return mockFn.apply(null, args).then(normalizeBoard);
  }
  if (ADAPTER_MODE === 'api') {
    return apiFn.apply(null, args).then(normalizeBoard);
  }
  if (ADAPTER_MODE === 'fallback') {
    return apiFn.apply(null, args).then(normalizeBoard).catch(function (err) {
      console.warn('[groupDiningAdapter] ' + name + ' API failed, falling back to mock', err);
      wx.showToast({
        title: 'API 不可用，本次用 mock',
        icon: 'none',
        duration: 1800
      });
      return mockFn.apply(null, args).then(normalizeBoard);
    });
  }
  return Promise.reject(makeError('bad_mode', 'Unknown ADAPTER_MODE: ' + ADAPTER_MODE));
}

// ─── API implementations ────────────────────────────────────────────────

function apiCreateTask(payload) {
  return apiRequest('POST', '', buildCreateTaskBody(payload));
}

function apiGetTaskBoard(taskId, inviteToken) {
  const query = inviteToken ? '?inviteToken=' + encodeURIComponent(inviteToken) : '';
  return apiRequest('GET', '/' + encodeURIComponent(taskId) + query, null);
}

function apiSubmitPreference(taskId, inviteToken, payload) {
  const body = Object.assign(buildParticipantBody(payload), {
    invite_token: inviteToken || ''
  });
  return apiRequest('POST', '/' + encodeURIComponent(taskId) + '/participants', body);
}

function apiGenerateRecommendation(taskId, inviteToken) {
  return apiRequest('POST', '/' + encodeURIComponent(taskId) + '/recommend',
                    { invite_token: inviteToken || '' });
}

function apiSubmitAdjustmentRequest(taskId, inviteToken, payload) {
  const safe = payload || {};
  const body = {
    invite_token: inviteToken || '',
    nickname: trim(safe.nickname),
    visibility: trim(safe.visibility) || 'public',
    candidate_id: trim(safe.candidateId),
    candidate_name: trim(safe.candidateName),
    reason_type: trim(safe.reasonType),
    note: trim(safe.note)
  };
  return apiRequest('POST', '/' + encodeURIComponent(taskId) + '/adjustment-requests', body);
}

function apiRequest(method, path, body) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: API_BASE_URL + API_PREFIX + path,
      method: method,
      data: body == null ? undefined : body,
      header: { 'Content-Type': 'application/json' },
      timeout: API_TIMEOUT_MS,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(makeError('http_' + res.statusCode, 'HTTP ' + res.statusCode));
        }
      },
      fail: function (err) {
        reject(makeError('network_failed', (err && err.errMsg) || 'network'));
      }
    });
  });
}

// ─── Mock implementations ───────────────────────────────────────────────

function mockCreateTask(payload) {
  return delay(ARTIFICIAL_DELAY_MS).then(function () {
    hydrateMockDb();
    const safe = payload || {};
    const taskId = generateId('task');
    const inviteToken = generateId('invite');
    const expected = parseIntLoose(safe.peopleCount || safe.expectedPeopleCount);

    // Adapter fills sane defaults for fields the simplified create form omits.
    const task = {
      task_id: taskId,
      title: buildTitle(safe, expected || 5),
      creator_name: trim(safe.creatorName) || '发起人',
      raw_request: trim(safe.rawRequest) || '一次多人聚餐，欢迎大家自由填写偏好',
      location_text: trim(safe.location || safe.locationText) || '待商量',
      expected_people_count: expected > 0 ? expected : 5,
      dinner_time: trim(safe.dinnerTime) || '待商量',
      status: STATUS_WAITING,
      created_at: nowIso()
    };

    const board = {
      task_id: taskId,
      invite_token: inviteToken,
      share_path: buildSharePath(taskId, inviteToken),
      task: task,
      participants: [],
      conflicts: [],
      recommendation_state: {
        status: STATUS_WAITING,
        hasGenerated: false,
        updated_at: nowIso(),
        dirty_reason: ''
      },
      recommendation_result: null
    };

    tasks[taskId] = board;
    if (!persistMockDb()) {
      delete tasks[taskId];
      throw makeError('mock_storage_failed', 'mock 任务保存失败，请重试');
    }
    return board;
  });
}

function mockGetTaskBoard(taskId, _inviteToken) {
  return delay(80).then(function () {
    const board = requireBoard(taskId);
    return board;
  });
}

function mockSubmitPreference(taskId, _inviteToken, payload) {
  return delay(ARTIFICIAL_DELAY_MS).then(function () {
    const board = requireBoard(taskId);
    const safe = payload || {};

    const nickname = trim(safe.nickname);
    if (!nickname) { throw makeError('invalid_payload', '请先填写昵称'); }

    const participant = buildMockParticipant(safe);

    // Upsert: same nickname replaces the existing entry.
    const existingIndex = board.participants.findIndex(function (p) {
      return p.nickname === nickname;
    });
    if (existingIndex >= 0) {
      participant.participant_id = board.participants[existingIndex].participant_id;
      board.participants[existingIndex] = participant;
    } else {
      board.participants.push(participant);
    }

    board.conflicts = detectMockConflicts(board.participants);
    board.recommendation_state = recomputeMockState(board);
    if (board.recommendation_result) {
      board.recommendation_state.dirty_reason = 'participants_changed';
    }
    persistMockDb();
    return board;
  });
}

function mockGenerateRecommendation(taskId, _inviteToken) {
  return delay(380).then(function () {
    const board = requireBoard(taskId);
    board.recommendation_result = synthesizeMockRecommendation(board);
    board.recommendation_state = {
      status: STATUS_DONE,
      hasGenerated: true,
      updated_at: nowIso(),
      dirty_reason: ''
    };
    if (board.task) { board.task.status = STATUS_DONE; }
    // Regenerating clears stale adjustment requests — they were about the
    // previous candidate list, no longer applicable.
    board.adjustment_requests = [];
    persistMockDb();
    return board;
  });
}

function mockSubmitAdjustmentRequest(taskId, _inviteToken, payload) {
  return delay(120).then(function () {
    const board = requireBoard(taskId);
    const safe = payload || {};

    const candidateId = trim(safe.candidateId);
    const reasonType = trim(safe.reasonType);
    if (!candidateId) { throw makeError('invalid_payload', '请选择一个候选'); }
    if (!reasonType) { throw makeError('invalid_payload', '请选择不满意的原因'); }
    if (!ADJUSTMENT_REASON_LABELS[reasonType]) {
      throw makeError('invalid_payload', '不支持的反馈类型');
    }

    if (!Array.isArray(board.adjustment_requests)) { board.adjustment_requests = []; }

    const visibility = trim(safe.visibility) || 'public';
    const nickname = trim(safe.nickname);
    const request = {
      id: generateId('adj'),
      nickname: nickname,
      visibility: visibility,
      candidate_id: candidateId,
      candidate_name: trim(safe.candidateName),
      reason_type: reasonType,
      reason_label: ADJUSTMENT_REASON_LABELS[reasonType],
      note: trim(safe.note),
      created_at: nowIso()
    };
    board.adjustment_requests.unshift(request);

    // Mark recommendation as dirty so the organizer sees the prompt.
    if (board.recommendation_state) {
      board.recommendation_state.dirty_reason = 'adjustment_requested';
    }
    persistMockDb();
    return board;
  });
}

// ─── Snake_case body builders (used by API mode and mock-internal storage) ──

function buildCreateTaskBody(payload) {
  const safe = payload || {};
  const expected = parseIntLoose(safe.peopleCount || safe.expectedPeopleCount);
  return {
    creator_name: trim(safe.creatorName) || '发起人',
    raw_request: trim(safe.rawRequest) || '一次多人聚餐，欢迎大家自由填写偏好',
    location_text: trim(safe.location || safe.locationText) || '待商量',
    expected_people_count: expected > 0 ? expected : 5,
    dinner_time: trim(safe.dinnerTime) || '待商量'
  };
}

function buildParticipantBody(payload) {
  const safe = payload || {};
  const availability = safe.availability || {};
  return {
    nickname: trim(safe.nickname),
    visibility: trim(safe.visibility) || 'public',
    raw_preference: trim(safe.rawPreference || safe.naturalLanguagePreference),
    available_days: arrayOrEmpty(availability.availableDays),
    available_hours: arrayOrEmpty(availability.availableHours),
    available_time_text: trim(availability.availableTimeText),
    dietary_restrictions: arrayOrEmpty(safe.dietaryRestrictions),
    cuisine_preferences: arrayOrEmpty(safe.cuisinePreferences),
    budget_tag: trim(safe.budgetTag || safe.budget),
    spicy_preference: mapSpicyToEnum(safe.spicyPreference || safe.spicy),
    // Explicit hard vs soft lists — the fill page composes these from its UI
    // and any custom-typed entries. Backend can persist verbatim.
    hard_requirements: arrayOrEmpty(safe.hardRequirements),
    soft_preferences: arrayOrEmpty(safe.softPreferences),
    requirement_priorities: plainObjectOrEmpty(safe.requirementPriorities),
    manual_fields: {
      budget_max: budgetMaxFromTag(safe.budgetTag) || parseIntLoose(safe.budget) || null,
      spicy_preference: mapSpicyToEnum(safe.spicyPreference || safe.spicy),
      leave_before: trim(safe.leaveBefore)
    }
  };
}

// ─── Mock participant builder (uses backend snake_case shape internally) ──

function buildMockParticipant(payload) {
  const body = buildParticipantBody(payload);
  return Object.assign(body, {
    participant_id: generateId('p'),
    created_at: nowIso(),
    extracted_constraints: extractMockConstraints(body)
  });
}

function extractMockConstraints(body) {
  const text = (body.raw_preference || '').toLowerCase();
  const hard = [];
  const soft = [];

  // Dietary chips already represent explicit "do not eat" — surface as hard.
  (body.dietary_restrictions || []).forEach(function (tag) {
    if (tag === '无忌口') { return; }
    hard.push(tag);
  });
  if (body.spicy_preference === 'no_spicy') { hard.push('不吃辣'); }
  if (text.indexOf('素') >= 0 && hard.indexOf('素食') < 0) { hard.push('要有素食'); }

  // Cuisine chips and natural-language hints become soft preferences.
  (body.cuisine_preferences || []).forEach(function (c) {
    if (c === '都可以') { return; }
    soft.push('偏好 ' + c);
  });
  if (text.indexOf('便宜') >= 0 || text.indexOf('实惠') >= 0) { soft.push('偏好平价'); }
  if (text.indexOf('近') >= 0 || text.indexOf('附近') >= 0) { soft.push('偏好近一点'); }
  if (text.indexOf('安静') >= 0 || text.indexOf('清净') >= 0) { soft.push('偏好安静'); }
  if (text.indexOf('热闹') >= 0) { soft.push('偏好热闹'); }
  if (text.indexOf('快') >= 0) { soft.push('偏好出餐快'); }
  if (text.indexOf('排队') >= 0) { soft.push('不想排队'); }
  if (body.spicy_preference === 'spicy') { soft.push('能吃辣'); }

  return { hard_constraints: hard, soft_preferences: soft };
}

// ─── Mock conflict detection ────────────────────────────────────────────

function detectMockConflicts(participants) {
  const conflicts = [];

  const hasSpicy = participants.some(function (p) {
    return p.spicy_preference === 'spicy';
  });
  const hasNoSpicy = participants.some(function (p) {
    return p.spicy_preference === 'no_spicy';
  });
  if (hasSpicy && hasNoSpicy) {
    conflicts.push({
      type: 'taste',
      severity: 'medium',
      description: '有人能吃辣，有人不吃辣',
      resolution_strategy: '推荐鸳鸯锅或可分餐厅型，确保两边都能吃'
    });
  }

  const budgets = participants
    .map(function (p) { return budgetMaxFromTag(p.budget_tag) || (p.manual_fields && p.manual_fields.budget_max); })
    .filter(function (n) { return typeof n === 'number' && n > 0; });
  if (budgets.length >= 2) {
    const min = Math.min.apply(null, budgets);
    const max = Math.max.apply(null, budgets);
    if (max - min > 50) {
      conflicts.push({
        type: 'budget',
        severity: 'medium',
        description: '预算分歧 ' + min + ' 到 ' + max + ' 元',
        resolution_strategy: '推荐人均 ' + Math.round((min + max) / 2) + ' 元上下的中间档'
      });
    }
  }

  // Availability overlap — if nobody shares a (day × hour) slot, mark conflict.
  const withAvailability = participants.filter(function (p) {
    return (p.available_days || []).length && (p.available_hours || []).length;
  });
  if (withAvailability.length >= 2) {
    const sharedDay = intersectArrays(withAvailability.map(function (p) {
      return (p.available_days || []).indexOf('随时') >= 0 ? ['随时'] : p.available_days;
    }));
    const sharedHour = intersectArrays(withAvailability.map(function (p) {
      return (p.available_hours || []).length ? p.available_hours : ['随时'];
    }));
    if (!sharedDay.length || !sharedHour.length) {
      conflicts.push({
        type: 'time',
        severity: 'high',
        description: '当前没有所有人都方便的时间段',
        resolution_strategy: '建议二次协调时间，或允许 2-3 人先约'
      });
    }
  }

  // Cuisine — every participant has a non-overlapping cuisine preference.
  const cuisines = withAnyCuisine(participants);
  if (cuisines.length >= 2) {
    const common = intersectArrays(cuisines);
    if (!common.length) {
      conflicts.push({
        type: 'cuisine',
        severity: 'low',
        description: '品类偏好分散，没有完全重合的选项',
        resolution_strategy: '推荐综合类餐厅，或选择多数人能接受的品类'
      });
    }
  }

  return conflicts;
}

function withAnyCuisine(participants) {
  return participants
    .map(function (p) {
      const list = (p.cuisine_preferences || []).filter(function (c) { return c !== '都可以'; });
      return list.length ? list : null;
    })
    .filter(function (list) { return !!list; });
}

function intersectArrays(arrays) {
  if (!arrays.length) { return []; }
  return arrays.reduce(function (acc, current) {
    return acc.filter(function (item) { return current.indexOf(item) >= 0; });
  }, arrays[0].slice());
}

function recomputeMockState(board) {
  const submitted = board.participants.length;
  const expected = (board.task && board.task.expected_people_count) || 0;
  const ready = expected > 0 && submitted >= expected;
  return {
    status: ready ? STATUS_READY : STATUS_WAITING,
    hasGenerated: !!board.recommendation_result,
    updated_at: nowIso(),
    dirty_reason: ''
  };
}

// ─── Mock recommendation synthesis ──────────────────────────────────────

const MOCK_RESTAURANTS = [
  { id: 'r_yuanyang',  name: '老灶坊·鸳鸯锅',   category: '火锅',     avg_price: 88, distance_m: 420, walk_minutes: 6, rating: 4.6, tags: ['鸳鸯锅', '可分餐', '热闹'],    supports_spicy: true,  supports_non_spicy: true },
  { id: 'r_homestyle', name: '阿姐家常菜',       category: '家常菜',   avg_price: 56, distance_m: 280, walk_minutes: 4, rating: 4.5, tags: ['平价', '出餐快', '素菜多'],     supports_spicy: true,  supports_non_spicy: true },
  { id: 'r_combo',     name: '七点小聚·套餐厅', category: '简餐套餐', avg_price: 75, distance_m: 540, walk_minutes: 8, rating: 4.4, tags: ['套餐', '安静', '可预订'],       supports_spicy: false, supports_non_spicy: true },
  { id: 'r_hunan',     name: '辣巷子湘菜',       category: '湘菜',     avg_price: 78, distance_m: 650, walk_minutes: 9, rating: 4.5, tags: ['下饭', '香辣', '人多热闹'],     supports_spicy: true,  supports_non_spicy: false }
];

function synthesizeMockRecommendation(board) {
  const conflicts = board.conflicts || [];
  const hasTaste = conflicts.some(function (c) { return c.type === 'taste'; });
  const hasBudget = conflicts.some(function (c) { return c.type === 'budget'; });
  const hasTime = conflicts.some(function (c) { return c.type === 'time'; });
  const participants = board.participants || [];

  let primary;
  if (hasTaste) { primary = pickRestaurant('r_yuanyang'); }
  else if (hasBudget) { primary = pickRestaurant('r_homestyle'); }
  else if (hasTime) { primary = pickRestaurant('r_combo'); }
  else { primary = pickRestaurant('r_hunan'); }

  const others = MOCK_RESTAURANTS.filter(function (r) { return r.id !== primary.id; }).slice(0, 2);
  const candidates = [primary].concat(others).map(function (r) {
    return formatMockCandidate(r, board, primary.id === r.id);
  });

  const risks = [];
  if (hasTaste) { risks.push('口味分歧已通过鸳鸯锅化解'); }
  if (hasBudget) { risks.push('预算分歧已选中间档'); }
  if (hasTime) { risks.push('已选出餐较快或可预订的店'); }
  if (!participants.length) { risks.push('尚无成员偏好，结果为默认方案'); }

  const dinner = (board.task && board.task.dinner_time && board.task.dinner_time !== '待商量')
    ? board.task.dinner_time : '今晚';
  const location = (board.task && board.task.location_text && board.task.location_text !== '待商量')
    ? board.task.location_text : '附近';
  const groupMessage =
    '今晚 ' + dinner + ' 一起吃 ' + primary.name +
    '（人均 ¥' + primary.avg_price + '，' + primary.walk_minutes + ' 分钟到 ' + location + '）。' +
    (risks.length ? '风险：' + risks.join('；') + '。' : '') +
    '到了我会发位置。';

  return {
    candidates: candidates,
    final_choice: {
      restaurant_id: primary.id,
      name: primary.name,
      reason: primary.tags.join('、') + '，最适合本次需求',
      risks: risks,
      backup: others[0] ? others[0].name : ''
    },
    group_message: groupMessage,
    normal_ai_message: '已根据 ' + participants.length + ' 位成员偏好挑出 ' + primary.name +
                       '，理由：' + primary.tags.join('、') + '。'
  };
}

function pickRestaurant(id) {
  for (let i = 0; i < MOCK_RESTAURANTS.length; i++) {
    if (MOCK_RESTAURANTS[i].id === id) { return MOCK_RESTAURANTS[i]; }
  }
  return MOCK_RESTAURANTS[0];
}

function formatMockCandidate(r, board, isPrimary) {
  const participants = board.participants || [];
  const hasNoSpicy = participants.some(function (p) { return p.spicy_preference === 'no_spicy'; });
  const hasSpicy = participants.some(function (p) { return p.spicy_preference === 'spicy'; });
  const budgets = participants
    .map(function (p) { return budgetMaxFromTag(p.budget_tag); })
    .filter(function (n) { return typeof n === 'number' && n > 0; });
  const tightest = budgets.length ? Math.min.apply(null, budgets) : 0;

  const hard = {
    spicy: (hasNoSpicy && !r.supports_non_spicy) ? 'fail'
         : (hasSpicy && !r.supports_spicy) ? 'risk' : 'pass',
    budget: tightest && r.avg_price > tightest ? 'risk' : 'pass',
    distance: r.distance_m > 1500 ? 'risk' : 'pass'
  };
  const soft = {
    atmosphere: r.tags.indexOf('安静') >= 0 || r.tags.indexOf('热闹') >= 0 ? 'pass' : 'risk',
    speed: r.tags.indexOf('出餐快') >= 0 ? 'pass' : 'risk'
  };
  const passed = hard.spicy !== 'fail' && hard.budget !== 'fail';

  // Per-member score map keyed by nickname (visibility-respected by the page).
  const memberScores = {};
  participants.forEach(function (p) {
    let s = isPrimary ? 88 : 78;
    if (p.spicy_preference === 'no_spicy' && r.supports_non_spicy) { s += 4; }
    if (p.spicy_preference === 'spicy' && r.supports_spicy) { s += 4; }
    const budget = budgetMaxFromTag(p.budget_tag);
    if (budget && r.avg_price <= budget) { s += 4; }
    if ((p.cuisine_preferences || []).some(function (c) {
      return c === r.category || (c === '火锅' && r.category === '火锅') || c === '都可以';
    })) { s += 4; }
    memberScores[p.nickname] = Math.min(99, s);
  });

  // Fairness explanation — aggregate hard requirements across all members
  // and check each one against this candidate using simple heuristics.
  const allHard = uniqueList(participants.reduce(function (acc, p) {
    return acc.concat(p.hard_requirements || []);
  }, []));
  const allSoft = uniqueList(participants.reduce(function (acc, p) {
    return acc.concat(p.soft_preferences || []);
  }, []));

  const matchedNeeds = [];
  const unmetNeeds = [];
  allHard.forEach(function (need) {
    if (isCandidateMatchingHardNeed(need, r)) { matchedNeeds.push(need); }
    else { unmetNeeds.push(need); }
  });
  // Soft preferences only contribute to the "matched" side — they're nice
  // to have, never sacrificed.
  allSoft.forEach(function (need) {
    if (matchedNeeds.indexOf(need) < 0) { matchedNeeds.push(need); }
  });

  // Per-participant tradeoffs only list unmet HARD requirements, respecting
  // each member's visibility setting.
  const tradeoffs = [];
  participants.forEach(function (p) {
    const personalUnmet = (p.hard_requirements || []).filter(function (need) {
      return !isCandidateMatchingHardNeed(need, r);
    });
    if (!personalUnmet.length) { return; }
    tradeoffs.push({
      nickname: p.visibility === 'private' ? '匿名成员' : (p.nickname || '某成员'),
      unmet_needs: personalUnmet,
      reason: buildTradeoffReason(personalUnmet)
    });
  });

  return {
    restaurant_id: r.id,
    name: r.name,
    category: r.category,
    avg_price: r.avg_price,
    distance_m: r.distance_m,
    walk_minutes: r.walk_minutes,
    rating: r.rating,
    score: isPrimary ? 92 : 80,
    member_scores: memberScores,
    tags: r.tags.slice(),
    reason: isPrimary
      ? '综合 ' + r.tags.join('、') + '，覆盖大多数偏好'
      : '作为备选：' + r.tags.join('、'),
    matched_needs: matchedNeeds,
    unmet_needs: unmetNeeds,
    tradeoffs: tradeoffs,
    audit: {
      passed: passed,
      hard_rules: hard,
      soft_checks: soft,
      llm_explanation: isPrimary
        ? '该方案在硬约束上全部通过，软偏好覆盖率较高。'
        : '作为备选方案，仍满足关键硬约束。'
    }
  };
}

// Heuristic — does this mock restaurant satisfy a hard requirement string?
// Lenient by default; only marks well-known patterns as unmet.
function isCandidateMatchingHardNeed(need, r) {
  const text = String(need || '');
  if (!text) { return true; }
  if (text === '不吃辣' || /不吃辣|无辣|忌辣/.test(text)) {
    return !!r.supports_non_spicy;
  }
  if (/不吃海鲜|忌海鲜/.test(text)) {
    return r.category !== '海鲜';
  }
  if (/预算/.test(text)) {
    const max = budgetMaxFromBudgetText(text);
    if (max > 0) { return r.avg_price <= max; }
  }
  if (/距离|近一点|远|附近/.test(text)) {
    return r.distance_m <= 1000;
  }
  // Soft-style hard requirements (e.g. "可参与时段") — leniently treat as met.
  return true;
}

function buildTradeoffReason(unmet) {
  if (!unmet.length) { return ''; }
  return '可能不满足：' + unmet.slice(0, 3).join('、') + (unmet.length > 3 ? '…' : '');
}

function budgetMaxFromBudgetText(text) {
  // Accepts "预算 50-80" / "预算 ≤ 80" / "预算 80 以内" etc.
  const safe = String(text || '');
  const rangeMatch = safe.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) { return parseInt(rangeMatch[2], 10); }
  const numberMatch = safe.match(/(\d+)/);
  if (numberMatch) { return parseInt(numberMatch[1], 10); }
  return 0;
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

// ─── Normalization (snake_case + camelCase → camelCase) ─────────────────

function normalizeBoard(payload) {
  const safe = payload || {};
  const task = normalizeTask(pickValue(safe, 'task', 'task', {}));
  const participantsRaw = pickArray(safe, 'participants', 'participants');
  const participants = participantsRaw.map(normalizeParticipant);
  const recState = normalizeRecommendationState(pickValue(safe, 'recommendationState', 'recommendation_state', null));
  const recResult = normalizeRecommendationResult(pickValue(safe, 'recommendationResult', 'recommendation_result', null));

  const adjustmentRequests = pickArray(safe, 'adjustmentRequests', 'adjustment_requests')
    .map(normalizeAdjustmentRequest);

  return {
    task: task,
    taskId: task.id || pickValue(safe, 'taskId', 'task_id', ''),
    inviteToken: pickValue(safe, 'inviteToken', 'invite_token', ''),
    sharePath: pickValue(safe, 'sharePath', 'share_path', '') || task.shareUrl || '',
    participants: participants,
    conflicts: pickArray(safe, 'conflicts', 'conflicts').map(normalizeConflict),
    recommendationState: recState,
    recommendationResult: recResult,
    adjustmentRequests: adjustmentRequests,
    adjustmentRequestCount: adjustmentRequests.length,
    submittedCount: participants.length,
    expectedCount: task.expectedPeopleCount,
    pendingCount: Math.max(0, (task.expectedPeopleCount || 0) - participants.length),
    raw: safe
  };
}

function normalizeAdjustmentRequest(r) {
  const safe = r || {};
  const reasonType = pickValue(safe, 'reasonType', 'reason_type', '');
  return {
    id: pickValue(safe, 'id', 'id', ''),
    nickname: pickValue(safe, 'nickname', 'nickname', ''),
    visibility: pickValue(safe, 'visibility', 'visibility', 'public'),
    candidateId: pickValue(safe, 'candidateId', 'candidate_id', ''),
    candidateName: pickValue(safe, 'candidateName', 'candidate_name', ''),
    reasonType: reasonType,
    reasonLabel: pickValue(safe, 'reasonLabel', 'reason_label', '') ||
                 ADJUSTMENT_REASON_LABELS[reasonType] || reasonType,
    note: pickValue(safe, 'note', 'note', ''),
    createdAt: pickValue(safe, 'createdAt', 'created_at', '')
  };
}

function normalizeTask(t) {
  const safe = t || {};
  return {
    id: pickValue(safe, 'id', 'task_id', ''),
    title: pickValue(safe, 'title', 'title', ''),
    creatorName: pickValue(safe, 'creatorName', 'creator_name', ''),
    rawRequest: pickValue(safe, 'rawRequest', 'raw_request', ''),
    locationText: pickValue(safe, 'locationText', 'location_text', ''),
    expectedPeopleCount: pickValue(safe, 'expectedPeopleCount', 'expected_people_count', 0),
    dinnerTime: pickValue(safe, 'dinnerTime', 'dinner_time', ''),
    status: pickValue(safe, 'status', 'status', ''),
    shareUrl: pickValue(safe, 'shareUrl', 'share_url', '')
  };
}

function normalizeParticipant(p) {
  const safe = p || {};
  const manual = pickValue(safe, 'manualFields', 'manual_fields', {});
  const extracted = pickValue(safe, 'extractedConstraints', 'extracted_constraints', {});
  const availability = {
    availableDays: pickArray(safe, 'availableDays', 'available_days'),
    availableHours: pickArray(safe, 'availableHours', 'available_hours'),
    availableTimeText: pickValue(safe, 'availableTimeText', 'available_time_text', '')
  };

  const spicyEnum = pickValue(safe, 'spicyPreference', 'spicy_preference', '')
                 || pickValue(manual, 'spicyPreference', 'spicy_preference', '');

  return {
    id: pickValue(safe, 'id', 'participant_id', ''),
    nickname: pickValue(safe, 'nickname', 'nickname', ''),
    visibility: pickValue(safe, 'visibility', 'visibility', 'public'),
    rawPreference: pickValue(safe, 'rawPreference', 'raw_preference', ''),
    availability: availability,
    availabilitySummary: buildAvailabilitySummary(availability),
    dietaryRestrictions: pickArray(safe, 'dietaryRestrictions', 'dietary_restrictions'),
    cuisinePreferences: pickArray(safe, 'cuisinePreferences', 'cuisine_preferences'),
    hardRequirements: pickArray(safe, 'hardRequirements', 'hard_requirements'),
    softPreferences: pickArray(safe, 'softPreferences', 'soft_preferences'),
    requirementPriorities: pickValue(safe, 'requirementPriorities', 'requirement_priorities', {}),
    budgetTag: pickValue(safe, 'budgetTag', 'budget_tag', ''),
    spicyPreference: spicyEnum,
    spicyLabel: spicyLabelOf(spicyEnum),
    manualFields: {
      budgetMax: numberOrNull(pickValue(manual, 'budgetMax', 'budget_max', null)),
      spicyPreference: spicyEnum,
      spicyLabel: spicyLabelOf(spicyEnum),
      leaveBefore: pickValue(manual, 'leaveBefore', 'leave_before', '')
    },
    extractedConstraints: {
      hardConstraints: pickArray(extracted, 'hardConstraints', 'hard_constraints'),
      softPreferences: pickArray(extracted, 'softPreferences', 'soft_preferences')
    }
  };
}

function normalizeConflict(c) {
  const safe = c || {};
  return {
    type: safe.type || '',
    severity: safe.severity || 'low',
    description: safe.description || '',
    resolutionStrategy: pickValue(safe, 'resolutionStrategy', 'resolution_strategy', '')
  };
}

function normalizeRecommendationState(state) {
  const safe = state || {};
  return {
    status: safe.status || '',
    hasGenerated: !!safe.hasGenerated,
    updatedAt: pickValue(safe, 'updatedAt', 'updated_at', ''),
    dirtyReason: pickValue(safe, 'dirtyReason', 'dirty_reason', '')
  };
}

function normalizeRecommendationResult(result) {
  if (!result) { return null; }
  const finalRaw = pickValue(result, 'finalChoice', 'final_choice', {});
  const candidates = pickArray(result, 'candidates', 'candidates').map(normalizeCandidate);
  return {
    candidates: candidates,
    finalChoice: {
      restaurantId: pickValue(finalRaw, 'restaurantId', 'restaurant_id', ''),
      name: finalRaw.name || '',
      reason: finalRaw.reason || '',
      risks: pickArray(finalRaw, 'risks', 'risks'),
      backup: finalRaw.backup || ''
    },
    groupMessage: pickValue(result, 'groupMessage', 'group_message', ''),
    normalAiMessage: pickValue(result, 'normalAiMessage', 'normal_ai_message', '')
  };
}

function normalizeCandidate(c) {
  const safe = c || {};
  const auditRaw = safe.audit || {};
  const tradeoffsRaw = pickArray(safe, 'tradeoffs', 'tradeoffs');
  return {
    id: pickValue(safe, 'id', 'restaurant_id', ''),
    name: safe.name || '',
    category: safe.category || '',
    avgPrice: numberOrNull(pickValue(safe, 'avgPrice', 'avg_price', null)),
    distanceM: numberOrNull(pickValue(safe, 'distanceM', 'distance_m', null)),
    walkMinutes: numberOrNull(pickValue(safe, 'walkMinutes', 'walk_minutes', null)),
    rating: numberOrNull(safe.rating),
    score: numberOrNull(safe.score),
    tags: pickArray(safe, 'tags', 'tags'),
    reason: safe.reason || '',
    memberScores: pickValue(safe, 'memberScores', 'member_scores', {}),
    memberScoreList: buildMemberScoreList(pickValue(safe, 'memberScores', 'member_scores', {})),
    matchedNeeds: pickArray(safe, 'matchedNeeds', 'matched_needs'),
    unmetNeeds: pickArray(safe, 'unmetNeeds', 'unmet_needs'),
    tradeoffs: tradeoffsRaw.map(normalizeTradeoff),
    tradeoffSummary: buildTradeoffSummary(tradeoffsRaw),
    audit: {
      passed: !!auditRaw.passed,
      hardRules: pickValue(auditRaw, 'hardRules', 'hard_rules', {}),
      softChecks: pickValue(auditRaw, 'softChecks', 'soft_checks', {}),
      llmExplanation: pickValue(auditRaw, 'llmExplanation', 'llm_explanation', '')
    }
  };
}

function normalizeTradeoff(t) {
  const safe = t || {};
  return {
    nickname: pickValue(safe, 'nickname', 'nickname', ''),
    unmetNeeds: pickArray(safe, 'unmetNeeds', 'unmet_needs'),
    reason: pickValue(safe, 'reason', 'reason', '')
  };
}

function buildTradeoffSummary(rawTradeoffs) {
  if (!rawTradeoffs || !rawTradeoffs.length) { return ''; }
  return rawTradeoffs.slice(0, 3).map(function (t) {
    const safe = t || {};
    const name = safe.nickname || '某成员';
    const unmet = pickArray(safe, 'unmetNeeds', 'unmet_needs');
    if (!unmet.length) { return name; }
    return name + ' · ' + unmet.slice(0, 2).join('/');
  }).join('；') + (rawTradeoffs.length > 3 ? '…' : '');
}

function buildMemberScoreList(scoreMap) {
  if (!scoreMap || typeof scoreMap !== 'object') { return []; }
  return Object.keys(scoreMap).map(function (name) {
    return { nickname: name, score: scoreMap[name] };
  });
}

function buildAvailabilitySummary(availability) {
  if (!availability) { return ''; }
  const parts = [];
  const days = availability.availableDays || [];
  const hours = availability.availableHours || [];
  if (days.length) { parts.push(days.slice(0, 4).join('、') + (days.length > 4 ? '…' : '')); }
  if (hours.length) { parts.push(hours.slice(0, 4).join('、') + (hours.length > 4 ? '…' : '')); }
  if (availability.availableTimeText) {
    if (parts.length) { return parts.join(' · ') + ' · ' + availability.availableTimeText; }
    return availability.availableTimeText;
  }
  return parts.join(' · ');
}

// ─── Helpers ────────────────────────────────────────────────────────────

function pickValue(obj, camelKey, snakeKey, defaultValue) {
  if (obj == null) { return defaultValue; }
  if (obj[camelKey] !== undefined && obj[camelKey] !== null) { return obj[camelKey]; }
  if (obj[snakeKey] !== undefined && obj[snakeKey] !== null) { return obj[snakeKey]; }
  return defaultValue;
}

function pickArray(obj, camelKey, snakeKey) {
  const v = pickValue(obj, camelKey, snakeKey, []);
  return Array.isArray(v) ? v.slice() : [];
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function plainObjectOrEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { return {}; }
  return Object.assign({}, value);
}

function numberOrNull(value) {
  if (typeof value === 'number' && isFinite(value)) { return value; }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (isFinite(n)) { return n; }
  }
  return null;
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

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function nowIso() { return new Date().toISOString(); }

function generateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
}

function buildTitle(payload, expected) {
  const dinner = trim(payload.dinnerTime);
  if (dinner && expected) { return dinner + ' · ' + expected + ' 人聚餐'; }
  if (expected) { return expected + ' 人聚餐'; }
  return '一次多人约饭';
}

function buildSharePath(taskId, inviteToken) {
  return '/pages/group/fill/fill?taskId=' + encodeURIComponent(taskId) +
         '&inviteToken=' + encodeURIComponent(inviteToken);
}

function hydrateMockDb() {
  const wxApi = getMockStorageApi();
  if (ADAPTER_MODE !== 'mock' || mockDbHydrated || !wxApi) { return; }
  try {
    const stored = wxApi.getStorageSync(MOCK_DB_STORAGE_KEY);
    const storedTasks = stored && stored.tasks;
    if (storedTasks && typeof storedTasks === 'object') {
      Object.keys(storedTasks).forEach(function (taskId) {
        if (taskId && storedTasks[taskId]) {
          tasks[taskId] = storedTasks[taskId];
        }
      });
    }
    mockDbHydrated = true;
  } catch (err) {
    console.warn('[groupDiningAdapter] failed to hydrate mock db', err);
  }
}

function persistMockDb() {
  const wxApi = getMockStorageApi();
  if (ADAPTER_MODE !== 'mock') { return true; }
  if (!wxApi) { return false; }
  try {
    const snapshot = {
      version: 1,
      updated_at: nowIso(),
      tasks: {}
    };
    Object.keys(tasks).forEach(function (taskId) {
      snapshot.tasks[taskId] = tasks[taskId];
    });
    wxApi.setStorageSync(MOCK_DB_STORAGE_KEY, snapshot);
    return true;
  } catch (err) {
    console.warn('[groupDiningAdapter] failed to persist mock db', err);
    return false;
  }
}

function getMockStorageApi() {
  const wxApi = typeof wx !== 'undefined'
    ? wx
    : (typeof globalThis !== 'undefined' ? globalThis.wx : null);
  if (!wxApi ||
      typeof wxApi.getStorageSync !== 'function' ||
      typeof wxApi.setStorageSync !== 'function') {
    return null;
  }
  return wxApi;
}

function requireBoard(taskId) {
  hydrateMockDb();
  const board = tasks[taskId];
  if (!board) {
    throw makeError('not_found', '任务不存在或已过期，请让发起人重新分享链接');
  }
  return board;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.errMsg = message;
  return err;
}

function mapSpicyToEnum(input) {
  if (input === 'no_spicy' || input === 'mild' || input === 'medium' || input === 'spicy' || input === 'any') {
    return input;
  }
  if (input === '不吃辣') { return 'no_spicy'; }
  if (input === '微辣') { return 'mild'; }
  if (input === '中辣') { return 'medium'; }
  if (input === '重辣' || input === '能吃辣') { return 'spicy'; }
  if (input === '都可以' || input === '都行') { return 'any'; }
  return '';
}

function spicyLabelOf(enumValue) {
  if (enumValue === 'no_spicy') { return '不吃辣'; }
  if (enumValue === 'mild') { return '微辣'; }
  if (enumValue === 'medium') { return '中辣'; }
  if (enumValue === 'spicy') { return '能吃辣'; }
  if (enumValue === 'any') { return '都行'; }
  return '';
}

function budgetMaxFromTag(tag) {
  const safe = trim(tag);
  if (!safe || safe === '都可以' || safe === '不限') { return 0; }
  if (safe === '30 以内' || safe === '30以内') { return 30; }
  if (safe === '30-50') { return 50; }
  if (safe === '50-80') { return 80; }
  if (safe === '80-120') { return 120; }
  return parseIntLoose(safe);
}

function seedDemoTask() {
  const taskId = 'demo_task';
  const inviteToken = 'demo_invite';
  tasks[taskId] = {
    task_id: taskId,
    invite_token: inviteToken,
    share_path: buildSharePath(taskId, inviteToken),
    task: {
      task_id: taskId,
      title: '一次 5 人聚餐',
      creator_name: '小幺',
      raw_request: '一次多人聚餐，欢迎大家自由填写偏好',
      location_text: '待商量',
      expected_people_count: 5,
      dinner_time: '待商量',
      status: STATUS_WAITING,
      created_at: nowIso()
    },
    participants: [],
    conflicts: [],
    recommendation_state: {
      status: STATUS_WAITING,
      hasGenerated: false,
      updated_at: nowIso(),
      dirty_reason: ''
    },
    recommendation_result: null
  };
}

module.exports = {
  createTask,
  getTaskBoard,
  submitPreference,
  generateRecommendation,
  submitAdjustmentRequest
};
