"""Tool registry — the allow-list the agent may call.

The agent can only ever invoke tools present here; anything else is rejected.
Construct one ``ToolRegistry`` per job run (tools hold their own httpx clients).
"""

from __future__ import annotations

from typing import Any

from app.agent.tools.base import Tool, ToolResult
from app.agent.tools.enrich_company import EnrichCompanyTool
from app.agent.tools.fetch_page import FetchPageTool
from app.agent.tools.find_contact import FindContactTool
from app.agent.tools.web_search import WebSearchTool
from app.config import settings


def _default_tools() -> list[Tool]:
    # web_search (keyless DDG fallback) and fetch_page are always available.
    tools: list[Tool] = [WebSearchTool(), FetchPageTool()]
    # Paid enrichment / contact tools only when configured — otherwise the agent
    # would waste steps calling tools that always return a config error.
    if settings.crunchbase_api_key:
        tools.append(EnrichCompanyTool())
    if settings.apollo_api_key:
        tools.append(FindContactTool())
    return tools


class ToolRegistry:
    def __init__(self, tools: list[Tool] | None = None) -> None:
        default: list[Tool] = tools if tools is not None else _default_tools()
        self._tools: dict[str, Tool] = {t.name: t for t in default}

    @property
    def names(self) -> list[str]:
        return list(self._tools)

    def schemas(self) -> list[dict[str, Any]]:
        """Anthropic tool definitions for every allow-listed tool."""
        return [t.json_schema() for t in self._tools.values()]

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    async def invoke(self, name: str, args: dict[str, Any]) -> ToolResult:
        tool = self._tools.get(name)
        if tool is None:
            return ToolResult(ok=False, error=f"Tool '{name}' is not allow-listed")
        return await tool.invoke(args)
