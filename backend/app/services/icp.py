"""ICP profile CRUD, always scoped to an org."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IcpProfile
from app.schemas.icp import IcpCreate, IcpUpdate


async def create_icp(session: AsyncSession, org_id: uuid.UUID, data: IcpCreate) -> IcpProfile:
    icp = IcpProfile(
        org_id=org_id,
        name=data.name,
        criteria=data.criteria.model_dump(),
        value_prop=data.value_prop,
    )
    session.add(icp)
    await session.flush()
    return icp


async def list_icps(session: AsyncSession, org_id: uuid.UUID) -> list[IcpProfile]:
    rows = await session.scalars(
        select(IcpProfile)
        .where(IcpProfile.org_id == org_id)
        .order_by(IcpProfile.created_at.desc())
    )
    return list(rows)


async def get_icp(
    session: AsyncSession, org_id: uuid.UUID, icp_id: uuid.UUID
) -> IcpProfile | None:
    return await session.scalar(
        select(IcpProfile).where(
            IcpProfile.id == icp_id, IcpProfile.org_id == org_id
        )
    )


async def update_icp(
    session: AsyncSession, icp: IcpProfile, data: IcpUpdate
) -> IcpProfile:
    if data.name is not None:
        icp.name = data.name
    if data.criteria is not None:
        icp.criteria = data.criteria.model_dump()
    if data.value_prop is not None:
        icp.value_prop = data.value_prop
    await session.flush()
    return icp
