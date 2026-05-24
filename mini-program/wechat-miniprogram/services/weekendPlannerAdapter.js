// Weekend planner adapter.
//
// PUBLIC CONTRACT:
//   createPlan(payload) -> Promise<Plan>
//   getPlan(planId)    -> Promise<Plan>
//
// Pages should use this adapter instead of calling wx.request directly.

const userIdentityAdapter = requireUserIdentityAdapter();

const ADAPTER_MODE = 'fallback';
const API_BASE_URL = 'http://meituan.43-110-71-200.sslip.io';
const API_PREFIX = '/api/weekend/plans';
const API_TIMEOUT_MS = 15000;
const MOCK_DB_STORAGE_KEY = '__WEEKEND_PLANNER_MOCK_DB__';
const ARTIFICIAL_DELAY_MS = 180;
const AUTH_REQUIRED_MESSAGE = '请先完成微信登录后再生成周边轻规划';
const SESSION_TOKEN_KEYS = [
  'MEITUAN_SESSION_TOKEN',
  'sessionToken',
  'wechatSessionToken',
  'authToken',
  'MINIPROGRAM_SESSION_TOKEN'
];

const ROUTE_TYPE_LABELS = ['出门路线', '折中路线', '雨天/低体力备选'];

const CHECK_LABELS = {
  budget: '预算',
  budgetMax: '预算',
  time: '时间窗口',
  timeWindow: '时间窗口',
  weather: '天气',
  walking: '步行强度',
  walk: '步行强度',
  energy: '步行强度',
  return: '返程时间',
  returnTime: '返程时间',
  transport: '交通'
};

const CONDITION_LABELS = {
  sunny: '晴朗',
  cloudy: '多云',
  rainy: '有雨',
  hot: '偏热',
  unknown: '未知'
};

const mockPlans = Object.create(null);
let mockDbHydrated = false;

function createPlan(payload) {
  return dispatch('createPlan', mockCreatePlan, apiCreatePlan, [payload]);
}

function getPlan(planId) {
  return dispatch('getPlan', mockGetPlan, apiGetPlan, [planId]);
}

function dispatch(name, mockFn, apiFn, args) {
  if (ADAPTER_MODE === 'mock') {
    return mockFn.apply(null, args).then(function (result) {
      return normalizePlan(result, { backendStatus: 'mock' });
    });
  }

  if (ADAPTER_MODE === 'api') {
    return apiFn.apply(null, args).then(function (result) {
      return normalizePlan(result, { backendStatus: 'ok' });
    });
  }

  if (ADAPTER_MODE === 'fallback') {
    return apiFn.apply(null, args).then(function (result) {
      return normalizePlan(result, { backendStatus: 'ok' });
    }).catch(function (err) {
      if (isAuthRequiredError(err)) {
        redirectToLoginIfPossible();
        return Promise.reject(err);
      }
      console.warn('[weekendPlannerAdapter] ' + name + ' API failed, falling back to local plan', err);
      const mockArgs = args.slice();
      mockArgs.push(err);
      return mockFn.apply(null, mockArgs).then(function (result) {
        return normalizePlan(result, {
          backendStatus: 'fallback',
          backendMessage: '后端暂不可用，当前展示本地保守方案。'
        });
      });
    });
  }

  return Promise.reject(makeError('bad_mode', 'Unknown ADAPTER_MODE: ' + ADAPTER_MODE));
}

function apiCreatePlan(payload) {
  return apiRequest('POST', '', buildPlanBody(payload));
}

function apiGetPlan(planId) {
  const safePlanId = trim(planId);
  if (!safePlanId) {
    return Promise.reject(makeError('invalid_payload', '缺少 planId'));
  }
  return apiRequest('GET', '/' + encodeURIComponent(safePlanId), null);
}

