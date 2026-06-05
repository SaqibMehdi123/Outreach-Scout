"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { Avatar, Btn, FitScore, Logo, SignalChip } from "./ui";
import { useToast } from "./toast";
import type { Lead } from "@/lib/mappers";

function DrawerStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kbox" style={{ flex: 1 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)", fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 7 }}>{children}</div>
    </div>
  );
}

export function LeadDrawer({
  lead, onClose, onApprove, onDiscard, onSaveDraft, onRegenerate,
}: {
  lead: Lead;
  onClose: () => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onSaveDraft: (id: string, draft: string) => void;
  onRegenerate: (id: string) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(lead.draft);
  const [editing, setEditing] = useState(false);
  const [regen, setRegen] = useState(false);
  useEffect(() => { setDraft(lead.draft); setEditing(false); }, [lead.id, lead.draft]);

  const doRegen = async () => {
    setRegen(true);
    await onRegenerate(lead.id);
    setRegen(false);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog">
        <div className="drawer-head">
          <Logo name={lead.company} color={lead.color} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 19, fontWeight: 680, letterSpacing: "-.02em" }}>{lead.company}</h2>
              {lead.approved && <span className="status done"><span className="led" />Approved</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
              <a className="src-link" href={`https://${lead.domain}`} target="_blank" rel="noreferrer" style={{ margin: 0 }}>{lead.domain} <Icon name="external" size={12} /></a>
              <span>· {lead.industry} · {lead.size} ppl · {lead.location}</span>
            </div>
          </div>
          <Btn kind="subtle" onClick={onClose}><Icon name="x" size={16} /></Btn>
        </div>

        <div className="drawer-body">
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            <DrawerStat label="Fit score">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FitScore value={lead.fit} size={42} />
                <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>
                  {lead.fit >= 85 ? "Strong match" : lead.fit >= 75 ? "Good match" : "Moderate match"}<br />across the ICP
                </span>
              </div>
            </DrawerStat>
            <DrawerStat label="Signals">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {lead.signals.length ? lead.signals.map((s, i) => <SignalChip key={i} type={s.type} />) : <span style={{ color: "var(--faint)", fontSize: 12.5 }}>—</span>}
              </div>
            </DrawerStat>
          </div>

          <div className="section-title" style={{ marginBottom: 10 }}>Identified contact</div>
          <div className="card card-pad" style={{ padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={lead.contact.name} size={46} color="var(--violet-300)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{lead.contact.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{lead.contact.title} · {lead.company}</div>
            </div>
            {lead.contact.linkedin && lead.contact.linkedin !== "#" && (
              <Btn kind="ghost" size="sm" icon="link" onClick={() => window.open(lead.contact.linkedin, "_blank")}>LinkedIn</Btn>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div className="section-title">Why they&apos;re a fit</div>
            <span className="tag" style={{ background: "var(--violet-100)", color: "var(--violet-700)" }}>researched</span>
          </div>
          <div className="card" style={{ padding: "6px 18px", marginBottom: 24 }}>
            {lead.insights.length ? lead.insights.map((ins, i) => (
              <div className="insight" key={i}>
                <span className="ic"><Icon name="checkSm" size={14} /></span>
                <div>
                  <div className="it" dangerouslySetInnerHTML={{ __html: ins.t }} />
                  {ins.src && <a className="src-link" href={ins.url} target="_blank" rel="noreferrer">{ins.src} <Icon name="external" size={11} /></a>}
                </div>
              </div>
            )) : <div style={{ padding: "14px 0", color: "var(--faint)", fontSize: 13 }}>No insights captured for this account.</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="sparkle" size={15} style={{ color: "var(--violet-600)" }} /> Personalized draft
            </div>
            <div style={{ flex: 1 }} />
            <Btn kind="subtle" size="sm" icon="refresh" onClick={doRegen} disabled={regen}>{regen ? "Regenerating…" : "Regenerate"}</Btn>
            <Btn kind="subtle" size="sm" icon={editing ? "checkSm" : "edit"} onClick={() => { if (editing) onSaveDraft(lead.id, draft); setEditing(!editing); }}>{editing ? "Save" : "Edit"}</Btn>
          </div>
          <div style={{ position: "relative" }}>
            {regen && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.6)", backdropFilter: "blur(1px)", borderRadius: 12, display: "grid", placeItems: "center", zIndex: 2 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--violet-700)", fontWeight: 550, fontSize: 13 }}>
                  <Icon name="refresh" size={16} className="spin" /> Rewriting with your value prop…</span>
              </div>
            )}
            <textarea className="textarea" rows={6} value={draft} readOnly={!editing} onChange={(e) => setDraft(e.target.value)}
              style={{ lineHeight: 1.6, fontSize: 13.5, background: editing ? "var(--surface)" : "var(--surface-2)", borderColor: editing ? "var(--violet-400)" : "var(--line)", boxShadow: editing ? "0 0 0 3.5px var(--violet-100)" : "none" }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 7, display: "flex", gap: 14 }}>
            <span>{draft.length} chars</span><span>~{draft.split(" ").length} words</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="sparkle" size={12} /> tuned to your value prop</span>
          </div>
        </div>

        <div className="drawer-foot">
          <Btn kind="danger" icon="trash" onClick={() => { onDiscard(lead.id); onClose(); }}>Discard</Btn>
          <div style={{ flex: 1 }} />
          <Btn kind="ghost" icon="edit" onClick={() => setEditing(true)}>Edit</Btn>
          <Btn kind="primary" icon="check" onClick={() => { onApprove(lead.id); toast("Lead approved", "check"); onClose(); }}>{lead.approved ? "Approved" : "Approve lead"}</Btn>
        </div>
      </div>
    </>
  );
}
