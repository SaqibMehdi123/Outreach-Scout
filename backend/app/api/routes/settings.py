"""Compliance settings + suppression-list routes (org-scoped)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentOrg, DbSession
from app.db.models import Org
from app.schemas.compliance import (
    ComplianceOut,
    ComplianceSettings,
    SuppressionCreate,
    SuppressionOut,
)
from app.services import compliance as svc

router = APIRouter()


@router.get("/compliance", response_model=ComplianceOut)
async def get_compliance(org_id: CurrentOrg, session: DbSession) -> ComplianceOut:
    org = await session.get(Org, org_id)
    suppressions = await svc.list_suppressions(session, org_id)
    return ComplianceOut(
        settings=svc.get_settings(org),
        suppressions=[SuppressionOut.model_validate(s) for s in suppressions],
    )


@router.put("/compliance", response_model=ComplianceSettings)
async def update_compliance(
    data: ComplianceSettings, org_id: CurrentOrg, session: DbSession
) -> ComplianceSettings:
    org = await session.get(Org, org_id)
    return await svc.update_settings(session, org, data)


@router.post("/suppression", response_model=SuppressionOut,
             status_code=status.HTTP_201_CREATED)
async def add_suppression(
    data: SuppressionCreate, org_id: CurrentOrg, session: DbSession
) -> SuppressionOut:
    entry = await svc.add_suppression(session, org_id, data.domain, data.reason)
    return SuppressionOut.model_validate(entry)


@router.delete("/suppression/{suppression_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_suppression(
    suppression_id: uuid.UUID, org_id: CurrentOrg, session: DbSession
) -> None:
    if not await svc.remove_suppression(session, org_id, suppression_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
