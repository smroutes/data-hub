# Citizen Records DB Stack (PostgreSQL + GoTrue + PostgREST)

A minimal, self-hosted backend for an internal citizen-records tool: 2-3
office/front-desk users, ~50k records, admin-managed accounts, no public
signup. Deployed on its **own** droplet, separate from the search app in
the rest of this repo.

```
app (Caddy + React)  --/auth/*-->  GoTrue   \
     |                --/rest/*--> PostgREST  }--> PostgreSQL
     └── serves the login + citizen-records UI    /

nightly pg_dump → gzip → Cloudflare R2 (host cron, see scripts/backup.sh)
```

## Before you start: two things this architecture cannot do

These aren't bugs to work around -- they're how GoTrue actually works, verified
against current docs before building this:

1. **No pure "username, no email" login.** GoTrue's user model requires an
   email (or phone) as the identifier. The standard, officially-supported
   pattern -- and what this stack uses -- is to map a username to a synthetic
   address like `frontdesk1@internal.local`. No real mail is ever sent
   (`GOTRUE_DISABLE_SIGNUP=true` + `GOTRUE_MAILER_AUTOCONFIRM=true` + admin-only
   user creation), so this never touches a real inbox. Your login form can
   just show a "username" field and append `@internal.local` before sending
   it to GoTrue.
2. **No "admin user" concept in GoTrue.** There's no special admin login --
   "admin" here means "has the `JWT_SECRET` and runs the scripts in
   `scripts/`." Those scripts mint a short-lived `service_role` JWT and call
   GoTrue's Admin API. There's no in-app UI for managing users; it's
   command-line, by design (matches "no custom auth implementation").

## Layout

```
db/
├── docker-compose.yml
├── .env.example
├── postgres/init/       -- runs once, only on an empty volume
│   ├── 01-roles.sql
│   ├── 02-set-passwords.sh
│   └── 03-schema.sql
├── scripts/
│   ├── manage-users.sh  -- create/disable/enable/reset-password/list
│   ├── create-admin.sh  -- bootstrap the first user
│   ├── backup.sh        -- pg_dump -> gzip -> R2, with verification + retention
│   ├── restore.sh        -- restore a dump from R2 (destructive, confirms twice)
│   └── lib/sign-service-jwt.py
└── app/                 -- React login + citizen-records UI, served by Caddy
    ├── Dockerfile
    ├── Caddyfile         -- serves the SPA, proxies /auth/* and /rest/*
    └── src/
        ├── lib/auth.ts         -- login/refresh/logout against GoTrue
        ├── lib/AuthContext.tsx
        ├── lib/ProtectedRoute.tsx
        └── pages/{Login,Dashboard}.tsx
```

## Local development

```bash
cd db
cp .env.example .env   # fill in POSTGRES_PASSWORD, AUTHENTICATOR_PASSWORD,
                        # GOTRUE_DB_PASSWORD, JWT_SECRET (R2_* can stay blank
                        # locally -- only scripts/backup.sh needs them)
docker compose up -d --build
./scripts/create-admin.sh dev-user
```
Open **http://localhost:8080** -- login page first, then the (placeholder)
authenticated landing page after signing in. `8080`/`8443` are used instead
of `80`/`443` so this doesn't clash with the other app in this repo if
you're running both locally at once.

## Fresh droplet setup

Target: DigitalOcean Basic droplet, 1 vCPU / 512MB / 10GB, Ubuntu 24.04 LTS.

```bash
# 1. Swap -- do this before anything else (see "Memory" section for why)
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. Docker
apt update && apt install -y docker.io docker-compose-v2 git

# 3. Firewall -- SSH + nothing else public (API goes behind Caddy on 80/443
# once you set that up; until then it's not exposed at all)
apt install -y ufw
ufw allow OpenSSH
ufw allow 80,443/tcp   # only if/when you add the Caddy reverse proxy
ufw enable

# 4. Get the code
git clone https://github.com/smroutes/data-hub.git
cd data-hub/db
cp .env.example .env
nano .env   # fill in every value -- see "Generating secrets" below
```

### Generating secrets

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 32   # AUTHENTICATOR_PASSWORD
openssl rand -base64 32   # GOTRUE_DB_PASSWORD
openssl rand -base64 48   # JWT_SECRET
```
Avoid quote characters in the output if you happen to get one (regenerate) --
`AUTHENTICATOR_PASSWORD`/`GOTRUE_DB_PASSWORD` get embedded in a SQL string in
`02-set-passwords.sh`.

Fill in `R2_*` from a Cloudflare R2 API token scoped to just the backup
bucket (Object Read & Write, that bucket only -- see the main repo's R2
setup notes for the click path).

### Bring it up

```bash
docker compose up -d
docker compose ps            # wait for db to show "healthy"
./scripts/create-admin.sh    # creates the first user, prints its password once
```

`create-admin.sh` uses `ADMIN_USERNAME` from `.env` (default `admin`) unless
you pass one: `./scripts/create-admin.sh frontdesk1`.

### Managing users afterward

```bash
./scripts/manage-users.sh create frontdesk2
./scripts/manage-users.sh list
./scripts/manage-users.sh disable frontdesk2
./scripts/manage-users.sh enable frontdesk2
./scripts/manage-users.sh reset-password frontdesk1
```

### Logging in (from a client app)

```bash
curl -s http://127.0.0.1:9999/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"frontdesk1@internal.local","password":"..."}'
```
Returns an `access_token` (JWT) -- send it as `Authorization: Bearer <token>`
to PostgREST (`http://127.0.0.1:3000/citizens`).

