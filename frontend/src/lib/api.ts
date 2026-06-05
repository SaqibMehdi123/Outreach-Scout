import type {
  ApiCompany,
  CampaignDetail,
  CompanyDetail,
  ComplianceData,
  IcpCriteria,
  MeResponse,
  StreamSnapshot,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const TOKEN_KEY = "ora_token_v1";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(t: string | null) {
    if (typeof window === "undefined") return;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = tokenStore.get();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try { detail = (await resp.json()).detail || detail; } catch {}
    throw new ApiError(detail, resp.status);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export interface TokenResponse { access_token: string; is_new?: boolean }

export const api = {
  base: BASE,

  // auth
  signup: (d: Record<string, unknown>) => request<TokenResponse>("POST", "/auth/signup", d),
  login: (email: string, password: string) =>
    request<TokenResponse>("POST", "/auth/login", { email, password }),
  google: (id_token: string, onboarding?: Record<string, unknown>) =>
    request<TokenResponse>("POST", "/auth/google", { id_token, ...(onboarding || {}) }),
  me: () => request<MeResponse>("GET", "/auth/me"),

  // icp + campaigns
  createIcp: (icp: { name: string; criteria: IcpCriteria; value_prop?: string | null }) =>
    request<{ id: string }>("POST", "/icp", icp),
  launchCampaign: (p: { target_count: number; icp_profile_id: string; name?: string }) =>
    request<{ id: string; status: string }>("POST", "/campaigns", p),
  getCampaign: (id: string) => request<CampaignDetail>("GET", `/campaigns/${id}`),

  // companies
  listCompanies: (campaignId: string, page = 1, pageSize = 200) =>
    request<{ items: ApiCompany[]; total: number }>(
      "GET", `/companies?campaign=${campaignId}&page=${page}&page_size=${pageSize}`),
  getCompany: (id: string) => request<CompanyDetail>("GET", `/companies/${id}`),

  // draft review gate
  approveDraft: (id: string) => request<unknown>("POST", `/drafts/${id}/approve`),
  unapproveDraft: (id: string) => request<unknown>("POST", `/drafts/${id}/unapprove`),
  discardDraft: (id: string) => request<unknown>("POST", `/drafts/${id}/discard`),
  editDraft: (id: string, message: string) => request<unknown>("PATCH", `/drafts/${id}`, { message }),
  regenerateDraft: (id: string) => request<{ message: string }>("POST", `/drafts/${id}/regenerate`),

  // export & CRM
  async exportCsv(campaignId: string): Promise<void> {
    const tok = tokenStore.get();
    const resp = await fetch(`${BASE}/campaigns/${campaignId}/export`, {
      method: "POST",
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    if (!resp.ok) {
      let detail = resp.statusText;
      try { detail = (await resp.json()).detail || detail; } catch {}
      throw new ApiError(detail, resp.status);
    }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `campaign-${campaignId}.csv`;
    a.click();
  },
  syncCampaign: (id: string) =>
    request<{ provider: string; synced: number; failed: number }>("POST", `/campaigns/${id}/sync`),

  // compliance
  getCompliance: () => request<ComplianceData>("GET", "/settings/compliance"),
  updateCompliance: (s: Record<string, unknown>) => request<unknown>("PUT", "/settings/compliance", s),
  addSuppression: (domain: string, reason?: string | null) =>
    request<{ id: string; domain: string }>("POST", "/settings/suppression", { domain, reason }),
  removeSuppression: (id: string) => request<unknown>("DELETE", `/settings/suppression/${id}`),

  // SSE live progress
  streamCampaign(campaignId: string, onProgress: (s: StreamSnapshot) => void): EventSource | null {
    const tok = tokenStore.get();
    if (typeof window === "undefined" || !tok) return null;
    const es = new EventSource(`${BASE}/campaigns/${campaignId}/stream?token=${encodeURIComponent(tok)}`);
    es.addEventListener("progress", (e) => {
      try { onProgress(JSON.parse((e as MessageEvent).data)); } catch {}
    });
    return es;
  },
};
