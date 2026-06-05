"""Read services for researched leads (companies), org-scoped."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import AgentTrace, Company, Contact
from app.schemas.company import (
    CompanyDetail,
    CompanyOut,
    ContactOut,
    DraftOut,
    TraceOut,
)


def _first_contact(company: Company) -> Contact | None:
    return company.contacts[0] if company.contacts else None


def _to_out(company: Company) -> CompanyOut:
    contact = _first_contact(company)
    draft = None
    if contact and contact.drafts:
        d = contact.drafts[0]
        draft = DraftOut(id=d.id, message=d.message, status=d.status.value)
    return CompanyOut(
        id=company.id, name=company.name, domain=company.domain,
        industry=company.industry, size=company.size, location=company.location,
        fit_score=company.fit_score, insights=company.insights or {},
        contact=ContactOut.model_validate(contact) if contact else None,
        draft=draft,
    )


async def list_companies(
    session: AsyncSession, org_id: uuid.UUID, *,
    campaign_id: uuid.UUID | None = None, page: int = 1, page_size: int = 50,
) -> tuple[list[CompanyOut], int]:
    filters = [Company.org_id == org_id]
    if campaign_id is not None:
        filters.append(Company.campaign_id == campaign_id)

    total = await session.scalar(select(func.count()).select_from(Company).where(*filters))
    rows = await session.scalars(
        select(Company)
        .where(*filters)
        .options(selectinload(Company.contacts).selectinload(Contact.drafts))
        .order_by(Company.fit_score.desc().nullslast(), Company.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [_to_out(c) for c in rows], int(total or 0)


async def get_company_detail(
    session: AsyncSession, org_id: uuid.UUID, company_id: uuid.UUID
) -> CompanyDetail | None:
    company = await session.scalar(
        select(Company)
        .where(Company.id == company_id, Company.org_id == org_id)
        .options(selectinload(Company.contacts).selectinload(Contact.drafts))
    )
    if company is None:
        return None

    trace_row = await session.scalar(
        select(AgentTrace).where(AgentTrace.job_id == company.job_id)
    )
    base = _to_out(company)
    trace = None
    if trace_row is not None:
        trace = TraceOut(steps=trace_row.steps or [], tokens=trace_row.tokens,
                         cost=float(trace_row.cost))
    return CompanyDetail(**base.model_dump(), created_at=company.created_at, trace=trace)
