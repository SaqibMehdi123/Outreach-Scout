"""ICP profile schemas. ``criteria`` mirrors the setup screen's selections."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IcpCriteria(BaseModel):
    """Firmographics + buying signals the agent matches against."""

    industries: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)  # s | m | l | xl | xxl
    geos: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    signals: list[str] = Field(default_factory=list)  # funded|hiring|launch|exec|tech


class IcpCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    criteria: IcpCriteria = Field(default_factory=IcpCriteria)
    value_prop: str | None = None


class IcpUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    criteria: IcpCriteria | None = None
    value_prop: str | None = None


class IcpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    criteria: dict
    value_prop: str | None
    created_at: datetime
    updated_at: datetime
