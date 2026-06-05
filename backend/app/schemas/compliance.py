"""Compliance settings + suppression schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ComplianceSettings(BaseModel):
    retention_days: int = Field(default=90, ge=1, le=3650)
    gdpr_checks: bool = True
    canspam_footer: bool = True


class SuppressionCreate(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    reason: str | None = Field(default=None, max_length=200)


class SuppressionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain: str
    reason: str | None
    created_at: datetime


class ComplianceOut(BaseModel):
    settings: ComplianceSettings
    suppressions: list[SuppressionOut]
