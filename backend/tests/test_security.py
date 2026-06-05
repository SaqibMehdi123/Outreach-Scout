"""Unit tests for password hashing + JWT (no DB required)."""

from __future__ import annotations

import uuid

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    h = hash_password("correct horse battery staple")
    assert h != "correct horse battery staple"
    assert verify_password("correct horse battery staple", h)
    assert not verify_password("wrong", h)


def test_password_over_72_bytes() -> None:
    pw = "a" * 200
    h = hash_password(pw)
    assert verify_password(pw, h)


def test_jwt_roundtrip_carries_tenant() -> None:
    uid, oid = uuid.uuid4(), uuid.uuid4()
    token = create_access_token(user_id=uid, org_id=oid)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(uid)
    assert payload["org"] == str(oid)


def test_jwt_rejects_tampered_token() -> None:
    token = create_access_token(user_id=uuid.uuid4(), org_id=uuid.uuid4())
    assert decode_access_token(token + "tamper") is None
    assert decode_access_token("not.a.jwt") is None
