# StockPulse One-Command Deployment

Run the full stack (`app + PostgreSQL + Redis`) with one command:

```bash
npm run stack:up
```

This starts:
- App on `http://127.0.0.1:3000`
- PostgreSQL on `127.0.0.1:5432`
- Redis on `127.0.0.1:6379`

On first run, `stack:up` auto-creates `.env` from `.env.stack.example` and
generates strong random values for:
- `AUTH_SESSION_SECRET`
- `POSTGRES_PASSWORD`

## Linux Install + Launch (single command)

For Ubuntu/Debian servers, this installs Docker (if missing) and launches everything:

```bash
sudo bash scripts/install-stockpulse-linux.sh
```

## Configuration

`docker compose` reads values from `.env` in project root.
Template file: `.env.stack.example`

Common overrides:

```env
APP_PORT=3000
POSTGRES_DB=stockpulse
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-strong-password
POSTGRES_PORT=5432
REDIS_PORT=6379
AUTH_SESSION_SECRET=replace-with-strong-secret
AUTH_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Useful Commands

```bash
npm run stack:logs
npm run stack:down
```

Legacy datastore-only compose remains available:

```bash
npm run infra:up
```
