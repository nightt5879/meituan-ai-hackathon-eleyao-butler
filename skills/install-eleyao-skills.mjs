#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REQUIRED_JSON_FILES = new Set([
  "skill.json",
  "input.schema.json",
  "output.schema.json",
  "examples/request.json",
  "examples/response.json"
]);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    target: process.env.OPENCLAW_SKILLS_DIR || ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--target") {
      const value = argv[index + 1];
      if (!value) throw new Error("--target requires a path value.");
      args.target = value;
      index += 1;
    } else if (arg.startsWith("--target=")) {
      args.target = arg.slice("--target=".length);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.target) {
    args.target = path.join(os.homedir(), ".openclaw", "skills");
  }

  args.target = expandHome(args.target);
  return args;
}

function printHelp() {
  console.log(`Install Eleyao OpenClaw skills.

Usage:
  node skills/install-eleyao-skills.mjs [--target <skills-root>] [--force] [--dry-run]

Options:
  --target   OpenClaw skills root. Defaults to OPENCLAW_SKILLS_DIR or ~/.openclaw/skills.
  --force    Replace existing eleyao skill directories in the target.
  --dry-run  Validate package files and print the install plan without copying.
`);
}

function expandHome(inputPath) {
  if (inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON: ${filePath}. ${error.message}`);
  }
}

function validateManifest(manifest, manifestPath) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Manifest is not an object: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    throw new Error("Manifest must contain a non-empty skills array.");
  }
  if (!Array.isArray(manifest.requiredFiles) || manifest.requiredFiles.length === 0) {
    throw new Error("Manifest must contain requiredFiles.");
  }
}

function assertRequiredFiles(skillRoot, requiredFiles) {
  const missing = requiredFiles.filter((relativeFile) => !fs.existsSync(path.join(skillRoot, relativeFile)));
  if (missing.length > 0) {
    throw new Error(`Missing files in ${skillRoot}: ${missing.join(", ")}`);
  }
}

function validateSkillPackage(skillsRoot, manifest) {
  validateManifest(manifest, path.join(skillsRoot, "eleyao-skills.manifest.json"));

  for (const skill of manifest.skills) {
    if (!skill.id || !skill.directory) {
      throw new Error(`Skill entry must include id and directory: ${JSON.stringify(skill)}`);
    }

    const skillRoot = path.join(skillsRoot, skill.directory);
    if (!fs.existsSync(skillRoot)) {
      throw new Error(`Skill directory does not exist: ${skillRoot}`);
    }
    assertRequiredFiles(skillRoot, manifest.requiredFiles);

    for (const relativeFile of manifest.requiredFiles) {
      if (REQUIRED_JSON_FILES.has(relativeFile)) {
        readJson(path.join(skillRoot, relativeFile));
      }
    }

    const skillMeta = readJson(path.join(skillRoot, "skill.json"));
    if (skillMeta.id !== skill.id) {
      throw new Error(`skill.json id mismatch in ${skillRoot}: expected ${skill.id}, got ${skillMeta.id}`);
    }
  }
}

function copySkillDirectory(sourceDir, targetDir, force) {
  if (fs.existsSync(targetDir)) {
    if (!force) {
      throw new Error(`Target already exists: ${targetDir}. Re-run with --force to replace it.`);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoSkillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
  const manifestPath = path.join(repoSkillsRoot, "eleyao-skills.manifest.json");
  const manifest = readJson(manifestPath);
  validateSkillPackage(repoSkillsRoot, manifest);

  const installPlan = manifest.skills.map((skill) => ({
    id: skill.id,
    from: path.join(repoSkillsRoot, skill.directory),
    to: path.join(args.target, skill.directory)
  }));

  console.log(`[eleyao-skills] package=${manifest.packageName} version=${manifest.version}`);
  console.log(`[eleyao-skills] target=${args.target}`);

  if (args.dryRun) {
    console.log("[eleyao-skills] dry-run ok. Planned installs:");
    for (const item of installPlan) {
      console.log(`  - ${item.id}: ${item.to}`);
    }
    return;
  }

  fs.mkdirSync(args.target, { recursive: true });
  for (const item of installPlan) {
    copySkillDirectory(item.from, item.to, args.force);
    console.log(`[eleyao-skills] installed ${item.id} -> ${item.to}`);
  }

  console.log("[eleyao-skills] done. Configure OpenClaw to scan the target skills root if it is not already in your skills.load.extraDirs.");
}

try {
  main();
} catch (error) {
  console.error(`[eleyao-skills] ERROR: ${error.message}`);
  process.exit(1);
}