function apiRequest(method, path, body) {
  return new Promise(function (resolve, reject) {
    const wxApi = getWxApi();
    if (!wxApi || typeof wxApi.request !== 'function') {
      reject(makeError('wx_unavailable', 'wx.request 不可用'));
      return;
    }

    const sessionToken = getSessionToken();
    console.log('[weekendPlannerAdapter] auth state', {
      hasToken: !!sessionToken,
      tokenPrefix: sessionToken ? sessionToken.slice(0, 8) : ''
    });

    if (!sessionToken) {
      reject(makeError('AUTH_REQUIRED', AUTH_REQUIRED_MESSAGE));
      return;
    }

    wxApi.request({
      url: getApiBaseUrl() + API_PREFIX + path,
      method: method,
      data: body == null ? undefined : body,
      header: buildRequestHeaders(sessionToken),
      timeout: API_TIMEOUT_MS,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
        } else {
          reject(normalizeApiError(res));
        }
      },
      fail: function (err) {
        reject(makeError('network_failed', (err && err.errMsg) || 'network'));
      }
    });
  });
}

function mockCreatePlan(payload, backendErr) {
  return delay(ARTIFICIAL_DELAY_MS).then(function () {
    hydrateMockDb();
    const body = buildPlanBody(payload);
    const planId = generateId('weekend');
    const plan = buildMockPlan(planId, body, backendErr);
    mockPlans[planId] = plan;
    persistMockDb();
    return plan;
  });
}

function mockGetPlan(planId, backendErr) {
  return delay(120).then(function () {
    hydrateMockDb();
    const safePlanId = trim(planId);
    const stored = safePlanId ? mockPlans[safePlanId] : null;
    if (stored) {
      if (backendErr) {
        return Object.assign({}, stored, {
          backendStatus: 'fallback',
          backendMessage: '后端暂不可用，已读回本地缓存规划。'
        });
      }
      return stored;
    }

    if (backendErr) {
      return buildMockPlan(safePlanId || 'weekend_local_preview', buildPlanBody({}), backendErr);
    }

    throw makeError('not_found', '规划不存在或已过期，请重新生成。');
  });
}

function buildPlanBody(payload) {
  const safe = payload || {};
  const timeMode = trim(safe.timeMode) === 'allDay' || safe.isAllDay === true ? 'allDay' : 'range';
  return {
    timeWindow: trim(safe.timeWindow) || '周六 14:00-17:00',
    dateLabel: trim(safe.dateLabel) || '周六',
    timeMode: timeMode,
    startTime: trim(safe.startTime) || '14:00',
    endTime: trim(safe.endTime) || '17:00',
    isAllDay: timeMode === 'allDay',
    budgetMax: parseIntLoose(safe.budgetMax) || 120,
    startArea: trim(safe.startArea) || '学校周边',
    mood: trim(safe.mood) || '想轻松一点',
    energyLevel: trim(safe.energyLevel) || '低体力',
    companions: trim(safe.companions) || '朋友',
    interests: normalizeStringArray(safe.interests),
    rawText: trim(safe.rawText)
  };
}

function buildMockPlan(planId, payload, backendErr) {
  const weatherFallback = !!backendErr;
  return {
    planId: planId,
    status: 'ready',
    request: payload,
    weather: {
      summary: weatherFallback
        ? '天气暂不可用，已按保守方案生成：优先室内、短步行、方便返程。'
        : '番禺学校周边多云，体感舒适，适合 2-4 小时轻出门。',
      status: weatherFallback ? 'unavailable' : 'ok',
      fallback: weatherFallback,
      condition: weatherFallback ? 'unknown' : 'cloudy',
      source: weatherFallback ? 'local_fallback' : 'mock_weather'
    },
    source: {
      weather: weatherFallback ? 'fallback-conservative' : 'mock-weather',
      poi: 'mock-school-area',
      planner: 'rules-v1'
    },
    routes: buildMockRoutes(payload, weatherFallback),
    createdAt: nowIso()
  };
}

