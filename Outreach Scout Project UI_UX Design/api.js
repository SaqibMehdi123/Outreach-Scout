/* Backend API client for OutreachScout.
   Talks to the FastAPI backend (default http://localhost:8000). Token is stored
   in localStorage and sent as a Bearer header; the SSE stream takes ?token=. */

(function () {
  const BASE = (window.OUTREACH_API_BASE) || "http://localhost:8000";
  const TOKEN_KEY = "ora_token_v1";

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
  const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} };

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const tok = getToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
    const resp = await fetch(`${BASE}${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      let detail = resp.statusText;
      try { detail = (await resp.json()).detail || detail; } catch (e) {}
      const err = new Error(detail); err.status = resp.status; throw err;
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  const Api = {
    BASE,
    getToken, setToken,
    isAuthed: () => !!getToken(),

    // ── auth ──
    async signup(data) {
      const r = await request("POST", "/auth/signup", data);
      setToken(r.access_token); return r;
    },
    async login(email, password) {
      const r = await request("POST", "/auth/login", { email, password });
      setToken(r.access_token); return r;
    },
    me: () => request("GET", "/auth/me"),
    logout: () => setToken(null),

    // ── icp + campaigns ──
    createIcp: (icp) => request("POST", "/icp", icp),
    listIcps: () => request("GET", "/icp"),
    launchCampaign: (payload) => request("POST", "/campaigns", payload),
    getCampaign: (id) => request("GET", `/campaigns/${id}`),
    listCampaigns: () => request("GET", "/campaigns"),

    // ── companies (leads) ──
    listCompanies: (campaignId, page = 1, pageSize = 200) =>
      request("GET", `/companies?campaign=${campaignId}&page=${page}&page_size=${pageSize}`),
    getCompany: (id) => request("GET", `/companies/${id}`),

    // ── export & CRM (approval gate) ──
    async exportCampaignCsv(campaignId) {
      const tok = getToken();
      const resp = await fetch(`${BASE}/campaigns/${campaignId}/export`, {
        method: "POST", headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try { detail = (await resp.json()).detail || detail; } catch (e) {}
        const err = new Error(detail); err.status = resp.status; throw err;
      }
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `campaign-${campaignId}.csv`; a.click();
    },
    syncCampaign: (campaignId) => request("POST", `/campaigns/${campaignId}/sync`),

    // ── draft review gate ──
    approveDraft: (id) => request("POST", `/drafts/${id}/approve`),
    unapproveDraft: (id) => request("POST", `/drafts/${id}/unapprove`),
    discardDraft: (id) => request("POST", `/drafts/${id}/discard`),
    editDraft: (id, message) => request("PATCH", `/drafts/${id}`, { message }),
    regenerateDraft: (id) => request("POST", `/drafts/${id}/regenerate`),

    // ── compliance settings ──
    getCompliance: () => request("GET", "/settings/compliance"),
    updateCompliance: (s) => request("PUT", "/settings/compliance", s),
    addSuppression: (domain, reason) => request("POST", "/settings/suppression", { domain, reason }),
    removeSuppression: (id) => request("DELETE", `/settings/suppression/${id}`),

    // ── live progress (SSE) ──
    streamCampaign(campaignId, onProgress, onError) {
      const tok = getToken();
      const es = new EventSource(`${BASE}/campaigns/${campaignId}/stream?token=${encodeURIComponent(tok)}`);
      es.addEventListener("progress", (e) => {
        try { onProgress(JSON.parse(e.data)); } catch (err) {}
      });
      es.onerror = (e) => { if (onError) onError(e); };
      return es; // caller closes via es.close()
    },
  };

  window.Api = Api;
})();
