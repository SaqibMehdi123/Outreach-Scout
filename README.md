# Outreach Scout — Outbound Research Agent (AI SDR)

Give the agent an ideal-customer profile (ICP); it finds matching companies,
researches each one with real web tools, identifies the right contact, drafts a
personalised first message, and logs every step. A **human approval gate** sits
before any export or CRM sync.

The agent runs a **bounded ReAct loop** as a **queued job, one per lead**, with a
max-step cap, token budget, and state checkpointing so crashed jobs resume.

## Architecture

```
ICP + Campaign ──▶ Job runner (ARQ + Redis)  ── one job per lead (parallel workers)
                          │
                          ▼
                  Research Agent loop (LangGraph)
                  plan → call tool → observe → repeat (max N steps, token budget)
                  tools: web_search, fetch_page, enrich_company, find_contact
                         (web content is UNTRUSTED → sandboxed)
                          │
                          ▼   structured {company, contact, insights, draft}
                  Postgres + pgvector  ──▶ live progress (SSE) to UI
                          │
                          ▼
                  Review UI (approve / edit) ──▶ Export CSV / CRM sync
```

### Stack
- **API**: FastAPI (async)
- **Agent**: bounded ReAct loop, provider-agnostic LLM (cheap tier for extraction, premium for the draft)
- **LLM**: any OpenAI-compatible endpoint — **Groq (free, default)**, Gemini, OpenRouter, Ollama — or Anthropic
- **Tools**: keyless **DuckDuckGo** web search + page fetch (free); Crunchbase/Apollo/Hunter optional
- **Queue**: ARQ on Redis (one job per lead)
- **DB**: Postgres + pgvector (semantic dedupe / similarity)
- **Observability**: Langfuse (full agent trace, tokens, cost)
- **Frontend**: Next.js 14 (App Router) + TypeScript in `frontend/` — auth/onboarding,
  ICP setup, live SSE research, review/export, and compliance settings, wired to the
  API via a typed client. (The original design prototype lives in `Outreach Scout Project UI_UX Design/`.)

### Run it free (no paid keys)
1. Get a free **Groq** key (no card) at https://console.groq.com → put it in `backend/.env` as `LLM_API_KEY`.
2. Leave `TAVILY_API_KEY` and the enrichment keys blank → web search uses keyless DuckDuckGo; the agent enriches via search + page fetch.
That's the whole cost: **$0**.

## Quick start

```bash
cp backend/.env.example backend/.env        # fill in ANTHROPIC_API_KEY + tool keys
docker compose up -d db redis               # infra
docker compose up --build api worker        # app + worker

# initialise the schema (dev path)
docker compose exec api python -m scripts.init_db
# …or migration-driven:
#   docker compose exec api alembic upgrade head
```

- API:        http://localhost:8000
- OpenAPI:     http://localhost:8000/docs
- Health:      http://localhost:8000/health  ·  Readiness: `/ready`

## Local (no Docker)

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
arq app.jobs.worker.WorkerSettings        # in a second shell
```

## Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local          # set NEXT_PUBLIC_API_BASE (+ Google client ID)
npm install
npm run dev                               # http://localhost:3000

# production
npm run build && npm start                # or: npm run typecheck
```

- App:        http://localhost:3000
- Config:     `frontend/.env.local` — `NEXT_PUBLIC_API_BASE` (backend URL) and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same Web client ID as the backend's `GOOGLE_CLIENT_ID`;
  leave blank to use email/password only).

Screens: login/signup + onboarding · ICP **setup** · **live** research (SSE progress,
per-lead steps) · **review & export** (approval gate → CSV / CRM sync) · compliance
**settings** (retention, suppression list, GDPR/CAN-SPAM).

## Configuration

All secrets come from the environment (`backend/.env`). See `.env.example` for
the full list: LLM key + models, Langfuse keys, per-lead budget caps
(`AGENT_MAX_STEPS`, `AGENT_TOKEN_BUDGET`, `AGENT_MAX_COST_USD`), and the external
data-tool provider keys (web search, enrichment, contact finder, email verify).

## Deploy

```bash
# build images, run migrations, start API (4 uvicorn workers) + 2 worker replicas
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate
# scale workers for larger campaigns
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=4
```

Migrations are Alembic (`alembic upgrade head`): `0001` enables pgvector, the
initial-schema revision creates all tables. Set real secrets in `backend/.env`
(`SECRET_KEY`, `LLM_API_KEY`, …) before deploying.

### Hardening
- **Per-lead budget caps** — `AGENT_MAX_STEPS`, `AGENT_TOKEN_BUDGET`, `AGENT_MAX_COST_USD` enforced in the agent loop; per-campaign token/cost rollup on the campaign detail.
- **Backpressure** — per-tool Redis token-bucket rate limiting + `WORKER_MAX_JOBS` concurrency cap; scale out with more worker replicas.
- **Compliance** — opt-out/suppression list (never targeted or drafted), data-retention window with a daily purge cron (keeps exported leads), GDPR/CAN-SPAM settings.
- **Resilience** — tool cache + rate limiter fail open if Redis is down; per-lead failure isolation; campaign completion is race-safe (row lock).

## Compliance

Legitimate data sources only; respect site ToS and robots. Data minimisation,
opt-out/suppression list, retention window, and GDPR awareness are surfaced as
product settings. **A human approves before anything is exported or sent.**
