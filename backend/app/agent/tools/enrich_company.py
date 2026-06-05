"""enrich_company — firmographics + funding via Crunchbase API v4."""

from __future__ import annotations

from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.agent.tools.base import Tool, ToolConfigError, ToolResult
from app.agent.tools.http import make_client, request_json
from app.config import settings

_CB_SEARCH = "https://api.crunchbase.com/api/v4/searches/organizations"
_FIELDS = [
    "identifier",
    "short_description",
    "categories",
    "num_employees_enum",
    "location_identifiers",
    "website_url",
    "last_funding_type",
    "last_funding_total",
    "rank_org",
]


class EnrichCompanyArgs(BaseModel):
    name: str | None = Field(default=None, description="Company name")
    domain: str | None = Field(default=None, description="Company domain")


def _term(args: EnrichCompanyArgs) -> str | None:
    return args.domain or args.name


def _map_entity(props: dict[str, Any]) -> dict[str, Any]:
    ident = props.get("identifier") or {}
    locs = props.get("location_identifiers") or []
    cats = props.get("categories") or []
    return {
        "name": ident.get("value"),
        "description": props.get("short_description"),
        "industry": (cats[0].get("value") if cats else None),
        "size": props.get("num_employees_enum"),
        "location": ", ".join(loc.get("value", "") for loc in locs[:2]) or None,
        "website": props.get("website_url"),
        "last_funding_type": props.get("last_funding_type"),
        "last_funding_total": props.get("last_funding_total"),
    }


class EnrichCompanyTool(Tool[EnrichCompanyArgs]):
    name = "enrich_company"
    description = (
        "Look up firmographics and funding for a company by name or domain: "
        "industry, employee count, location, website, and latest funding round."
    )
    args_model = EnrichCompanyArgs
    untrusted_output = False  # structured provider data, not arbitrary web text
    rate_per_sec = 2.0
    cache_ttl = 60 * 60 * 24 * 7  # 7d — firmographics change slowly

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        super().__init__()
        self._client = make_client(client)

    async def _run(self, args: EnrichCompanyArgs) -> ToolResult:
        if not settings.crunchbase_api_key:
            raise ToolConfigError("CRUNCHBASE_API_KEY is not configured")
        term = _term(args)
        if not term:
            return ToolResult(ok=False, error="provide name or domain")

        body = {
            "field_ids": _FIELDS,
            "limit": 1,
            "query": [
                {
                    "type": "predicate",
                    "field_id": "identifier",
                    "operator_id": "contains",
                    "values": [term],
                }
            ],
        }
        data = await request_json(
            self._client,
            "POST",
            _CB_SEARCH,
            json=body,
            headers={"X-cb-user-key": settings.crunchbase_api_key},
        )
        entities = data.get("entities") or []
        if not entities:
            return ToolResult(ok=True, data={"found": False}, source="Crunchbase")

        company = _map_entity(entities[0].get("properties") or {})
        return ToolResult(
            ok=True, data={"found": True, **company}, source="Crunchbase"
        )
