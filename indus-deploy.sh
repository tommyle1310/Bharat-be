#!/usr/bin/env bash
set -euo pipefail

# indus-deploy.sh
# Usage:
#   ./indus-deploy.sh start  [--env .env.test] [--prefer-local-db]
#   ./indus-deploy.sh stop   [--env .env.test]
#   ./indus-deploy.sh restart
#   ./indus-deploy.sh status
#   ./indus-deploy.sh logs
#
# Behavior:
# - Always aim to run host port 1310 for the app (1310:1310).
# - If port 1310 has any listener, script will show info and ask you to confirm to kill/stop it.
# - Prefix for containers: indus_auction_system_buyer_service_*
# - If REDIS in .env unreachable -> spin local redis container (internal name 'redis').
# - If DB is localhost or --prefer-local-db -> spin mysql-local; otherwise use DB from .env.
# - Creates .env.runtime for overrides (redis/mysql local).
#
PROJECT_PREFIX="indus_auction_system_buyer_service"
PROJECT="indus_auction_system_buyer_service"
COMPOSE_BASE="docker-compose.yml"
COMPOSE_REDIS="docker-compose.redis.yml"
COMPOSE_MYSQL="docker-compose.mysql.yml"
ENV_FILE_DEFAULT=".env.test"
RUNTIME_ENV=".env.runtime"
NETWORK="indus_buyer_net"

HOST_PORT=1310
REDIS_HOST_PORT_DEFAULT=6380
MYSQL_HOST_PORT_DEFAULT=3307

CMD="${1:-start}"; shift || true
PREFER_LOCAL_DB=0
ENV_FILE="$ENV_FILE_DEFAULT"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --prefer-local-db) PREFER_LOCAL_DB=1; shift ;;
    *) echo "Unknown arg $1"; exit 1 ;;
  esac
done

log(){ echo -e "\n[indus] $*"; }
err(){ echo -e "\n[indus][ERROR] $*" >&2; }

if [[ ! -f "$ENV_FILE" ]]; then
  err "Env file $ENV_FILE not found"
  exit 1
fi

# ensure docker network exists
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  log "Creating docker network $NETWORK"
  docker network create "$NETWORK" >/dev/null
fi

# helper to read env key
get_env(){
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d'=' -f2- || echo ""
}

REDIS_HOST="$(get_env REDIS_HOST)"
REDIS_PORT="$(get_env REDIS_PORT)"; REDIS_PORT="${REDIS_PORT:-6379}"
DB_HOST="$(get_env DB_HOST)"
DB_PORT="$(get_env DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
# optional: data files path from env file (for bind mount)
DATA_FILES_PATH_FROM_ENV="$(get_env DATA_FILES_PATH)"

# check tcp connect
check_tcp(){
  timeout 1 bash -c "cat < /dev/null > /dev/tcp/${1}/${2}" >/dev/null 2>&1
}

# find who listens on HOST_PORT (1310)
who_listens_port(){
  sudo ss -ltnp "( sport = :${HOST_PORT} )" 2>/dev/null || true
}

# if listener is docker container, get its container name
docker_container_publishing_port(){
  # list containers that publish host port exactly HOST_PORT
  docker ps --format '{{.Names}} {{.Ports}}' | awk -v p=":${HOST_PORT}->" \
    '$0 ~ p { print $1; exit }'
}

# kill/stop listener with confirmation
resolve_port_1310(){
  local info
  info="$(who_listens_port)"
  if [[ -z "$info" ]]; then
    return 0
  fi

  echo
  log "Port ${HOST_PORT} is currently LISTENED:"
  echo "----------------------------------------"
  echo "$info"
  echo "----------------------------------------"
  # check docker container
  local cont
  cont="$(docker_container_publishing_port || true)"
  if [[ -n "$cont" ]]; then
    if [[ "$cont" == "${PROJECT_PREFIX}"* ]] ; then
      log "Port ${HOST_PORT} is used by our project container: $cont. We'll recreate it."
      # we'll allow recreate later
      return 0
    else
      echo "Port ${HOST_PORT} is published by docker container: $cont (NOT our project)."
      read -p "Do you want to stop that container ($cont) so we can use 1310? [y/N]: " ans
      if [[ "$ans" =~ ^[Yy]$ ]]; then
        log "Stopping container $cont..."
        docker stop "$cont" || true
        docker rm "$cont" || true
        log "Stopped and removed $cont"
        sleep 1
        return 0
      else
        err "User refused to stop container $cont. Cannot bind 1310. Aborting."
        return 2
      fi
    fi
  fi

  # not a docker container => process (PID)
  # get PIDs
  local pids
  pids=$(sudo lsof -ti TCP:"${HOST_PORT}" -sTCP:LISTEN || true)
  if [[ -z "$pids" ]]; then
    # maybe ss shows but lsof didn't -> try ss parse pid
    pids=$(sudo ss -ltnp "( sport = :${HOST_PORT} )" 2>/dev/null | awk -F',' '/pid=/ { for(i=1;i<=NF;i++) if($i ~ /pid=/) { sub(/.*pid=/,"",$i); sub(/,.*$/,"",$i); print $i } }' | tr '\n' ' ' || true)
  fi

  if [[ -n "$pids" ]]; then
    echo "PID(s) listening on ${HOST_PORT}: $pids"
    read -p "Do you want to kill these PID(s) so we can bind 1310? [y/N]: " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      for p in $pids; do
        log "Killing PID $p ..."
        sudo kill -9 "$p" || true
      done
      sleep 1
      return 0
    else
      err "User refused to kill PID(s). Aborting."
      return 2
    fi
  fi

  err "Unable to resolve listener on ${HOST_PORT}"
  return 1
}

