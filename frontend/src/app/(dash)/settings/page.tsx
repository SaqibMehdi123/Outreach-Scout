"use client";

import { useEffect, useState } from "react";
import { Icon, IconName } from "@/components/icons";
import { Btn, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";

const SOURCES = [
  { name: "DuckDuckGo search", status: "connected", detail: "Keyless web search · free", icon: "globe" },
  { name: "Page fetch", status: "connected", detail: "Reads + extracts page text", icon: "doc" },
  { name: "Crunchbase", status: "disconnected", detail: "Funding & firmographics (optional)", icon: "database" },
  { name: "Apollo", status: "disconnected", detail: "Contact / people search (optional)", icon: "user" },
  { name: "Hunter.io", status: "disconnected", detail: "Email verification (optional)", icon: "mail" },
];

function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    connected: ["var(--green-600)", "Connected"],
    degraded: ["var(--amber-600)", "Degraded"],
    disconnected: ["var(--faint)", "Not connected"],
  };
  const [color, label] = map[status] || map.disconnected;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 560, color }}><span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />{label}</span>;
}

export default function SettingsPage() {
  const toast = useToast();
  const [retention, setRetention] = useState("90");
  const [gdpr, setGdpr] = useState(true);
  const [canspam, setCanspam] = useState(true);
  const [list, setList] = useState<{ id: string; domain: string }[]>([]);
  const [newOptout, setNewOptout] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await api.getCompliance();
        setRetention(String(c.settings.retention_days));
        setGdpr(c.settings.gdpr_checks);
        setCanspam(c.settings.canspam_footer);
        setList(c.suppressions.map((s) => ({ id: s.id, domain: s.domain })));
      } catch {}
    })();
  }, []);

  const saveCompliance = async (patch: Record<string, unknown>) => {
    try { await api.updateCompliance({ retention_days: +retention, gdpr_checks: gdpr, canspam_footer: canspam, ...patch }); }
    catch (e) { toast((e as ApiError).message || "Failed to save", "warn"); }
  };
  const addOptout = async (domain: string) => {
    try {
      const s = await api.addSuppression(domain);
      setList((l) => (l.some((x) => x.id === s.id) ? l : [...l, { id: s.id, domain: s.domain }]));
      toast("Added to suppression list", "shield");
    } catch (e) { toast((e as ApiError).message || "Failed to add", "warn"); }
  };
  const removeOptout = async (id: string) => {
    try { await api.removeSuppression(id); setList((l) => l.filter((x) => x.id !== id)); }
    catch (e) { toast((e as ApiError).message || "Failed to remove", "warn"); }
  };

  return (
    <div className="scroll"><div className="page">
      <h1 style={{ fontSize: 24, fontWeight: 680, letterSpacing: "-.02em" }}>Settings</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6, marginBottom: 28 }}>Data sources, and the compliance controls that govern every run.</p>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span className="ic-sec"><Icon name="database" size={17} /></span>
          <div><div className="section-title" style={{ fontSize: 15 }}>Data sources</div>
            <p className="section-hint">The agent researches with these. Free sources are on by default; paid ones are optional.</p></div>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {SOURCES.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--violet-50)", color: "var(--violet-600)", display: "grid", placeItems: "center", flex: "none" }}><Icon name={s.icon as IconName} size={19} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.detail}</div>
              </div>
              <StatusDot status={s.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="ic-sec" style={{ background: "var(--green-50)", color: "var(--green-600)" }}><Icon name="shield" size={17} /></span>
          <div><div className="section-title" style={{ fontSize: 15 }}>Compliance & data controls</div>
            <p className="section-hint">Guardrails applied to every account before the agent drafts or syncs.</p></div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="flag" size={15} style={{ color: "var(--muted)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 560 }}>Opt-out / suppression list</span>
            <span className="tag">{list.length} domains</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {list.map((d) => (
              <span key={d.id} className="chip tech" style={{ paddingRight: 6 }}>
                {d.domain}
                <button onClick={() => removeOptout(d.id)} style={{ border: "none", background: "none", color: "var(--faint)", display: "grid", placeItems: "center", padding: 0, marginLeft: 2 }}><Icon name="x" size={13} /></button>
              </span>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (newOptout.trim()) { void addOptout(newOptout.trim()); setNewOptout(""); } }} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <input className="input" placeholder="add domain to never contact…" value={newOptout} onChange={(e) => setNewOptout(e.target.value)} />
            <Btn kind="ghost" icon="plus" type="submit">Add</Btn>
          </form>
        </div>

        <hr className="divider" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="clock" size={16} style={{ color: "var(--muted)", marginTop: 2 }} />
            <div><div style={{ fontSize: 13.5, fontWeight: 560 }}>Data-retention window</div>
              <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 380 }}>Researched data is auto-purged after this period unless a lead is synced to your CRM.</div></div>
          </div>
          <select className="select" value={retention} onChange={(e) => { setRetention(e.target.value); void saveCompliance({ retention_days: +e.target.value }); toast("Retention updated", "shield"); }} style={{ width: 180 }}>
            <option value="30">30 days</option><option value="90">90 days</option>
            <option value="180">180 days</option><option value="365">1 year</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line-2)" }}>
          <div><div style={{ fontSize: 13.5, fontWeight: 560 }}>GDPR / lawful-basis checks</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Flag EU contacts lacking a lawful basis for outreach.</div></div>
          <Toggle on={gdpr} onChange={(v) => { setGdpr(v); void saveCompliance({ gdpr_checks: v }); }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line-2)" }}>
          <div><div style={{ fontSize: 13.5, fontWeight: 560 }}>CAN-SPAM footer enforcement</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Require physical address + unsubscribe in every sequence.</div></div>
          <Toggle on={canspam} onChange={(v) => { setCanspam(v); void saveCompliance({ canspam_footer: v }); }} />
        </div>
      </div>
    </div></div>
  );
}
