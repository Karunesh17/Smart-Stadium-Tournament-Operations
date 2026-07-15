# Deployment Runbook — AI Smart Stadium Operations Platform

## Overview
This document describes how to deploy the AI Smart Stadium platform to production using Docker Compose. The stack consists of four services: **Gateway (FastAPI)**, **PostgreSQL**, **Redis**, and **Qdrant**.

---

## Prerequisites

| Tool | Min Version | Install |
|---|---|---|
| Docker | 24.x | https://docs.docker.com/get-docker/ |
| Docker Compose | v2.x | Bundled with Docker Desktop |
| Git | any | https://git-scm.com/ |

---

## Quick Start (Local / Staging)

```bash
# 1. Clone the repository
git clone <your-repo-url> smart-stadium
cd smart-stadium

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with real values — especially SECRET_KEY, POSTGRES_PASSWORD, GEMINI_API_KEY

# 3. Build and start all services
docker compose -f infra/docker-compose.prod.yml up -d --build

# 4. Tail the gateway logs
docker logs -f smart-stadium-gateway

# 5. Verify health
curl http://localhost:8000/health
# Expected: {"status": "healthy", ...}

# 6. Run smoke tests
SMOKE_URL=http://localhost:8000 python scripts/smoke_test.py
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | ✅ | — | JWT signing secret (64-char hex) |
| `DATABASE_URL` | ✅ | — | PostgreSQL DSN |
| `POSTGRES_USER` | ✅ | `stadium` | Postgres username |
| `POSTGRES_PASSWORD` | ✅ | — | Postgres password |
| `POSTGRES_DB` | ✅ | `smart_stadium` | Database name |
| `REDIS_URL` | ✅ | — | Redis connection URL |
| `QDRANT_URL` | ✅ | — | Qdrant HTTP endpoint |
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `ENVIRONMENT` | ❌ | `production` | Runtime environment label |
| `LOG_LEVEL` | ❌ | `INFO` | Uvicorn log level |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `30` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ❌ | `7` | JWT refresh token TTL |

> Generate `SECRET_KEY` with:
> ```bash
> python -c "import secrets; print(secrets.token_hex(64))"
> ```

---

## Service Architecture

```
Internet
    │
    ▼
[Gateway :8000]  ──── FastAPI + Uvicorn (4 workers)
    │
    ├── [PostgreSQL :5432]  — Relational data (users, vendors, crowd, staff, incidents)
    ├── [Redis :6379]       — Pub/sub events + KPI cache
    └── [Qdrant :6333]      — Vector store for AI RAG pipeline
```

---

## Health Checks

All services expose healthchecks that Docker monitors every 30s.

```bash
# Check all service health
docker compose -f infra/docker-compose.prod.yml ps

# Manual checks
curl http://localhost:8000/health          # Gateway
docker exec smart-stadium-postgres pg_isready -U stadium
docker exec smart-stadium-redis redis-cli ping
curl http://localhost:6333/healthz         # Qdrant
```

---

## Smoke Test

Run after every deploy to validate all critical user flows:

```bash
SMOKE_URL=http://localhost:8000 python scripts/smoke_test.py
```

The smoke test checks:
1. `GET /health` — service is up
2. `POST /api/v1/auth/register` — user registration works
3. `POST /api/v1/auth/login` — JWT issuance works
4. `GET /api/v1/items` — inventory is accessible
5. `GET /api/v1/analytics/dashboard` — admin KPI dashboard loads
6. `POST /api/v1/chat` — AI copilot responds
7. `GET /api/v1/auth/me` — JWT token integrity

Exit code `0` = all good. Exit code `1` = investigate before declaring deploy successful.

---

## Database Migrations

The gateway auto-creates all SQLAlchemy tables at startup (`Base.metadata.create_all`). For production with Alembic migrations:

```bash
docker exec smart-stadium-gateway alembic upgrade head
```

> **Note**: Alembic migrations are in `infra/migrations/`. Always back up the database before running migrations in production.

---

## Scaling

To run more gateway workers horizontally:

```bash
docker compose -f infra/docker-compose.prod.yml up -d --scale gateway=3
```

Add an Nginx or Traefik reverse proxy in front to load-balance across instances.

---

## Rollback Procedure

### Option A — Image tag rollback (recommended)

```bash
# 1. Tag the current image before deploying a new version
docker tag smart-stadium-gateway:latest smart-stadium-gateway:v1.0.0-backup

# 2. If the new deploy fails, revert:
docker tag smart-stadium-gateway:v1.0.0-backup smart-stadium-gateway:latest
docker compose -f infra/docker-compose.prod.yml up -d gateway

# 3. Confirm rollback
curl http://localhost:8000/health
python scripts/smoke_test.py
```

### Option B — Git revert

```bash
git revert HEAD
git push origin main
# Trigger re-build via CI/CD or manually:
docker compose -f infra/docker-compose.prod.yml up -d --build
```

---

## Stopping / Teardown

```bash
# Stop all services (preserves volumes/data)
docker compose -f infra/docker-compose.prod.yml down

# Stop and remove all data volumes (DESTRUCTIVE)
docker compose -f infra/docker-compose.prod.yml down -v
```

---

## Monitoring

- **Logs**: `docker logs -f smart-stadium-gateway` (structured JSON)
- **Metrics**: Add Prometheus + Grafana by extending `docker-compose.prod.yml` with `prom/prometheus` and `grafana/grafana` services
- **Alerts**: Configure Grafana alerting rules on `gateway_request_duration_seconds` and `http_requests_total`

---

## Security Checklist

- [ ] `SECRET_KEY` is at least 64 characters and randomly generated
- [ ] `POSTGRES_PASSWORD` is not the default
- [ ] `.env` file is in `.gitignore` and never committed
- [ ] Docker containers run as non-root (`appuser` uid 1001)
- [ ] Database port 5432 is NOT exposed publicly (internal Docker network only in production)
- [ ] HTTPS is terminated at the reverse proxy (Nginx/Traefik) level, not inside the container
