-- Roles for the GoTrue + PostgREST stack.
-- Passwords are set separately in 02-set-passwords.sh from environment
-- variables, so no secrets live in this file.

-- Dedicated role GoTrue connects as. Owns the `auth` schema it manages.
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;

-- Base role for unauthenticated PostgREST requests. No privileges granted
-- by default (see 03-schema.sql) -- this is an internal admin tool, not a
-- public API, so anonymous requests should see nothing.
CREATE ROLE anon NOLOGIN NOINHERIT;

-- Base role for logged-in staff (the JWT's "role" claim resolves to this).
CREATE ROLE authenticated NOLOGIN NOINHERIT;

-- Role PostgREST itself connects as. It has no privileges of its own; it
-- switches into anon/authenticated per-request based on the JWT.
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- Let the auth admin role create and manage its own `auth` schema.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO supabase_auth_admin', current_database());
END $$;

-- GoTrue expects this schema to exist and be writable by the role it
-- connects as. It runs its own migrations inside it on startup -- do not
-- hand-edit its tables. GoTrue's DDL doesn't schema-qualify its tables, so
-- the connecting role's default search_path is what routes it into `auth`
-- instead of `public` (there's no GoTrue env var for this -- upstream
-- Supabase bakes the equivalent into their custom postgres image).
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth;
