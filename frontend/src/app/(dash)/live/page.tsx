"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Btn, FitScore, Logo, Progress, SignalChip, StatusBadge, Avatar } from "@/components/ui";
import { LeadDrawer } from "@/components/lead-drawer";
import { useDashboard } from "@/lib/dashboard";
import type { Lead } from "@/lib/mappers";

function StatPill({ label, value, color, active }: { label: string; value: number | string; color: string; active?: boolean }) {
  return (
    <div className="stat" style={{ borderColor: active ? "var(--violet-300)" : "var(--line)", boxShadow: active ? "var(--sh-glow)" : "var(--sh-xs)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
        <span className="k" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="v" style={{ marginTop: 6, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function StepRow({ step, state }: { step: Lead["stepData"][number]; state: string }) {
  return (
    <div className={`step ${state}`}>
      <span className="si" style={step.fail ? { background: "var(--red-50)", borderColor: "var(--red-200)", color: "var(--red-600)" } : {}}>
        {state === "active" ? <Icon name="refresh" size={11} className="spin" /> : step.fail ? <Icon name="x" size={11} /> : <Icon name="checkSm" size={12} />}
      </span>
      <span className="stxt">
        <span dangerouslySetInnerHTML={{ __html: step.t }} />
        {step.src && <> <span className="src">· {step.src}</span></>}
      </span>
    </div>
  );
}

function LeadRow({ lead, expanded, onToggle, onOpen }: { lead: Lead; expanded: boolean; onToggle: () => void; onOpen: () => void }) {
  const researching = lead.status === "researching";
  const done = lead.status === "done";
  return (
    <>
      <tr className={`lead-row ${expanded ? "expanded" : ""}`} onClick={onToggle}>
        <td style={{ width: 34, paddingRight: 0 }}><Icon name={expanded ? "chevDown" : "chevRight"} size={16} style={{ color: "var(--faint)" }} /></td>
        <td>
          <div className="coname">
            <Logo name={lead.company} color={lead.color} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block" }}>{lead.company}</span>
              <span className="cmeta">{lead.domain} · {lead.industry}{lead.size !== "—" && ` · ${lead.size} ppl`}</span>
            </span>
          </div>
        </td>
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 230 }}>
            {lead.signals.slice(0, 2).map((s, i) => <SignalChip key={i} type={s.type} />)}
            {lead.signals.length > 2 && <span className="tag">+{lead.signals.length - 2}</span>}
          </div>
        </td>
        <td>
          {done && !lead.fail && lead.contact.name !== "—" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Avatar name={lead.contact.name} size={28} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 550, fontSize: 13 }}>{lead.contact.name}</span>
                <span className="cmeta">{lead.contact.title}</span>
              </span>
            </div>
          ) : researching ? <span style={{ color: "var(--faint)", fontSize: 12.5, fontStyle: "italic" }}>identifying…</span>
            : <span style={{ color: "var(--faint)" }}>—</span>}
        </td>
        <td style={{ width: 64 }}>{done && !lead.fail ? <FitScore value={lead.fit} /> : <span style={{ color: "var(--faint)" }}>—</span>}</td>
        <td style={{ width: 168 }}>
          {researching ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <StatusBadge status="researching" />
              <Progress value={lead.progress} />
            </div>
          ) : <StatusBadge status={lead.fail && done ? "failed" : lead.status} />}
        </td>
        <td style={{ width: 44, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
          {done && !lead.fail && <Btn kind="subtle" size="sm" onClick={onOpen} title="Open lead"><Icon name="chevRight" size={15} /></Btn>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, background: "var(--surface-2)" }}>
            <div className="steplog">
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)", fontWeight: 600, padding: "10px 0 4px" }}>
                Agent activity {researching && <span className="src" style={{ textTransform: "none", letterSpacing: 0 }}>· working</span>}
              </div>
              {lead.stepData.length ? lead.stepData.map((s, i, arr) => (
                <StepRow key={i} step={s} state={s.fail ? "fail" : researching && i === arr.length - 1 ? "active" : "done"} />
              )) : <div style={{ fontSize: 12.5, color: "var(--faint)", paddingBottom: 8 }}>Open the lead to load the full step log.</div>}
              {done && !lead.fail && <div style={{ marginTop: 10 }}><Btn kind="ghost" size="sm" icon="doc" onClick={onOpen}>Review lead & draft</Btn></div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LivePage() {
  const router = useRouter();
  const { leads: allLeads, stats, running, launched, pause, resume, openLead, approve, discard, saveDraft, regenerate } = useDashboard();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const leads = allLeads.filter((l) => !l.discarded);
  const total = leads.length;
  const complete = stats.queued === 0 && stats.researching === 0;
  const pct = total ? Math.round(((stats.done + stats.failed) / total) * 100) : 0;
  const openLeadObj = openId ? leads.find((l) => l.id === openId) : null;

  const open = async (id: string) => { await openLead(id); setOpenId(id); };

  if (!launched) {
    return (
      <div className="scroll"><div className="page">
        <div className="card empty">
          <span className="eico"><Icon name="radar" size={28} /></span>
          <h3>No active research run</h3>
          <p>Define your ideal customer and launch a campaign — leads will stream in here in real time as the agent researches each account.</p>
          <div style={{ marginTop: 18 }}><Btn kind="primary" icon="rocket" onClick={() => router.push("/setup")}>Set up a campaign</Btn></div>
        </div>
      </div></div>
    );
  }

  return (
    <div className="scroll">
      <div className="page page-wide">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 680, letterSpacing: "-.02em" }}>Outbound research</h1>
              {!complete && running && <span className="status researching"><span className="led" />Live</span>}
              {!complete && !running && <span className="status queued"><span className="led" />Paused</span>}
              {complete && <span className="status done"><span className="led" />Complete</span>}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6 }}>
              {complete ? <>Done — researched {total} accounts, {stats.done} ready to review.</>
                : <>The agent is working through {total} accounts. Expand any row to watch it research live.</>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!complete && (running ? <Btn kind="ghost" icon="pause" onClick={pause}>Pause</Btn> : <Btn kind="ghost" icon="rocket" onClick={resume}>Resume</Btn>)}
            <Btn kind="primary" icon="list" iconRight="chevRight" disabled={stats.done === 0} onClick={() => router.push("/review")}>
              Review {stats.done} {stats.done === 1 ? "lead" : "leads"}
            </Btn>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16, padding: "18px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              {complete ? "Run complete" : "Overall progress"}
              <span style={{ color: "var(--muted)", fontWeight: 450 }}> · {stats.done + stats.failed} of {total} processed</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: "var(--muted)" }}>
              {!complete && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={14} /> ~{stats.eta}s remaining</span>}
              {stats.cost > 0 && <span>${stats.cost.toFixed(3)} · {stats.tokens.toLocaleString()} tok</span>}
              <span style={{ fontWeight: 680, color: "var(--ink)", fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
            </span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 18 }}>
          <StatPill label="Queued" value={stats.queued} color="var(--faint)" />
          <StatPill label="Researching" value={stats.researching} color="var(--violet-600)" active={stats.researching > 0} />
          <StatPill label="Done" value={stats.done} color="var(--green-600)" />
          <StatPill label="Failed" value={stats.failed} color="var(--red-600)" />
          <StatPill label="Avg fit" value={stats.avgFit || "—"} color="var(--violet-400)" />
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th></th><th>Company</th><th>Signals</th><th>Contact</th><th>Fit</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <LeadRow key={l.id} lead={l} expanded={expanded === l.id}
                  onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                  onOpen={() => void open(l.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openLeadObj && (
        <LeadDrawer lead={openLeadObj} onClose={() => setOpenId(null)}
          onApprove={(id) => approve(id, true)} onDiscard={discard} onSaveDraft={saveDraft} onRegenerate={regenerate} />
      )}
    </div>
  );
}
