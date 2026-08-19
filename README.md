# data-hub

DataHub — search UI over CSV reports (DuckDB + FastAPI backend, React/Vite frontend, Caddy reverse proxy).

## Local development

```bash
cp .env.example .env   # fill in R2 creds, or leave blank to use ./sheet-data
docker compose up --build
```
Serves on `http://localhost` (HTTP only, no domain).

## Production deploy (droplet)

Images are built by GitHub Actions and published to GHCR whenever a version tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This publishes `ghcr.io/smroutes/data-hub-backend` and `ghcr.io/smroutes/data-hub-frontend`, tagged with the version and `:latest`. GHCR packages are private by default, so the droplet needs a one-time login before it can pull them.

**One-time setup on the droplet:**
1. Create a GitHub Personal Access Token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → grant **read:packages** on this repo.
2. On the droplet:
   ```bash
   echo "<your-PAT>" | docker login ghcr.io -u smroutes --password-stdin
   ```
   This only needs to be done once — Docker caches the credential.

**Deploy / redeploy:**
```bash
git clone https://github.com/smroutes/data-hub.git
cd data-hub
cp .env.example .env
nano .env   # set SITE_ADDRESS=wb275.in, plus R2 credentials

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Caddy detects the real domain in `SITE_ADDRESS` and automatically provisions HTTPS via Let's Encrypt — no manual cert steps.

To ship a new version later: bump the tag, push it, wait for the Actions build to finish, then re-run the `pull` + `up -d` on the droplet.
