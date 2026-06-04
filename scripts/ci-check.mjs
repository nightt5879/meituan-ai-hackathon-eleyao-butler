#!/usr/bin/env node
/**
 * Repo pre-flight checks that run WITHOUT consuming GitHub Actions minutes.
 *
 *   Run locally (free):   node scripts/ci-check.mjs
 *   Run on CI (manual):   triggered only via .github/workflows/ci-checks.yml
 *                         (workflow_dispatch — never auto-runs on push/PR).
 *
 * Checks:
 *   1. Syntax-guards every hand-written .js / .mjs / .cjs outside node_modules
 *      (mini-program + repo scripts) with `node --check`. This is exactly the
 *      guard that would have caught the duplicated-`return` syntax error that
 *      shipped in mini-program/.../groupDiningAdapter.js.
 *   2. Type-checks the Next.js frontend with `tsc --noEmit`.
 *
 * Exits non-zero if any check fails, so it can gate a release / pre-commit.
 */

import { execFileSync, execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Hand-written JS lives here; everything else is TS (covered by tsc) or vendored.
const SCAN_DIRS = ["mini-program", "scripts", "frontend/scripts", "analysis/scripts"];
const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm", ".next", "out", "dist", ".git"]);
const JS_EXT = new Set([".js", ".mjs", ".cjs"]);

function collectJsFiles(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectJsFiles(full, acc);
    } else if (JS_EXT.has(extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

const problems = [];

// 1) Syntax guard ----------------------------------------------------------
const files = [];
for (const rel of SCAN_DIRS) {
  const abs = join(repoRoot, rel);
  if (existsSync(abs)) collectJsFiles(abs, files);
}

console.log(`\n[1/3] Syntax-checking ${files.length} JS files (node --check)...`);
let syntaxFailures = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    syntaxFailures += 1;
    const detail = (error.stderr || error.stdout || error.message || "").toString().trim();
    console.error(`  ✗ ${relative(repoRoot, file)}`);
    console.error(`      ${detail.split("\n").slice(0, 3).join("\n      ")}`);
  }
}
if (syntaxFailures === 0) {
  console.log("  ✓ all JS files parse cleanly");
} else {
  problems.push(`${syntaxFailures} JS file(s) failed syntax check`);
}

// 2) Frontend typecheck ----------------------------------------------------
console.log("\n[2/3] Type-checking frontend (tsc --noEmit)...");
try {
  execSync("npx tsc --noEmit", { cwd: join(repoRoot, "frontend"), stdio: "inherit" });
  console.log("  ✓ frontend types OK");
} catch {
  problems.push("frontend typecheck failed");
  console.error("  ✗ frontend typecheck failed (see output above)");
}

// 3) Frontend unit tests ---------------------------------------------------
console.log("\n[3/3] Running frontend unit tests (vitest)...");
try {
  execSync("npm test", { cwd: join(repoRoot, "frontend"), stdio: "inherit" });
  console.log("  ✓ unit tests passed");
} catch {
  problems.push("unit tests failed");
  console.error("  ✗ unit tests failed (see output above)");
}

// Summary ------------------------------------------------------------------
console.log("");
if (problems.length > 0) {
  console.error(`✗ ci-check failed:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("✓ ci-check passed.");
