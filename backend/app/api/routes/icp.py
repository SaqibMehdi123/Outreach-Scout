"""ICP routes (org-scoped CRUD)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentOrg, DbSession
from app.schemas.icp import IcpCreate, IcpOut, IcpUpdate
from app.services import icp as svc

router = APIRouter()


@router.post("", response_model=IcpOut, status_code=status.HTTP_201_CREATED)
async def create_icp(data: IcpCreate, org_id: CurrentOrg, session: DbSession) -> IcpOut:
    return IcpOut.model_validate(await svc.create_icp(session, org_id, data))


@router.get("", response_model=list[IcpOut])
async def list_icps(org_id: CurrentOrg, session: DbSession) -> list[IcpOut]:
    return [IcpOut.model_validate(x) for x in await svc.list_icps(session, org_id)]


@router.get("/{icp_id}", response_model=IcpOut)
async def get_icp(icp_id: uuid.UUID, org_id: CurrentOrg, session: DbSession) -> IcpOut:
    icp = await svc.get_icp(session, org_id, icp_id)
    if icp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP not found")
    return IcpOut.model_validate(icp)


@router.patch("/{icp_id}", response_model=IcpOut)
async def update_icp(
    icp_id: uuid.UUID, data: IcpUpdate, org_id: CurrentOrg, session: DbSession
) -> IcpOut:
    icp = await svc.get_icp(session, org_id, icp_id)
    if icp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP not found")
    return IcpOut.model_validate(await svc.update_icp(session, icp, data))
