#!/usr/bin/env sh
set -eu

REPO_URL="${ELEYAO_SKILLS_REPO:-https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler.git}"
TARGET="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"
WORKDIR="$(mktemp -d)"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

git clone --depth 1 "$REPO_URL" "$WORKDIR/eleyao" >/dev/null 2>&1
node "$WORKDIR/eleyao/skills/install-eleyao-skills.mjs" --target "$TARGET" --force
