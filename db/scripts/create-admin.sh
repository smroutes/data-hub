#!/bin/bash
# Bootstraps the first user. Really just a thin wrapper around
# manage-users.sh create -- GoTrue has no distinct "admin account" type
# (see manage-users.sh header comment), so this is the same mechanism
# you'll use for every subsequent user.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -f ../.env ]; then
  set -a; source ../.env; set +a
fi

username="${1:-${ADMIN_USERNAME:-admin}}"
password="${2:-}"

echo "Waiting for auth service to be reachable..."
for i in $(seq 1 30); do
  curl -sf "${GOTRUE_URL:-http://127.0.0.1:9999}/health" >/dev/null 2>&1 && break
  sleep 2
done

./manage-users.sh create "$username" "$password"
