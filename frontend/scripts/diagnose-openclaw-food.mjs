#!/usr/bin/env node

const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function readNumberArg(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(readArg(name, ""));
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), max) : fallback;
}

const baseUrl = readArg("--base-url", "http://127.0.0.1:3001").replace(/\/+$/, "");
const runs = readNumberArg("--runs", 1, 10);
const timeoutMs = readNumberArg("--timeout-ms", 90_000);
const demoUserId = readArg("--demo-user-id", `diagnose-openclaw-food-${Date.now().toString(36)}`);
const jsonOutput = hasFlag("--json");

function makeUrl(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function nowMs() {
  return Math.round(performance.now());
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const startedAt = nowMs();

  try {
    const response = await fetch(makeUrl(path), {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const raw = await response.text();
    const elapsedMs = nowMs() - startedAt;
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    const expectedStatus = options.expectedStatus || [200];
    if (!expectedStatus.includes(response.status)) {
      const detail = data?.detail || data?.error?.message || raw.slice(0, 240) || response.statusText;
      const error = new Error(`${path} returned ${response.status}: ${detail}`);
      error.data = data;
      error.elapsedMs = elapsedMs;
      throw error;
    }

    return { data, elapsedMs, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function foodRequestBody(runIndex) {
  return {
    aiProgressTraceId: `diag_food_${Date.now().toString(36)}_${runIndex}`,
    slots: {
      mealPurpose: "晚餐",
      branchPreference: "热乎的",
      budget: "60元内",
      distance: "1公里内",
      userNotes: "不要香菜，想快一点"
    },
    preferences: {
      tasteTags: ["热乎", "清淡"],
      needTags: ["单人快吃"],
      avoidTags: ["香菜"],
      temporaryAvoidTags: [],
      spicyLevel: "不吃辣"
    },
    requestContext: {
      batchIndex: runIndex
    }
  };
}

function summarizeRun(index, recommendResult, recommendElapsedMs) {
  const data = recommendResult.data;
  const diagnostics = data.diagnostics || {};
  const openclawFood = diagnostics.openclawFood || {};
  const timings = Array.isArray(diagnostics.timings) ? diagnostics.timings : [];

  return {
    run: index,
    ok: Array.isArray(data.recommendations) && data.recommendations.length > 0,
    clientTotalMs: recommendElapsedMs,
    serverTotalMs: diagnostics.durationMs,
    authMs: timingMs(timings, "auth"),
    parseRequestMs: timingMs(timings, "parse_request"),
    sanitizeRequestMs: timingMs(timings, "sanitize_request"),
    startProgressMs: timingMs(timings, "start_progress"),
    profileContextMs: timingMs(timings, "profile_context"),
    preOpenClawProgressMs: timingMs(timings, "pre_openclaw_progress"),
    openclawRecommendationMs: timingMs(timings, "openclaw_recommendation"),
    recordProgressMs: timingMs(timings, "record_progress"),
    localCandidateMs: openclawFood.localCandidateMs,
    cliMs: openclawFood.cliMs,
    parseMs: openclawFood.parseMs,
    normalizeMs: openclawFood.normalizeMs,
    inputMode: openclawFood.inputMode,
    payloadChars: openclawFood.payloadChars,
    promptChars: openclawFood.promptChars,
    responseChars: openclawFood.responseChars,
    candidateCount: openclawFood.candidateCount,
    selectedCount: openclawFood.selectedCount,
    outputMode: openclawFood.outputMode,
    firstRecommendation: data.recommendations?.[0]?.name || ""
  };
}

function timingMs(timings, name) {
  const item = timings.find((entry) => entry?.name === name);
  return item?.durationMs;
}

function printRun(summary) {
  console.log(`\nRun ${summary.run}`);
  console.table([
    { phase: "client_total", ms: summary.clientTotalMs },
    { phase: "server_total", ms: summary.serverTotalMs },
    { phase: "auth", ms: summary.authMs },
    { phase: "parse_request", ms: summary.parseRequestMs },
    { phase: "sanitize_request", ms: summary.sanitizeRequestMs },
    { phase: "start_progress", ms: summary.startProgressMs },
    { phase: "profile_context", ms: summary.profileContextMs },
    { phase: "pre_openclaw_progress", ms: summary.preOpenClawProgressMs },
    { phase: "openclaw_recommendation", ms: summary.openclawRecommendationMs },
    { phase: "record_progress", ms: summary.recordProgressMs },
    { phase: "local_candidate", ms: summary.localCandidateMs },
    { phase: "openclaw_cli_gateway_model", ms: summary.cliMs },
    { phase: "parse_openclaw_json", ms: summary.parseMs },
    { phase: "normalize_and_enrich", ms: summary.normalizeMs }
  ]);
  console.log(`inputMode=${summary.inputMode ?? "n/a"} payloadChars=${summary.payloadChars ?? "n/a"} promptChars=${summary.promptChars ?? "n/a"} responseChars=${summary.responseChars ?? "n/a"} candidateCount=${summary.candidateCount ?? "n/a"} outputMode=${summary.outputMode ?? "n/a"} selectedCount=${summary.selectedCount ?? "n/a"}`);
  console.log(`firstRecommendation=${summary.firstRecommendation || "n/a"}`);
}

const results = [];

try {
  const session = await requestJson("/api/demo/session", {
    method: "POST",
    body: {
      demoUserId,
      displayName: "OpenClaw Food Diagnostics"
    }
  });
  const token = session.data.sessionToken;

  if (!token) {
    throw new Error("demo session did not return a sessionToken");
  }

  const status = await requestJson("/api/food/status", { token });
  if (!jsonOutput) {
    const reachable = Boolean(status.data?.openclaw?.ok || status.data?.openclaw?.gatewayReachable);
    console.log(`baseUrl=${baseUrl}`);
    console.log(`demoUserId=${demoUserId}`);
    console.log(`openclawReachable=${reachable} statusMs=${status.elapsedMs}`);
  }

  for (let index = 1; index <= runs; index += 1) {
    const recommendResult = await requestJson("/api/food/recommend", {
      method: "POST",
      token,
      body: foodRequestBody(index),
      timeoutMs
    });
    const summary = summarizeRun(index, recommendResult, recommendResult.elapsedMs);
    results.push(summary);

    if (!jsonOutput) {
      printRun(summary);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ baseUrl, demoUserId, results }, null, 2));
  }
} catch (error) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      baseUrl,
      demoUserId,
      error: error instanceof Error ? error.message : String(error),
      data: error?.data,
      elapsedMs: error?.elapsedMs,
      results
    }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    if (error?.data?.diagnostics) {
      console.error(JSON.stringify(error.data.diagnostics, null, 2));
    }
  }
  process.exitCode = 1;
}
