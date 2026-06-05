"""Module 9: retention purge (live DB)."""

from __future__ import annotations

import socket
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import pytest

from app.config import settings
from app.db.models import (
    Campaign,
    CampaignStatus,
    Company,
    Contact,
    Draft,
    DraftStatus,
    IcpProfile,
    Job,
    JobStatus,
    Org,
)
from app.db.session import SessionLocal
from app.services.retention import purge_expired


def _reachable(url: str, port: int) -> bool:
    try:
        p = urlsplit(url)
        with socket.create_connection((p.hostname or "localhost", p.port or port), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not (_reachable(settings.database_url, 5432) and _reachable(settings.redis_url, 6379)),
    reason="Postgres/Redis not reachable",
)


async def _company(session, org, camp, name, domain, *, age_days: int, draft_status):
    job = Job(campaign_id=camp.id, company_seed={}, status=JobStatus.done)
    session.add(job)
    await session.flush()
    company = Company(job_id=job.id, org_id=org.id, campaign_id=camp.id,
                      name=name, domain=domain, insights={})
    company.created_at = datetime.now(UTC) - timedelta(days=age_days)
    session.add(company)
    await session.flush()
    contact = Contact(company_id=company.id, name="X")
    session.add(contact)
    await session.flush()
    if draft_status is not None:
        session.add(Draft(contact_id=contact.id, message="m", status=draft_status))
    return company.id


async def test_purge_removes_stale_keeps_exported_and_recent() -> None:
    async with SessionLocal() as s:
        org = Org(name="Ret", settings={"retention_days": 30})
        s.add(org)
        await s.flush()
        icp = IcpProfile(org_id=org.id, name="i", criteria={})
        s.add(icp)
        await s.flush()
        camp = Campaign(org_id=org.id, icp_profile_id=icp.id, target_count=3,
                        status=CampaignStatus.done)
        s.add(camp)
        await s.flush()

        stale = await _company(s, org, camp, "Stale", "stale.com",
                               age_days=60, draft_status=DraftStatus.pending)
        kept_exported = await _company(s, org, camp, "Kept", "kept.com",
                                       age_days=60, draft_status=DraftStatus.exported)
        recent = await _company(s, org, camp, "New", "new.com",
                                age_days=1, draft_status=DraftStatus.pending)
        await s.commit()

    async with SessionLocal() as s:
        removed = await purge_expired(s)
        assert removed >= 1

    async with SessionLocal() as s:
        assert await s.get(Company, stale) is None          # old + not exported → purged
        assert await s.get(Company, kept_exported) is not None  # exported → retained
        assert await s.get(Company, recent) is not None      # within window → retained
