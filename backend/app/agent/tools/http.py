"""Shared async HTTP plumbing for tools.

Centralises the httpx client and maps transport/status failures onto the tool
error taxonomy so every provider client gets uniform retry behaviour. Tools may
inject a client (e.g. an httpx.MockTransport in tests).
"""

from __future__ import annotations

from typing import Any

import httpx

from app.agent.tools.base import RetryableToolError, ToolError
from app.config import settings

# Transient HTTP statuses worth retrying.
_RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}


def make_client(client: httpx.AsyncClient | None = None) -> httpx.AsyncClient:
    return client or httpx.AsyncClient(
        timeout=settings.tool_default_timeout_seconds,
        headers={"User-Agent": "OutreachScout/0.1 (+research-agent)"},
        follow_redirects=True,
    )


async def request_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """Perform a request and return parsed JSON, classifying failures."""
    try:
        resp = await client.request(method, url, **kwargs)
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise RetryableToolError(f"network error: {exc}") from exc

    if resp.status_code in _RETRY_STATUS:
        raise RetryableToolError(f"upstream {resp.status_code}")
    if resp.status_code >= 400:
        raise ToolError(f"upstream {resp.status_code}: {resp.text[:200]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ToolError(f"invalid JSON from upstream: {exc}") from exc
