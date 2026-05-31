#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[deploy-frontend] %s\n' "$*"
}

fail() {
  printf '[deploy-frontend] ERROR: %s\n' "$*" >&2
  exit 1
}

resolve_dir() {
  local dir="$1"
  cd "$dir" >/dev/null 2>&1 && pwd -P
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_ROOT="${REPO_ROOT:-$(resolve_dir "$SCRIPT_DIR/..")}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$REPO_ROOT/.deploy.env}"

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  log "loading deploy env: $DEPLOY_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$DEPLOY_ENV_FILE"
  set +a
fi

FRONTEND_DIR="${FRONTEND_DIR:-$REPO_ROOT/frontend}"
FRONTEND_DIR="$(resolve_dir "$FRONTEND_DIR")"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
INSTALL_DEPS="${INSTALL_DEPS:-1}"
MEITUAN_DEPLOY_STATE_DIR="${MEITUAN_DEPLOY_STATE_DIR:-$REPO_ROOT/.deploy-state}"
MEITUAN_DEPLOY_LOG_FILE="${MEITUAN_DEPLOY_LOG_FILE:-$MEITUAN_DEPLOY_STATE_DIR/frontend-3001.log}"
MEITUAN_DEPLOY_PID_FILE="${MEITUAN_DEPLOY_PID_FILE:-$MEITUAN_DEPLOY_STATE_DIR/frontend-3001.pid}"
STOP_TIMEOUT_SECONDS="${STOP_TIMEOUT_SECONDS:-10}"
DEPLOY_RESTART_MODE="${DEPLOY_RESTART_MODE:-auto}"
FRONTEND_SYSTEMD_SERVICE="${FRONTEND_SYSTEMD_SERVICE:-meituan-prj-h5.service}"
SUDO_BIN="${SUDO_BIN:-sudo}"

[[ -d "$REPO_ROOT/.git" || -f "$REPO_ROOT/.git" ]] || fail "REPO_ROOT is not a git worktree: $REPO_ROOT"
[[ -f "$FRONTEND_DIR/package.json" ]] || fail "FRONTEND_DIR does not contain package.json: $FRONTEND_DIR"

mkdir -p "$MEITUAN_DEPLOY_STATE_DIR"

log "repo: $REPO_ROOT"
log "frontend: $FRONTEND_DIR"
log "state dir: $MEITUAN_DEPLOY_STATE_DIR"
log "log file: $MEITUAN_DEPLOY_LOG_FILE"
log "restart mode: $DEPLOY_RESTART_MODE"
log "systemd service: $FRONTEND_SYSTEMD_SERVICE"

if [[ "$SKIP_GIT_PULL" != "1" ]]; then
  current_branch="$(git -C "$REPO_ROOT" branch --show-current)"
  [[ "$current_branch" == "$DEPLOY_BRANCH" ]] || fail "current branch is '$current_branch', expected '$DEPLOY_BRANCH'. Set DEPLOY_BRANCH or SKIP_GIT_PULL=1."

  log "updating branch $DEPLOY_BRANCH"
  git -C "$REPO_ROOT" fetch origin "$DEPLOY_BRANCH" --prune
  git -C "$REPO_ROOT" pull --ff-only origin "$DEPLOY_BRANCH"
else
  log "skip git pull"
fi

cd "$FRONTEND_DIR"

if [[ "$INSTALL_DEPS" != "0" ]]; then
  log "installing dependencies with npm ci"
  npm ci
else
  log "skip npm ci"
fi

log "building frontend"
npm run build

systemd_unit_exists() {
  [[ -n "$FRONTEND_SYSTEMD_SERVICE" ]] || return 1
  command -v systemctl >/dev/null 2>&1 || return 1

  systemctl list-unit-files "$FRONTEND_SYSTEMD_SERVICE" --no-legend 2>/dev/null | grep -q . \
    || systemctl status "$FRONTEND_SYSTEMD_SERVICE" >/dev/null 2>&1
}

run_systemctl() {
  if [[ "$(id -u)" == "0" ]]; then
    systemctl "$@"
  else
    "$SUDO_BIN" systemctl "$@"
  fi
}

if [[ "$DEPLOY_RESTART_MODE" != "manual" ]]; then
  if systemd_unit_exists; then
    log "restarting systemd service: $FRONTEND_SYSTEMD_SERVICE"
    run_systemctl restart "$FRONTEND_SYSTEMD_SERVICE"

    if ! run_systemctl is-active --quiet "$FRONTEND_SYSTEMD_SERVICE"; then
      run_systemctl status "$FRONTEND_SYSTEMD_SERVICE" --no-pager || true
      fail "systemd service did not become active: $FRONTEND_SYSTEMD_SERVICE"
    fi

    log "systemd service is active: $FRONTEND_SYSTEMD_SERVICE"
    log "status: $SUDO_BIN systemctl status $FRONTEND_SYSTEMD_SERVICE --no-pager"
    exit 0
  fi

  if [[ "$DEPLOY_RESTART_MODE" == "systemd" ]]; then
    fail "systemd service not found: $FRONTEND_SYSTEMD_SERVICE"
  fi

  log "systemd service not found; falling back to manual npm run start"
fi

log "stopping old frontend processes from this directory"
matched_pids=()
while IFS= read -r pid; do
  [[ -n "$pid" ]] || continue
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  if [[ "$cwd" == "$FRONTEND_DIR" ]]; then
    matched_pids+=("$pid")
    log "sending TERM to pid $pid"
    kill "$pid" 2>/dev/null || true
  fi
done < <(pgrep -f 'npm run start|next start|next-server' || true)

if (( ${#matched_pids[@]} > 0 )); then
  deadline=$((SECONDS + STOP_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    still_running=0
    for pid in "${matched_pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        still_running=1
        break
      fi
    done
    (( still_running == 0 )) && break
    sleep 1
  done

  for pid in "${matched_pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log "pid $pid did not stop after ${STOP_TIMEOUT_SECONDS}s; sending KILL"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
else
  log "no existing frontend process matched $FRONTEND_DIR"
fi

log "starting frontend with npm run start"
nohup npm run start >"$MEITUAN_DEPLOY_LOG_FILE" 2>&1 &
new_pid="$!"
printf '%s\n' "$new_pid" >"$MEITUAN_DEPLOY_PID_FILE"

sleep 2
if ! kill -0 "$new_pid" 2>/dev/null; then
  tail -n 80 "$MEITUAN_DEPLOY_LOG_FILE" >&2 || true
  fail "frontend process exited immediately"
fi

log "started pid: $new_pid"
log "pid file: $MEITUAN_DEPLOY_PID_FILE"
log "tail logs: tail -f \"$MEITUAN_DEPLOY_LOG_FILE\""
