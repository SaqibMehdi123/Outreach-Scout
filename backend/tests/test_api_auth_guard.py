"""Routing + auth-guard tests that don't require DB/Redis."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_open() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_protected_routes_require_auth() -> None:
    cases = [
        ("get", "/icp", None),
        ("post", "/icp", {}),
        ("get", "/campaigns", None),
        ("post", "/campaigns", {}),
        ("get", "/auth/me", None),
    ]
    for method, path, body in cases:
        kwargs = {"json": body} if body is not None else {}
        resp = getattr(client, method)(path, **kwargs)
        assert resp.status_code in (401, 403), f"{method} {path} -> {resp.status_code}"


def test_invalid_token_rejected() -> None:
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"})
    assert resp.status_code == 401
