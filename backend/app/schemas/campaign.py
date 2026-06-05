"""Campaign schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import CampaignStatus
from app.schemas.icp import IcpCreate


class CampaignCreate(BaseModel):
    """Launch a campaign. Either reference an existing ICP or inline a new one."""

    name: str | None = Field(default=None, max_length=200)
    target_count: int = Field(default=50, ge=1, le=500)
    icp_profile_id: uuid.UUID | None = None
    icp: IcpCreate | None = None  # inline ICP (created on the fly) if no id given


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None
    target_count: int
    status: CampaignStatus
    icp_profile_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CampaignStats(BaseModel):
    queued: int = 0
    researching: int = 0
    done: int = 0
    failed: int = 0
    avg_fit: float | None = None
    tokens: int = 0
    cost_usd: float = 0.0


class CampaignDetail(CampaignOut):
    stats: CampaignStats = Field(default_factory=CampaignStats)
