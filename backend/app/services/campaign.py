"""Campaign launch: resolve ICP → discover candidates → one job per candidate → enqueue."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AgentTrace,
    Campaign,
    CampaignStatus,
    Company,
    IcpProfile,
    Job,
    JobStatus,
)
from app.jobs.queue import enqueue_research_job
from app.schemas.campaign import CampaignCreate, CampaignStats
from app.schemas.icp import IcpCriteria
from app.services.compliance import suppressed_domains
from app.services.discovery import discover_candidates
from app.services.icp import create_icp


class CampaignError(Exception):
    """Raised when a campaign cannot be launched (mapped to 400 at the route)."""


async def launch_campaign(
    session: AsyncSession, org_id: uuid.UUID, data: CampaignCreate
) -> Campaign:
    icp = await _resolve_icp(session, org_id, data)

    campaign = Campaign(
        org_id=org_id,
        icp_profile_id=icp.id,
        name=data.name or icp.name,
        target_count=data.target_count,
        status=CampaignStatus.running,
    )
    session.add(campaign)
    await session.flush()

    criteria = IcpCriteria.model_validate(icp.criteria or {})
    existing_domains = set(await session.scalars(
        select(Company.domain).where(Company.org_id == org_id)
    ))
    # Compliance: never target opted-out / suppressed domains.
    existing_domains |= await suppressed_domains(session, org_id)
    seeds = await discover_candidates(
        criteria, data.target_count, existing_domains=existing_domains
    )

    jobs = [
        Job(campaign_id=campaign.id, company_seed=seed, status=JobStatus.queued)
        for seed in seeds
    ]
    session.add_all(jobs)
    await session.flush()

    # Persist before enqueuing so workers never race ahead of committed rows.
    await session.commit()

    for job in jobs:
        await enqueue_research_job(str(job.id))

    return campaign


async def _resolve_icp(
    session: AsyncSession, org_id: uuid.UUID, data: CampaignCreate
) -> IcpProfile:
    if data.icp_profile_id is not None:
        icp = await session.scalar(
            select(IcpProfile).where(
                IcpProfile.id == data.icp_profile_id, IcpProfile.org_id == org_id
            )
        )
        if icp is None:
            raise CampaignError("ICP profile not found")
        return icp
    if data.icp is not None:
        return await create_icp(session, org_id, data.icp)
    raise CampaignError("Provide either icp_profile_id or an inline icp")


async def list_campaigns(session: AsyncSession, org_id: uuid.UUID) -> list[Campaign]:
    rows = await session.scalars(
        select(Campaign)
        .where(Campaign.org_id == org_id)
        .order_by(Campaign.created_at.desc())
    )
    return list(rows)


async def get_campaign(
    session: AsyncSession, org_id: uuid.UUID, campaign_id: uuid.UUID
) -> Campaign | None:
    return await session.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id, Campaign.org_id == org_id
        )
    )


async def campaign_stats(session: AsyncSession, campaign_id: uuid.UUID) -> CampaignStats:
    rows = await session.execute(
        select(Job.status, func.count())
        .where(Job.campaign_id == campaign_id)
        .group_by(Job.status)
    )
    counts = {status: n for status, n in rows.all()}
    avg_fit = await session.scalar(
        select(func.avg(Company.fit_score)).where(
            Company.campaign_id == campaign_id, Company.fit_score.is_not(None)
        )
    )
    # Cost / token rollup across this campaign's agent traces.
    spend = (await session.execute(
        select(func.coalesce(func.sum(AgentTrace.tokens), 0),
               func.coalesce(func.sum(AgentTrace.cost), 0))
        .join(Job, AgentTrace.job_id == Job.id)
        .where(Job.campaign_id == campaign_id)
    )).one()
    return CampaignStats(
        queued=counts.get(JobStatus.queued, 0),
        researching=counts.get(JobStatus.researching, 0),
        done=counts.get(JobStatus.done, 0),
        failed=counts.get(JobStatus.failed, 0),
        avg_fit=round(float(avg_fit), 1) if avg_fit is not None else None,
        tokens=int(spend[0]),
        cost_usd=round(float(spend[1]), 4),
    )
