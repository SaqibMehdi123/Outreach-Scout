"""Shared async Redis client (cache, rate limiting, ARQ all use the same server)."""

from __future__ import annotations

from functools import lru_cache

import redis.asyncio as aioredis

from app.config import settings


@lru_cache
def get_redis() -> aioredis.Redis:
    return aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