start(){
  # Decide redis usage:
  local use_local_redis=0
  if [[ -z "$REDIS_HOST" || "$REDIS_HOST" == "127.0.0.1" || "$REDIS_HOST" == "localhost" ]]; then
    use_local_redis=1
  else
    if check_tcp "$REDIS_HOST" "$REDIS_PORT"; then
      log "External REDIS reachable at $REDIS_HOST:$REDIS_PORT"
      use_local_redis=0
    else
      log "External REDIS unreachable at $REDIS_HOST:$REDIS_PORT -> will fallback to local redis container"
      use_local_redis=1
    fi
  fi

  # Decide DB usage:
  local use_local_db=0
  if [[ "$PREFER_LOCAL_DB" -eq 1 || -z "$DB_HOST" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ]]; then
    use_local_db=1
  else
    if check_tcp "$DB_HOST" "$DB_PORT"; then
      log "External DB reachable at $DB_HOST:$DB_PORT"
      use_local_db=0
    else
      log "External DB unreachable at $DB_HOST:$DB_PORT -> will fallback to local mysql container"
      use_local_db=1
    fi
  fi

  # create runtime env if needed
  cp "$ENV_FILE" "$RUNTIME_ENV"
  if [[ "$use_local_redis" -eq 1 ]]; then
    sed -i -e 's/^REDIS_HOST=.*/REDIS_HOST=redis/' \
           -e 's/^REDIS_PORT=.*/REDIS_PORT=6379/' \
           -e 's/^REDIS_TLS=.*/REDIS_TLS=false/' "$RUNTIME_ENV"
  fi
  if [[ "$use_local_db" -eq 1 ]]; then
    sed -i -e 's/^DB_HOST=.*/DB_HOST=mysql/' \
           -e 's/^DB_PORT=.*/DB_PORT=3306/' "$RUNTIME_ENV"
  fi

  # Handle file paths for local vs remote environments
  # For local development with --prefer-local-db, use local file paths from .env.development
  if [[ "$PREFER_LOCAL_DB" -eq 1 && -f ".env.development" ]]; then
    log "Using local file paths from .env.development for local development"
    # Extract file path variables from .env.development
    local_data_files_path=$(grep -E "^DATA_FILES_PATH=" ".env.development" 2>/dev/null | cut -d'=' -f2- || echo "")
    local_dir_base=$(grep -E "^DIR_BASE=" ".env.development" 2>/dev/null | cut -d'=' -f2- || echo "")
    local_dir_vehicle=$(grep -E "^DIR_VEHICLE=" ".env.development" 2>/dev/null | cut -d'=' -f2- || echo "")
    local_dir_buyer=$(grep -E "^DIR_BUYER=" ".env.development" 2>/dev/null | cut -d'=' -f2- || echo "")
    
    # Update runtime env with local paths if they exist
    # Note: For Docker containers, DATA_FILES_PATH will be overridden by Docker detection in config.ts
    if [[ -n "$local_data_files_path" ]]; then
      # Escape backslashes for sed
      escaped_path=$(echo "$local_data_files_path" | sed 's/\\/\\\\/g')
      sed -i -e "s|^DATA_FILES_PATH=.*|DATA_FILES_PATH=$escaped_path|" "$RUNTIME_ENV"
    fi
    if [[ -n "$local_dir_base" ]]; then
      # Escape backslashes for sed
      escaped_path=$(echo "$local_dir_base" | sed 's/\\/\\\\/g')
      sed -i -e "s|^DIR_BASE=.*|DIR_BASE=$escaped_path|" "$RUNTIME_ENV"
    fi
    if [[ -n "$local_dir_vehicle" ]]; then
      sed -i -e "s|^DIR_VEHICLE=.*|DIR_VEHICLE=$local_dir_vehicle|" "$RUNTIME_ENV"
    fi
    if [[ -n "$local_dir_buyer" ]]; then
      sed -i -e "s|^DIR_BUYER=.*|DIR_BUYER=$local_dir_buyer|" "$RUNTIME_ENV"
    fi
    
    # Set environment variable for Docker volume mapping
    if [[ -n "$local_data_files_path" ]]; then
      export LOCAL_DATA_FILES_PATH="$local_data_files_path"
      log "Set LOCAL_DATA_FILES_PATH=$local_data_files_path for Docker volume mapping"
    fi
  else
    log "Using file paths from $ENV_FILE for remote/production environment"
    # Ensure container can see host data files dir defined in .env.test
    if [[ -n "$DATA_FILES_PATH_FROM_ENV" ]]; then
      export LOCAL_DATA_FILES_PATH="$DATA_FILES_PATH_FROM_ENV"
      log "Set LOCAL_DATA_FILES_PATH=$DATA_FILES_PATH_FROM_ENV for Docker volume mapping"
    fi
  fi

  # Ensure 1310 is free or handle.
  who_listens_port >/dev/null 2>&1 || true
  if who_listens_port | grep -q LISTEN; then
    resolve_port_1310
    res=$?
    if [[ $res -ne 0 ]]; then
      err "Cannot acquire port ${HOST_PORT}. Aborting start."
      exit 1
    fi
  fi

  # Compose files to use
  COMPOSE_FILES=(-p "$PROJECT" -f "$COMPOSE_BASE")
  if [[ "$use_local_redis" -eq 1 && -f "$COMPOSE_REDIS" ]]; then
    COMPOSE_FILES+=(-f "$COMPOSE_REDIS")
  fi
  if [[ "$use_local_db" -eq 1 && -f "$COMPOSE_MYSQL" ]]; then
    COMPOSE_FILES+=(-f "$COMPOSE_MYSQL")
  fi

  # Export host ports envs for compose (redis/mysql host port mapping)
  export REDIS_HOST_PORT="${REDIS_HOST_PORT:-$REDIS_HOST_PORT_DEFAULT}"
  export MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-$MYSQL_HOST_PORT_DEFAULT}"

  # Start redis/mysql first when needed
  if [[ "$use_local_redis" -eq 1 && -f "$COMPOSE_REDIS" ]]; then
    log "Starting local redis container..."
    docker compose "${COMPOSE_FILES[@]}" --env-file "$RUNTIME_ENV" up -d redis || true
  fi
  if [[ "$use_local_db" -eq 1 && -f "$COMPOSE_MYSQL" ]]; then
    log "Starting local mysql container..."
    docker compose "${COMPOSE_FILES[@]}" --env-file "$RUNTIME_ENV" up -d mysql || true
  fi

  # Rebuild image to ensure latest code is used
  log "Building latest app image..."
  docker compose -p "$PROJECT" -f "$COMPOSE_BASE" build app || true

  # Finally start app (HOST port 1310 is hardcoded in compose)
  log "Starting app container (will map host 1310 -> container 1310)..."
  # Enforce low resource usage via compose deploy limits
  docker compose -p "$PROJECT" -f "$COMPOSE_BASE" --env-file "${RUNTIME_ENV}" up -d app || {
    err "docker compose up failed. See logs."
    docker compose -p "$PROJECT" -f "$COMPOSE_BASE" --env-file "${RUNTIME_ENV}" ps || true
    exit 1
  }

  log "Done. Containers (filtered):"
  docker ps --filter "name=${PROJECT_PREFIX}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  log "App should be reachable on host port ${HOST_PORT} -> container 1310"
}

stop(){
  log "Stopping project containers (compose down)..."
  docker compose -p "$PROJECT" -f "$COMPOSE_BASE" down || true
  if [[ -f "$COMPOSE_REDIS" ]]; then docker compose -p "$PROJECT" -f "$COMPOSE_REDIS" down || true; fi
  if [[ -f "$COMPOSE_MYSQL" ]]; then docker compose -p "$PROJECT" -f "$COMPOSE_MYSQL" down || true; fi
  rm -f "$RUNTIME_ENV" || true
  log "Stopped."
}

status(){
  docker compose -p "$PROJECT" -f "$COMPOSE_BASE" ps || true
  if [[ -f "$COMPOSE_REDIS" ]]; then docker compose -p "$PROJECT" -f "$COMPOSE_REDIS" ps || true; fi
  if [[ -f "$COMPOSE_MYSQL" ]]; then docker compose -p "$PROJECT" -f "$COMPOSE_MYSQL" ps || true; fi
}

logs(){
  docker compose -p "$PROJECT" -f "$COMPOSE_BASE" logs -f || true
}

case "$CMD" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) logs ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs} [--env .env.test] [--prefer-local-db]" ;;
esac
