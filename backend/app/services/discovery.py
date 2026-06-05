"""Discovery service — turn an ICP into candidate company seeds.

Uses one cheap LLM call to propose companies matching the ICP, excluding domains
already researched for this org (cross-run dedupe). Falls back to deterministic
placeholder seeds when no LLM key is configured or the call fails, so a campaign
launch never hard-fails on discovery.

The per-lead agent (Module 4) verifies and enriches each seed, so discovery only
needs a name + best-guess domain.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.config import settings
from app.observability.logging import get_logger
from app.schemas.icp import IcpCriteria
from app.services.llm import LLMClient, Tier, get_llm

logger = get_logger(__name__)

_EMIT_CANDIDATES = {
    "name": "emit_candidates",
    "description": "Emit the list of candidate companies that match the ICP.",
    "input_schema": {
        "type": "object",
        "properties": {
            "candidates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "domain": {"type": "string"},
                    },
                    "required": ["name"],
                },
            }
        },
        "required": ["candidates"],
    },
}


def _placeholder_seeds(criteria: IcpCriteria, n: int) -> list[dict[str, Any]]:
    industry = criteria.industries[0] if criteria.industries else "B2B SaaS"
    role = criteria.roles[0] if criteria.roles else "VP Sales"
    return [
        {
            "hint": f"Candidate {i + 1}",
            "industry": industry,
            "target_role": role,
            "signals": criteria.signals,
            "geos": criteria.geos,
            "sizes": criteria.sizes,
            "placeholder": True,
        }
        for i in range(n)
    ]


def _build_prompt(criteria: IcpCriteria, n: int, existing: set[str]) -> str:
    lines = [
        f"Propose up to {n} real companies that fit this ideal-customer profile. "
        "For each, give the company name and its primary website domain.",
        "",
        f"- Industries: {criteria.industries or 'any B2B'}",
        f"- Company sizes: {criteria.sizes or 'any'}",
        f"- Geographies: {criteria.geos or 'any'}",
        f"- Buying signals to favour: {criteria.signals or 'any'}",
    ]
    if existing:
        sample = list(existing)[:50]
        lines += ["", f"Do NOT include these already-researched domains: {sample}"]
    lines += ["", "Call emit_candidates with the list."]
    return "\n".join(lines)


def _to_seed(c: dict[str, Any], criteria: IcpCriteria) -> dict[str, Any]:
    return {
        "name": c.get("name"),
        "domain": (c.get("domain") or "").strip().lower() or None,
        "industry": criteria.industries[0] if criteria.industries else None,
        "target_role": criteria.roles[0] if criteria.roles else None,
        "signals": criteria.signals,
    }


async def discover_candidates(
    criteria: IcpCriteria,
    target_count: int,
    *,
    existing_domains: Iterable[str] | None = None,
    llm: LLMClient | None = None,
) -> list[dict[str, Any]]:
    existing = {d.lower() for d in (existing_domains or [])}

    if not settings.llm_configured:
        return _placeholder_seeds(criteria, target_count)

    client = llm or get_llm()
    try:
        resp = await client.complete(
            messages=[{"role": "user",
                       "content": _build_prompt(criteria, target_count, existing)}],
            tier=Tier.CHEAP,
            tools=[_EMIT_CANDIDATES],
            force_tool="emit_candidates",
            max_tokens=2048,
            temperature=0.5,
        )
    except Exception as exc:  # noqa: BLE001 — never fail launch on discovery
        logger.warning("discovery_failed", error=str(exc))
        return _placeholder_seeds(criteria, target_count)

    emit = next((t for t in resp.tool_calls if t.name == "emit_candidates"), None)
    candidates = (emit.arguments.get("candidates") if emit else []) or []

    seeds: list[dict[str, Any]] = []
    seen: set[str] = set()
    for c in candidates:
        dom = (c.get("domain") or "").strip().lower()
        if dom and (dom in existing or dom in seen):
            continue
        if dom:
            seen.add(dom)
        seeds.append(_to_seed(c, criteria))
        if len(seeds) >= target_count:
            break

    return seeds or _placeholder_seeds(criteria, target_count)