## Reverse proxy / HTTPS in production

The `app` service *is* the reverse proxy -- it's Caddy, serving the login UI
and proxying `/auth/*` → GoTrue and `/rest/*` → PostgREST over the internal
Docker network (same pattern as `../frontend/Caddyfile` in this repo). GoTrue
and PostgREST additionally publish to `127.0.0.1` directly, for the admin
scripts and manual `curl` debugging -- not for the office UI, which only
ever talks to `app`.

For production: set `SITE_ADDRESS=your-domain.com` in `.env` and
`APP_HTTP_PORT=80`/`APP_HTTPS_PORT=443`, point DNS at the droplet, and Caddy
auto-provisions Let's Encrypt HTTPS on startup -- no manual cert steps
(identical mechanism to `../docker-compose.prod.yml`'s `SITE_ADDRESS`).

## Security checklist

- [x] Postgres never published to the host or internet -- no `ports:` entry at all
- [x] GoTrue and PostgREST bound to `127.0.0.1` only -- not reachable except through a reverse proxy you add
- [x] Separate passwords for `postgres` superuser, `authenticator`, and `supabase_auth_admin`
- [x] `anon` role has zero table grants -- unauthenticated requests see nothing
- [x] `GOTRUE_DISABLE_SIGNUP=true` -- no public registration
- [x] `.env` gitignored, `.env.example` has no real values
- [ ] You: enable `ufw`, allow only SSH (+ 80/443 once Caddy is added)
- [ ] You: put the reverse proxy's HTTPS in front before pointing real traffic at this
- [ ] You: rotate `R2_ACCESS_KEY_ID`/secret if this repo or `.env` is ever exposed

## Memory

**Be honest about this: 512MB is tight, not comfortable.** Rough idle
budget for this stack alone is close to the whole droplet before OS
overhead:

| Component | Approx. idle RAM |
|---|---|
| Postgres (tuned per this compose file) | ~150-200MB |
| GoTrue | ~20-40MB |
| PostgREST | ~15-25MB |
| `app` (Caddy, static files) | ~10-20MB |
| Ubuntu + Docker daemon | ~150-200MB |
| **Total idle** | **~360-470MB** |

Under 2-3 concurrent users doing simple CRUD, expect another 50-100MB of
headroom used (small connection pools, a handful of queries at a time) --
so **peak usage can realistically approach or exceed 512MB**. That's why
step 1 of setup is a 1GB swap file: it turns "OOM kill" into "briefly
slow," which is an acceptable trade for a low-traffic internal tool.

**What indicates memory pressure:**
- `free -h` shows swap actually in use (`Swap: ... used` growing, not just allocated)
- `docker compose logs db` shows the Postgres process being OOM-killed (check `dmesg | grep -i oom` too)
- API requests intermittently time out or the containers restart on their own (`docker compose ps` shows recent restarts)

**When to upgrade to a 1GB droplet:** if you see swap usage under normal
daytime load (not just occasional spikes), if `dmesg` shows OOM kills, or
once the citizen table grows well past 50k rows. The upgrade is a
DigitalOcean resize (a few minutes of downtime) -- no config changes needed
here, the same compose file works, just raise `shared_buffers`/
`effective_cache_size` afterward if you want to use the extra RAM.

## Troubleshooting

```bash
docker compose ps                 # container status + health
docker compose logs db            # Postgres logs
docker compose logs auth          # GoTrue logs
docker compose logs rest          # PostgREST logs
docker compose restart auth       # restart one service
```

**`db` never becomes healthy** -- check `docker compose logs db` for a
role/password error from `02-set-passwords.sh`; usually means
`AUTHENTICATOR_PASSWORD`/`GOTRUE_DB_PASSWORD` weren't set before the first
`docker compose up` (init scripts only run once, on an empty volume -- see
below).

**Changed `.env` passwords but nothing changed** -- init scripts
(`postgres/init/*`) only run against a *fresh, empty* `pgdata` volume. If
you change `AUTHENTICATOR_PASSWORD` after the first boot, you must also run
`ALTER ROLE authenticator WITH PASSWORD '...'` by hand (`docker compose exec
db psql -U postgres`) -- changing `.env` alone doesn't retroactively update
existing roles.

**GoTrue won't start / migration errors** -- check `GOTRUE_DB_DATABASE_URL`
points at `db:5432` (the compose service name, not `localhost`) and that
`supabase_auth_admin`'s password in `.env` matches what
`02-set-passwords.sh` applied. `docker compose logs auth` shows the actual
migration error.

**PostgREST returns 401/403 on everything** -- confirm `JWT_SECRET` is
*identical* between the `auth` and `rest` services (it's the same `.env`
var, so this should always be true unless you edited one directly), and
that you're sending `Authorization: Bearer <token>` from a real login, not
an expired one (`JWT_EXP` default is 3600s = 1 hour).

**"survives `docker compose down && up -d`?"** -- yes, `pgdata` is a named
Docker volume, unaffected by `down`/`up`. Only `docker compose down -v` (or
manually removing the volume) deletes data.

## Restoring on a brand-new droplet

```bash
docker compose up -d db          # let init scripts create roles + empty schema
./scripts/restore.sh --list      # see available backups in R2
./scripts/restore.sh postgresql/daily/2026-08-19/database.sql.gz --yes
docker compose up -d             # bring up auth + rest now that data is loaded
```
