"""Distributed token-bucket rate limiter backed by Redis.

Used by the tool layer so a large campaign with many parallel workers never
trips an external provider's rate limit. ``acquire`` blocks (with backpressure)
until a token is available or ``max_wait`` is exceeded.
"""

from __future__ import annotations

import asyncio
import time

from app.services.redis_client import get_redis

# Atomic refill-and-take. KEYS[1]=bucket key, ARGV=rate, capacity, now, requested.
_LUA = """
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now end

local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, math.ceil(capacity / rate) + 10)
return allowed
"""


class RateLimiter:
    def __init__(self, name: str, rate_per_sec: float, capacity: int | None = None) -> None:
        self.key = f"rl:{name}"
        self.rate = rate_per_sec
        self.capacity = capacity or max(1, int(rate_per_sec))

    async def acquire(self, *, max_wait: float = 30.0) -> bool:
        redis = get_redis()
        deadline = time.monotonic() + max_wait
        backoff = 0.05
        while True:
            try:
                allowed = await redis.eval(
                    _LUA, 1, self.key, self.rate, self.capacity, time.time(), 1
                )
            except Exception:  # noqa: BLE001
                # Redis unavailable → fail open (don't block tool calls).
                return True
            if int(allowed) == 1:
                return True
            if time.monotonic() >= deadline:
                return False
            await asyncio.sleep(min(backoff, 1.0))
            backoff *= 1.6
