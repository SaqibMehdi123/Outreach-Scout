"""web_search — real web search.

Uses Tavily when a key is configured (cleaner, agent-tuned results); otherwise
falls back to keyless DuckDuckGo (free, no signup). Both return the same shape.
"""

from __future__ import annotations

import asyncio

import httpx
from pydantic import BaseModel, Field

from app.agent.sandbox import neutralise
from app.agent.tools.base import RetryableToolError, Tool, ToolResult
from app.agent.tools.http import make_client, request_json
from app.config import settings

_TAVILY_URL = "https://api.tavily.com/search"


class WebSearchArgs(BaseModel):
    # No tight maxLength: strict providers (Groq) reject the whole completion if
    # the model emits a longer query. We defensively trim in _run instead.
    query: str = Field(description="Search query", min_length=2)
    max_results: int = Field(default=5, ge=1, le=10)


class WebSearchTool(Tool[WebSearchArgs]):
    name = "web_search"
    description = (
        "Search the public web for information about a company, person, funding, "
        "hiring or product news. Returns titles, urls and snippets."
    )
    args_model = WebSearchArgs
    untrusted_output = True
    rate_per_sec = 3.0
    cache_ttl = 60 * 60 * 6  # 6h

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        super().__init__()
        self._client = make_client(client)

    async def _run(self, args: WebSearchArgs) -> ToolResult:
        args.query = args.query[:400]  # keep providers happy + queries focused
        if settings.tavily_api_key:
            results, source = await self._tavily(args), "Tavily"
        else:
            results, source = await self._duckduckgo(args), "DuckDuckGo"
        return ToolResult(
            ok=True, data={"query": args.query, "results": results},
            source=source, untrusted=True,
        )

    async def _tavily(self, args: WebSearchArgs) -> list[dict]:
        payload = {
            "api_key": settings.tavily_api_key, "query": args.query,
            "max_results": args.max_results, "search_depth": "basic",
        }
        data = await request_json(self._client, "POST", _TAVILY_URL, json=payload)
        return [
            {"title": neutralise(str(r.get("title", "")))[:300],
             "url": r.get("url"),
             "snippet": neutralise(str(r.get("content", "")))[:1000],
             "score": r.get("score")}
            for r in (data.get("results") or [])
        ]

    async def _duckduckgo(self, args: WebSearchArgs) -> list[dict]:
        # ddgs is synchronous; run it off the event loop.
        def _search() -> list[dict]:
            from ddgs import DDGS

            with DDGS() as ddgs:
                return list(ddgs.text(args.query, max_results=args.max_results))

        try:
            raw = await asyncio.to_thread(_search)
        except Exception as exc:  # noqa: BLE001 — DDG rate-limits / transient errors
            raise RetryableToolError(f"duckduckgo search failed: {exc}") from exc
        return [
            {"title": neutralise(str(r.get("title", "")))[:300],
             "url": r.get("href") or r.get("url"),
             "snippet": neutralise(str(r.get("body", "")))[:1000],
             "score": None}
            for r in raw
        ]