function buildMockRoutes(payload, weatherFallback) {
  const budget = parseIntLoose(payload.budgetMax) || 120;
  const budgetA = Math.max(45, Math.min(budget, Math.round(budget * 0.85)));
  const budgetB = Math.max(50, Math.min(budget, Math.round(budget * 0.75)));
  const budgetC = Math.max(35, Math.min(budget, Math.round(budget * 0.6)));
  const interests = normalizeStringArray(payload.interests);
  const interestText = interests.length ? interests.slice(0, 3).join('、') : '咖啡、散步';
  const start = payload.startArea || '学校周边';
  const lowEnergy = /低|不想太累|轻松/.test(payload.energyLevel + ' ' + payload.rawText);

  return [
    {
      id: 'route_outing',
      type: 'outing',
      title: '咖啡开场 + 校园周边 citywalk',
      summary: '适合天气正常、想出门换换空气的 ' + (payload.companions || '朋友') + ' 局。',
      estimatedBudget: budgetA + ' 元以内/人',
      estimatedDurationMinutes: lowEnergy ? 150 : 180,
      transport: '步行 + 短途骑行',
      timeline: [
        { time: '0-20 分钟', title: '集合开场', placeName: start, activity: '先确认返程时间和预算上限，把路线节奏定轻一点。', durationMinutes: 20 },
        { time: '20-70 分钟', title: '咖啡/轻食补能', placeName: '学校周边咖啡或轻食店', activity: '选择不排队、可久坐的位置，适合边休息边确认下一站。', durationMinutes: 50 },
        { time: '70-140 分钟', title: interestText + '轻路线', placeName: '学校周边步行路线', activity: '围绕学校周边走一圈，拍照点不超过 2 个，避免路线过满。', durationMinutes: 70 },
        { time: '最后 30 分钟', title: '返程缓冲', placeName: '近距离返程点', activity: '保留机动时间，买水、整理照片或提前结束都方便。', durationMinutes: 30 }
      ],
      selfChecks: {
        budget: '控制在 ' + budgetA + ' 元以内',
        timeWindow: payload.timeWindow || '周边 2-4 小时',
        weather: weatherFallback ? '按天气未知处理，减少露天停留' : '多云可出门',
        walking: lowEnergy ? '低强度，单段步行不超过 20 分钟' : '中低强度，节奏可放慢',
        returnTime: '预留 30 分钟返程'
      },
      risks: weatherFallback ? ['天气未确认，优先带伞并保留室内替代点'] : ['热门咖啡店可能排队，建议准备附近备选'],
      inviteText: '找个空档一起从' + start + '出发，走一条咖啡 + citywalk 轻路线吧，预算 ' + budgetA + ' 元以内，约 ' + (lowEnergy ? '2.5' : '3') + ' 小时。'
    },
    {
      id: 'route_balanced',
      type: 'balanced',
      title: '轻食 + 展览/公园二选一',
      summary: '预算、体力和兴趣更均衡，适合想稳一点的折中方案。',
      estimatedBudget: budgetB + ' 元以内/人',
      estimatedDurationMinutes: 150,
      transport: '步行优先，必要时打车一小段',
      timeline: [
        { time: '0-45 分钟', title: '轻食简餐', placeName: '学校周边轻食店', activity: '先解决吃饭，不把路线压得太满，保留换点空间。', durationMinutes: 45 },
        { time: '45-105 分钟', title: '展览/公园二选一', placeName: '附近展览或公园', activity: '根据当天排队和天气选择室内或户外，优先低压力路线。', durationMinutes: 60 },
        { time: '105-150 分钟', title: '甜品收尾', placeName: '甜品店或便利店休息点', activity: '坐下来复盘照片、补水，确认是否直接返程。', durationMinutes: 45 }
      ],
      selfChecks: [
        { label: '预算', status: 'pass', detail: budgetB + ' 元以内，有 20% 缓冲' },
        { label: '时间窗口', status: 'pass', detail: '约 2.5 小时，可压缩' },
        { label: '天气', status: weatherFallback ? 'warn' : 'pass', detail: weatherFallback ? '天气未知时切展览/室内' : '户外和室内都可切换' },
        { label: '步行强度', status: 'pass', detail: '单段步行 10-15 分钟' },
        { label: '返程时间', status: 'pass', detail: '最后 30 分钟不新增远点' }
      ],
      risks: ['展览临时闭馆时，直接切换到公园或商圈休息点'],
      inviteText: '一起走折中路线吗？先轻食，再看天气选展览或公园，预算 ' + budgetB + ' 元以内，约 2.5 小时。'
    },
    {
      id: 'route_rainy_low_energy',
      type: 'backup',
      title: '室内咖啡 + 近距离轻食备选',
      summary: '雨天、低体力或临时不想走路时使用，路线最短。',
      estimatedBudget: budgetC + ' 元以内/人',
      estimatedDurationMinutes: 120,
      transport: '步行 1 公里内',
      timeline: [
        { time: '0-15 分钟', title: '近距离集合', placeName: '学校周边集合点', activity: '确认是否需要带伞、是否有人要提前返程。', durationMinutes: 15 },
        { time: '15-75 分钟', title: '室内咖啡/茶饮', placeName: '离校近的室内店', activity: '选择有座位、离校近的店，减少雨天和低体力负担。', durationMinutes: 60 },
        { time: '75-120 分钟', title: '轻食或补给', placeName: '近距离轻食或便利店', activity: '不新增远距离点位，补给后随时可结束或返程。', durationMinutes: 45 }
      ],
      selfChecks: {
        budget: '最低预算方案，约 ' + budgetC + ' 元以内',
        timeWindow: '2 小时内可完成',
        weather: '适配雨天/天气未知',
        walking: '低体力友好，步行最少',
        returnTime: '返程距离最短'
      },
      risks: ['体验丰富度较低，但稳定可执行'],
      inviteText: '如果下雨或大家都不想太累，就走室内低体力版：咖啡 + 近距离轻食，预算 ' + budgetC + ' 元以内，2 小时左右。'
    }
  ];
}

