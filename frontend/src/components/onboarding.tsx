"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Btn } from "./ui";
import { TextField } from "./text-field";

export interface OnboardingData {
  name: string;
  role: string;
  company: string;
  website: string;
  size: string;
  sells: string;
  crm: string;
}

const OB_ROLES = [
  { key: "founder", icon: "rocket", t: "Founder / CEO", d: "I'm running sales myself for now" },
  { key: "sales_lead", icon: "trend", t: "Sales / Revenue leader", d: "VP Sales, Head of Revenue, CRO" },
  { key: "sdr", icon: "radar", t: "SDR / AE", d: "I do outbound day to day" },
  { key: "revops", icon: "settings", t: "RevOps / Growth", d: "I build the GTM systems" },
];
const OB_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];
const OB_CRMS = [
  { key: "hubspot", t: "HubSpot", letter: "H", color: "#FF7A59" },
  { key: "salesforce", t: "Salesforce", letter: "S", color: "#00A1E0" },
  { key: "pipedrive", t: "Pipedrive", letter: "P", color: "#1A1A1A" },
  { key: "none", t: "No CRM yet", letter: "—", color: "#8A958F" },
];
const STEPS = 4;

export function Onboarding({ name, onFinish }: { name: string; onFinish: (d: OnboardingData) => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<OnboardingData>({ name, role: "", company: "", website: "", size: "", sells: "", crm: "" });
  const set = (k: keyof OnboardingData, v: string) => setD({ ...d, [k]: v });

  const canNext = [d.name.trim() && d.role, d.company.trim() && d.size, d.sells.trim().length > 8, true][step];
  const next = () => (step < STEPS - 1 ? setStep(step + 1) : onFinish(d));

  return (
    <div className="ob-host">
      <div className="ob-top">
        <span className="bm"><Icon name="radar" size={18} style={{ color: "#fff" }} /></span>
        <b style={{ fontWeight: 680, fontSize: 15 }}>OutreachScout</b>
        <div className="ob-steps">{Array.from({ length: STEPS }).map((_, i) => <span key={i} className={`ob-dot ${i <= step ? "on" : ""}`} />)}</div>
      </div>

      <div className="ob-card" key={step}>
        {step === 0 && (
          <>
            <div className="ob-eyebrow">STEP 1 OF 4 · ABOUT YOU</div>
            <h2 className="ob-h">Welcome{name ? `, ${name.split(" ")[0]}` : ""} 👋</h2>
            <p className="ob-sub">We&apos;ll tailor the agent to how you sell. First, what&apos;s your role?</p>
            <div style={{ marginTop: 20 }}>
              <TextField label="Your name" value={d.name} onChange={(v) => set("name", v)} placeholder="Alex Greer" autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }} className="resp-2">
              {OB_ROLES.map((r) => (
                <button key={r.key} className={`opt-card ${d.role === r.key ? "on" : ""}`} onClick={() => set("role", r.key)}>
                  <span className="oi"><Icon name={r.icon} size={19} /></span>
                  <span><span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{r.t}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.d}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-eyebrow">STEP 2 OF 4 · YOUR COMPANY</div>
            <h2 className="ob-h">Tell us about your company</h2>
            <p className="ob-sub">This sets the sender context for every drafted message.</p>
            <div style={{ marginTop: 20 }}>
              <TextField label="Company name" value={d.company} onChange={(v) => set("company", v)} placeholder="Acme GTM" autoFocus />
              <div className="field" style={{ marginBottom: 14 }}>
                <span className="label">Website <span className="opt">· helps the agent learn your offering</span></span>
                <div className="input-affix"><span className="pre">https://</span>
                  <input className="input" value={d.website} onChange={(e) => set("website", e.target.value)} placeholder="acme.com" /></div>
              </div>
              <div className="field">
                <span className="label">How big is your sales team?</span>
                <div className="seg">{OB_SIZES.map((s) => (
                  <button key={s} className={`seg-opt ${d.size === s ? "on" : ""}`} onClick={() => set("size", s)}>{d.size === s && <Icon name="checkSm" size={14} />}{s}</button>
                ))}</div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-eyebrow">STEP 3 OF 4 · WHAT YOU SELL</div>
            <h2 className="ob-h">What do you help customers achieve?</h2>
            <p className="ob-sub">This becomes your primary value proposition — the agent weaves it into every personalized opener. Be specific about the outcome.</p>
            <div className="field" style={{ marginTop: 20 }}>
              <span className="label"><Icon name="sparkle" size={14} style={{ color: "var(--accent)" }} /> Your value proposition</span>
              <textarea className="textarea" rows={4} value={d.sells} autoFocus onChange={(e) => set("sells", e.target.value)}
                placeholder="e.g. We build the research + personalization layer so SDRs start every account in a real conversation, not a spreadsheet." />
              <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{d.sells.trim().length} characters{d.sells.trim().length <= 8 && " · add a little more detail"}</span>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-eyebrow">STEP 4 OF 4 · CONNECT</div>
            <h2 className="ob-h">Where should approved leads go?</h2>
            <p className="ob-sub">Pick your CRM and we&apos;ll sync researched accounts and drafts two-way. You can change this later in Settings.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }} className="resp-2">
              {OB_CRMS.map((c) => (
                <button key={c.key} className={`opt-card ${d.crm === c.key ? "on" : ""}`} onClick={() => set("crm", c.key)}>
                  <span className="oi" style={d.crm === c.key ? {} : { background: "#fff", border: "1px solid var(--line)", color: c.color, fontWeight: 800, fontSize: 16 }}>
                    {d.crm === c.key ? <Icon name="checkSm" size={18} /> : c.letter}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.t}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, padding: "12px 14px", background: "var(--violet-50)", border: "1px solid var(--violet-200)", borderRadius: 12 }}>
              <Icon name="shield" size={16} style={{ color: "var(--accent)", marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                Your data stays yours. We&apos;re SOC 2 Type II, GDPR-ready, and auto-purge researched data on a retention window you control.</span>
            </div>
          </>
        )}

        <div className="ob-foot">
          {step > 0 && <Btn kind="ghost" icon="arrowLeft" onClick={() => setStep(step - 1)}>Back</Btn>}
          <div style={{ flex: 1 }} />
          {step === 3 && <Btn kind="subtle" onClick={() => onFinish(d)}>Skip for now</Btn>}
          <Btn kind="primary" iconRight={step < STEPS - 1 ? "chevRight" : "check"} disabled={!canNext} onClick={next}>
            {step < STEPS - 1 ? "Continue" : "Launch OutreachScout"}
          </Btn>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 18 }}>Step {step + 1} of {STEPS} · takes under a minute</p>
    </div>
  );
}
