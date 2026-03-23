# Spliit Deployment (`split.ishanr.com`)

This folder deploys [Spliit](https://github.com/spliit-app/spliit) with Docker:

- `spliit` app (built from `services/spliit`)
- PostgreSQL
- Caddy (automatic HTTPS + reverse proxy)

## 1) Checkout Spliit source

Already done in this repo at:

- `services/spliit`

If needed again:

```powershell
git clone https://github.com/spliit-app/spliit.git services/spliit
```

## 2) DNS setup

Create an `A` record:

- Host: `split`
- Value: your VPS public IPv4
- Proxy: DNS only (if using Cloudflare, disable orange-cloud until TLS is healthy)

## 3) Configure environment

```powershell
cd deploy/spliit
copy .env.example .env
```

Edit `.env` and set a strong password in:

- `POSTGRES_PASSWORD`
- Keep both `POSTGRES_*URL*` values in sync with that password.

## 4) Start stack

```powershell
docker compose --env-file .env up -d --build
```

Check status:

```powershell
docker compose ps
```

Logs (if needed):

```powershell
docker compose logs -f spliit
docker compose logs -f caddy
```

## 5) Verify

Open:

- `https://split.ishanr.com`

## 6) Update to latest Spliit

```powershell
cd ../../services/spliit
git pull
cd ../../deploy/spliit
docker compose --env-file .env up -d --build
```
