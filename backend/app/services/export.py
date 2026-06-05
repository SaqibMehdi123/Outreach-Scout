"""Export & CRM sync — strictly behind the human approval gate.

Only drafts with status ``approved`` are eligible. After a successful export or
sync the draft moves to ``exported`` so it isn't pushed twice.
"""

from __future__ import annotations

import csv
import io
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Company, Contact, Draft, DraftStatus
from app.services.crm import CrmSyncResult, get_connector
from app.services.crm.base import LeadRecord

CSV_COLUMNS = [
    "Company", "Domain", "Industry", "Location", "Contact", "Title", "Email",
    "FitScore", "Signals", "Message",
]


async def _approved_drafts(
    session: AsyncSession, org_id: uuid.UUID, campaign_id: uuid.UUID | None
) -> list[Draft]:
    filters = [Company.org_id == org_id, Draft.status == DraftStatus.approved]
    if campaign_id is not None:
        filters.append(Company.campaign_id == campaign_id)
    rows = await session.scalars(
        select(Draft)
        .join(Contact, Draft.contact_id == Contact.id)
        .join(Company, Contact.company_id == Company.id)
        .where(*filters)
        .options(selectinload(Draft.contact).selectinload(Contact.company))
        .order_by(Company.fit_score.desc().nullslast())
    )
    return list(rows)


def _to_record(draft: Draft) -> LeadRecord:
    contact = draft.contact
    company = contact.company
    signals = [s.get("type", "") for s in (company.insights or {}).get("signals", [])]
    return LeadRecord(
        company=company.name, domain=company.domain, industry=company.industry,
        location=company.location, fit_score=company.fit_score,
        contact_name=contact.name, contact_title=contact.title,
        contact_email=contact.email, message=draft.message, signals=signals,
    )


async def export_csv(
    session: AsyncSession, org_id: uuid.UUID, campaign_id: uuid.UUID | None = None
) -> tuple[str, int]:
    drafts = await _approved_drafts(session, org_id, campaign_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    for d in drafts:
        r = _to_record(d)
        writer.writerow([
            r.company, r.domain, r.industry or "", r.location or "",
            r.contact_name or "", r.contact_title or "", r.contact_email or "",
            r.fit_score if r.fit_score is not None else "",
            "; ".join(r.signals), r.message.replace("\n", " "),
        ])
        d.status = DraftStatus.exported
    await session.flush()
    return buf.getvalue(), len(drafts)


async def sync_crm(
    session: AsyncSession, org_id: uuid.UUID, provider: str | None,
    campaign_id: uuid.UUID | None = None,
) -> CrmSyncResult:
    drafts = await _approved_drafts(session, org_id, campaign_id)
    records = [_to_record(d) for d in drafts]
    connector = get_connector(provider)
    result = await connector.sync(records)
    # Mark exported only when everything synced cleanly.
    if result.failed == 0:
        for d in drafts:
            d.status = DraftStatus.exported
        await session.flush()
    return result
