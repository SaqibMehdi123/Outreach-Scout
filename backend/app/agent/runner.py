"""Job runner: drive one lead's research end-to-end and persist the result.

Failure is isolated to the lead — exceptions never propagate out of
``run_research_job``, so one bad lead never kills the batch. Progress and the
checkpoint are written each step (resumable); the full trace, tokens and cost
land in ``agent_traces``.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select, update

from app.agent.loop import AgentRun, ResearchAgent
from app.agent.schemas import ResearchResult
from app.agent.tools.registry import ToolRegistry
from app.db.models import (
    AgentTrace,
    Campaign,
    CampaignStatus,
    Company,
    Contact,
    Draft,
    DraftStatus,
    IcpProfile,
    Job,
    JobStatus,
    Org,
)
from app.db.session import SessionLocal
from app.observability.logging import get_logger
from app.schemas.icp import IcpCriteria
from app.services.compliance import suppressed_domains
from app.services.draft import generate_draft
from app.services.llm import Usage, get_llm
from app.services.scoring import compute_fit_score

logger = get_logger(__name__)


async def run_research_job(job_id: str) -> dict[str, Any]:
    jid = uuid.UUID(job_id)
    async with SessionLocal() as session:
        job = await session.get(Job, jid)
        if job is None:
            return {"job_id": job_id, "status": "missing"}
        if job.status == JobStatus.done:
            return {"job_id": job_id, "status": "already_done"}

        campaign = await session.get(Campaign, job.campaign_id)
        icp = await session.get(IcpProfile, campaign.icp_profile_id)
        org = await session.get(Org, campaign.org_id)
        criteria = IcpCriteria.model_validate(icp.criteria or {})
        value_prop = icp.value_prop or (org.value_prop if org else None)

        job.status = JobStatus.researching
        await session.commit()

    agent = ResearchAgent(get_llm(), ToolRegistry())

    async def on_step(progress: int, step: int, checkpoint: dict) -> None:
        async with SessionLocal() as s:
            await s.execute(
                update(Job).where(Job.id == jid).values(progress=progress, checkpoint=checkpoint)
            )
            await s.commit()

    run = await agent.run(
        seed=job.company_seed, criteria=criteria, value_prop=value_prop,
        resume=job.checkpoint, on_step=on_step,
    )

    async with SessionLocal() as session:
        suppressed = await suppressed_domains(session, campaign.org_id)
        await _persist(session, jid, campaign, run, criteria, value_prop, suppressed)
        # Flush so this job's new status is visible to the completion count
        # (the session uses autoflush=False).
        await session.flush()
        await _maybe_complete_campaign(session, campaign.id)
        await session.commit()

    logger.info("research_lead.finished", job_id=job_id, status=run.status,
                tokens=run.usage.total_tokens, cost=round(run.usage.cost_usd, 4))
    return {"job_id": job_id, "status": run.status,
            "tokens": run.usage.total_tokens, "cost": run.usage.cost_usd}


async def _persist(
    session, jid: uuid.UUID, campaign: Campaign, run: AgentRun,
    criteria: IcpCriteria, value_prop: str | None, suppressed: set[str],
) -> None:
    job = await session.get(Job, jid)
    job.checkpoint = run.checkpoint
    tokens = run.usage.total_tokens
    cost = run.usage.cost_usd

    if run.status == "done" and run.result is not None:
        # Score for ICP fit unless the agent already supplied one.
        if run.result.fit_score is None:
            run.result.fit_score = compute_fit_score(run.result, criteria)
        # Compliance gate: never draft a suppressed / opted-out domain.
        is_suppressed = (run.result.domain or "").strip().lower() in suppressed
        if is_suppressed:
            message, draft_usage = None, Usage()
        else:
            message, draft_usage = await _maybe_draft(run.result, value_prop)
        tokens += draft_usage.total_tokens
        cost += draft_usage.cost_usd
        await _write_company(session, jid, campaign, run.result, message)
        job.status = JobStatus.done
        job.progress = 100
        if is_suppressed:
            job.error = "suppressed: on opt-out list, no draft generated"
    else:
        job.status = JobStatus.failed
        job.progress = 100
        job.error = run.error or "research failed"

    session.add(AgentTrace(job_id=jid, steps=run.trace, tokens=tokens, cost=cost))


async def _maybe_draft(r: ResearchResult, value_prop: str | None):
    if not (r.contact.name or r.contact.email):
        return None, Usage()
    return await generate_draft(r, value_prop)


async def _write_company(
    session, jid: uuid.UUID, campaign: Campaign, r: ResearchResult,
    draft_message: str | None = None,
) -> None:
    domain = (r.domain or "").strip().lower() or f"unknown-{jid}"

    # Dedupe by (org, domain): reuse the existing company row if present.
    existing = await session.scalar(
        select(Company).where(Company.org_id == campaign.org_id, Company.domain == domain)
    )
    insights = {
        "facts": [i.model_dump() for i in r.insights],
        "signals": [s.model_dump() for s in r.signals],
    }
    if existing is not None:
        existing.insights = insights
        if r.fit_score is not None:
            existing.fit_score = r.fit_score
        company = existing
    else:
        company = Company(
            job_id=jid, org_id=campaign.org_id, campaign_id=campaign.id,
            name=r.name, domain=domain, industry=r.industry, size=r.size,
            location=r.location, insights=insights, fit_score=r.fit_score,
        )
        session.add(company)
        await session.flush()

    c = r.contact
    if c.name or c.email:
        contact = Contact(
            company_id=company.id, name=c.name, title=c.title,
            profile_url=c.profile_url, email=c.email, email_verified=c.email_verified,
        )
        session.add(contact)
        await session.flush()
        if draft_message:
            # Pending — the human approval gate sits before any export.
            session.add(Draft(contact_id=contact.id, message=draft_message,
                              status=DraftStatus.pending))


async def _maybe_complete_campaign(session, campaign_id: uuid.UUID) -> None:
    # Lock the campaign row so concurrent workers finishing the last jobs
    # serialize here — the final worker then sees all sibling jobs committed and
    # reliably flips the campaign to done (fixes the completion race).
    campaign = await session.scalar(
        select(Campaign).where(Campaign.id == campaign_id).with_for_update()
    )
    if campaign is None or campaign.status in (CampaignStatus.done, CampaignStatus.failed):
        return
    rows = await session.execute(
        select(Job.status, func.count()).where(Job.campaign_id == campaign_id).group_by(Job.status)
    )
    counts = {status: n for status, n in rows.all()}
    pending = counts.get(JobStatus.queued, 0) + counts.get(JobStatus.researching, 0)
    if pending > 0:
        return
    done = counts.get(JobStatus.done, 0)
    campaign.status = CampaignStatus.done if done > 0 else CampaignStatus.failed
