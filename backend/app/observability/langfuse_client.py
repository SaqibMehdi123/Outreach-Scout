"""Langfuse client wrapper.

Langfuse captures the full agent trace (every step, tool call and decision) plus
cost and token usage. When keys are absent the client degrades to a no-op so the
app still runs locally without an observability backend.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from langfuse import Langfuse


@lru_cache
def get_langfuse() -> Langfuse | None:
    if not settings.langfuse_enabled:
        return None
    from langfuse import Langfuse

    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )
