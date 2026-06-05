"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, IconName } from "@/components/icons";
import { Btn } from "@/components/ui";
import { useDashboard } from "@/lib/dashboard";

const INDUSTRIES = ["B2B SaaS", "Fintech", "Healthtech", "Developer Tools", "Cybersecurity", "Ecommerce Infra", "AI / ML", "Logistics"];
const SIZES: [string, string][] = [["11–50", "s"], ["51–200", "m"], ["201–500", "l"], ["501–1k", "xl"], ["1k+", "xxl"]];
const GEOS = ["United States", "Canada", "United Kingdom", "Europe (EU)", "Remote-first"];
const ROLES = ["VP Sales", "Head of Revenue", "Director of Sales Dev", "CRO", "RevOps Lead", "Founder / CEO"];
const SIGNAL_DEFS: { key: string; icon: IconName; title: string; desc: string }[] = [
  { key: "funded", icon: "trend", title: "Recently funded", desc: "Raised a round in the last 6 months" },
  { key: "hiring", icon: "user", title: "Hiring SDRs / AEs", desc: "Open sales roles on careers page" },
  { key: "launch", icon: "rocket", title: "Launched a product", desc: "New product or major release shipped" },
  { key: "exec", icon: "sparkle", title: "New GTM exec", desc: "New VP Sales / CRO in last 90 days" },
  { key: "tech", icon: "bolt", title: "Tech-stack match", desc: "Uses Salesforce, HubSpot or Outreach" },
];

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`seg-opt ${on ? "on" : ""}`} onClick={onClick}>{on && <Icon name="checkSm" size={15} />}{children}</button>;
}
function SecNum({ n }: { n: string }) {
  return <span style={{ width: 24, height: 24, borderRadius: 8, background: "var(--accent-grad)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 680, flex: "none" }}>{n}</span>;
}
function Summary({ k, v }: { k: string; v: string | number }) {
  return <span><b style={{ color: "var(--ink)", fontWeight: 680, fontVariantNumeric: "tabular-nums" }}>{v}</b> <span style={{ color: "var(--muted)" }}>{k}</span></span>;
}

export default function SetupPage() {
  const router = useRouter();
  const { config, setConfig, launch } = useDashboard();
  const c = config;
  const set = (k: keyof typeof c, v: unknown) => setConfig({ ...c, [k]: v } as typeof c);
  const tog = (k: "industries" | "sizes" | "geos" | "roles" | "signals", v: string) => set(k, toggle(c[k], v));
  const [customRole, setCustomRole] = useState("");

  const ready = c.industries.length && c.sizes.length && c.roles.length && c.geos.length;
  const onLaunch = async () => { await launch(); router.push("/live"); };

  return (
    <div className="scroll">
      <div className="page">
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--violet-100)", color: "var(--violet-700)", padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <Icon name="target" size={14} /> New campaign
          </div>
          <h1 style={{ fontSize: 29, fontWeight: 680, letterSpacing: "-.025em", lineHeight: 1.05 }}>Define your ideal customer</h1>
          <p style={{ color: "var(--muted)", fontSize: 14.5, marginTop: 9, maxWidth: 560, lineHeight: 1.55 }}>
            Tell the agent who to look for and why they&apos;d care. It researches every account, finds the right contact, and drafts a personalized opener — while you watch.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <SecNum n="1" /><div className="section-title" style={{ fontSize: 15 }}>Who are you targeting?</div>
            </div>
            <p className="section-hint" style={{ marginBottom: 18, marginLeft: 34 }}>Firmographics the agent will match against.</p>
            <div style={{ marginLeft: 34, display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="field">
                <span className="label">Industry <span className="opt">· pick one or more</span></span>
                <div className="seg">{INDUSTRIES.map((i) => <Chip key={i} on={c.industries.includes(i)} onClick={() => tog("industries", i)}>{i}</Chip>)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="resp-2">
                <div className="field">
                  <span className="label">Company size <span className="opt">· employees</span></span>
                  <div className="seg">{SIZES.map(([lbl, k]) => <Chip key={k} on={c.sizes.includes(k)} onClick={() => tog("sizes", k)}>{lbl}</Chip>)}</div>
                </div>
                <div className="field">
                  <span className="label">Geography</span>
                  <div className="seg">{GEOS.map((g) => <Chip key={g} on={c.geos.includes(g)} onClick={() => tog("geos", g)}>{g}</Chip>)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <SecNum n="2" /><div className="section-title" style={{ fontSize: 15 }}>Who should it reach out to?</div>
            </div>
            <p className="section-hint" style={{ marginBottom: 18, marginLeft: 34 }}>The agent identifies the best-fit person per account.</p>
            <div style={{ marginLeft: 34 }} className="field">
              <span className="label">Target role / title</span>
              <div className="seg">
                {[...ROLES, ...c.roles.filter((r) => !ROLES.includes(r))].map((r) =>
                  <Chip key={r} on={c.roles.includes(r)} onClick={() => tog("roles", r)}>{r}</Chip>)}
                <form onSubmit={(e) => { e.preventDefault(); if (customRole.trim()) { set("roles", [...c.roles, customRole.trim()]); setCustomRole(""); } }} style={{ display: "inline-flex" }}>
                  <input className="input" value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="+ Add title" style={{ width: 130, padding: "9px 12px", fontSize: 13 }} />
                </form>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <SecNum n="3" /><div className="section-title" style={{ fontSize: 15 }}>Buying signals</div>
              <span className="tag" style={{ marginLeft: 6, background: "var(--violet-100)", color: "var(--violet-700)" }}>boosts fit score</span>
            </div>
            <p className="section-hint" style={{ marginBottom: 18, marginLeft: 34 }}>Prioritize accounts showing timing triggers. The agent verifies each before drafting.</p>
            <div style={{ marginLeft: 34, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
              {SIGNAL_DEFS.map((s) => {
                const on = c.signals.includes(s.key);
                return (
                  <button key={s.key} onClick={() => tog("signals", s.key)}
                    style={{ textAlign: "left", border: `1px solid ${on ? "var(--violet-400)" : "var(--line)"}`, background: on ? "var(--violet-50)" : "var(--surface)", borderRadius: 14, padding: "14px 15px", display: "flex", gap: 12, alignItems: "flex-start", transition: "all .14s", boxShadow: on ? "inset 0 0 0 1px var(--violet-300)" : "none", cursor: "pointer" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: on ? "var(--accent-grad)" : "var(--surface-2)", color: on ? "#fff" : "var(--muted)" }}><Icon name={s.icon} size={18} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                        {s.title} {on && <Icon name="checkSm" size={15} style={{ color: "var(--violet-600)" }} />}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, display: "block", marginTop: 3 }}>{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <SecNum n="4" /><div className="section-title" style={{ fontSize: 15 }}>Run settings & messaging</div>
            </div>
            <p className="section-hint" style={{ marginBottom: 18, marginLeft: 34 }}>How many leads to find, and the value prop that shapes every draft.</p>
            <div style={{ marginLeft: 34, display: "flex", flexDirection: "column", gap: 22 }}>
              <div className="field">
                <span className="label">Target lead count <span className="opt">· this run</span></span>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <input type="range" min={10} max={200} step={5} value={c.targetCount} onChange={(e) => set("targetCount", +e.target.value)} style={{ flex: 1, accentColor: "var(--violet-600)", maxWidth: 420 }} />
                  <div style={{ minWidth: 70, textAlign: "center", padding: "8px 12px", borderRadius: 10, background: "var(--violet-50)", border: "1px solid var(--violet-200)", fontWeight: 680, fontSize: 17, color: "var(--violet-700)", fontVariantNumeric: "tabular-nums" }}>{c.targetCount}</div>
                </div>
              </div>
              <div className="field">
                <span className="label"><Icon name="sparkle" size={14} style={{ color: "var(--violet-600)" }} /> Primary value proposition <span className="opt">· informs every draft</span></span>
                <textarea className="textarea" rows={3} value={c.valueProp} onChange={(e) => set("valueProp", e.target.value)}
                  placeholder="What do you help these companies achieve? The agent weaves this into each personalized opener." />
                <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{c.valueProp.length} characters · be specific about the outcome you deliver</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,.86)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)", padding: "14px 28px", display: "flex", alignItems: "center", gap: 18, zIndex: 10 }}>
        <div style={{ display: "flex", gap: 22, fontSize: 12.5, color: "var(--muted)", flexWrap: "wrap" }} className="hide-compact">
          <Summary k="Industries" v={c.industries.length || "—"} />
          <Summary k="Roles" v={c.roles.length || "—"} />
          <Summary k="Signals" v={c.signals.length || "—"} />
          <Summary k="Target" v={c.targetCount} />
        </div>
        <div style={{ flex: 1 }} />
        {!ready && <span style={{ fontSize: 12.5, color: "var(--amber-600)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="warn" size={14} /> Pick industry, size, role & geography</span>}
        <Btn kind="primary" size="lg" icon="rocket" disabled={!ready} onClick={onLaunch}>Launch research</Btn>
      </div>
    </div>
  );
}
