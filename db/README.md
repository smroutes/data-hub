# Citizen Records DB Stack (PostgreSQL + GoTrue + PostgREST)

A minimal, self-hosted backend for an internal citizen-records tool: 2-3
office/front-desk users, ~50k records, admin-managed accounts, no public
signup. Deployed on its **own** droplet, separate from the search app in
the rest of this repo.

```
../frontend (separate app/droplet, wb275.in)
     |  cross-origin fetch, CORS
     v
gateway (Caddy, TLS + CORS)  --/auth/*-->  GoTrue   \
                             --/rest/*--> PostgREST  }--> PostgreSQL
                                                          /

pg_dump → gzip → Cloudflare R2, daily or every 15min (host cron, see "Backups" below)
```

The login UI itself lives in `../frontend` (the existing DataHub app) --
not here. This directory is the backend + a thin public gateway into it;
see `../frontend/src/lib/auth.ts` etc. for the client side.

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
├── Caddyfile             -- the gateway: TLS + CORS, /auth/* and /rest/*
├── .env.example
├── postgres/init/       -- runs once, only on an empty volume
│   ├── 01-roles.sql
│   ├── 02-set-passwords.sh
│   └── 03-schema.sql
└── scripts/
    ├── manage-users.sh  -- create/disable/enable/reset-password/list
    ├── create-admin.sh  -- bootstrap the first user
    ├── backup.sh        -- pg_dump -> gzip -> R2, with verification + retention
    ├── restore.sh        -- restore a dump from R2 (destructive, confirms twice)
    └── lib/sign-service-jwt.py
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
This exposes the API gateway on **http://localhost:8081** (`/auth/*`,
`/rest/*`). Then, separately, run the frontend against it:
```bash
cd ../frontend
npm install
npm run dev
```
Open **http://localhost:5173/login** -- `CORS_ALLOWED_ORIGIN` in `db/.env`
already defaults to `http://localhost:5173` to match. `8081`/`8444` are used
instead of `80`/`443` so this doesn't clash with the other app in this repo
if you're running both locally at once.

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
to PostgREST (`http://127.0.0.1:3000/citizens` locally, or
`https://your-api-domain.com/rest/citizens` through the gateway in
production). The actual login UI is `../frontend`'s `/login` page, which
does exactly this over `gateway` instead of hitting `auth`/`rest` directly.

## Reverse proxy / HTTPS in production

`gateway` is the public entrypoint -- Caddy, proxying `/auth/*` → GoTrue and
`/rest/*` → PostgREST over the internal Docker network, with CORS headers
so the frontend (a different origin, on a different droplet) can call it
from the browser. GoTrue and PostgREST additionally publish to `127.0.0.1`
directly, for the admin scripts and manual `curl` debugging -- the frontend
never talks to those ports, only to `gateway`.

For production: set `SITE_ADDRESS=your-api-domain.com`,
`CORS_ALLOWED_ORIGIN=https://your-frontend-domain.com`, and
`GATEWAY_HTTP_PORT=80`/`GATEWAY_HTTPS_PORT=443` in `.env`, point DNS at this
droplet, and Caddy auto-provisions Let's Encrypt HTTPS on startup -- no
manual cert steps (identical mechanism to `../docker-compose.prod.yml`'s
`SITE_ADDRESS`). Then set the frontend's API base URL env vars (see
`../frontend/README.md`) to `https://your-api-domain.com`.

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
| `gateway` (Caddy, TLS + CORS only) | ~10-20MB |
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
docker compose logs gateway       # Caddy gateway logs
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

**Frontend gets a CORS error in the browser console** -- `CORS_ALLOWED_ORIGIN`
in `db/.env` must exactly match the frontend's origin (scheme + host + port,
e.g. `http://localhost:5173`, no trailing slash). Restart `gateway` after
changing it: `docker compose up -d gateway`.

**"survives `docker compose down && up -d`?"** -- yes, `pgdata` is a named
Docker volume, unaffected by `down`/`up`. Only `docker compose down -v` (or
manually removing the volume) deletes data.

## Backups

`scripts/backup.sh` runs from host cron on the production droplet (not
inside a container) -- `pg_dump` piped through `gzip`, uploaded to
Cloudflare R2, with verification at each step (dump size, gzip integrity,
uploaded size matches local size). Filenames always include the time
(`postgresql/daily/<date>/database-<HHMMSS>.sql.gz`), so it's always safe
to run more than once a day -- one run never overwrites another's file
that same day. `BACKUP_PRUNE_ENABLED` in `.env` is `false` by default;
nothing is ever auto-deleted from R2 unless that's explicitly set to
`true`.

Cadence is just a crontab line -- the script itself doesn't care how
often it's invoked:

```bash
ssh root@api.wb275.in
crontab -e
```

- **Normal operation -- once daily**, at 2:00 AM IST (20:30 UTC, since the
  droplet's system clock is UTC while the app's own `TZ` is Asia/Kolkata):
  ```
  30 20 * * * cd /root/data-hub/db && ./scripts/backup.sh >> /var/log/db-backup.log 2>&1
  ```
- **During a citizen camp (or any day with a lot of write activity worth
  a tighter recovery window) -- every 15 minutes:**
  ```
  */15 * * * * cd /root/data-hub/db && ./scripts/backup.sh >> /var/log/db-backup.log 2>&1
  ```
  Switch back to the daily line once the camp is over -- there's no reason
  to keep the 15-minute cadence running day-to-day, it just produces ~96
  files a day instead of 1 for no ongoing benefit.

Verify a schedule change actually took effect with `crontab -l`, and
check `/var/log/db-backup.log` (or list `postgresql/daily/<today>/` in R2
directly) to confirm runs are actually landing before trusting a new
cadence.

## Restoring on a brand-new droplet

```bash
docker compose up -d db          # let init scripts create roles + empty schema
./scripts/restore.sh --list      # see available backups in R2
./scripts/restore.sh postgresql/daily/2026-08-19/database.sql.gz --yes
docker compose up -d             # bring up auth + rest now that data is loaded
```
