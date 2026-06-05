"""Aggregate API router. Each module attaches its sub-router here."""

from __future__ import annotations

from fastapi import APIRouter

from app.api import health
from app.api.routes import auth, campaigns, companies, drafts, icp, settings

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(icp.router, prefix="/icp", tags=["icp"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
