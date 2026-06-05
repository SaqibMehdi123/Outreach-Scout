"""Draft review gate routes (approve / discard / edit / regenerate)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentOrg, DbSession
from app.db.models import DraftStatus
from app.schemas.draft import DraftStatusOut, DraftUpdate
from app.services import review as svc

router = APIRouter()


async def _load(session, org_id, draft_id):
    draft = await svc.get_draft_scoped(session, org_id, draft_id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    return draft


def _out(draft) -> DraftStatusOut:
    return DraftStatusOut(id=draft.id, status=draft.status.value, message=draft.message)


@router.post("/{draft_id}/approve", response_model=DraftStatusOut)
async def approve(draft_id: uuid.UUID, org_id: CurrentOrg, session: DbSession) -> DraftStatusOut:
    draft = await _load(session, org_id, draft_id)
    return _out(await svc.set_status(session, draft, DraftStatus.approved))


@router.post("/{draft_id}/discard", response_model=DraftStatusOut)
async def discard(draft_id: uuid.UUID, org_id: CurrentOrg, session: DbSession) -> DraftStatusOut:
    draft = await _load(session, org_id, draft_id)
    return _out(await svc.set_status(session, draft, DraftStatus.discarded))


@router.post("/{draft_id}/unapprove", response_model=DraftStatusOut)
async def unapprove(draft_id: uuid.UUID, org_id: CurrentOrg, session: DbSession) -> DraftStatusOut:
    draft = await _load(session, org_id, draft_id)
    return _out(await svc.set_status(session, draft, DraftStatus.pending))


@router.patch("/{draft_id}", response_model=DraftStatusOut)
async def edit(
    draft_id: uuid.UUID, data: DraftUpdate, org_id: CurrentOrg, session: DbSession
) -> DraftStatusOut:
    draft = await _load(session, org_id, draft_id)
    return _out(await svc.update_message(session, draft, data.message))


@router.post("/{draft_id}/regenerate", response_model=DraftStatusOut)
async def regenerate(draft_id: uuid.UUID, org_id: CurrentOrg, session: DbSession) -> DraftStatusOut:
    draft = await _load(session, org_id, draft_id)
    return _out(await svc.regenerate(session, draft))
