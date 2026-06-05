"""Data-retention purge.

Researched data is auto-purged after each org's retention window, EXCEPT leads
that were exported/synced to a CRM (those are kept). Deleting a Company cascades
to its contacts and drafts; the producing job + trace are removed too.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Contact, Draft, DraftStatus, Job, Org
from app.observability.logging import get_logger

logger = get_logger(__name__)

DEFAULT_RETENTION_DAYS = 90


async def purge_expired(session: AsyncSession) -> int:
    """Delete expired researched data across all orgs. Returns rows removed."""
    total = 0
    orgs = list(await session.scalars(select(Org)))
    for org in orgs:
        days = int((org.settings or {}).get("retention_days", DEFAULT_RETENTION_DAYS))
        cutoff = datetime.now(UTC) - timedelta(days=days)

        # Companies that have an exported draft are retained.
        exported = (
            select(Company.id)
            .join(Contact, Contact.company_id == Company.id)
            .join(Draft, Draft.contact_id == Contact.id)
            .where(Draft.status == DraftStatus.exported)
        )
        stale = list(await session.scalars(
            select(Company.id).where(
                Company.org_id == org.id,
                Company.created_at < cutoff,
                Company.id.not_in(exported),
            )
        ))
        if not stale:
            continue
        job_ids = list(await session.scalars(
            select(Company.job_id).where(Company.id.in_(stale))
        ))
        await session.execute(delete(Company).where(Company.id.in_(stale)))
        if job_ids:
            # Removes the producing jobs + their agent traces (cascade).
            await session.execute(delete(Job).where(Job.id.in_(job_ids)))
        total += len(stale)
        logger.info("retention.purged", org_id=str(org.id), count=len(stale), retention_days=days)

    await session.commit()
    return total
