"""Draft review schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class DraftUpdate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class DraftStatusOut(BaseModel):
    id: uuid.UUID
    status: str
    message: str
