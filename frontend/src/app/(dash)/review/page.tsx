"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Btn, FitScore, Logo, SignalChip } from "@/components/ui";
import { LeadDrawer } from "@/components/lead-drawer";
import { useToast } from "@/components/toast";
import { useDashboard } from "@/lib/dashboard";

function Checkbox({ on, onChange, indeterminate }: { on: boolean; onChange: (v: boolean) => void; indeterminate?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      style={{ width: 19, height: 19, borderRadius: 6, border: `1.6px solid ${on || indeterminate ? "var(--violet-600)" : "var(--line)"}`, background: on || indeterminate ? "var(--violet-600)" : "var(--surface)", display: "grid", placeItems: "center", flex: "none", transition: "all .12s" }}>
      {on && <Icon name="checkSm" size={13} style={{ color: "#fff" }} />}
      {indeterminate && !on && <span style={{ width: 9, height: 2, background: "#fff", borderRadius: 2 }} />}
    </button>
  );
}

export default function ReviewPage() {
  const toast = useToast();
  const { leads, approve, discard, saveDraft, regenerate, openLead, exportCsv, sync } = useDashboard();
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const done = leads.filter((l) => l.status === "done" && !l.fail && !l.discarded);
  const approvedCount = done.filter((l) => l.approved).length;
  const shown = done.filter((l) => (filter === "approved" ? l.approved : filter === "pending" ? !l.approved : true));

  const dupes = useMemo(() => {
    const pairs: [typeof done[number], typeof done[number]][] = [];
    for (let i = 0; i < done.length; i++)
      for (let j = i + 1; j < done.length; j++)
        if (done[i].contact.title === done[j].contact.title && done[i].contact.title !== "—" && Math.abs(done[i].fit - done[j].fit) <= 1)
          pairs.push([done[i], done[j]]);
    return pairs.slice(0, 1);
  }, [done]);

  const allSel = shown.length > 0 && shown.every((l) => sel.has(l.id));
  const someSel = shown.some((l) => sel.has(l.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(shown.map((l) => l.id)));
  const toggle = (id: string) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const bulkApprove = () => { sel.forEach((id) => approve(id, true)); toast(`Approved ${sel.size} leads`, "check"); setSel(new Set()); };
  const bulkDiscard = () => { sel.forEach((id) => discard(id)); toast(`Discarded ${sel.size} leads`, "trash"); setSel(new Set()); };

  const doSync = async () => { setSyncing(true); await sync(); setSyncing(false); };
  const open = async (id: string) => { await openLead(id); setOpenId(id); };
  const openLeadObj = openId ? done.find((l) => l.id === openId) : null;

  if (done.length === 0) {
    return (
      <div className="scroll"><div className="page">
        <h1 style={{ fontSize: 24, fontWeight: 680, letterSpacing: "-.02em", marginBottom: 6 }}>Review & export</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 30 }}>Approved leads land here, ready to push to your CRM.</p>
        <div className="card empty">
          <span className="eico"><Icon name="inbox" size={28} /></span>
          <h3>No leads ready yet</h3>
          <p>Once the agent finishes researching accounts, you&apos;ll review and approve them here, then export to CSV or sync to your CRM.</p>
        </div>
      </div></div>
    );
  }

  return (
    <div className="scroll"><div className="page page-wide">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 24, fontWeight: 680, letterSpacing: "-.02em" }}>Review & export</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6 }}>{approvedCount} approved · {done.length} researched · ready to push to your CRM.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="ghost" icon="download" onClick={exportCsv}>Export CSV</Btn>
          <Btn kind="primary" icon="sync" disabled={approvedCount === 0 || syncing} onClick={doSync}>
            {syncing ? <><Icon name="refresh" size={16} className="spin" /> Syncing…</> : `Sync ${approvedCount} to CRM`}
          </Btn>
        </div>
      </div>

      {dupes.length > 0 && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--amber-50)", border: "1px solid var(--amber-200)", borderRadius: 14, padding: "13px 16px", marginBottom: 16 }}>
          <span style={{ color: "var(--amber-600)", marginTop: 1 }}><Icon name="warn" size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#8A5A12" }}>Possible duplicate detected</div>
            <div style={{ fontSize: 12.5, color: "#9A6A22", marginTop: 2 }}>
              <b>{dupes[0][0].company}</b> and <b>{dupes[0][1].company}</b> target the same role with near-identical fit. Review before syncing to avoid double-touching an account.
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={() => void open(dupes[0][0].id)}>Review pair</Btn>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        {([["all", "All ready", done.length], ["approved", "Approved", approvedCount], ["pending", "Pending", done.length - approvedCount]] as const).map(([k, lbl, n]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ border: "none", background: filter === k ? "var(--violet-100)" : "transparent", color: filter === k ? "var(--violet-700)" : "var(--muted)", padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 560, display: "inline-flex", gap: 7, alignItems: "center" }}>
            {lbl} <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{n}</span>
          </button>
        ))}
      </div>

      {someSel && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--violet-600)", color: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 14, boxShadow: "var(--sh-md)" }}>
          <span style={{ fontSize: 13, fontWeight: 550 }}>{sel.size} selected</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }} onClick={bulkApprove}><Icon name="check" size={14} /> Approve</button>
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={bulkDiscard}><Icon name="trash" size={14} /> Discard</button>
          <button className="btn btn-sm" style={{ background: "transparent", color: "#fff" }} onClick={() => setSel(new Set())}><Icon name="x" size={14} /></button>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th style={{ width: 40 }}><Checkbox on={allSel} indeterminate={someSel && !allSel} onChange={toggleAll} /></th>
            <th>Company</th><th>Contact</th><th>Signals</th><th>Fit</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="lead-row" onClick={() => void open(l.id)}>
                <td onClick={(e) => e.stopPropagation()}><Checkbox on={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                <td>
                  <div className="coname">
                    <Logo name={l.company} color={l.color} />
                    <span>
                      <span style={{ display: "block" }}>{l.company}</span>
                      <span className="cmeta">{l.domain} · {l.location}</span>
                    </span>
                  </div>
                </td>
                <td><div style={{ fontWeight: 550, fontSize: 13 }}>{l.contact.name}</div><div className="cmeta">{l.contact.title}</div></td>
                <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 210 }}>{l.signals.slice(0, 2).map((s, i) => <SignalChip key={i} type={s.type} />)}</div></td>
                <td><FitScore value={l.fit} /></td>
                <td>{l.approved ? <span className="status done"><span className="led" />Approved</span> : <span className="status queued"><span className="led" />Pending</span>}</td>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {!l.approved
                    ? <Btn kind="ghost" size="sm" icon="check" onClick={() => { approve(l.id, true); toast(`Approved ${l.company}`, "check"); }}>Approve</Btn>
                    : <Btn kind="subtle" size="sm" onClick={() => approve(l.id, false)}>Unapprove</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 14, textAlign: "center" }}>
        Export includes company, contact, title, fit score, signals, source links and the personalized draft.
      </p>

      {openLeadObj && (
        <LeadDrawer lead={openLeadObj} onClose={() => setOpenId(null)}
          onApprove={(id) => approve(id, true)} onDiscard={discard} onSaveDraft={saveDraft} onRegenerate={regenerate} />
      )}
    </div></div>
  );
}