function normalizePlan(payload, meta) {
  const safe = payload || {};
  const weatherRaw = plainObjectOrEmpty(pickValue(safe, 'weather', 'weather', {}));
  const sourceRaw = plainObjectOrEmpty(pickValue(safe, 'source', 'source', {}));
  const rawRoutes = firstNonEmptyArray(
    pickArray(safe, 'routes', 'routes'),
    pickArray(safe, 'plans', 'plans')
  );
  const routes = rawRoutes.map(normalizeRoute);
  const sourceWeather = trim(pickValue(sourceRaw, 'weather', 'weather', ''));
  const weatherStatus = trim(pickValue(weatherRaw, 'status', 'status', '')) || 'ok';
  const weatherSource = trim(pickValue(weatherRaw, 'source', 'source', ''));
  const weatherFallback = !!weatherRaw.fallback ||
    weatherStatus === 'unavailable' ||
    sourceWeather === 'fallback-conservative' ||
    weatherSource === 'mock_fallback';
  const condition = trim(pickValue(weatherRaw, 'condition', 'condition', '')) || 'unknown';
  const backendStatus = (meta && meta.backendStatus) || safe.backendStatus || 'ok';
  const backendMessage = (meta && meta.backendMessage) || safe.backendMessage || '';

  return {
    status: safe.status || (routes.length ? 'ready' : 'empty'),
    planId: pickValue(safe, 'planId', 'plan_id', ''),
    request: plainObjectOrEmpty(pickValue(safe, 'request', 'request', {})),
    weather: {
      summary: trim(pickValue(weatherRaw, 'summary', 'summary', '')) || '天气摘要暂不可用',
      status: weatherStatus,
      fallback: weatherFallback,
      condition: condition,
      conditionText: CONDITION_LABELS[condition] || condition || '未知',
      source: weatherSource || sourceWeather || '',
      sourceLabel: weatherFallback ? '保守降级' : '实时天气'
    },
    weatherNotice: weatherFallback ? '天气暂不可用，已按保守方案生成。' : '',
    source: {
      weather: sourceWeather || weatherSource || '',
      poi: pickValue(sourceRaw, 'poi', 'poi', ''),
      planner: pickValue(sourceRaw, 'planner', 'planner', '')
    },
    routes: routes,
    hasRoutes: routes.length > 0,
    routeCountText: routes.length + ' 条路线',
    backendStatus: backendStatus,
    backendUnavailable: backendStatus === 'fallback',
    backendMessage: backendMessage,
    raw: safe
  };
}

