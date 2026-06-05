"""ARQ worker entrypoint.

Run with:  arq app.jobs.worker.WorkerSettings

Each task isolates failure: one lead crashing never kills the batch. The real
research loop is wired in Module 4; for now ``research_lead`` is a thin shell
that drives job status transitions so the scaffold is exercisable end-to-end.
"""

from __future__ import annotations

from typing import Any

from arq import cron

from app.config import settings
from app.jobs.queue import redis_settings
from app.observability.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def research_lead(ctx: dict[str, Any], job_id: str) -> dict[str, Any]:
    """Research one lead via the bounded ReAct loop. Failure is isolated inside."""
    from app.agent.runner import run_research_job

    logger.info("research_lead.start", job_id=job_id)
    return await run_research_job(job_id)


async def purge_expired_data(ctx: dict[str, Any]) -> int:
    """Daily retention sweep — drop researched data past each org's window."""
    from app.db.session import SessionLocal
    from app.services.retention import purge_expired

    async with SessionLocal() as session:
        removed = await purge_expired(session)
    logger.info("retention.sweep_done", removed=removed)
    return removed


async def on_startup(ctx: dict[str, Any]) -> None:
    configure_logging()
    logger.info("worker.startup", environment=settings.environment)


async def on_shutdown(ctx: dict[str, Any]) -> None:
    logger.info("worker.shutdown")


class WorkerSettings:
    functions = [research_lead]
    cron_jobs = [cron(purge_expired_data, hour=3, minute=0)]  # daily 03:00
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = redis_settings()
    # Backpressure: cap concurrent research jobs per process so a large campaign
    # doesn't hammer external APIs. Scale out by adding worker processes.
    max_jobs = settings.worker_max_jobs
    job_timeout = 60 * 10
    keep_result = 60 * 60
