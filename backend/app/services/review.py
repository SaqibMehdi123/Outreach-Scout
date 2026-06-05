"""Draft review gate — approve / discard / edit / regenerate, org-scoped.

This is the mandatory human gate: drafts start ``pending`` and only an explicit
approval moves them toward export.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.schemas import ResearchContact, ResearchInsight, ResearchResult, ResearchSignal
from app.db.models import Company, Contact, Draft, DraftStatus, Org
from app.services.draft import generate_draft


async def get_draft_scoped(
    session: AsyncSession, org_id: uuid.UUID, draft_id: uuid.UUID
) -> Draft | None:
    """Fetch a draft only if it belongs to the org (draft→contact→company→org)."""
    return await session.scalar(
        select(Draft)
        .join(Contact, Draft.contact_id == Contact.id)
        .join(Company, Contact.company_id == Company.id)
        .where(Draft.id == draft_id, Company.org_id == org_id)
    )


async def set_status(session: AsyncSession, draft: Draft, status: DraftStatus) -> Draft:
    draft.status = status
    await session.flush()
    return draft


async def update_message(session: AsyncSession, draft: Draft, message: str) -> Draft:
    draft.message = message
    await session.flush()
    return draft


async def regenerate(session: AsyncSession, draft: Draft) -> Draft:
    """Rebuild the message from stored research, with a fresh angle."""
    contact = await session.get(Contact, draft.contact_id)
    company = await session.get(Company, contact.company_id)
    org = await session.get(Org, company.org_id)

    insights = company.insights or {}
    result = ResearchResult(
        name=company.name, domain=company.domain, industry=company.industry,
        size=company.size, location=company.location,
        insights=[ResearchInsight(**f) for f in insights.get("facts", [])],
        signals=[ResearchSignal(**s) for s in insights.get("signals", [])],
        contact=ResearchContact(name=contact.name, title=contact.title,
                                profile_url=contact.profile_url, email=contact.email,
                                email_verified=contact.email_verified),
        fit_score=company.fit_score,
    )
    message, _ = await generate_draft(result, org.value_prop if org else None, variant=True)
    if message:
        draft.message = message
        await session.flush()
    return draft
