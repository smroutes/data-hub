#!/bin/bash
# Sets passwords for the roles created in 01-roles.sql from environment
# variables passed to the postgres container, so no secrets are ever
# written into a SQL file or committed to the repo.
set -euo pipefail

: "${AUTHENTICATOR_PASSWORD:?AUTHENTICATOR_PASSWORD must be set}"
: "${GOTRUE_DB_PASSWORD:?GOTRUE_DB_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER ROLE authenticator WITH PASSWORD '${AUTHENTICATOR_PASSWORD}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${GOTRUE_DB_PASSWORD}';
EOSQL
