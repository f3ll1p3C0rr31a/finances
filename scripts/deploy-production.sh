#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="/home/fellipecorreia/sites/finances"
APP_DIR="$BASE_DIR/app"
BACKUPS_DIR="$BASE_DIR/backups"
COMPOSE_FILE="docker-compose.production.yml"
PROJECT="finances"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"

mkdir -p "$APP_DIR" "$BACKUPS_DIR"

echo "==> Backing up current database (if running)"
POSTGRES_CID=$(docker compose -p "$PROJECT" -f "$APP_DIR/$COMPOSE_FILE" ps -q postgres 2>/dev/null || true)
if [ -n "$POSTGRES_CID" ]; then
  docker exec "$POSTGRES_CID" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUPS_DIR/finances-$TIMESTAMP.sql.gz"
  echo "Backup saved to $BACKUPS_DIR/finances-$TIMESTAMP.sql.gz"
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
  echo "ERROR: $APP_DIR/.env not found. Create it before the first deploy (see prisma/schema.prisma env vars)." >&2
  exit 1
fi

echo "==> Building and restarting containers"
cd "$APP_DIR"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --build

echo "==> Health check"
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8090/login >/dev/null; then
    echo "Health check passed"
    exit 0
  fi
  sleep 1
done

echo "Health check FAILED — dumping logs"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" logs --tail 50 app
exit 1
