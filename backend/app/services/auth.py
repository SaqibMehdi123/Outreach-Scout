"""Auth service: registration (org + user) and credential verification."""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import hash_password, verify_password
from app.db.models import Org, User
from app.schemas.auth import GoogleAuthRequest, SignupRequest


class AuthError(Exception):
    """Raised on registration/login failures (mapped to 400/401 at the route)."""


async def register(session: AsyncSession, data: SignupRequest) -> User:
    existing = await session.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise AuthError("An account with this email already exists")

    # Each signup bootstraps its own org (tenant). Onboarding context lands here.
    org = Org(
        name=data.company or f"{data.name}'s workspace",
        value_prop=data.value_prop,
        crm_provider=data.crm_provider,
    )
    session.add(org)
    await session.flush()  # assign org.id

    user = User(
        org_id=org.id,
        email=data.email,
        name=data.name,
        role=data.role,
        hashed_password=hash_password(data.password),
    )
    session.add(user)
    await session.flush()
    return user


async def authenticate(
    session: AsyncSession, *, email: str, password: str
) -> User | None:
    user = await session.scalar(select(User).where(User.email == email))
    if user is None or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def _verify_google_token(token: str) -> dict:
    """Verify a Google ID token against our client ID. Returns the claims."""
    if not settings.google_client_id:
        raise AuthError("Google login is not configured on the server")
    from google.auth.transport import requests as g_requests
    from google.oauth2 import id_token as g_id_token

    def _verify() -> dict:
        return g_id_token.verify_oauth2_token(
            token, g_requests.Request(), settings.google_client_id
        )

    try:
        claims = await asyncio.to_thread(_verify)
    except ValueError as exc:
        raise AuthError("Invalid Google token") from exc
    if not claims.get("email_verified"):
        raise AuthError("Google account email is not verified")
    return claims


async def authenticate_google(
    session: AsyncSession, data: GoogleAuthRequest
) -> tuple[User, bool]:
    """Verify the Google ID token and find-or-create the user. Returns (user, is_new)."""
    claims = await _verify_google_token(data.id_token)
    email = claims["email"]
    name = claims.get("name") or email.split("@")[0]

    user = await session.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False

    # First Google sign-in → bootstrap an org (no password).
    org = Org(
        name=data.company or f"{name}'s workspace",
        value_prop=data.value_prop,
        crm_provider=data.crm_provider,
    )
    session.add(org)
    await session.flush()
    user = User(org_id=org.id, email=email, name=name, role=data.role)
    session.add(user)
    await session.flush()
    return user, True
