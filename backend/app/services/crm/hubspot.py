"""Real HubSpot connector (used when HUBSPOT_ACCESS_TOKEN is set).

Upserts a Company and a Contact per approved lead via the CRM v3 API and writes
the drafted opener onto the contact. Failures are isolated per lead so one bad
record never aborts the batch.
"""

from __future__ import annotations

import httpx

from app.config import settings
from app.observability.logging import get_logger
from app.services.crm.base import CrmConnector, CrmSyncResult, LeadRecord

logger = get_logger(__name__)

_BASE = "https://api.hubapi.com"


class HubSpotConnector(CrmConnector):
    provider = "hubspot"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(
            base_url=_BASE,
            timeout=20.0,
            headers={"Authorization": f"Bearer {settings.hubspot_access_token}",
                     "Content-Type": "application/json"},
        )

    async def sync(self, leads: list[LeadRecord]) -> CrmSyncResult:
        result = CrmSyncResult(provider=self.provider, synced=0)
        for lead in leads:
            try:
                await self._sync_one(lead)
                result.synced += 1
            except Exception as exc:  # noqa: BLE001 — isolate per lead
                result.failed += 1
                result.errors.append(f"{lead.company}: {exc}")
                logger.warning("crm.hubspot.lead_failed", company=lead.company, error=str(exc))
        return result

    async def _sync_one(self, lead: LeadRecord) -> None:
        company_props = {
            "name": lead.company, "domain": lead.domain,
            "industry": lead.industry or "", "city": lead.location or "",
        }
        await self._client.post("/crm/v3/objects/companies",
                                json={"properties": company_props})

        first, _, last = (lead.contact_name or "").partition(" ")
        contact_props = {
            "email": lead.contact_email or f"unknown@{lead.domain}",
            "firstname": first, "lastname": last,
            "jobtitle": lead.contact_title or "",
            "company": lead.company,
            "hs_lead_status": "NEW",
            "message": lead.message,
        }
        resp = await self._client.post("/crm/v3/objects/contacts",
                                       json={"properties": contact_props})
        if resp.status_code >= 400:
            raise RuntimeError(f"contact upsert {resp.status_code}: {resp.text[:200]}")