function normalizeRoute(route, index) {
  const safe = route || {};
  const title = trim(safe.title || safe.name) || ROUTE_TYPE_LABELS[index] || ('路线 ' + (index + 1));
  const typeLabel = trim(safe.typeLabel || safe.label) || ROUTE_TYPE_LABELS[index] || '路线';
  const timeline = pickArray(safe, 'timeline', 'timeline').map(normalizeTimelineItem);
  const selfChecks = normalizeSelfChecks(
    pickValue(safe, 'selfChecks', 'self_checks', null) ||
    pickValue(safe, 'checks', 'checks', null)
  );
  const risks = normalizeTextList(firstNonEmptyArray(
    pickArray(safe, 'risks', 'risks'),
    pickArray(safe, 'riskTips', 'risk_tips')
  ));
  const estimatedBudget = pickValue(safe, 'estimatedBudget', 'estimated_budget', '');
  const estimatedDurationMinutes = parseIntLoose(
    pickValue(safe, 'estimatedDurationMinutes', 'estimated_duration_minutes', 0)
  );
  const durationText = trim(
    pickValue(safe, 'estimatedDurationText', 'estimated_duration_text', '')
  ) || formatDuration(estimatedDurationMinutes);

  return {
    id: safe.id || safe.routeId || safe.route_id || ('route_' + index),
    type: safe.type || '',
    typeLabel: typeLabel,
    title: title,
    summary: trim(safe.summary || safe.reason || safe.description),
    estimatedBudgetText: formatBudget(estimatedBudget),
    estimatedDurationText: durationText,
    transport: trim(safe.transport) || '步行优先',
    timeline: timeline,
    hasTimeline: timeline.length > 0,
    selfChecks: selfChecks,
    hasChecks: selfChecks.length > 0,
    risks: risks,
    hasRisks: risks.length > 0,
    inviteText: trim(pickValue(safe, 'inviteText', 'invite_text', '')) ||
      trim(pickValue(safe, 'inviteCopy', 'invite_copy', '')) ||
      buildInviteText(title, estimatedBudget, durationText)
  };
}

function normalizeTimelineItem(item, index) {
  if (typeof item === 'string') {
    return {
      id: 'timeline_' + index,
      time: '第 ' + (index + 1) + ' 段',
      title: item,
      placeName: '',
      activity: '',
      durationMinutes: '',
      description: '',
      hasDescription: false
    };
  }

  const safe = item || {};
  const placeName = trim(
    safe.placeName ||
    safe.place_name ||
    safe.locationName ||
    safe.location_name ||
    safe.place ||
    safe.location
  );
  const activity = trim(safe.activity || safe.description || safe.detail || safe.note || safe.desc);
  const durationMinutes = parseDurationMinutes(
    safe.durationMinutes ||
    safe.duration_minutes ||
    safe.stayMinutes ||
    safe.stay_minutes ||
    safe.duration
  );
  const description = trim(safe.description || safe.detail || safe.note || safe.desc);
  return {
    id: safe.id || ('timeline_' + index),
    time: trim(safe.time || safe.timeLabel || safe.startTime) || ('第 ' + (index + 1) + ' 段'),
    title: trim(safe.title || safe.phase || safe.name || safe.label || safe.activity || placeName) || '待安排',
    placeName: placeName,
    activity: activity,
    durationMinutes: durationMinutes || '',
    description: description,
    hasDescription: !!description
  };
}

