#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy de produção no Saturno (Proxmox), dentro do CT 101 "ct-web".
# O checkout vive em /dados/sites/finances/app e o arquivo de stack visível no
# Dockge em /opt/stacks/finances.
BASE_DIR="${FINANCES_DEPLOY_BASE:-/dados/sites/finances}"
STACK_DIR="${FINANCES_STACK_DIR:-/opt/stacks/finances}"
APP_DIR="$BASE_DIR/app"
BACKUPS_DIR="$BASE_DIR/backups"
COMPOSE_FILE="docker-compose.production.yml"
PROJECT="finances"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
APP_COMMIT_SHA="${GITHUB_SHA:-$(git -C "$WORKSPACE" rev-parse HEAD)}"
export APP_COMMIT_SHA

mkdir -p "$APP_DIR" "$BACKUPS_DIR"

echo "==> Backing up current database (if running)"
POSTGRES_CID=$(docker ps -q --filter "name=^finances-postgres$" || true)
if [ -n "$POSTGRES_CID" ]; then
  docker exec "$POSTGRES_CID" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUPS_DIR/finances-$TIMESTAMP.sql.gz"
  echo "Backup saved to $BACKUPS_DIR/finances-$TIMESTAMP.sql.gz"
  ls -1t "$BACKUPS_DIR"/finances-*.sql.gz | tail -n +11 | xargs -r rm --
else
  echo "No existing postgres container found — skipping backup (first deploy)"
fi

echo "==> Syncing checkout into $APP_DIR"
rsync -a --delete \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  "$WORKSPACE/" "$APP_DIR/"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found. Create it before the first deploy (see .env.example)." >&2
  exit 1
fi

# O volume de dados foi criado fora do Compose na migração do Jupiter; o
# arquivo o declara como external, então ele precisa existir de fato.
if ! docker volume inspect finances_postgres_data >/dev/null 2>&1; then
  echo "ERROR: docker volume finances_postgres_data não existe. Restaure o volume antes do deploy." >&2
  exit 1
fi

echo "==> Building and restarting containers"
cd "$APP_DIR"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --build

echo "==> Syncing stack file for Dockge ($STACK_DIR)"
if [ -d "$STACK_DIR" ]; then
  cp "$APP_DIR/$COMPOSE_FILE" "$STACK_DIR/compose.yml"
fi

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Health check"
for _ in $(seq 1 60); do
  VERSION_RESPONSE=$(curl -sf http://127.0.0.1:8092/api/version 2>/dev/null || true)
  if [[ "$VERSION_RESPONSE" == *"\"commit\":\"$APP_COMMIT_SHA\""* ]]; then
    if curl -sf http://127.0.0.1:8092/login >/dev/null; then
      echo "Health check passed for commit $APP_COMMIT_SHA"
      exit 0
    fi
  fi
  sleep 2
done

echo "Health check FAILED — dumping logs"
echo "Expected commit: $APP_COMMIT_SHA"
echo "Version endpoint: ${VERSION_RESPONSE:-unavailable}"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" logs --tail 50 app
exit 1
