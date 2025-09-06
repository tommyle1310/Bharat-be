#!/bin/bash
set -euo pipefail

PROJECT="kmsg-buyer"
ENV_FILE=""
RUNTIME_ENV=".env.runtime"   # file tạm thời cho app container khi cần chỉnh REDIS_* lúc chạy redis local

select_env() {
  echo "🌐 Select environment file:"
  select choice in ".env.development" ".env.test" ".env.production"; do
    case $choice in
      .env.development|.env.test|.env.production) ENV_FILE="$choice"; break;;
      *) echo "❌ Invalid choice";;
    esac
  done
  export ENV_FILE
  echo "[KMSG] Using $ENV_FILE"
}

# simple tcp check (timeout 2s)
check_tcp() {
  host="$1"; port="$2"
  (echo > /dev/tcp/$host/$port) >/dev/null 2>&1
}

# get var from env file
env_get() {
  key="$1"
  awk -F= -v k="$key" '$0!~/^#/ && $1==k { $1=""; sub(/^=/,""); print }' "$ENV_FILE" | tr -d '\r'
}

# ensure network exists
ensure_network() {
  if ! docker network inspect kmsg_buyer_net >/dev/null 2>&1; then
    docker network create kmsg_buyer_net >/dev/null
  fi
}

start() {
  select_env
  ensure_network

  # read envs
  REDIS_HOST="$(env_get REDIS_HOST || true)"
  REDIS_PORT="$(env_get REDIS_PORT || true)"
  DB_HOST="$(env_get DB_HOST || true)"
  DB_PORT="$(env_get DB_PORT || echo 3306)"

  # --- DB: external only (KHÔNG spin mysql) ---
  if [[ -n "$DB_HOST" && "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "localhost" ]]; then
    if ! check_tcp "$DB_HOST" "$DB_PORT"; then
      echo "❌ Cannot reach external MySQL ${DB_HOST}:${DB_PORT}. App sẽ vẫn start (restart:unless-stopped), nhưng nên kiểm tra DB."
      # không fallback MySQL theo yêu cầu
    else
      echo "✅ External MySQL reachable: ${DB_HOST}:${DB_PORT}"
    fi
  fi

  # --- Redis: local vs external ---
  COMPOSE_FILES=(-f docker-compose.yml)
  USE_RUNTIME_ENV=0

  if [[ "$REDIS_HOST" == "127.0.0.1" || "$REDIS_HOST" == "localhost" || -z "$REDIS_HOST" ]]; then
    # Dùng redis local (container) + chỉnh REDIS_HOST cho app → trỏ tới service name trong network
    REDIS_PORT="${REDIS_PORT:-6379}"
    echo "🔧 Starting local Redis container at host port ${REDIS_PORT}..."
    export REDIS_PORT
    COMPOSE_FILES+=(-f docker-compose.redis.yml)

    # tạo .env.runtime dựa trên ENV_FILE nhưng sửa REDIS_* cho app container
    cp "$ENV_FILE" "$RUNTIME_ENV"
    # bắt buộc host=redis-local và tls=false
    sed -i.bak -e 's/^REDIS_HOST=.*/REDIS_HOST=redis-local/' \
               -e 's/^REDIS_PORT=.*/REDIS_PORT=6379/' \
               -e 's/^REDIS_TLS=.*/REDIS_TLS=false/' "$RUNTIME_ENV" || true
    rm -f "${RUNTIME_ENV}.bak"
    USE_RUNTIME_ENV=1
  else
    # External redis → test connect, nếu fail thì fallback sang local
    RPORT="${REDIS_PORT:-6379}"
    if check_tcp "$REDIS_HOST" "$RPORT"; then
      echo "✅ External Redis reachable: ${REDIS_HOST}:${RPORT}"
    else
      echo "⚠️  External Redis unreachable: ${REDIS_HOST}:${RPORT} → fallback to local Redis"
      export REDIS_PORT="${REDIS_PORT:-6379}"
      COMPOSE_FILES+=(-f docker-compose.redis.yml)
      cp "$ENV_FILE" "$RUNTIME_ENV"
      sed -i.bak -e 's/^REDIS_HOST=.*/REDIS_HOST=redis-local/' \
                 -e 's/^REDIS_PORT=.*/REDIS_PORT=6379/' \
                 -e 's/^REDIS_TLS=.*/REDIS_TLS=false/' "$RUNTIME_ENV" || true
      rm -f "${RUNTIME_ENV}.bak"
      USE_RUNTIME_ENV=1
    fi
  fi

  # up
  if [[ $USE_RUNTIME_ENV -eq 1 ]]; then
    ENV_FILE="$RUNTIME_ENV" docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d
  else
    docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}" up -d
  fi

  echo "✅ Up. Use: ./kmsg.sh logs | ./kmsg.sh status"
}

stop() {
  select_env
  docker compose -p "kmsg-buyer" -f docker-compose.yml down || true
  # stop redis-local nếu có
  docker compose -p "kmsg-buyer" -f docker-compose.yml -f docker-compose.redis.yml down || true
  rm -f .env.runtime
}

restart() { stop; start; }
logs()    { select_env; docker compose -p "kmsg-buyer" logs -f; }
status()  { select_env; docker compose -p "kmsg-buyer" ps; }

case "${1:-help}" in
  start)   start ;;
  stop)    stop ;;
  restart) restart ;;
  logs)    logs ;;
  status)  status ;;
  *) echo "Usage: ./kmsg.sh {start|stop|restart|logs|status}" ;;
esac
