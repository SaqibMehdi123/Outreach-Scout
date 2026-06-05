"""Default credential-free CRM connector — records what would be synced."""

from __future__ import annotations

from app.observability.logging import get_logger
from app.services.crm.base import CrmConnector, CrmSyncResult, LeadRecord

logger = get_logger(__name__)


class LogConnector(CrmConnector):
    provider = "log"

    async def sync(self, leads: list[LeadRecord]) -> CrmSyncResult:
        for lead in leads:
            logger.info("crm.sync.lead", company=lead.company, domain=lead.domain,
                        contact=lead.contact_name, email=lead.contact_email)
        return CrmSyncResult(provider=self.provider, synced=len(leads))
