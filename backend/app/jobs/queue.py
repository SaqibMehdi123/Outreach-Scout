"""ARQ job-queue plumbing.

One queued job per lead (per the TRD); workers scale horizontally and pull from
Redis. ``enqueue_research_job`` is called by campaign launch (Module 2).
"""

from __future__ import annotations

from functools import lru_cache

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import settings

_pool: ArqRedis | None = None


@lru_cache
def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


async def get_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings())
    return _pool


async def enqueue_research_job(job_id: str) -> None:
    """Queue a single lead's research job. Idempotent on ``_job_id``."""
    pool = await get_pool()
    await pool.enqueue_job("research_lead", job_id, _job_id=f"research:{job_id}")
