"""find_contact — identify the best-fit person (Apollo) + verify email (Hunter)."""

from __future__ import annotations

from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.agent.tools.base import Tool, ToolConfigError, ToolResult
from app.agent.tools.http import make_client, request_json
from app.config import settings

_APOLLO_SEARCH = "https://api.apollo.io/api/v1/mixed_people/search"
_HUNTER_FINDER = "https://api.hunter.io/v2/email-finder"
_HUNTER_VERIFY = "https://api.hunter.io/v2/email-verifier"


class FindContactArgs(BaseModel):
    domain: str = Field(description="Company domain to search within")
    titles: list[str] = Field(
        default_factory=list, description="Preferred role titles, best-fit first"
    )


def _pick_person(people: list[dict[str, Any]]) -> dict[str, Any] | None:
    return people[0] if people else None


class FindContactTool(Tool[FindContactArgs]):
    name = "find_contact"
    description = (
        "Find the best-fit decision-maker at a company by domain and target "
        "titles, returning name, title, LinkedIn url and a verified work email."
    )
    args_model = FindContactArgs
    untrusted_output = False
    rate_per_sec = 2.0
    cache_ttl = 60 * 60 * 24 * 3  # 3d

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        super().__init__()
        self._client = make_client(client)

    async def _run(self, args: FindContactArgs) -> ToolResult:
        if not settings.apollo_api_key:
            raise ToolConfigError("APOLLO_API_KEY is not configured")

        body = {
            "q_organization_domains": args.domain,
            "person_titles": args.titles or None,
            "page": 1,
            "per_page": 5,
        }
        data = await request_json(
            self._client,
            "POST",
            _APOLLO_SEARCH,
            json={k: v for k, v in body.items() if v is not None},
            headers={"X-Api-Key": settings.apollo_api_key, "Content-Type": "application/json"},
        )
        person = _pick_person(data.get("people") or [])
        if person is None:
            return ToolResult(ok=True, data={"found": False}, source="Apollo")

        contact = {
            "name": person.get("name"),
            "title": person.get("title"),
            "profile_url": person.get("linkedin_url"),
            "email": person.get("email"),
            "email_verified": False,
        }

        # Apollo often masks the email; fall back to Hunter to find + verify.
        masked = not contact["email"] or "email_not_unlocked" in str(contact["email"])
        if masked and settings.hunter_api_key:
            contact = await self._enrich_email_via_hunter(contact, args.domain, person)
        elif contact["email"] and settings.hunter_api_key:
            contact["email_verified"] = await self._verify(contact["email"])

        return ToolResult(ok=True, data={"found": True, **contact}, source="Apollo+Hunter")

    async def _enrich_email_via_hunter(
        self, contact: dict[str, Any], domain: str, person: dict[str, Any]
    ) -> dict[str, Any]:
        first = person.get("first_name") or (contact["name"] or "").split(" ")[0]
        last = person.get("last_name") or (contact["name"] or "").split(" ")[-1]
        if not (first and last):
            return contact
        data = await request_json(
            self._client,
            "GET",
            _HUNTER_FINDER,
            params={
                "domain": domain,
                "first_name": first,
                "last_name": last,
                "api_key": settings.hunter_api_key,
            },
        )
        found = (data.get("data") or {}).get("email")
        if found:
            contact["email"] = found
            contact["email_verified"] = (data["data"].get("verification") or {}).get(
                "status"
            ) == "valid"
        return contact

    async def _verify(self, email: str) -> bool:
        data = await request_json(
            self._client,
            "GET",
            _HUNTER_VERIFY,
            params={"email": email, "api_key": settings.hunter_api_key},
        )
        return (data.get("data") or {}).get("status") == "valid"
