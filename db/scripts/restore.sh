#!/bin/bash
# Restores a database dump downloaded from Cloudflare R2.
#
# THIS IS DESTRUCTIVE: it drops and recreates the target database before
# loading the dump. Requires --yes to actually run.
#
# Usage:
#   ./scripts/restore.sh postgresql/daily/2026-08-19/database.sql.gz --yes
#   ./scripts/restore.sh --list                     # see what's available in R2
#
# To restore onto a fresh droplet: bring up `docker compose up -d db` only
# first (so the roles/schema init scripts run), then run this script.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f .env ]; then
  set -a; source .env; set +a
fi

: "${R2_BUCKET:?R2_BUCKET must be set}"
: "${R2_ENDPOINT:?R2_ENDPOINT must be set}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID must be set}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY must be set}"

DB_NAME="${POSTGRES_DB:-citizens}"
DB_USER="${POSTGRES_USER:-postgres}"

mc_endpoint="${R2_ENDPOINT#https://}"
mc_endpoint="${mc_endpoint#http://}"
export MC_HOST_r2="https://${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}@${mc_endpoint}"

if [ "${1:-}" = "--list" ]; then
  echo "Daily backups:"
  docker run --rm -e MC_HOST_r2 minio/mc ls -r "r2/${R2_BUCKET}/postgresql/daily/"
  echo
  echo "Weekly backups:"
  docker run --rm -e MC_HOST_r2 minio/mc ls -r "r2/${R2_BUCKET}/postgresql/weekly/"
  exit 0
fi

KEY="${1:-}"
CONFIRM="${2:-}"
if [ -z "$KEY" ] || [ "$CONFIRM" != "--yes" ]; then
  echo "usage: $0 <r2-object-key> --yes    (or: $0 --list)" >&2
  echo "example: $0 postgresql/daily/2026-08-19/database.sql.gz --yes" >&2
  exit 1
fi

TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT

echo "Downloading r2/${R2_BUCKET}/${KEY}..."
docker run --rm -e MC_HOST_r2 -v "$(dirname "$TMPFILE"):/out" minio/mc cp \
  "r2/${R2_BUCKET}/${KEY}" "/out/$(basename "$TMPFILE")"

gzip -t "$TMPFILE" || { echo "ERROR: downloaded file failed gzip integrity check" >&2; exit 1; }

echo "About to DROP and recreate database '${DB_NAME}'. This cannot be undone."
read -r -p "Type the database name to confirm: " typed
if [ "$typed" != "$DB_NAME" ]; then
  echo "Aborted -- input did not match '${DB_NAME}'."
  exit 1
fi

echo "Stopping auth/rest (they hold open connections that block DROP DATABASE)..."
docker compose stop auth rest 2>/dev/null || true

echo "Dropping and recreating '${DB_NAME}'..."
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE);"
docker compose exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"${DB_NAME}\";"

echo "Loading dump..."
gunzip -c "$TMPFILE" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"

echo "Restarting auth/rest..."
docker compose up -d auth rest

echo "Restore complete."
echo "If this was a fresh droplet: make sure you ran 'docker compose up -d db'"
echo "at least once BEFORE this script, so postgres/init/*.sql already created"
echo "the anon/authenticated/authenticator/supabase_auth_admin roles that this"
echo "dump's ownership/grants refer to."
