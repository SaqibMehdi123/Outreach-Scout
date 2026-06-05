"""Typed tool interface.

Every external capability the agent can call lives behind this interface, which
gives it — for free and uniformly — a JSON schema for the LLM, per-tool rate
limiting with backpressure, retries with backoff, and result caching. Tools also
declare whether their output is ``untrusted`` (i.e. derived from arbitrary web
content) so the agent loop can sandbox it against prompt injection.

Concrete tools (web_search, fetch_page, enrich_company, find_contact) live in
sibling modules and are registered in ``registry.py`` (Module 3).
"""

from __future__ import annotations

import abc
import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, ClassVar, Generic, TypeVar

import orjson
from pydantic import BaseModel
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings
from app.observability.logging import get_logger
from app.services.ratelimit import RateLimiter
from app.services.redis_client import get_redis

logger = get_logger(__name__)

ArgsT = TypeVar("ArgsT", bound=BaseModel)


class ToolError(Exception):
    """Raised when a tool fails irrecoverably (after retries)."""


class ToolConfigError(ToolError):
    """Raised when a tool is invoked without its required API key/config."""


class RetryableToolError(ToolError):
    """Transient failure — safe to retry (timeout, 5xx, rate limit)."""


@dataclass(slots=True)
class ToolResult:
    """Normalized tool output.

    ``untrusted`` marks data that originated from arbitrary web content and must
    be treated as potentially adversarial by the agent loop.
    """

    ok: bool
    data: Any = None
    error: str | None = None
    source: str | None = None
    untrusted: bool = False
    cached: bool = False
    meta: dict[str, Any] = field(default_factory=dict)


class Tool(abc.ABC, Generic[ArgsT]):
    """Base class for an allow-listed, typed agent tool."""

    name: ClassVar[str]
    description: ClassVar[str]
    args_model: ClassVar[type[BaseModel]]

    # Output derived from arbitrary web pages → must be sandboxed by the agent.
    untrusted_output: ClassVar[bool] = False
    # Token-bucket limits (tune per provider quota).
    rate_per_sec: ClassVar[float] = 5.0
    rate_capacity: ClassVar[int | None] = None
    # Cache TTL; 0 disables caching for this tool.
    cache_ttl: ClassVar[int | None] = None
    # A destructive tool may never run without explicit human approval.
    destructive: ClassVar[bool] = False

    def __init__(self) -> None:
        self._limiter = RateLimiter(
            self.name, self.rate_per_sec, self.rate_capacity
        )

    # ── LLM-facing schema ─────────────────────────────────────────────────────
    def json_schema(self) -> dict[str, Any]:
        """Anthropic tool-definition schema."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.args_model.model_json_schema(),
        }

    # ── Subclasses implement the actual call ───────────────────────────────────
    @abc.abstractmethod
    async def _run(self, args: ArgsT) -> ToolResult:
        ...

    # ── Public entry point: cache → rate limit → retry → execute ───────────────
    async def invoke(self, raw_args: dict[str, Any]) -> ToolResult:
        if self.destructive:
            # Allow-listed loop never reaches here for destructive tools without
            # an explicit approval flag; guard defensively regardless.
            return ToolResult(
                ok=False, error="Destructive tool requires human approval"
            )

        try:
            args = self.args_model.model_validate(raw_args)
        except Exception as exc:  # noqa: BLE001
            return ToolResult(ok=False, error=f"Invalid arguments: {exc}")

        cache_key = self._cache_key(args)
        if cache_key:
            cached = await self._cache_get(cache_key)
            if cached is not None:
                return ToolResult(**{**cached, "cached": True})

        if not await self._limiter.acquire():
            return ToolResult(ok=False, error="Rate limit backpressure timeout")

        result = await self._run_with_retries(args)

        if cache_key and result.ok:
            await self._cache_set(cache_key, result)
        return result

    async def _run_with_retries(self, args: ArgsT) -> ToolResult:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(settings.tool_max_retries),
                wait=wait_exponential(multiplier=0.5, max=8),
                retry=retry_if_exception_type(RetryableToolError),
                reraise=True,
            ):
                with attempt:
                    return await self._run(args)
        except ToolConfigError as exc:
            logger.warning("tool_config_error", tool=self.name, error=str(exc))
            return ToolResult(ok=False, error=str(exc))
        except ToolError as exc:
            logger.error("tool_failed", tool=self.name, error=str(exc))
            return ToolResult(ok=False, error=str(exc))
        except Exception as exc:  # noqa: BLE001
            logger.exception("tool_unexpected_error", tool=self.name)
            return ToolResult(ok=False, error=f"Unexpected error: {exc}")
        return ToolResult(ok=False, error="exhausted retries")

    # ── Caching helpers (Redis, keyed by tool + normalized args) ───────────────
    def _cache_key(self, args: ArgsT) -> str | None:
        ttl = self.cache_ttl if self.cache_ttl is not None else settings.tool_cache_ttl_seconds
        if not ttl:
            return None
        payload = json.dumps(args.model_dump(), sort_keys=True, default=str)
        digest = hashlib.sha256(payload.encode()).hexdigest()[:32]
        return f"toolcache:{self.name}:{digest}"

    async def _cache_get(self, key: str) -> dict[str, Any] | None:
        # Cache is an optimization — degrade to a miss if Redis is unavailable.
        try:
            raw = await get_redis().get(key)
        except Exception as exc:  # noqa: BLE001
            logger.debug("tool_cache_unavailable", tool=self.name, error=str(exc))
            return None
        if not raw:
            return None
        try:
            return orjson.loads(raw)
        except orjson.JSONDecodeError:
            return None

    async def _cache_set(self, key: str, result: ToolResult) -> None:
        ttl = self.cache_ttl if self.cache_ttl is not None else settings.tool_cache_ttl_seconds
        payload = {
            "ok": result.ok,
            "data": result.data,
            "error": result.error,
            "source": result.source,
            "untrusted": result.untrusted,
            "meta": result.meta,
        }
        try:
            await get_redis().set(key, orjson.dumps(payload), ex=ttl)
        except Exception as exc:  # noqa: BLE001
            logger.debug("tool_cache_write_failed", tool=self.name, error=str(exc))
