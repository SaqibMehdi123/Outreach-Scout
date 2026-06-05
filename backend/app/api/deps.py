"""Shared FastAPI dependencies: DB session, current user, tenant scoping.

``get_current_user`` resolves the JWT to a User; ``CurrentOrg`` exposes the
org_id every downstream query must filter on, so a tenant can only ever see its
own ICPs, campaigns, companies and drafts.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_session

_bearer = HTTPBearer(auto_error=True)

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    session: DbSession,
) -> User:
    payload = decode_access_token(creds.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )
    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token subject"
        ) from exc
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_org_id(user: CurrentUser) -> uuid.UUID:
    return user.org_id


CurrentOrg = Annotated[uuid.UUID, Depends(get_current_org_id)]
