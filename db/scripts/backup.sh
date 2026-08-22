#!/bin/bash
# Logical backup: pg_dump -> gzip -> Cloudflare R2, with verification at
# each step and safe retention (never deletes the last remaining backup).
# Filenames include the time, not just the date, so this is safe to run
# many times a day without each run overwriting the last.
#
# Intended to run from host cron, e.g. every 15 minutes:
#   */15 * * * * cd /opt/data-hub/db && ./scripts/backup.sh >> /var/log/db-backup.log 2>&1
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f .env ]; then
  set -a; source .env; set +a
fi

: "${R2_BUCKET:?R2_BUCKET must be set}"
: "${R2_ENDPOINT:?R2_ENDPOINT must be set}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID must be set}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY must be set}"

RETENTION_DAILY_DAYS="${BACKUP_RETENTION_DAILY_DAYS:-7}"
RETENTION_WEEKLY_DAYS="${BACKUP_RETENTION_WEEKLY_DAYS:-56}"
# Off by default -- with intraday backups piling up fast, deleting old ones
# automatically is riskier than usual while this data is still critical.
# Set to "true" in .env once you're ready to let old backups age out again.
PRUNE_ENABLED="${BACKUP_PRUNE_ENABLED:-false}"
DB_NAME="${POSTGRES_DB:-citizens}"
DB_USER="${POSTGRES_USER:-postgres}"

DATE="$(date +%Y-%m-%d)"
TIME="$(date +%H%M%S)"
DOW="$(date +%u)" # 1=Monday .. 7=Sunday
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"; }

mc_endpoint="${R2_ENDPOINT#https://}"
mc_endpoint="${mc_endpoint#http://}"
export MC_HOST_r2="https://${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}@${mc_endpoint}"

# 1-2. pg_dump piped straight through gzip.
log "Starting pg_dump for database '${DB_NAME}'..."
if ! docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$TMPFILE"; then
  log "ERROR: pg_dump failed"
  exit 1
fi

# 3. Verify the dump: non-trivial size and a valid gzip stream.
SIZE_BYTES=$(stat -f%z "$TMPFILE" 2>/dev/null || stat -c%s "$TMPFILE")
if [ "$SIZE_BYTES" -lt 200 ]; then
  log "ERROR: dump suspiciously small (${SIZE_BYTES} bytes) -- aborting, not uploading"
  exit 1
fi
if ! gzip -t "$TMPFILE"; then
  log "ERROR: gzip integrity check failed -- aborting, not uploading"
  exit 1
fi
log "Dump OK (${SIZE_BYTES} bytes)"

# 4. Upload to R2.
DAILY_KEY="postgresql/daily/${DATE}/database-${TIME}.sql.gz"
log "Uploading to r2/${R2_BUCKET}/${DAILY_KEY}..."
if ! docker run --rm -e MC_HOST_r2 -v "$TMPFILE:/backup.sql.gz:ro" minio/mc cp /backup.sql.gz "r2/${R2_BUCKET}/${DAILY_KEY}"; then
  log "ERROR: upload failed"
  exit 1
fi

# 5. Verify the upload landed with the right size.
REMOTE_SIZE=$(docker run --rm -e MC_HOST_r2 minio/mc stat "r2/${R2_BUCKET}/${DAILY_KEY}" --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("size",0))' || echo 0)
if [ "$REMOTE_SIZE" != "$SIZE_BYTES" ]; then
  log "ERROR: uploaded size (${REMOTE_SIZE}) does not match local size (${SIZE_BYTES})"
  exit 1
fi
log "Upload verified (${REMOTE_SIZE} bytes)"

# Also keep a weekly copy on Sundays -- pinned to one run (02:00-02:14) so
# running every 15 minutes doesn't create ~96 weekly copies on a Sunday.
if [ "$DOW" = "7" ] && [ "${TIME:0:2}" = "02" ] && [ "${TIME:2:2}" = "00" ]; then
  WEEKLY_KEY="postgresql/weekly/${DATE}/database.sql.gz"
  log "Sunday 02:00 -- also copying to r2/${R2_BUCKET}/${WEEKLY_KEY}..."
  docker run --rm -e MC_HOST_r2 minio/mc cp "r2/${R2_BUCKET}/${DAILY_KEY}" "r2/${R2_BUCKET}/${WEEKLY_KEY}"
fi

# 6. Log result (this script's stdout, redirected to a logfile by cron).
log "Backup complete: ${DAILY_KEY}"

# 7. Retention -- only runs after the above succeeded, and never deletes
# the last remaining backup in a prefix.
prune() {
  local prefix="$1" retention_days="$2"
  local cutoff
  cutoff=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null || date -v-"${retention_days}"d +%Y-%m-%d)

  local dates
  dates=$(docker run --rm -e MC_HOST_r2 minio/mc ls "r2/${R2_BUCKET}/${prefix}/" 2>/dev/null | awk '{print $NF}' | tr -d '/' | sort)
  local total
  total=$(echo "$dates" | grep -c . || true)

  echo "$dates" | while read -r d; do
    [ -n "$d" ] || continue
    if [[ "$d" < "$cutoff" ]]; then
      if [ "$total" -le 1 ]; then
        log "Retention: keeping ${prefix}/${d} -- it is the only backup left"
        break
      fi
      log "Retention: deleting ${prefix}/${d} (older than ${retention_days} days)"
      docker run --rm -e MC_HOST_r2 minio/mc rm --recursive --force "r2/${R2_BUCKET}/${prefix}/${d}/"
      total=$((total - 1))
    fi
  done
}

if [ "$PRUNE_ENABLED" = "true" ]; then
  prune "postgresql/daily" "$RETENTION_DAILY_DAYS"
  prune "postgresql/weekly" "$RETENTION_WEEKLY_DAYS"
else
  log "Retention pruning disabled (BACKUP_PRUNE_ENABLED=false) -- keeping everything for now"
fi

log "Done."
