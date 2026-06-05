"""ORM models — the backend schema from the TRD.

Tenancy chain:  Org → User
Pipeline chain: IcpProfile → Campaign → Job → Company → Contact → Draft
Observability:  Job → AgentTrace
"""

from __future__ import annotations

import enum
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────
class CampaignStatus(enum.StrEnum):
    draft = "draft"
    running = "running"
    done = "done"
    failed = "failed"


class JobStatus(enum.StrEnum):
    queued = "queued"
    researching = "researching"
    done = "done"
    failed = "failed"


class DraftStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    discarded = "discarded"
    exported = "exported"


# ─────────────────────────────────────────────────────────────────────────────
# Tenancy
# ─────────────────────────────────────────────────────────────────────────────
class Org(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orgs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Sender context woven into every drafted message.
    value_prop: Mapped[str | None] = mapped_column(Text)
    crm_provider: Mapped[str | None] = mapped_column(String(50))
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    users: Mapped[list[User]] = relationship(back_populates="org")
    icp_profiles: Mapped[list[IcpProfile]] = relationship(back_populates="org")
    campaigns: Mapped[list[Campaign]] = relationship(back_populates="org")


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(50))  # founder | sales_lead | sdr | revops
    hashed_password: Mapped[str | None] = mapped_column(String(255))

    org: Mapped[Org] = relationship(back_populates="users")


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────────────────────
class IcpProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "icp_profiles"

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Industry, size, role, geo, signals.
    criteria: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    value_prop: Mapped[str | None] = mapped_column(Text)

    org: Mapped[Org] = relationship(back_populates="icp_profiles")
    campaigns: Mapped[list[Campaign]] = relationship(back_populates="icp_profile")


class Campaign(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "campaigns"

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    icp_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("icp_profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(200))
    target_count: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status"),
        default=CampaignStatus.draft,
        nullable=False,
        index=True,
    )

    org: Mapped[Org] = relationship(back_populates="campaigns")
    icp_profile: Mapped[IcpProfile] = relationship(back_populates="campaigns")
    jobs: Mapped[list[Job]] = relationship(back_populates="campaign")


class Job(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One research job per candidate lead. Resumable via checkpointing."""

    __tablename__ = "jobs"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Initial company hint produced by discovery (name, domain hint, ...).
    company_seed: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"),
        default=JobStatus.queued,
        nullable=False,
        index=True,
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0..100
    error: Mapped[str | None] = mapped_column(Text)
    # LangGraph checkpoint blob so a crashed job resumes.
    checkpoint: Mapped[dict | None] = mapped_column(JSONB)

    campaign: Mapped[Campaign] = relationship(back_populates="jobs")
    company: Mapped[Company | None] = relationship(
        back_populates="job", uselist=False
    )
    trace: Mapped[AgentTrace | None] = relationship(
        back_populates="job", uselist=False
    )


class Company(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "companies"
    __table_args__ = (
        # Domain unique per org for cross-run dedupe.
        UniqueConstraint("org_id", "domain", name="uq_companies_org_domain"),
        Index("ix_companies_campaign", "campaign_id"),
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Denormalised for fast org-scoped dedupe + campaign listing.
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(200))
    size: Mapped[str | None] = mapped_column(String(50))
    location: Mapped[str | None] = mapped_column(String(200))
    # Researched facts + source urls + signals.
    insights: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    fit_score: Mapped[float | None] = mapped_column(Float)
    # Embedding of insights for semantic dedupe / similarity (pgvector).
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))

    job: Mapped[Job] = relationship(back_populates="company")
    contacts: Mapped[list[Contact]] = relationship(back_populates="company")


class Contact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "contacts"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(200))
    profile_url: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(320))
    email_verified: Mapped[bool] = mapped_column(default=False, server_default="false")

    company: Mapped[Company] = relationship(back_populates="contacts")
    drafts: Mapped[list[Draft]] = relationship(back_populates="contact")


class Draft(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "drafts"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DraftStatus] = mapped_column(
        Enum(DraftStatus, name="draft_status"),
        default=DraftStatus.pending,
        nullable=False,
        index=True,
    )

    contact: Mapped[Contact] = relationship(back_populates="drafts")


class AgentTrace(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Full per-job agent trace for observability + cost tracking."""

    __tablename__ = "agent_traces"
    __table_args__ = (
        CheckConstraint("tokens >= 0", name="ck_agent_traces_tokens_nonneg"),
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Ordered step / tool-call log.
    steps: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(10, 6), default=0, nullable=False)
    langfuse_trace_id: Mapped[str | None] = mapped_column(String(64))

    job: Mapped[Job] = relationship(back_populates="trace")


class Suppression(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Opt-out / do-not-contact domains. Compliance gate before any drafting."""

    __tablename__ = "suppressions"
    __table_args__ = (
        UniqueConstraint("org_id", "domain", name="uq_suppressions_org_domain"),
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(200))
