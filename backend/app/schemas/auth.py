"""Auth & onboarding request/response schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    # Optional onboarding context captured at signup (UI onboarding flow).
    company: str | None = Field(default=None, max_length=200)
    role: str | None = None  # founder | sales_lead | sdr | revops
    value_prop: str | None = None
    crm_provider: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    # Optional onboarding context for a first-time Google sign-up.
    company: str | None = Field(default=None, max_length=200)
    role: str | None = None
    value_prop: str | None = None
    crm_provider: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str | None
    role: str | None
    org_id: uuid.UUID


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    value_prop: str | None
    crm_provider: str | None


class MeResponse(BaseModel):
    user: UserOut
    org: OrgOut
