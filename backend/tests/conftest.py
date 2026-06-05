"""Shared test fixtures.

pytest-asyncio gives each test its own event loop. Our cached infra clients
(SQLAlchemy engine pool, Redis client, ARQ pool) would otherwise be bound to a
closed loop on the next test, so we reset them after every test.
"""

from __future__ import annotations

import contextlib

import pytest_asyncio

from app.db.session import engine
from app.jobs import queue as queue_mod
from app.services.redis_client import get_redis


@pytest_asyncio.fixture(autouse=True)
async def _reset_infra_singletons():
    yield
    # Postgres engine
    with contextlib.suppress(Exception):
        await engine.dispose()
    # ARQ pool (created lazily on first enqueue)
    if queue_mod._pool is not None:
        with contextlib.suppress(Exception):
            await queue_mod._pool.aclose()
        queue_mod._pool = None
    # Redis client (cache + rate limiter + tool cache share it)
    with contextlib.suppress(Exception):
        await get_redis().aclose()
    get_redis.cache_clear()
