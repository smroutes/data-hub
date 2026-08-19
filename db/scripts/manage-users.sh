#!/bin/bash
# Admin user management against GoTrue's Admin API.
#
# GoTrue has no "admin user" login of its own -- admin capability here
# means holding the service_role JWT (minted from JWT_SECRET), which this
# script does on your behalf each time it runs. There is no username-only
# auth in GoTrue; usernames are mapped to a synthetic <username>@internal.local
# address. See ../README.md for why.
#
# Usage:
#   manage-users.sh create   <username> [password]   # generates a password if omitted
#   manage-users.sh disable  <username>
#   manage-users.sh enable   <username>
#   manage-users.sh reset-password <username> [password]
#   manage-users.sh list
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ -f .env ]; then
  set -a; source .env; set +a
fi

: "${JWT_SECRET:?JWT_SECRET must be set (source .env first)}"
GOTRUE_URL="${GOTRUE_URL:-http://127.0.0.1:9999}"
EMAIL_DOMAIN="${EMAIL_DOMAIN:-internal.local}"

SERVICE_JWT="$(python3 "$SCRIPT_DIR/lib/sign-service-jwt.py" "$JWT_SECRET" 300)"

api() {
  local method="$1" path="$2" body="${3:-}"
  curl -sS -X "$method" "${GOTRUE_URL}${path}" \
    -H "Authorization: Bearer ${SERVICE_JWT}" \
    -H "Content-Type: application/json" \
    ${body:+-d "$body"}
}

user_id_for() {
  local email="$1"
  api GET "/admin/users?filter=${email}" | python3 -c '
import json, sys
data = json.load(sys.stdin)
users = data.get("users", data if isinstance(data, list) else [])
for u in users:
    if u.get("email") == sys.argv[1]:
        print(u["id"]); break
' "$email"
}

cmd="${1:-}"
username="${2:-}"

case "$cmd" in
  create)
    [ -n "$username" ] || { echo "usage: manage-users.sh create <username> [password]" >&2; exit 1; }
    email="${username}@${EMAIL_DOMAIN}"
    password="${3:-$(openssl rand -base64 18)}"
    resp=$(api POST /admin/users "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true}")
    if echo "$resp" | grep -q '"id"'; then
      echo "Created user '${username}' (${email})"
      echo "Password: ${password}"
      echo "(save this now -- it is not stored anywhere and cannot be shown again)"
    else
      echo "Failed to create user:" >&2
      echo "$resp" >&2
      exit 1
    fi
    ;;

  disable)
    [ -n "$username" ] || { echo "usage: manage-users.sh disable <username>" >&2; exit 1; }
    email="${username}@${EMAIL_DOMAIN}"
    id=$(user_id_for "$email")
    [ -n "$id" ] || { echo "No such user: ${username}" >&2; exit 1; }
    api PUT "/admin/users/${id}" '{"ban_duration":"87600h"}' >/dev/null
    echo "Disabled user '${username}'"
    ;;

  enable)
    [ -n "$username" ] || { echo "usage: manage-users.sh enable <username>" >&2; exit 1; }
    email="${username}@${EMAIL_DOMAIN}"
    id=$(user_id_for "$email")
    [ -n "$id" ] || { echo "No such user: ${username}" >&2; exit 1; }
    api PUT "/admin/users/${id}" '{"ban_duration":"none"}' >/dev/null
    echo "Enabled user '${username}'"
    ;;

  reset-password)
    [ -n "$username" ] || { echo "usage: manage-users.sh reset-password <username> [password]" >&2; exit 1; }
    email="${username}@${EMAIL_DOMAIN}"
    id=$(user_id_for "$email")
    [ -n "$id" ] || { echo "No such user: ${username}" >&2; exit 1; }
    password="${3:-$(openssl rand -base64 18)}"
    api PUT "/admin/users/${id}" "{\"password\":\"${password}\"}" >/dev/null
    echo "Password reset for '${username}'"
    echo "New password: ${password}"
    ;;

  list)
    api GET "/admin/users" | python3 -c '
import json, sys
data = json.load(sys.stdin)
users = data.get("users", data if isinstance(data, list) else [])
for u in users:
    status = "disabled" if u.get("banned_until") else "active"
    email = u.get("email", "?")
    uid = u.get("id")
    print(f"{email:40} {status:10} id={uid}")
'
    ;;

  *)
    echo "usage: manage-users.sh {create|disable|enable|reset-password|list} [username] [password]" >&2
    exit 1
    ;;
esac
