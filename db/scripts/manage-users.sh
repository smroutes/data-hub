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
#
#   manage-users.sh make-admin   <username>   # RBAC: full access, bypasses permissions
#   manage-users.sh revoke-admin <username>
#   manage-users.sh grant <username> <search|applications|citizens|ai_writer|applications_export> <read|write|readwrite|none>
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

# Runs against the `db` compose service as postgres -- used for RBAC tables
# only (public.staff/permissions), never for GoTrue's own `auth` schema.
psql_exec() {
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d "${POSTGRES_DB:-citizens}" -c "$1"
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
      id=$(echo "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
      # RBAC mirror row -- see db/postgres/init/05-rbac-schema.sql. Starts
      # with is_admin=false and no permissions; grant access separately via
      # `make-admin` or `grant` below (or the Admin UI once the account
      # first signs in).
      psql_exec "INSERT INTO public.staff (id, username) VALUES ('${id}', '${username}')" >/dev/null
      echo "Created user '${username}' (${email})"
      echo "Password: ${password}"
      echo "(save this now -- it is not stored anywhere and cannot be shown again)"
      echo "No page access granted yet -- use 'grant' or 'make-admin' to give this account access."
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

  make-admin)
    [ -n "$username" ] || { echo "usage: manage-users.sh make-admin <username>" >&2; exit 1; }
    psql_exec "UPDATE public.staff SET is_admin = true WHERE username = '${username}'" >/dev/null
    echo "'${username}' is now an admin (full access, bypasses per-page permissions)"
    ;;

  revoke-admin)
    [ -n "$username" ] || { echo "usage: manage-users.sh revoke-admin <username>" >&2; exit 1; }
    psql_exec "UPDATE public.staff SET is_admin = false WHERE username = '${username}'" >/dev/null
    echo "'${username}' is no longer an admin"
    ;;

  grant)
    page="${3:-}"
    level="${4:-}"
    case "$page" in search|applications|citizens|ai_writer|applications_export) ;; *)
      echo "usage: manage-users.sh grant <username> <search|applications|citizens|ai_writer|applications_export> <read|write|readwrite|none>" >&2; exit 1 ;;
    esac
    case "$level" in
      read)      can_read=true;  can_write=false ;;
      write)     can_read=false; can_write=true ;;
      readwrite) can_read=true;  can_write=true ;;
      none)      can_read=false; can_write=false ;;
      *) echo "usage: manage-users.sh grant <username> <search|applications|citizens|ai_writer|applications_export> <read|write|readwrite|none>" >&2; exit 1 ;;
    esac
    [ -n "$username" ] || { echo "usage: manage-users.sh grant <username> <page> <level>" >&2; exit 1; }
    psql_exec "
      INSERT INTO public.permissions (user_id, page, can_read, can_write)
      SELECT id, '${page}', ${can_read}, ${can_write} FROM public.staff WHERE username = '${username}'
      ON CONFLICT (user_id, page) DO UPDATE SET can_read = ${can_read}, can_write = ${can_write}
    " >/dev/null
    echo "Set '${username}' access to '${page}': ${level}"
    ;;

  *)
    echo "usage: manage-users.sh {create|disable|enable|reset-password|list|make-admin|revoke-admin|grant} [username] [password]" >&2
    exit 1
    ;;
esac
