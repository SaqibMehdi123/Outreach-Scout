"""CRM connectors.

A connector takes approved leads and pushes them to an external CRM. The default
``LogConnector`` requires no credentials (it records what would sync) so the app
runs free; ``HubSpotConnector`` is a real implementation used when a token is set.
Selected by ``get_connector`` from the org's ``crm_provider`` + env.
"""

from __future__ import annotations

from app.services.crm.base import CrmConnector, CrmSyncResult, LeadRecord
from app.services.crm.hubspot import HubSpotConnector
from app.services.crm.log import LogConnector

__all__ = [
    "CrmConnector",
    "CrmSyncResult",
    "LeadRecord",
    "HubSpotConnector",
    "LogConnector",
    "get_connector",
]


def get_connector(provider: str | None) -> CrmConnector:
    from app.config import settings

    if (provider or "").lower() == "hubspot" and settings.hubspot_access_token:
        return HubSpotConnector()
    return LogConnector()
