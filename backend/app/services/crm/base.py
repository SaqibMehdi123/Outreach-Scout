"""CRM connector interface + the normalized lead record."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field


@dataclass(slots=True)
class LeadRecord:
    """The fields any CRM connector receives for one approved lead."""

    company: str
    domain: str
    industry: str | None
    location: str | None
    fit_score: float | None
    contact_name: str | None
    contact_title: str | None
    contact_email: str | None
    message: str
    signals: list[str] = field(default_factory=list)


@dataclass(slots=True)
class CrmSyncResult:
    provider: str
    synced: int
    failed: int = 0
    errors: list[str] = field(default_factory=list)


class CrmConnector(abc.ABC):
    provider: str

    @abc.abstractmethod
    async def sync(self, leads: list[LeadRecord]) -> CrmSyncResult:
        ...
