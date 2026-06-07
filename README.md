<h1 align="center">Outreach Scout</h1>

<p align="center">
  <strong>Autonomous outbound research agent (AI SDR).</strong><br/>
  Give it an ideal-customer profile — it finds matching companies, researches each one with
  real web tools, identifies the right contact, and drafts a personalized first message,
  with a human approval gate before anything is exported or synced.
</p>

<p align="center">
  <img alt="Python"     src="https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI"    src="https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white">
  <img alt="Next.js"    src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Postgres"   src="https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis"      src="https://img.shields.io/badge/Redis-ARQ-DC382D?logo=redis&logoColor=white">
  <img alt="License"    src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Testing](#testing)
- [Security & Compliance](#security--compliance)
- [License](#license)

---

## Overview

Sales teams burn hours manually researching accounts before they can write a single relevant
line. **Outreach Scout** automates that first mile. You define an **ideal-customer profile
(ICP)** and a value proposition; the agent then, for every candidate company:

1. **Discovers & scores** companies that match the ICP (with domain de-duplication).
2. **Researches** each one through a bounded **ReAct loop** using real web tools.
3. **Identifies** the right contact and gathers supporting insights and buying signals.
4. **Drafts** a personalized, structured first message grounded in what it found.
5. **Surfaces** every step live, then waits for a **human to approve, edit, or discard**.

Each lead is processed as an **isolated queued job** with a hard step cap, token budget, and
state checkpointing, so a single failure never derails a campaign and crashed jobs resume.
Nothing is exported or synced to a CRM until a person signs off.

---

## Key Features

**Agentic research**
- Bounded **ReAct loop** (plan → call tool → observe → repeat) with per-lead **step, token, and cost caps**.
- **Sandboxed tools** — untrusted web content is isolated from the control plane.
- State **checkpointing** for crash-safe resumption; per-lead failure isolation.
- Full agent **trace** (tools, tokens, cost) via Langfuse.

**Provider-agnostic LLM**
- Any **OpenAI-compatible** endpoint — Groq, **Google Gemini**, OpenRouter, or local Ollama — or **Anthropic**.
- Two-tier model strategy: a cheap model for high-volume extraction, a stronger model for reasoning and the final draft.

**Pipeline & workflow**
- One **queued job per lead** (ARQ on Redis) with a configurable concurrency cap and back-pressure.
- **Live progress** streamed to the UI over Server-Sent Events.
- **Human approval gate** before any **CSV export** or **CRM sync**.

**Multi-tenant & compliant**
- Org-scoped data model with JWT auth (email/password **and** Google sign-in).
- Opt-out / **suppression list**, configurable **data-retention** window with a daily purge, and GDPR / CAN-SPAM settings.

---

## Architecture

```
ICP + Campaign ──▶ Job runner (ARQ + Redis) ── one job per lead, parallel workers
                         │
                         ▼
                 Research agent — bounded ReAct loop
                 plan → call tool → observe → repeat   (max N steps · token & cost budget)
                 tools: web_search · fetch_page · enrich_company · find_contact
                        (web content is UNTRUSTED → sandboxed)
                         │
                         ▼   structured { company, contact, insights, draft }
                 PostgreSQL + pgvector ──▶ live progress (SSE) ──▶ Next.js UI
                         │
                         ▼
                 Review (approve / edit / discard) ──▶ CSV export · CRM sync
```

The frontend is a separate **Next.js** application that talks to the API through a typed client
and renders the full workflow: authentication and onboarding, ICP setup, live research,
review/export, and compliance settings.

---

## Tech Stack

| Layer            | Technology                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **Backend API**  | FastAPI (async), Pydantic v2                                               |
| **Agent**        | Bounded ReAct loop, sandboxed tool layer, provider-agnostic LLM client     |
| **LLM**          | OpenAI-compatible — Groq · Google Gemini · OpenRouter · Ollama — or Anthropic |
| **Job queue**    | ARQ on Redis (one job per lead)                                            |
| **Database**     | PostgreSQL + **pgvector** (semantic de-duplication / similarity)           |
| **Observability**| Langfuse (agent traces, tokens, cost), structlog                          |
| **Frontend**     | Next.js 14 (App Router), React 18, TypeScript                             |
| **Infra**        | Docker Compose, Alembic migrations                                         |

---

## Getting Started

### Prerequisites

- **Docker** & Docker Compose
- **Node.js** 18+ (for the frontend)
- An LLM API key — a free **Groq** (`console.groq.com`) or **Google Gemini** (`aistudio.google.com/apikey`) key works at $0 cost

### 1. Backend (Docker)

```bash
cp backend/.env.example backend/.env     # then set SECRET_KEY and LLM_API_KEY

docker compose up -d db redis            # infrastructure
docker compose up --build api worker     # API + background worker

# initialize the schema
docker compose exec api alembic upgrade head
```

| Service    | URL                                  |
| ---------- | ------------------------------------ |
| API        | http://localhost:8000                |
| API docs   | http://localhost:8000/docs           |
| Health     | http://localhost:8000/health · `/ready` |

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local         # set NEXT_PUBLIC_API_BASE (+ Google client ID)
npm install
npm run dev                              # http://localhost:3000
```

The UI covers: login / signup + onboarding · ICP **setup** · **live** research (SSE progress
and per-lead step logs) · **review & export** (approval gate → CSV / CRM) · compliance
**settings** (retention, suppression list, GDPR / CAN-SPAM).

### Local development without Docker

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
arq app.jobs.worker.WorkerSettings       # in a second shell
```

---

## Configuration

All configuration is supplied via environment variables (`backend/.env`). The most important:

| Variable                                   | Description                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `SECRET_KEY`                               | Secret used to sign JWTs                                          |
| `DATABASE_URL`                             | PostgreSQL (+pgvector) connection DSN                            |
| `REDIS_URL`                                | Redis connection (job queue + cache)                            |
| `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` | LLM provider, endpoint, and key                            |
| `LLM_MODEL_CHEAP` / `LLM_MODEL_PREMIUM`    | Cheap (extraction) and premium (reasoning/draft) model names     |
| `GOOGLE_CLIENT_ID`                         | OAuth Web client ID for Google sign-in (optional)               |
| `CORS_ORIGINS`                             | Comma-separated allowed frontend origins                         |
| `AGENT_MAX_STEPS` / `AGENT_TOKEN_BUDGET` / `AGENT_MAX_COST_USD` | Per-lead safety caps                         |
| `WORKER_MAX_JOBS`                          | Max concurrent research jobs per worker                          |
| `TAVILY_API_KEY`, `APOLLO_API_KEY`, `HUNTER_API_KEY`, … | Optional search / enrichment / contact providers     |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Optional agent tracing                                        |

> Web search and page fetch work **with no API key** (keyless engines); enrichment and contact
> providers are optional and only activate when their key is present. See `backend/.env.example`
> for the complete, documented list.

---

## Project Structure

```
Outreach Scout/
├── backend/
│   ├── app/
│   │   ├── agent/          # bounded ReAct loop, sandboxed tools, evaluation
│   │   ├── api/            # FastAPI routes + dependencies
│   │   ├── services/       # auth, campaign, discovery, draft, export, llm, crm …
│   │   ├── jobs/           # ARQ queue + worker
│   │   ├── db/             # SQLAlchemy models + session
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── observability/  # structured logging, Langfuse
│   │   └── config.py       # environment-driven settings
│   ├── alembic/            # database migrations
│   ├── tests/              # backend test suite
│   ├── Dockerfile
│   └── start.sh            # single-host start (migrate + worker + API)
├── frontend/
│   └── src/
│       ├── app/            # Next.js App Router pages (auth, setup, live, review, settings)
│       ├── components/     # UI components
│       └── lib/            # typed API client, auth + dashboard state
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

---

## Deployment

Runs on a **fully free cloud tier**:

| Component             | Platform   | Notes                                              |
| --------------------- | ---------- | -------------------------------------------------- |
| Frontend (Next.js)    | **Vercel** | First-class Next.js hosting                        |
| API + Worker          | **Render** | One Web Service; `start.sh` runs both + migrations |
| PostgreSQL + pgvector | **Neon**   | Serverless Postgres, pgvector enabled              |
| Redis                 | **Upstash**| Serverless Redis for the ARQ queue                 |

Set the backend env vars (`DATABASE_URL`, `REDIS_URL`, `LLM_*`, `CORS_ORIGINS` = your Vercel URL)
on Render, and `NEXT_PUBLIC_API_BASE` = your Render URL on Vercel. The schema is applied
automatically on boot via `alembic upgrade head`.

For a self-hosted / containerized deployment, a production compose overlay is included:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=4
```

---

## Testing

```bash
cd backend
pytest -q          # backend suite (live Postgres/Redis integration)
```

```bash
cd frontend
npm run typecheck  # TypeScript
npm run build      # production build
```

---

## Security & Compliance

- **Human-in-the-loop:** a person approves every lead before any export or CRM sync.
- **Tenant isolation:** all data is org-scoped; queries are filtered by tenant.
- **Untrusted content is sandboxed** — fetched web pages never reach the control plane directly.
- **Responsible data use:** legitimate sources only, with data minimization, an opt-out /
  suppression list, a configurable retention window with automatic purge, and GDPR / CAN-SPAM
  awareness surfaced as product settings.
- **Budget guardrails:** per-lead step, token, and cost caps prevent runaway spend.

---

## License

Released under the **MIT License**. See [`LICENSE`](LICENSE) for details.
