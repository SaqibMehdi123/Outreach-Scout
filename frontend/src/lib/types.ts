export interface MeResponse {
  user: { id: string; email: string; name: string | null; role: string | null; org_id: string };
  org: { id: string; name: string; value_prop: string | null; crm_provider: string | null };
}

export interface IcpCriteria {
  industries: string[];
  sizes: string[];
  geos: string[];
  roles: string[];
  signals: string[];
}

export interface CampaignStats {
  queued: number;
  researching: number;
  done: number;
  failed: number;
  avg_fit: number | null;
  tokens: number;
  cost_usd: number;
}

export interface CampaignDetail {
  id: string;
  name: string | null;
  target_count: number;
  status: string;
  stats: CampaignStats;
}

export interface ApiContact {
  id: string;
  name: string | null;
  title: string | null;
  profile_url: string | null;
  email: string | null;
  email_verified: boolean;
}

export interface ApiDraft {
  id: string;
  message: string;
  status: string;
}

export interface ApiCompany {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  size: string | null;
  location: string | null;
  fit_score: number | null;
  insights: { facts?: { text: string; source?: string; url?: string }[]; signals?: { type: string; detail?: string }[] };
  contact: ApiContact | null;
  draft: ApiDraft | null;
}

export interface TraceStep {
  type: string;
  tool?: string;
  ok?: boolean;
  source?: string;
  text?: string;
}

export interface CompanyDetail extends ApiCompany {
  created_at: string;
  trace: { steps: TraceStep[]; tokens: number; cost: number } | null;
}

export interface StreamSnapshot {
  stats: CampaignStats;
  done: boolean;
  leads: {
    job_id: string;
    status: string;
    progress: number;
    company: string | null;
    domain: string | null;
    fit: number | null;
    error: string | null;
  }[];
}

export interface ComplianceData {
  settings: { retention_days: number; gdpr_checks: boolean; canspam_footer: boolean };
  suppressions: { id: string; domain: string; reason: string | null; created_at: string }[];
}
