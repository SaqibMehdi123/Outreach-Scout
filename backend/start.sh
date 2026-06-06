#!/usr/bin/env bash
# Production start for a single free host (e.g. Render Web Service):
# applies DB migrations, runs the ARQ worker in the background, and serves the API.
set -e

# 1) Apply database migrations (idempotent — no-op once up to date).
alembic upgrade head

# 2) Background worker: processes the per-lead research jobs from Redis.
arq app.jobs.worker.WorkerSettings &

# 3) Foreground API on the platform-provided port (Render/Railway set $PORT).
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
