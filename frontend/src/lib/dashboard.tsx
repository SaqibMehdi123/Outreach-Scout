"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { api, ApiError } from "./api";
import { companyToLead, Lead, snapshotLead, traceToSteps } from "./mappers";
import { useAuth } from "./auth";

export interface IcpConfig {
  industries: string[];
  sizes: string[];
  geos: string[];
  roles: string[];
  signals: string[];
  targetCount: number;
  valueProp: string;
}

export interface Stats {
  queued: number;
  researching: number;
  done: number;
  failed: number;
  avgFit: number;
  eta: number;
  tokens: number;
  cost: number;
}

const DEFAULT_CONFIG: IcpConfig = {
  industries: ["B2B SaaS"],
  sizes: ["m"],
  geos: ["United States", "Canada"],
  roles: ["VP Sales", "Head of Revenue", "Director of Sales Dev"],
  signals: ["funded", "hiring", "launch"],
  targetCount: 50,
  valueProp: "We build the research + personalization layer so SDRs start every account in a real conversation, not a spreadsheet.",
};

const emptyStats = (): Stats => ({ queued: 0, researching: 0, done: 0, failed: 0, avgFit: 0, eta: 0, tokens: 0, cost: 0 });
const CAMPAIGN_KEY = "ora_campaign_v1";

interface DashboardState {
  config: IcpConfig;
  setConfig: (c: IcpConfig) => void;
  leads: Lead[];
  stats: Stats;
  running: boolean;
  launched: boolean;
  campaignId: string | null;
  launch: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  approve: (id: string, val?: boolean) => Promise<void>;
  discard: (id: string) => Promise<void>;
  saveDraft: (id: string, draft: string) => Promise<void>;
  regenerate: (id: string) => Promise<void>;
  openLead: (id: string) => Promise<void>;
  exportCsv: () => Promise<void>;
  sync: () => Promise<void>;
}

