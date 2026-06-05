"""Personalised first-message generation.

Uses the PREMIUM model (the one place the cost-control NFR allows it) to turn the
researched insights + value prop into a specific, non-generic opener. Output is
forced through a structured tool and validated; on any failure the caller gets a
safe fallback rather than an exception.
"""

from __future__ import annotations

from app.agent.schemas import ResearchResult
from app.observability.logging import get_logger
from app.services.llm import LLMClient, Tier, Usage, get_llm

logger = get_logger(__name__)

MIN_CHARS = 120
MAX_CHARS = 900

_EMIT_DRAFT = {
    "name": "emit_draft",
    "description": "Emit the final personalised first-touch message.",
    "input_schema": {
        "type": "object",
        "properties": {
            "message": {"type": "string", "description": "The personalised opener"},
        },
        "required": ["message"],
    },
}

_SYSTEM = """You write concise, specific B2B first-touch messages. Rules:
- Reference a concrete, researched fact about THIS company (funding, hiring, \
launch, exec change) — never generic flattery.
- Tie that fact to the sender's value proposition and the outcome it delivers.
- 2–5 sentences, plain and human. No subject line, no greeting boilerplate beyond \
the contact's first name, no fake urgency, no placeholders like [Company].
- End with one low-friction ask."""


def _build_prompt(r: ResearchResult, value_prop: str | None, variant: bool) -> str:
    facts = "\n".join(f"- {i.text}" + (f" ({i.source})" if i.source else "")
                      for i in r.insights) or "- (no specific insights found)"
    first = (r.contact.name or "there").split(" ")[0]
    lines = [
        f"Company: {r.name} ({r.domain})",
        f"Industry: {r.industry or 'unknown'} · Size: {r.size or 'unknown'} · "
        f"Location: {r.location or 'unknown'}",
        f"Contact: {r.contact.name or 'unknown'} — {r.contact.title or 'unknown'}",
        f"Address them by first name: {first}",
        "",
        "Researched insights:",
        facts,
        "",
        f"Our value proposition: {value_prop or 'We help teams scale outbound.'}",
        "",
        "Write the message and call emit_draft.",
    ]
    if variant:
        lines.append("Produce a distinctly different angle from a typical opener.")
    return "\n".join(lines)


def _validate(message: str) -> str:
    msg = message.strip()
    if not msg:
        raise ValueError("empty draft")
    if "[" in msg and "]" in msg:
        raise ValueError("draft contains an unfilled placeholder")
    if len(msg) < MIN_CHARS:
        raise ValueError("draft too short")
    return msg[:MAX_CHARS]


async def generate_draft(
    result: ResearchResult,
    value_prop: str | None,
    *,
    llm: LLMClient | None = None,
    variant: bool = False,
) -> tuple[str | None, Usage]:
    """Return (message, usage). ``message`` is None if generation fails."""
    client = llm or get_llm()
    try:
        resp = await client.complete(
            messages=[{"role": "user", "content": _build_prompt(result, value_prop, variant)}],
            tier=Tier.PREMIUM,
            system=_SYSTEM,
            tools=[_EMIT_DRAFT],
            force_tool="emit_draft",
            max_tokens=600,
            temperature=0.7 if variant else 0.5,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("draft_generation_failed", company=result.name, error=str(exc))
        return None, Usage()

    emit = next((t for t in resp.tool_calls if t.name == "emit_draft"), None)
    if emit is None:
        return None, resp.usage
    try:
        return _validate(str(emit.arguments.get("message", ""))), resp.usage
    except ValueError as exc:
        logger.warning("draft_invalid", company=result.name, error=str(exc))
        return None, resp.usage
