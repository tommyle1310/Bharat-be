#!/bin/bash
set -euo pipefail

PROJECT="kmsg-buyer"
ENV_FILE=".env.test"
RUNTIME_ENV=".env.runtime"

# --- ensure network ---
if ! docker network inspect kmsg_buyer_net >/dev/null 2>&1; then
  docker network create kmsg_buyer_net >/dev/null
fi

# --- Redis fallback logic ---
REDIS_HOST="$(grep '^REDIS_HOST=' "$ENV_FILE" | cut -d= -f2 || echo "")"
REDIS_PORT="$(grep '^REDIS_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 6379)"

check_tcp() {
  local host=$1
  local port=$2
  (echo > /dev/tcp/$host/$port) >/dev/null 2>&1
}

USE_RUNTIME_ENV=0
REDIS_OK=0
if [[ -n "$REDIS_HOST" && "$REDIS_HOST" != "127.0.0.1" && "$REDIS_HOST" != "localhost" ]]; then
  if check_tcp "$REDIS_HOST" "$REDIS_PORT"; then
    REDIS_OK=1
  fi
fi

if [[ "$REDIS_OK" -eq 0 ]]; then
  echo "⚠️  Redis unreachable at $REDIS_HOST:$REDIS_PORT → fallback to local Redis container"
  cp "$ENV_FILE" "$RUNTIME_ENV"
  sed -i -e 's/^REDIS_HOST=.*/REDIS_HOST=redis-local/' \
         -e 's/^REDIS_PORT=.*/REDIS_PORT=6379/' \
         -e 's/^REDIS_TLS=.*/REDIS_TLS=false/' "$RUNTIME_ENV"
  USE_RUNTIME_ENV=1
fi

# --- Start containers ---
COMPOSE_FILES=(-f docker-compose.yml)
if [[ $USE_RUNTIME_ENV -eq 1 ]]; then
  COMPOSE_FILES+=(-f docker-compose.redis.yml)
  ENV_FILE="$RUNTIME_ENV"
fi

docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d

echo "✅ Backend + Redis up. Logs: ./kmsg.sh logs, Status: ./kmsg.sh status"

# --- CLI functions ---
logs() { docker compose -p "$PROJECT" logs -f; }
status() { docker compose -p "$PROJECT" ps; }
stop() {
  docker compose -p "$PROJECT" down || true
  rm -f "$RUNTIME_ENV"
}

# --- CLI entry ---
case "${1:-start}" in
  start) echo "✅ Already started";;
  stop) stop ;;
  restart) stop; "$0" start ;;
  logs) logs ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|restart|logs|status}" ;;
esac
