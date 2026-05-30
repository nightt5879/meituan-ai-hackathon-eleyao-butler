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

const baseUrl = readArg("--base-url", "http://127.0.0.1:3000").replace(/\/+$/, "");
const requireOpenClawStatus = !hasFlag("--skip-openclaw-status");
const includeOpenClawFeed = hasFlag("--include-openclaw-feed");
const includeOpenClawRecommend = hasFlag("--include-openclaw-recommend");
const demoUserId = readArg("--demo-user-id", "server-smoke");

let failures = 0;
let sessionToken = "";
let userId = "";
let profileId = "";

function makeUrl(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

function printStatus(status, name, detail = "") {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status} ${name}${suffix}`);
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function summarizeOpenClawContext(context) {
  if (!context || typeof context !== "object") {
    return "missing openclawContext";
  }

  const detail = typeof context.detail === "string" && context.detail.trim()
    ? ` detail=${context.detail.trim().slice(0, 320)}`
    : "";
  const blocks = Array.isArray(context.contextBlocks) ? ` blocks=${context.contextBlocks.join(",")}` : "";

  return `status=${context.status || "unknown"} submitted=${Boolean(context.submitted)} traceId=${context.traceId || "missing"}${blocks}${detail}`;
}

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(makeUrl(path), {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  let data = {};
  let isJson = true;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    isJson = false;
    data = { raw };
  }

  const expectedStatus = options.expectedStatus || [200];

  if (!expectedStatus.includes(response.status)) {
    const detail = data?.error?.message || data?.error?.code || raw.slice(0, 160) || response.statusText;
    throw new Error(`${path} returned ${response.status}: ${detail}`);
  }

  if (!isJson) {
    throw new Error(`${path} returned ${response.status} but response is not JSON: ${raw.slice(0, 160)}`);
  }

  return data;
}

async function step(name, run) {
  try {
    const detail = await run();
    printStatus("PASS", name, detail);
  } catch (error) {
    failures += 1;
    printStatus("FAIL", name, error instanceof Error ? error.message : String(error));
  }
}

await step("health endpoint", async () => {
  const health = await requestJson("/api/health");
  assertCondition(health.ok === true, "health.ok is not true");
  const feedMode = health.build?.openclawFeedMode ? ` / ${health.build.openclawFeedMode}` : "";
  return `${health.service || "ok"}${feedMode}`;
});

await step("food ping endpoint", async () => {
  const ping = await requestJson("/api/food/ping");
  assertCondition(ping.ok === true, "food ping did not return ok=true");
  return ping.service || "ok";
});

await step("OpenClaw status endpoint", async () => {
  const status = await requestJson("/api/food/status");
  const backendOk = Boolean(status.backend?.ok);
  const openclawReachable = Boolean(status.openclaw?.ok || status.openclaw?.gatewayReachable);

  assertCondition(backendOk, "backend.ok is not true");

  if (requireOpenClawStatus) {
    assertCondition(openclawReachable, "OpenClaw is not reachable; use --skip-openclaw-status only for local dry runs");
  }

  return openclawReachable ? "OpenClaw reachable" : "backend reachable only";
});

await step("demo account session", async () => {
  const login = await requestJson("/api/demo/session", {
    method: "POST",
    body: {
      demoUserId,
      displayName: "Server Smoke User"
    }
  });

  assertCondition(login.ok === true, "demo session did not return ok=true");
  assertCondition(typeof login.userId === "string" && login.userId.startsWith("user_"), "missing stable userId");
  assertCondition(typeof login.sessionToken === "string" && login.sessionToken.length > 10, "missing sessionToken");
  assertCondition(typeof login.profileId === "string" && login.profileId.startsWith("profile_"), "missing profileId");

  sessionToken = login.sessionToken;
  userId = login.userId;
  profileId = login.profileId;

  const profileText = JSON.stringify(login.profile || {});
  assertCondition(!profileText.includes(login.sessionToken), "profile response contains session token");

  return `${userId} / ${profileId}`;
});

await step("profile read and init", async () => {
  const current = await requestJson("/api/user/profile", { token: sessionToken });
  assertCondition(current.profileId === profileId, "profileId changed before init");
  assertCondition(current.profile?.userId === userId, "profile is not bound to current userId");
  assertCondition(current.profile?.preferences?.food, "profile missing food preference container");
  assertCondition(current.profile?.memories, "profile missing memory container");

  const initialized = await requestJson("/api/user/profile/init", {
    method: "POST",
    token: sessionToken,
    body: {}
  });
  const repeated = await requestJson("/api/user/profile/init", {
    method: "POST",
    token: sessionToken,
    body: {}
  });

  assertCondition(initialized.profileInitialized === true, "profile was not initialized");
  assertCondition(initialized.profileId === profileId, "profileId changed after init");
  assertCondition(repeated.profileId === profileId, "profileId changed after repeated init");

  return "profile initialized idempotently";
});

await step("today food info flow without OpenClaw generation", async () => {
  const ranked = await requestJson("/api/restaurants/rank", {
    method: "POST",
    body: {
      slots: {
        scene: "soloToday",
        tasteTags: ["鲜香"],
        needTags: ["汤汤水水"],
        avoidTags: ["不吃辣"],
        budgetMax: 40,
        maxDistanceKm: 1
      },
      userMemory: {
        likedTags: ["粉面"],
        favoriteShopIds: []
      },
      limit: 3
    }
  });

  assertCondition(Array.isArray(ranked.items) && ranked.items.length > 0, "restaurant ranking returned no items");
  return `${ranked.items.length} ranked items`;
});

await step("group dining flow", async () => {
  const task = await requestJson("/api/group-tasks", {
    method: "POST",
    token: sessionToken,
    expectedStatus: [201],
    body: {
      creatorName: "Server Smoke",
      rawRequest: "周六晚上 4 个人聚餐，人均 80 以内，适合聊天",
      locationText: "学校东门",
      expectedPeopleCount: 4,
      dinnerTime: "周六 18:30"
    }
  });

  assertCondition(task.taskId && task.inviteToken, "group task did not return taskId/inviteToken");

  await requestJson(`/api/group-tasks/${encodeURIComponent(task.taskId)}/participants`, {
    method: "POST",
    token: sessionToken,
    body: {
      inviteToken: task.inviteToken,
      clientId: "server-smoke-device",
      nickname: "Smoke",
      rawPreference: "不吃辣，预算 80 以内，想找安静一点的地方",
      manualFields: {
        budgetMax: 80,
        spicyPreference: "no_spicy",
        leaveBefore: "20:30"
      }
    }
  });

  const board = await requestJson(`/api/group-tasks/${encodeURIComponent(task.taskId)}/recommend`, {
    method: "POST",
    token: sessionToken,
    body: {
      inviteToken: task.inviteToken,
      openclawFeed: includeOpenClawFeed,
      useOpenClaw: false
    }
  });

  assertCondition(board.recommendationResult?.candidates?.length > 0, "group recommendation returned no candidates");
  if (includeOpenClawFeed) {
    assertCondition(
      board.openclawContext?.submitted === true,
      `group OpenClaw context was not submitted: ${summarizeOpenClawContext(board.openclawContext)}`
    );
    assertCondition(board.openclawContext?.contextBlocks?.includes("participants"), "group OpenClaw context missing participants block");
    return `${task.taskId} generated with OpenClaw context ${board.openclawContext.traceId}`;
  }

  return `${task.taskId} generated`;
});

await step("weekend planning flow", async () => {
  const plan = await requestJson("/api/weekend/plans", {
    method: "POST",
    token: sessionToken,
    expectedStatus: [201],
    body: {
      timeWindow: "周六下午 3 小时",
      budgetMax: 120,
      startArea: "学校东门",
      mood: "想轻松一点",
      energyLevel: "中等",
      companions: "朋友",
      interests: ["咖啡", "citywalk", "拍照"],
      rawText: "不想排队，想找能坐下来聊天和拍照的地方。",
      openclawFeed: includeOpenClawFeed
    }
  });

  assertCondition(plan.planId, "weekend plan missing planId");
  assertCondition(Array.isArray(plan.routes) && plan.routes.length > 0, "weekend plan returned no routes");
  if (includeOpenClawFeed) {
    assertCondition(
      plan.openclawContext?.submitted === true,
      `weekend OpenClaw context was not submitted: ${summarizeOpenClawContext(plan.openclawContext)}`
    );
    assertCondition(plan.openclawContext?.contextBlocks?.includes("route_candidates"), "weekend OpenClaw context missing route candidates block");
    return `${plan.planId} generated with OpenClaw context ${plan.openclawContext.traceId}`;
  }

  return `${plan.planId} generated`;
});

if (includeOpenClawFeed) {
  await step("food OpenClaw context feed", async () => {
    const result = await requestJson("/api/food/recommend", {
      method: "POST",
      token: sessionToken,
      body: {
        openclawFeedOnly: true,
        slots: {
          mealPurpose: "午餐",
          branchPreference: "粉面",
          budget: "20 元以内",
          distance: "1 公里以内"
        },
        preferences: {
          tasteTags: ["鲜香"],
          needTags: ["汤汤水水"],
          avoidTags: ["不吃辣"],
          spicyLevel: "不吃辣"
        },
        memoryProfile: {
          enabled: true,
          stableFoodPreferences: {
            avoidTags: ["不吃辣"],
            spicyLevel: "不吃辣",
            source: "server-smoke"
          }
        },
        requestContext: {
          excludeIds: [],
          batchIndex: 0
        }
      }
    });

    assertCondition(
      result.diagnostics?.openclawContext?.submitted === true,
      `food OpenClaw context was not submitted: ${summarizeOpenClawContext(result.diagnostics?.openclawContext)}`
    );
    assertCondition(result.diagnostics?.openclawContext?.contextBlocks?.includes("current_food_request"), "food OpenClaw context missing request block");
    return `food context ${result.diagnostics.openclawContext.traceId}`;
  });
}

if (includeOpenClawRecommend) {
  await step("optional OpenClaw recommendation generation", async () => {
    const result = await requestJson("/api/food/recommend", {
      method: "POST",
      token: sessionToken,
      body: {
        slots: {
          mealPurpose: "午餐",
          branchPreference: "粉面",
          budget: "20 元以内",
          distance: "1 公里以内"
        },
        preferences: {
          tasteTags: ["鲜香"],
          needTags: ["汤汤水水"],
          avoidTags: ["不吃辣"],
          spicyLevel: "不吃辣"
        },
        memoryProfile: {
          enabled: true,
          stableFoodPreferences: {
            avoidTags: ["不吃辣"],
            spicyLevel: "不吃辣",
            source: "server-smoke"
          }
        },
        requestContext: {
          excludeIds: [],
          batchIndex: 0
        }
      }
    });

    assertCondition(Array.isArray(result.recommendations) && result.recommendations.length > 0, "OpenClaw returned no recommendations");
    assertCondition(
      result.diagnostics?.openclawContext?.submitted === true,
      `food OpenClaw context was not submitted: ${summarizeOpenClawContext(result.diagnostics?.openclawContext)}`
    );
    assertCondition(result.diagnostics?.openclawContext?.contextBlocks?.includes("current_food_request"), "food OpenClaw context missing request block");
    return `${result.recommendations.length} recommendations with OpenClaw context ${result.diagnostics.openclawContext.traceId}`;
  });
} else {
  printStatus("SKIP", "optional OpenClaw recommendation generation", "pass --include-openclaw-recommend to submit a real recommendation request");
}

if (failures > 0) {
  console.error(`\n${failures} server flow check(s) failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`\nAll server flow checks passed for ${baseUrl}`);