function normalizeSelfChecks(rawChecks) {
  if (!rawChecks) { return []; }

  if (Array.isArray(rawChecks)) {
    return rawChecks.map(normalizeCheck).filter(function (item) {
      return !!item.label || !!item.detail;
    });
  }

  if (typeof rawChecks === 'object') {
    return Object.keys(rawChecks).map(function (key) {
      const value = rawChecks[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return normalizeCheck(Object.assign({ label: CHECK_LABELS[key] || key }, value));
      }
      return normalizeCheck({
        label: CHECK_LABELS[key] || key,
        status: value === false ? 'fail' : 'pass',
        detail: value === true ? '通过' : trim(value)
      });
    });
  }

  return [];
}

function normalizeCheck(check, index) {
  const safe = check || {};
  const label = trim(safe.label || safe.name || CHECK_LABELS[safe.key] || safe.key) ||
    ('自检 ' + (index + 1));
  const detail = trim(safe.detail || safe.message || safe.text || safe.description);
  const statusClass = normalizeStatusClass(safe.status || safe.result || safe.level, safe.passed, detail);
  return {
    label: label,
    detail: detail || (statusClass === 'pass' ? '通过' : '需留意'),
    statusClass: statusClass,
    statusText: safe.statusText || (statusClass === 'pass' ? '通过' : (statusClass === 'fail' ? '不通过' : '留意'))
  };
}

function normalizeStatusClass(status, passed, detail) {
  if (passed === true) { return 'pass'; }
  if (passed === false) { return 'fail'; }

  const safeStatus = trim(status).toLowerCase();
  if (safeStatus === 'pass' || safeStatus === 'ok' || safeStatus === 'passed' || safeStatus === 'true') {
    return 'pass';
  }
  if (safeStatus === 'fail' || safeStatus === 'failed' || safeStatus === 'error' || safeStatus === 'false') {
    return 'fail';
  }
  if (safeStatus === 'warn' || safeStatus === 'warning' || safeStatus === 'risk') {
    return 'warn';
  }

  if (/超|失败|不可|不通过/.test(detail || '')) { return 'warn'; }
  return 'pass';
}

function getApiBaseUrl() {
  const app = getAppSafe();
  const globalData = (app && app.globalData) || {};
  const configured = trim(
    globalData.weekendApiBaseUrl ||
    globalData.apiBaseUrl ||
    globalData.backendBaseUrl ||
    globalData.API_BASE_URL
  );
  return trimTrailingSlash(configured || API_BASE_URL);
}

function requireUserIdentityAdapter() {
  try {
    return require('./userIdentityAdapter');
  } catch (err) {
    console.warn('[weekendPlannerAdapter] userIdentityAdapter unavailable, using storage token fallback', err);
    return null;
  }
}

function buildRequestHeaders(sessionToken) {
  const headers = Object.assign(
    { 'content-type': 'application/json' },
    getAuthorizationHeaderFromIdentityAdapter()
  );
  const token = trim(sessionToken);
  if (token) {
    headers['x-session-token'] = token;
    if (!headers.Authorization) {
      headers.Authorization = 'Bearer ' + token;
    }
  }
  return headers;
}

