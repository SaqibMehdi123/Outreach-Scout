"""Auth routes: signup, login, me."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token
from app.db.models import Org
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    MeResponse,
    OrgOut,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services.auth import (
    AuthError,
    authenticate,
    authenticate_google,
    register,
)

router = APIRouter()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest, session: DbSession) -> TokenResponse:
    try:
        user = await register(session, data)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    token = create_access_token(user_id=user.id, org_id=user.org_id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: DbSession) -> TokenResponse:
    user = await authenticate(session, email=data.email, password=data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    token = create_access_token(user_id=user.id, org_id=user.org_id)
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
async def google_auth(data: GoogleAuthRequest, session: DbSession) -> TokenResponse:
    """Sign in / up with a Google ID token (verified server-side)."""
    try:
        user, is_new = await authenticate_google(session, data)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    token = create_access_token(user_id=user.id, org_id=user.org_id)
    return TokenResponse(access_token=token, is_new=is_new)


@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser, session: DbSession) -> MeResponse:
    org = await session.get(Org, user.org_id)
    return MeResponse(user=UserOut.model_validate(user), org=OrgOut.model_validate(org))
