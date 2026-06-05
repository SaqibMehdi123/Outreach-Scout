"""Company / lead read routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentOrg, DbSession
from app.schemas.company import CompanyDetail, CompanyPage
from app.services import company as svc

router = APIRouter()


@router.get("", response_model=CompanyPage)
async def list_companies(
    org_id: CurrentOrg,
    session: DbSession,
    campaign: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> CompanyPage:
    items, total = await svc.list_companies(
        session, org_id, campaign_id=campaign, page=page, page_size=page_size
    )
    return CompanyPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{company_id}", response_model=CompanyDetail)
async def get_company(
    company_id: uuid.UUID, org_id: CurrentOrg, session: DbSession
) -> CompanyDetail:
    detail = await svc.get_company_detail(session, org_id, company_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return detail