function getSessionToken() {
  const identityToken = getSessionTokenFromIdentityAdapter();
  if (identityToken) { return identityToken; }

  const app = getAppSafe();
  const globalData = (app && app.globalData) || {};

  for (let i = 0; i < SESSION_TOKEN_KEYS.length; i++) {
    const key = SESSION_TOKEN_KEYS[i];
    const globalValue = tokenFromValue(globalData[key]);
    if (globalValue) { return globalValue; }
  }

  const wxApi = getWxApi();
  if (!wxApi || typeof wxApi.getStorageSync !== 'function') {
    return '';
  }

  for (let j = 0; j < SESSION_TOKEN_KEYS.length; j++) {
    const storageKey = SESSION_TOKEN_KEYS[j];
    try {
      const storageValue = tokenFromValue(wxApi.getStorageSync(storageKey));
      if (storageValue) { return storageValue; }
    } catch (err) {
      console.warn('[weekendPlannerAdapter] failed to read token key ' + storageKey, err);
    }
  }

  return '';
}

function getSessionTokenFromIdentityAdapter() {
  if (!userIdentityAdapter || typeof userIdentityAdapter.getSessionToken !== 'function') {
    return '';
  }

  try {
    return trim(userIdentityAdapter.getSessionToken());
  } catch (err) {
    console.warn('[weekendPlannerAdapter] userIdentityAdapter.getSessionToken failed', err);
    return '';
  }
}

function getAuthorizationHeaderFromIdentityAdapter() {
  if (!userIdentityAdapter || typeof userIdentityAdapter.getAuthorizationHeader !== 'function') {
    return {};
  }

  try {
    const header = userIdentityAdapter.getAuthorizationHeader() || {};
    return header && typeof header === 'object' ? Object.assign({}, header) : {};
  } catch (err) {
    console.warn('[weekendPlannerAdapter] userIdentityAdapter.getAuthorizationHeader failed', err);
    return {};
  }
}

function redirectToLoginIfPossible() {
  if (!userIdentityAdapter || typeof userIdentityAdapter.requireLoginRedirect !== 'function') {
    return;
  }

  try {
    userIdentityAdapter.requireLoginRedirect('/pages/weekend/weekend');
  } catch (err) {
    console.warn('[weekendPlannerAdapter] require login redirect failed', err);
  }
}

function tokenFromValue(value) {
  if (!value) { return ''; }
  if (typeof value === 'string' || typeof value === 'number') {
    return trim(value);
  }
  if (typeof value === 'object') {
    for (let i = 0; i < SESSION_TOKEN_KEYS.length; i++) {
      const nested = trim(value[SESSION_TOKEN_KEYS[i]]);
      if (nested) { return nested; }
    }
    return trim(value.token || value.accessToken || value.session_token);
  }
  return '';
}

function normalizeApiError(res) {
  const statusCode = res && res.statusCode;
  const data = (res && res.data) || {};
  const nestedError = data && data.error && typeof data.error === 'object' ? data.error : {};
  const code = trim(
    data.code ||
    data.errorCode ||
    nestedError.code ||
    (typeof data.error === 'string' ? data.error : '')
  ) || ('http_' + statusCode);
  const message = isAuthCode(code) || statusCode === 401
    ? AUTH_REQUIRED_MESSAGE
    : (trim(data.message || data.errMsg || data.errorMessage || nestedError.message) ||
       ('HTTP ' + statusCode));
  return makeError(code, message);
}

function isAuthRequiredError(err) {
  return !!err && (isAuthCode(err.code) || isAuthCode(err.errCode) ||
    isAuthCode(err.error) || err.statusCode === 401);
}

function isAuthCode(code) {
  const safe = trim(code).toUpperCase();
  return safe === 'AUTH_REQUIRED' || safe === 'UNAUTHORIZED' || safe === '401';
}

function getAppSafe() {
  if (typeof getApp !== 'function') { return null; }
  try {
    return getApp();
  } catch (err) {
    return null;
  }
}

function getWxApi() {
  if (typeof globalThis !== 'undefined' && globalThis.wx) {
    return globalThis.wx;
  }
  return typeof wx !== 'undefined' ? wx : null;
}

