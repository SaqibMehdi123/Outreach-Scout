"""Campaign routes: launch (enqueues jobs), list, detail with live stats."""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.api.deps import CurrentOrg, DbSession
from app.core.security import decode_access_token
from app.db.models import Campaign, Company, Job, Org
from app.db.session import SessionLocal
from app.schemas.campaign import (
    CampaignCreate,
    CampaignDetail,
    CampaignOut,
)
from app.services import campaign as svc
from app.services import export as export_svc
from app.services.campaign import CampaignError

router = APIRouter()

# How often the live stream polls the DB for progress.
_STREAM_INTERVAL_S = 1.0


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def launch_campaign(
    data: CampaignCreate, org_id: CurrentOrg, session: DbSession
) -> CampaignOut:
    try:
        campaign = await svc.launch_campaign(session, org_id, data)
    except CampaignError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CampaignOut.model_validate(campaign)


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(org_id: CurrentOrg, session: DbSession) -> list[CampaignOut]:
    return [CampaignOut.model_validate(c) for c in await svc.list_campaigns(session, org_id)]


@router.get("/{campaign_id}", response_model=CampaignDetail)
async def get_campaign(
    campaign_id: uuid.UUID, org_id: CurrentOrg, session: DbSession
) -> CampaignDetail:
    campaign = await svc.get_campaign(session, org_id, campaign_id)
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )
    stats = await svc.campaign_stats(session, campaign.id)
    detail = CampaignDetail.model_validate(campaign)
    detail.stats = stats
    return detail


class CrmSyncOut(BaseModel):
    provider: str
    synced: int
    failed: int
    errors: list[str] = []


async def _require_campaign(session, org_id: uuid.UUID, campaign_id: uuid.UUID) -> Campaign:
    campaign = await svc.get_campaign(session, org_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.post("/{campaign_id}/export")
async def export_campaign(
    campaign_id: uuid.UUID, org_id: CurrentOrg, session: DbSession
) -> Response:
    """Download approved leads as CSV (marks them exported). Approval gate."""
    await _require_campaign(session, org_id, campaign_id)
    csv_text, count = await export_svc.export_csv(session, org_id, campaign_id)
    if count == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No approved leads to export")
    return Response(
        content=csv_text, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="campaign-{campaign_id}.csv"'},
    )


@router.post("/{campaign_id}/sync", response_model=CrmSyncOut)
async def sync_campaign(
    campaign_id: uuid.UUID, org_id: CurrentOrg, session: DbSession
) -> CrmSyncOut:
    """Sync approved leads to the org's CRM (marks them exported). Approval gate."""
    await _require_campaign(session, org_id, campaign_id)
    org = await session.get(Org, org_id)
    result = await export_svc.sync_crm(
        session, org_id, org.crm_provider if org else None, campaign_id
    )
    return CrmSyncOut(provider=result.provider, synced=result.synced,
                      failed=result.failed, errors=result.errors)


async def _stream_snapshot(campaign_id: uuid.UUID) -> dict:
    """One live snapshot: campaign stats + per-lead progress."""
    async with SessionLocal() as session:
        stats = await svc.campaign_stats(session, campaign_id)
        jobs = list(await session.scalars(
            select(Job).where(Job.campaign_id == campaign_id).order_by(Job.created_at)
        ))
        companies = list(await session.scalars(
            select(Company).where(Company.campaign_id == campaign_id)
        ))
        by_job = {c.job_id: c for c in companies}
        leads = []
        for j in jobs:
            c = by_job.get(j.id)
            leads.append({
                "job_id": str(j.id), "status": j.status.value, "progress": j.progress,
                "company": c.name if c else (j.company_seed or {}).get("name"),
                "domain": c.domain if c else None,
                "fit": c.fit_score if c else None,
                "error": j.error,
            })
    done = stats.queued == 0 and stats.researching == 0
    return {"stats": stats.model_dump(), "leads": leads, "done": done}


@router.get("/{campaign_id}/stream")
async def stream_campaign(campaign_id: uuid.UUID, request: Request, token: str):
    """SSE live progress. Auth via ?token= (EventSource can't set headers)."""
    payload = decode_access_token(token)
    if payload is None or "org" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    org_id = uuid.UUID(payload["org"])

    async with SessionLocal() as session:
        campaign = await session.get(Campaign, campaign_id)
        if campaign is None or campaign.org_id != org_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    async def event_gen():
        import orjson
        while True:
            if await request.is_disconnected():
                break
            snap = await _stream_snapshot(campaign_id)
            yield {"event": "progress", "data": orjson.dumps(snap).decode()}
            if snap["done"]:
                break
            await asyncio.sleep(_STREAM_INTERVAL_S)

    return EventSourceResponse(event_gen())
