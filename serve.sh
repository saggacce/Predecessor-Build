#!/usr/bin/env bash
# serve.sh — Manage Predecessor Build services (API + Frontend)
#
# Usage:
#   ./serve.sh start              # start in dev mode
#   ./serve.sh start --prod       # build and start in production mode
#   ./serve.sh stop               # stop all services
#   ./serve.sh restart            # stop + start (same mode as before)
#   ./serve.sh restart --prod     # stop + start in prod mode
#   ./serve.sh status             # show running status
#   ./serve.sh logs [api|web]     # tail logs (both if no arg)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$ROOT/.pids"
LOGS_DIR="$ROOT/logs"

API_PID="$PIDS_DIR/api.pid"
WEB_PID="$PIDS_DIR/web.pid"
API_LOG="$LOGS_DIR/api.log"
WEB_LOG="$LOGS_DIR/web.log"

# Ports (must match apps/api/src/index.ts and vite.config.ts)
API_PORT=3001
WEB_DEV_PORT=5173
WEB_PREVIEW_PORT=4173

# ── Colors ───────────────────────────────────────────────────────────────────

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; NC=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; }

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

wait_for_port() {
  local port="$1" retries=20
  while (( retries-- > 0 )); do
    if bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

check_env() {
  if [[ ! -f "$ROOT/.env" ]]; then
    warn ".env not found — copy .env.example and fill in DATABASE_URL and PRED_GG_* vars"
    return
  fi
  # Export all vars from .env so child processes inherit them
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
}

# ── Start ─────────────────────────────────────────────────────────────────────

start_api() {
  local mode="$1"

  if is_running "$API_PID"; then
    warn "API already running (PID $(cat "$API_PID"))"
    return
  fi

  log "Starting API ($mode)..."
  mkdir -p "$PIDS_DIR" "$LOGS_DIR"

  if [[ "$mode" == "prod" ]]; then
    NODE_ENV=production "$ROOT/node_modules/.bin/tsx" "$ROOT/apps/api/src/index.ts" \
      >> "$API_LOG" 2>&1 &
  else
    NODE_ENV=development "$ROOT/node_modules/.bin/tsx" "$ROOT/apps/api/src/index.ts" \
      >> "$API_LOG" 2>&1 &
  fi

  local pid=$!
  echo "$pid" > "$API_PID"

  if wait_for_port "$API_PORT"; then
    ok "API running on http://localhost:$API_PORT  (PID $pid)"
  else
    fail "API did not come up on port $API_PORT — check logs/api.log"
    cat "$API_LOG" | tail -10
  fi
}

start_web() {
  local mode="$1"

  if is_running "$WEB_PID"; then
    warn "Frontend already running (PID $(cat "$WEB_PID"))"
    return
  fi

  log "Starting Frontend ($mode)..."
  mkdir -p "$PIDS_DIR" "$LOGS_DIR"

  if [[ "$mode" == "prod" ]]; then
    log "Building frontend..."
    npm run build --workspace=@predecessor/web >> "$LOGS_DIR/build.log" 2>&1 \
      || { fail "Build failed — check logs/build.log"; return 1; }
    ok "Build complete"
    (cd "$ROOT/apps/web" && exec "$ROOT/apps/web/node_modules/.bin/vite" preview) \
      >> "$WEB_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$WEB_PID"
    if wait_for_port "$WEB_PREVIEW_PORT"; then
      ok "Frontend running on http://localhost:$WEB_PREVIEW_PORT  (PID $pid)"
    else
      fail "Frontend did not come up — check logs/web.log"
    fi
  else
    (cd "$ROOT/apps/web" && exec "$ROOT/apps/web/node_modules/.bin/vite") \
      >> "$WEB_LOG" 2>&1 &
    local pid=$!
    echo "$pid" > "$WEB_PID"
    if wait_for_port "$WEB_DEV_PORT"; then
      ok "Frontend running on http://localhost:$WEB_DEV_PORT  (PID $pid)"
    else
      fail "Frontend did not come up — check logs/web.log"
    fi
  fi
}

# ── Stop ──────────────────────────────────────────────────────────────────────

stop_service() {
  local name="$1" pid_file="$2"

  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    # Kill the process group so child processes (tsx, vite) are also stopped
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    rm -f "$pid_file"
    ok "$name stopped (was PID $pid)"
  else
    warn "$name was not running"
    rm -f "$pid_file"
  fi
}

stop_repo_orphans() {
  local matches
  matches="$(pgrep -af "$ROOT" 2>/dev/null || true)"
  if [[ -z "$matches" ]]; then
    return
  fi

  local pids=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if [[ "$line" =~ (tsx|vite|npm|node) ]]; then
      pids+=("${line%% *}")
    fi
  done <<< "$matches"

  if (( ${#pids[@]} == 0 )); then
    return
  fi

  warn "Stopping orphan repo processes: ${pids[*]}"
  kill "${pids[@]}" 2>/dev/null || true
}

# ── Status ────────────────────────────────────────────────────────────────────

status_service() {
  local name="$1" pid_file="$2" port="$3"

  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    echo -e "  ${GREEN}●${NC} ${BOLD}$name${NC}  running  PID $pid  port $port"
  else
    echo -e "  ${RED}○${NC} ${BOLD}$name${NC}  stopped"
    rm -f "$pid_file"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

CMD="${1:-help}"
ARG="${2:---dev}"
MODE="${ARG#--}"   # strip leading "--"  →  dev | prod

STAGING_API_PID="$PIDS_DIR/staging-api.pid"
STAGING_API_PORT=3002
STAGING_NGINX_PORT=8080
STAGING_LOG="$LOGS_DIR/staging.log"

# Load .env for all commands that interact with services
if [[ -f "$ROOT/.env" && "$CMD" != "help" && "$CMD" != "staging" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

case "$CMD" in

  start)
    check_env
    echo ""
    echo -e "${BOLD}Predecessor Build — Starting (mode: $MODE)${NC}"
    echo "──────────────────────────────────────────"
    start_api  "$MODE"
    start_web  "$MODE"
    echo ""
    echo -e "${CYAN}Logs:${NC}  tail -f logs/api.log logs/web.log"
    echo -e "${CYAN}Stop:${NC}  ./serve.sh stop"
    echo ""
    ;;

  stop)
    echo ""
    echo -e "${BOLD}Predecessor Build — Stopping${NC}"
    echo "──────────────────────────────────────────"
    stop_service "API"      "$API_PID"
    stop_service "Frontend" "$WEB_PID"
    stop_repo_orphans
    echo ""
    ;;

  restart)
    check_env
    echo ""
    echo -e "${BOLD}Predecessor Build — Restarting (mode: $MODE)${NC}"
    echo "──────────────────────────────────────────"
    stop_service "API"      "$API_PID"
    stop_service "Frontend" "$WEB_PID"
    stop_repo_orphans
    sleep 1
    start_api  "$MODE"
    start_web  "$MODE"
    echo ""
    ;;

  status)
    echo ""
    echo -e "${BOLD}Predecessor Build — Status${NC}"
    echo "──────────────────────────────────────────"
    status_service "API"      "$API_PID" "$API_PORT"
    status_service "Frontend" "$WEB_PID" "$WEB_DEV_PORT / $WEB_PREVIEW_PORT"
    echo ""
    ;;

  logs)
    TARGET="${2:-both}"
    case "$TARGET" in
      api)   tail -f "$API_LOG" ;;
      web)   tail -f "$WEB_LOG" ;;
      build) tail -f "$LOGS_DIR/build.log" ;;
      *)     tail -f "$API_LOG" "$WEB_LOG" ;;
    esac
    ;;

  staging)
    if [[ ! -f "$ROOT/.env.staging" ]]; then
      fail ".env.staging not found — copy .env.example to .env.staging and configure it"
      exit 1
    fi

    echo ""
    echo -e "${BOLD}RiftLine — Staging${NC} ${CYAN}(production-like, nginx :$STAGING_NGINX_PORT → API :$STAGING_API_PORT)${NC}"
    echo "──────────────────────────────────────────────────────────"

    # Stop previous staging if running
    if is_running "$STAGING_API_PID"; then
      stop_service "Staging API" "$STAGING_API_PID"
    fi

    # Build frontend for staging
    log "Building frontend (production build)..."
    (cd "$ROOT/apps/web" && NODE_ENV=production npm run build >> "$LOGS_DIR/staging-build.log" 2>&1) \
      || { fail "Frontend build failed — check logs/staging-build.log"; exit 1; }
    ok "Frontend built"

    # Generate Prisma client
    log "Generating Prisma client..."
    (cd "$ROOT" && npx prisma generate --schema=workers/data-sync/prisma/schema.prisma >> "$LOGS_DIR/staging-build.log" 2>&1)
    ok "Prisma client ready"

    # Load staging env and start API
    log "Starting Staging API on port $STAGING_API_PORT..."
    mkdir -p "$PIDS_DIR" "$LOGS_DIR"
    set -a
    source "$ROOT/.env.staging"
    set +a

    "$ROOT/node_modules/.bin/tsx" "$ROOT/apps/api/src/index.ts" \
      >> "$STAGING_LOG" 2>&1 &
    staging_pid=$!
    echo "$staging_pid" > "$STAGING_API_PID"

    if wait_for_port "$STAGING_API_PORT"; then
      ok "Staging API running on port $STAGING_API_PORT (PID $staging_pid)"
    else
      fail "Staging API did not start — check logs/staging.log"
      exit 1
    fi

    # Start nginx
    log "Starting nginx..."
    sudo nginx -t > /dev/null 2>&1 && sudo nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true

    if wait_for_port "$STAGING_NGINX_PORT"; then
      ok "nginx proxying http://localhost:$STAGING_NGINX_PORT → :$STAGING_API_PORT"
    else
      warn "nginx may not be running — try: sudo nginx"
    fi

    echo ""
    echo -e "${GREEN}✓ Staging ready${NC} — ${BOLD}http://localhost:$STAGING_NGINX_PORT${NC}"
    echo -e "${CYAN}Logs:${NC}  tail -f logs/staging.log"
    echo -e "${CYAN}Stop:${NC}  ./serve.sh staging-stop"
    echo ""
    ;;

  staging-stop)
    echo ""
    echo -e "${BOLD}RiftLine — Stopping Staging${NC}"
    echo "──────────────────────────────────────────"
    stop_service "Staging API" "$STAGING_API_PID"
    sudo nginx -s stop 2>/dev/null || true
    ok "nginx stopped"
    echo ""
    ;;

  staging-status)
    echo ""
    echo -e "${BOLD}RiftLine — Staging Status${NC}"
    echo "──────────────────────────────────────────"
    status_service "Staging API" "$STAGING_API_PID" "$STAGING_API_PORT"
    if curl -s "http://localhost:$STAGING_NGINX_PORT/health" | grep -q "ok" 2>/dev/null; then
      echo -e "  ${GREEN}●${NC} ${BOLD}nginx${NC}  running  port $STAGING_NGINX_PORT"
    else
      echo -e "  ${RED}○${NC} ${BOLD}nginx${NC}  stopped"
    fi
    echo ""
    ;;

  help|*)
    echo ""
    echo -e "${BOLD}Usage:${NC} ./serve.sh <command> [--dev|--prod]"
    echo ""
    echo -e "${BOLD}Development commands:${NC}"
    echo "  start   [--dev|--prod]   Start API and Frontend (default: --dev)"
    echo "  stop                     Stop all dev services"
    echo "  restart [--dev|--prod]   Stop and start again"
    echo "  status                   Show PID and port for each service"
    echo "  logs    [api|web|build]  Tail log files (default: both)"
    echo ""
    echo -e "${BOLD}Staging commands (production-like, nginx + built static):${NC}"
    echo "  staging                  Build frontend + start nginx :8080 → API :3002"
    echo "  staging-stop             Stop staging services"
    echo "  staging-status           Show staging status"
    echo ""
    echo -e "${BOLD}Environments:${NC}"
    echo "  .env          → development (Vite HMR, port 5173)"
    echo "  .env.staging  → staging (nginx :8080, NODE_ENV=production)"
    echo ""
    echo -e "${BOLD}Logs:${NC} logs/api.log  logs/web.log  logs/staging.log  logs/staging-build.log"
    echo ""
    ;;
esac