function hydrateMockDb() {
  const wxApi = getWxApi();
  if (mockDbHydrated || !wxApi || typeof wxApi.getStorageSync !== 'function') { return; }
  try {
    const stored = wxApi.getStorageSync(MOCK_DB_STORAGE_KEY);
    const storedPlans = stored && stored.plans;
    if (storedPlans && typeof storedPlans === 'object') {
      Object.keys(storedPlans).forEach(function (planId) {
        mockPlans[planId] = storedPlans[planId];
      });
    }
  } catch (err) {
    console.warn('[weekendPlannerAdapter] failed to hydrate mock db', err);
  }
  mockDbHydrated = true;
}

function persistMockDb() {
  const wxApi = getWxApi();
  if (!wxApi || typeof wxApi.setStorageSync !== 'function') { return false; }
  try {
    wxApi.setStorageSync(MOCK_DB_STORAGE_KEY, {
      version: 1,
      updatedAt: nowIso(),
      plans: mockPlans
    });
    return true;
  } catch (err) {
    console.warn('[weekendPlannerAdapter] failed to persist mock db', err);
    return false;
  }
}

function firstNonEmptyArray() {
  for (let i = 0; i < arguments.length; i++) {
    if (Array.isArray(arguments[i]) && arguments[i].length) {
      return arguments[i].slice();
    }
  }
  return [];
}

function pickValue(obj, camelKey, snakeKey, defaultValue) {
  if (obj == null) { return defaultValue; }
  if (obj[camelKey] !== undefined && obj[camelKey] !== null) { return obj[camelKey]; }
  if (obj[snakeKey] !== undefined && obj[snakeKey] !== null) { return obj[snakeKey]; }
  return defaultValue;
}

function pickArray(obj, camelKey, snakeKey) {
  const value = pickValue(obj, camelKey, snakeKey, []);
  return Array.isArray(value) ? value.slice() : [];
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) { return []; }
  const seen = {};
  const out = [];
  value.forEach(function (item) {
    const safe = trim(item);
    if (!safe || seen[safe]) { return; }
    seen[safe] = true;
    out.push(safe);
  });
  return out;
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) { return []; }
  return value.map(function (item) {
    if (typeof item === 'string') { return trim(item); }
    const safe = item || {};
    return trim(safe.text || safe.title || safe.message || safe.description || safe.detail);
  }).filter(function (item) {
    return !!item;
  });
}

function plainObjectOrEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { return {}; }
  return Object.assign({}, value);
}

function parseDurationMinutes(value) {
  if (typeof value === 'number' && isFinite(value)) {
    return value > 0 ? Math.round(value) : 0;
  }
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }
  return 0;
}

function formatBudget(value) {
  if (typeof value === 'number' && isFinite(value)) {
    return value + ' 元以内/人';
  }
  const safe = trim(value);
  if (safe) { return safe; }
  return '预算待确认';
}

function formatDuration(minutes) {
  if (!minutes) { return '约 2-4 小时'; }
  if (minutes < 60) { return '约 ' + minutes + ' 分钟'; }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return '约 ' + hours + (rest ? ' 小时 ' + rest + ' 分钟' : ' 小时');
}

function buildInviteText(title, budget, durationText) {
  return '一起走「' + title + '」吧，' + formatBudget(budget) + '，' + durationText + '。';
}

function parseIntLoose(value) {
  if (typeof value === 'number' && isFinite(value)) { return Math.max(0, Math.floor(value)); }
  if (typeof value === 'string') {
    const match = value.match(/-?\d+/);
    if (match) { return Math.max(0, parseInt(match[0], 10)); }
  }
  return 0;
}

function trim(value) {
  if (typeof value === 'string') { return value.trim(); }
  if (value == null) { return ''; }
  return String(value).trim();
}

function trimTrailingSlash(value) {
  return trim(value).replace(/\/+$/, '');
}

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.errMsg = message;
  if (isAuthCode(code)) {
    err.authRequired = true;
  }
  return err;
}

module.exports = {
  ADAPTER_MODE,
  API_BASE_URL,
  getApiBaseUrl,
  getSessionToken,
  createPlan,
  getPlan
};