const DashboardCtx = createContext<DashboardState | null>(null);
export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { me } = useAuth();
  const [config, setConfig] = useState<IcpConfig>(DEFAULT_CONFIG);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [running, setRunning] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // seed value prop from the org
  useEffect(() => {
    if (me?.org.value_prop) setConfig((c) => ({ ...c, valueProp: me.org.value_prop as string }));
  }, [me]);

  const applyStats = useCallback((s: Partial<Stats> & { avg_fit?: number | null; cost_usd?: number }) => {
    const pending = (s.queued || 0) + (s.researching || 0);
    setStats((prev) => ({
      queued: s.queued ?? prev.queued,
      researching: s.researching ?? prev.researching,
      done: s.done ?? prev.done,
      failed: s.failed ?? prev.failed,
      avgFit: s.avg_fit != null ? Math.round(s.avg_fit) : prev.avgFit,
      eta: Math.max(0, Math.ceil(pending * 1.6)),
      tokens: s.tokens ?? prev.tokens,
      cost: s.cost_usd ?? prev.cost,
    }));
  }, []);

  const stopStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
  }, []);

  const loadCampaign = useCallback(async (id: string) => {
    try {
      const page = await api.listCompanies(id);
      setLeads((page.items || []).map((c) => companyToLead(c)));
      setLaunched(true);
      const camp = await api.getCampaign(id);
      applyStats(camp.stats);
      if (camp.status === "running") startStream(id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStats]);

  const startStream = useCallback((id: string) => {
    stopStream();
    setRunning(true);
    esRef.current = api.streamCampaign(id, async (snap) => {
      applyStats(snap.stats);
      setLeads((prev) => {
        const byId = Object.fromEntries(prev.map((l) => [l.id, l]));
        return (snap.leads || []).map((l) => {
          const existing = byId[l.job_id];
          if (existing && existing.status === "done" && existing.draftId) return existing;
          return snapshotLead(l);
        });
      });
      if (snap.done) {
        setRunning(false);
        stopStream();
        await loadCampaign(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStats, loadCampaign, stopStream]);

  // restore last campaign
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem(CAMPAIGN_KEY); } catch { return null; } })();
    if (saved && me) {
      setCampaignId(saved);
      void loadCampaign(saved);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const launch = useCallback(async () => {
    try {
      const icp = await api.createIcp({
        name: `${config.industries[0] || "ICP"} — ${new Date().toLocaleDateString()}`,
        criteria: { industries: config.industries, sizes: config.sizes, geos: config.geos, roles: config.roles, signals: config.signals },
        value_prop: config.valueProp,
      });
      const camp = await api.launchCampaign({ target_count: config.targetCount, icp_profile_id: icp.id });
      setCampaignId(camp.id);
      try { localStorage.setItem(CAMPAIGN_KEY, camp.id); } catch {}
      setLeads([]);
      setLaunched(true);
      setStats(emptyStats());
      startStream(camp.id);
      toast("Campaign launched", "rocket");
    } catch (e) {
      toast((e as ApiError).message || "Launch failed", "warn");
    }
  }, [config, startStream, toast]);

  const patchLead = (id: string, patch: Partial<Lead>) =>
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const approve = useCallback(async (id: string, val = true) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead?.draftId) { patchLead(id, { approved: val }); return; }
    try {
      await (val ? api.approveDraft(lead.draftId) : api.unapproveDraft(lead.draftId));
      patchLead(id, { approved: val, discarded: false, draftStatus: val ? "approved" : "pending" });
    } catch (e) { toast((e as ApiError).message, "warn"); }
  }, [leads, toast]);

  const discard = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id);
    try { if (lead?.draftId) await api.discardDraft(lead.draftId); } catch {}
    patchLead(id, { discarded: true, approved: false, draftStatus: "discarded" });
    toast("Lead discarded", "trash");
  }, [leads, toast]);

  const saveDraft = useCallback(async (id: string, draft: string) => {
    const lead = leads.find((l) => l.id === id);
    patchLead(id, { draft });
    try { if (lead?.draftId) await api.editDraft(lead.draftId, draft); }
    catch (e) { toast((e as ApiError).message, "warn"); }
  }, [leads, toast]);

  const regenerate = useCallback(async (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead?.draftId) return;
    try {
      const r = await api.regenerateDraft(lead.draftId);
      patchLead(id, { draft: r.message });
      toast("Regenerated draft", "sparkle");
    } catch (e) { toast((e as ApiError).message, "warn"); }
  }, [leads, toast]);

  const openLead = useCallback(async (id: string) => {
    try {
      const d = await api.getCompany(id);
      patchLead(id, {
        stepData: traceToSteps(d.trace),
        insights: (d.insights?.facts || []).map((f) => ({ t: f.text, src: f.source || "", url: f.url || "#" })),
      });
    } catch {}
  }, []);

  const exportCsv = useCallback(async () => {
    if (!campaignId) return;
    try {
      await api.exportCsv(campaignId);
      toast("Exported approved leads to CSV", "download");
      await loadCampaign(campaignId);
    } catch (e) { toast((e as ApiError).message || "Nothing approved to export", "warn"); }
  }, [campaignId, loadCampaign, toast]);

  const sync = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await api.syncCampaign(campaignId);
      toast(`Synced ${res.synced} leads to your CRM`, "sync");
      await loadCampaign(campaignId);
    } catch (e) { toast((e as ApiError).message || "Sync failed", "warn"); }
  }, [campaignId, loadCampaign, toast]);

  return (
    <DashboardCtx.Provider
      value={{
        config, setConfig, leads, stats, running, launched, campaignId,
        launch,
        pause: () => { stopStream(); setRunning(false); },
        resume: () => campaignId && startStream(campaignId),
        approve, discard, saveDraft, regenerate, openLead, exportCsv, sync,
      }}
    >
      {children}
    </DashboardCtx.Provider>
  );
}
