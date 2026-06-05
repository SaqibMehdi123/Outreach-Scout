"""ICP-fit scoring.

Deterministic 0–100 score across the dimensions the ICP cares about: industry,
size, geography, a verified contact, matched buying signals, and research depth.
Kept rule-based (not LLM) so scores are stable, explainable and free.
"""

from __future__ import annotations

from app.agent.schemas import ResearchResult
from app.schemas.icp import IcpCriteria

# Weight per dimension (sums to 100).
_W_INDUSTRY = 18
_W_SIZE = 10
_W_GEO = 10
_W_CONTACT = 22
_W_SIGNALS = 30
_W_DEPTH = 10


def _matches_any(needle: str | None, haystack: list[str]) -> bool:
    if not needle or not haystack:
        return False
    n = needle.lower()
    return any(h.lower() in n or n in h.lower() for h in haystack)


def compute_fit_score(result: ResearchResult, criteria: IcpCriteria) -> float:
    score = 0.0

    # Industry — full marks on match, half credit if criteria didn't constrain it.
    if _matches_any(result.industry, criteria.industries):
        score += _W_INDUSTRY
    elif not criteria.industries:
        score += _W_INDUSTRY * 0.5

    # Size / geo — partial credit when present (size buckets are coarse).
    if result.size:
        score += _W_SIZE * (1.0 if criteria.sizes else 0.6)
    if _matches_any(result.location, criteria.geos):
        score += _W_GEO
    elif not criteria.geos and result.location:
        score += _W_GEO * 0.5

    # Verified, titled contact is the strongest fit signal for outbound.
    if result.contact.name and result.contact.title:
        score += _W_CONTACT * (1.0 if result.contact.email_verified else 0.75)
    elif result.contact.name:
        score += _W_CONTACT * 0.5

    # Buying signals matched against the ICP's prioritised signals.
    wanted = set(criteria.signals)
    if wanted:
        found = {s.type for s in result.signals} & wanted
        score += _W_SIGNALS * (len(found) / len(wanted))
    elif result.signals:
        score += _W_SIGNALS * 0.5

    # Research depth — sourced insights.
    sourced = sum(1 for i in result.insights if i.source or i.url)
    score += _W_DEPTH * min(1.0, sourced / 3)

    return round(min(100.0, score), 1)
