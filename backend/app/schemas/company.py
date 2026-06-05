"""Company / lead read schemas for the review UI."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str | None
    title: str | None
    profile_url: str | None
    email: str | None
    email_verified: bool


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message: str
    status: str


class CompanyOut(BaseModel):
    """List-row view for the live/review tables."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    domain: str
    industry: str | None
    size: str | None
    location: str | None
    fit_score: float | None
    insights: dict
    contact: ContactOut | None = None
    draft: DraftOut | None = None


class TraceOut(BaseModel):
    steps: list = []
    tokens: int = 0
    cost: float = 0.0


class CompanyDetail(CompanyOut):
    """Lead detail + insights + draft + trace."""

    created_at: datetime
    trace: TraceOut | None = None


class CompanyPage(BaseModel):
    items: list[CompanyOut]
    total: int
    page: int
    page_size: int
