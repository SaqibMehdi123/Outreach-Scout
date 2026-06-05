/* Screen 2 — Live Research view (presentation; engine in app.jsx) */

function StatPill({ label, value, color, sub, active }) {
  return (
    <div className="stat" style={{ borderColor: active?"var(--violet-300)":"var(--line)", boxShadow: active?"var(--sh-glow)":"var(--sh-xs)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
        <span style={{ width:8, height:8, borderRadius:99, background:color }} />
        <span className="k" style={{ margin:0 }}>{label}</span>
      </div>
      <div className="v" style={{ marginTop:6, color:"var(--ink)" }}>{value}{sub && <span style={{ fontSize:14, color:"var(--faint)", fontWeight:500 }}> {sub}</span>}</div>
    </div>
  );
}

function StepRow({ step, state }) {
  // state: 'done' | 'active' | 'fail'
  return (
    <div className={`step ${state}`}>
      <span className="si" style={ step.fail ? { background:"var(--red-50)", borderColor:"var(--red-200)", color:"var(--red-600)" } : {}}>
        {state === "active" ? <Icon name="refresh" size={11} className="spin" />
          : step.fail ? <Icon name="x" size={11} />
          : <Icon name="checkSm" size={12} />}
      </span>
      <span className="stxt">
        <span dangerouslySetInnerHTML={{ __html: step.t }} />
        {step.src && <> <span className="src">· {step.src}</span></>}
      </span>
    </div>
  );
}

function LeadRow({ lead, expanded, onToggle, onOpen, compact }) {
  const researching = lead.status === "researching";
  const done = lead.status === "done";
  const revealed = lead.revealed || 0;
  return (
    <>
      <tr className={`lead-row ${expanded?"expanded":""}`} onClick={onToggle}>
        <td style={{ width:34, paddingRight:0 }}>
          <Icon name={expanded?"chevDown":"chevRight"} size={16} style={{ color:"var(--faint)" }} />
        </td>
        <td>
          <div className="coname">
            <Logo lead={lead} />
            <span style={{ minWidth:0 }}>
              <span style={{ display:"block" }}>{lead.company}</span>
              <span className="cmeta">{lead.domain} · {lead.industry}{lead.size!=="—" && ` · ${lead.size} ppl`}</span>
            </span>
          </div>
        </td>
        {!compact && <td>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", maxWidth:230 }}>
            {lead.signals.slice(0,2).map((s,i)=><SignalChip key={i} type={s.type} label={SEED.SIG[s.type].label} />)}
            {lead.signals.length>2 && <span className="tag">+{lead.signals.length-2}</span>}
          </div>
        </td>}
        {!compact && <td>
          {done && !lead.fail ? (
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <Avatar name={lead.contact.name} size={28} />
              <span style={{ minWidth:0 }}>
                <span style={{ display:"block", fontWeight:550, fontSize:13 }}>{lead.contact.name}</span>
                <span className="cmeta">{lead.contact.title}</span>
              </span>
            </div>
          ) : researching ? <span style={{ color:"var(--faint)", fontSize:12.5, fontStyle:"italic" }}>identifying…</span>
            : <span style={{ color:"var(--faint)" }}>—</span>}
        </td>}
        <td style={{ width:64 }}>{done && !lead.fail ? <FitScore value={lead.fit} /> : <span style={{ color:"var(--faint)" }}>—</span>}</td>
        <td style={{ width: 168 }}>
          {researching ? (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <StatusBadge status="researching" />
              <Progress value={lead.progress} />
            </div>
          ) : <StatusBadge status={lead.fail && done ? "failed" : lead.status} />}
        </td>
        <td style={{ width:44, textAlign:"right" }} onClick={e=>e.stopPropagation()}>
          {done && !lead.fail && <Btn kind="subtle" size="sm" onClick={onOpen} title="Open lead"><Icon name="chevRight" size={15} /></Btn>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={compact?4:7} style={{ padding:0, background:"var(--surface-2)" }}>
            <div className="steplog" style={ compact ? { paddingLeft:24 } : {}}>
              <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".06em", color:"var(--faint)", fontWeight:600, padding:"10px 0 4px" }}>
                Agent activity {researching && <span className="src" style={{ textTransform:"none", letterSpacing:0 }}>· working</span>}
              </div>
              {lead.stepData.slice(0, lead.fail && done ? lead.stepData.length : Math.max(revealed, done?lead.stepData.length:0))
                .map((s, i, arr) => {
                  const isLast = i === arr.length - 1;
                  const state = s.fail ? "fail" : (researching && isLast && revealed < lead.stepData.length) ? "active" : "done";
                  return <StepRow key={i} step={s} state={state} />;
                })}
              {done && !lead.fail && (
                <div style={{ marginTop:10 }}>
                  <Btn kind="ghost" size="sm" icon="doc" onClick={onOpen}>Review lead & draft</Btn>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LiveScreen({ leads, stats, running, onPause, onResume, onOpenLead, onGoReview, compact }) {
  const [expanded, setExpanded] = useState(null);
  const total = leads.length;
  const pct = Math.round((stats.done + stats.failed) / total * 100);
  const complete = stats.queued === 0 && stats.researching === 0;

  return (
    <div className="scroll">
      <div className="page page-wide">
        {/* run header */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:20, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:240 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <h1 style={{ fontSize:24, fontWeight:680, letterSpacing:"-.02em" }}>Outbound research</h1>
              {!complete && running && <span className="status researching"><span className="led" />Live</span>}
              {!complete && !running && <span className="status queued"><span className="led" />Paused</span>}
              {complete && <span className="status done"><span className="led" />Complete</span>}
            </div>
            <p style={{ color:"var(--muted)", fontSize:13.5, marginTop:6 }}>
              {complete ? <>Done — researched {total} accounts, {stats.done} ready to review.</>
                : <>The agent is working through {total} accounts. Expand any row to watch it research live.</>}
            </p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {!complete && (running
              ? <Btn kind="ghost" icon="pause" onClick={onPause}>Pause</Btn>
              : <Btn kind="ghost" icon="rocket" onClick={onResume}>Resume</Btn>)}
            <Btn kind="primary" icon="list" iconRight="chevRight" disabled={stats.done===0} onClick={onGoReview}>
              Review {stats.done} {stats.done===1?"lead":"leads"}
            </Btn>
          </div>
        </div>

        {/* overall progress */}
        <div className="card card-pad" style={{ marginBottom:16, padding:"18px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
            <span style={{ fontSize:13.5, fontWeight:600 }}>
              {complete ? "Run complete" : "Overall progress"}
              <span style={{ color:"var(--muted)", fontWeight:450 }}> · {stats.done+stats.failed} of {total} processed</span>
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:14, fontSize:12.5, color:"var(--muted)" }}>
              {!complete && <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><Icon name="clock" size={14} /> ~{stats.eta}s remaining</span>}
              <span style={{ fontWeight:680, color:"var(--ink)", fontSize:15, fontVariantNumeric:"tabular-nums" }}>{pct}%</span>
            </span>
          </div>
          <Progress value={pct} />
        </div>

        {/* stat grid */}
        <div className="stat-grid hide-compact" style={{ gridTemplateColumns:"repeat(5,1fr)", marginBottom:18 }}>
          <StatPill label="Queued" value={stats.queued} color="var(--faint)" />
          <StatPill label="Researching" value={stats.researching} color="var(--violet-600)" active={stats.researching>0} />
          <StatPill label="Done" value={stats.done} color="var(--green-600)" />
          <StatPill label="Failed" value={stats.failed} color="var(--red-600)" />
          <StatPill label="Avg fit" value={stats.avgFit || "—"} color="var(--violet-400)" />
        </div>

        {/* table */}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Company</th>
                {!compact && <th>Signals</th>}
                {!compact && <th>Contact</th>}
                <th>Fit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <LeadRow key={l.id} lead={l} compact={compact}
                  expanded={expanded===l.id}
                  onToggle={()=>setExpanded(expanded===l.id?null:l.id)}
                  onOpen={(e)=>{ e && e.stopPropagation(); onOpenLead(l.id); }} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LiveScreen });
