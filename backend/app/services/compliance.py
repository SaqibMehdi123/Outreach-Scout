"""Compliance: opt-out/suppression list + retention settings, org-scoped.

Suppressed domains must never be drafted or exported. Retention controls how
long researched data lives before the purge task removes it.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Org, Suppression
from app.schemas.compliance import ComplianceSettings


def _normalise(domain: str) -> str:
    d = domain.strip().lower()
    for prefix in ("https://", "http://", "www."):
        if d.startswith(prefix):
            d = d[len(prefix):]
    return d.split("/")[0]


def get_settings(org: Org) -> ComplianceSettings:
    return ComplianceSettings.model_validate(org.settings or {})


async def update_settings(
    session: AsyncSession, org: Org, data: ComplianceSettings
) -> ComplianceSettings:
    org.settings = {**(org.settings or {}), **data.model_dump()}
    await session.flush()
    return data


async def list_suppressions(session: AsyncSession, org_id: uuid.UUID) -> list[Suppression]:
    rows = await session.scalars(
        select(Suppression).where(Suppression.org_id == org_id)
        .order_by(Suppression.created_at.desc())
    )
    return list(rows)


async def add_suppression(
    session: AsyncSession, org_id: uuid.UUID, domain: str, reason: str | None
) -> Suppression:
    norm = _normalise(domain)
    existing = await session.scalar(
        select(Suppression).where(Suppression.org_id == org_id, Suppression.domain == norm)
    )
    if existing is not None:
        if reason:
            existing.reason = reason
        return existing
    entry = Suppression(org_id=org_id, domain=norm, reason=reason)
    session.add(entry)
    await session.flush()
    return entry


async def remove_suppression(
    session: AsyncSession, org_id: uuid.UUID, suppression_id: uuid.UUID
) -> bool:
    entry = await session.scalar(
        select(Suppression).where(
            Suppression.id == suppression_id, Suppression.org_id == org_id
        )
    )
    if entry is None:
        return False
    await session.delete(entry)
    return True


async def suppressed_domains(session: AsyncSession, org_id: uuid.UUID) -> set[str]:
    rows = await session.scalars(
        select(Suppression.domain).where(Suppression.org_id == org_id)
    )
    return set(rows)


async def is_suppressed(session: AsyncSession, org_id: uuid.UUID, domain: str | None) -> bool:
    if not domain:
        return False
    return _normalise(domain) in await suppressed_domains(session, org_id)
