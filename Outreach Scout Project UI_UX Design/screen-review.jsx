/* Screen 4 — Review & Export */

function Checkbox({ on, onChange, indeterminate }) {
  return (
    <button onClick={(e)=>{ e.stopPropagation(); onChange(!on); }}
      style={{ width:19, height:19, borderRadius:6, border:`1.6px solid ${on||indeterminate?"var(--violet-600)":"var(--line)"}`,
        background: on||indeterminate?"var(--violet-600)":"var(--surface)", display:"grid", placeItems:"center", flex:"none", transition:"all .12s" }}>
      {on && <Icon name="checkSm" size={13} style={{ color:"#fff" }} />}
      {indeterminate && !on && <span style={{ width:9, height:2, background:"#fff", borderRadius:2 }} />}
    </button>
  );
}

function ReviewScreen({ leads, onApprove, onDiscard, onOpenLead, onExport, onSync, toast }) {
  const done = leads.filter(l => l.status==="done" && !l.fail && !l.discarded);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(new Set());
  const [syncing, setSyncing] = useState(false);

  const shown = done.filter(l => filter==="approved" ? l.approved : filter==="pending" ? !l.approved : true);
  const approvedCount = done.filter(l=>l.approved).length;

  // dedupe: flag leads that share a contact first-name+company token (fabricated heuristic on seed)
  const dupes = useMemo(() => {
    const pairs = [];
    for (let i=0;i<done.length;i++) for (let j=i+1;j<done.length;j++) {
      if (done[i].contact.title === done[j].contact.title && Math.abs(done[i].fit - done[j].fit) <= 1) {
        pairs.push([done[i], done[j]]);
      }
    }
    return pairs.slice(0,1);
  }, [done.length]);

  const allSel = shown.length>0 && shown.every(l=>sel.has(l.id));
  const someSel = shown.some(l=>sel.has(l.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(shown.map(l=>l.id)));
  const toggle = (id) => { const n=new Set(sel); n.has(id)?n.delete(id):n.add(id); setSel(n); };

  const bulkApprove = () => { sel.forEach(id=>onApprove(id,true)); toast(`Approved ${sel.size} leads`,"check"); setSel(new Set()); };
  const bulkDiscard = () => { sel.forEach(id=>onDiscard(id)); toast(`Discarded ${sel.size} leads`,"trash"); setSel(new Set()); };

  const doSync = () => {
    setSyncing(true);
    setTimeout(()=>{ setSyncing(false); onSync(approvedCount); }, 1700);
  };

  if (done.length === 0) {
    return (
      <div className="scroll"><div className="page">
        <h1 style={{ fontSize:24, fontWeight:680, letterSpacing:"-.02em", marginBottom:6 }}>Review & export</h1>
        <p style={{ color:"var(--muted)", fontSize:13.5, marginBottom:30 }}>Approved leads land here, ready to push to your CRM.</p>
        <div className="card empty">
          <span className="eico"><Icon name="inbox" size={28} /></span>
          <h3>No leads ready yet</h3>
          <p>Once the agent finishes researching accounts, you'll review and approve them here, then export to CSV or sync to your CRM.</p>
        </div>
      </div></div>
    );
  }

  return (
    <div className="scroll"><div className="page page-wide">
      <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:22, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220 }}>
          <h1 style={{ fontSize:24, fontWeight:680, letterSpacing:"-.02em" }}>Review & export</h1>
          <p style={{ color:"var(--muted)", fontSize:13.5, marginTop:6 }}>
            {approvedCount} approved · {done.length} researched · ready to push to {SEED.crm.name}.
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn kind="ghost" icon="download" onClick={()=>{ onExport(done.filter(l=>l.approved).length?done.filter(l=>l.approved):done); }}>Export CSV</Btn>
          <Btn kind="primary" icon="sync" disabled={approvedCount===0 || syncing} onClick={doSync}>
            {syncing ? <><Icon name="refresh" size={16} className="spin" /> Syncing…</> : `Sync ${approvedCount} to ${SEED.crm.name}`}
          </Btn>
        </div>
      </div>

      {/* dedupe warning */}
      {dupes.length>0 && (
        <div style={{ display:"flex", gap:12, alignItems:"flex-start", background:"var(--amber-50)", border:"1px solid var(--amber-200)",
          borderRadius:14, padding:"13px 16px", marginBottom:16 }}>
          <span style={{ color:"var(--amber-600)", marginTop:1 }}><Icon name="warn" size={18} /></span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13.5, fontWeight:600, color:"#8A5A12" }}>{dupes.length} possible duplicate{dupes.length>1?"s":""} detected</div>
            <div style={{ fontSize:12.5, color:"#9A6A22", marginTop:2 }}>
              <b>{dupes[0][0].company}</b> and <b>{dupes[0][1].company}</b> target the same role with near-identical fit. Review before syncing to avoid double-touching an account.
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={()=>onOpenLead(dupes[0][0].id)}>Review pair</Btn>
        </div>
      )}

      {/* filter tabs */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
        {[["all","All ready",done.length],["approved","Approved",approvedCount],["pending","Pending",done.length-approvedCount]].map(([k,lbl,n])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{ border:"none", background: filter===k?"var(--violet-100)":"transparent", color: filter===k?"var(--violet-700)":"var(--muted)",
              padding:"7px 13px", borderRadius:9, fontSize:13, fontWeight:560, display:"inline-flex", gap:7, alignItems:"center" }}>
            {lbl} <span style={{ fontVariantNumeric:"tabular-nums", opacity:.7 }}>{n}</span>
          </button>
        ))}
      </div>

      {/* bulk bar */}
      {someSel && (
        <div style={{ display:"flex", alignItems:"center", gap:12, background:"var(--violet-600)", color:"#fff",
          borderRadius:12, padding:"10px 14px", marginBottom:14, boxShadow:"var(--sh-md)" }}>
          <span style={{ fontSize:13, fontWeight:550 }}>{sel.size} selected</span>
          <div style={{ flex:1 }} />
          <button className="btn btn-sm" style={{ background:"rgba(255,255,255,.16)", color:"#fff" }} onClick={bulkApprove}><Icon name="check" size={14} /> Approve</button>
          <button className="btn btn-sm" style={{ background:"rgba(255,255,255,.1)", color:"#fff" }} onClick={bulkDiscard}><Icon name="trash" size={14} /> Discard</button>
          <button className="btn btn-sm" style={{ background:"transparent", color:"#fff" }} onClick={()=>setSel(new Set())}><Icon name="x" size={14} /></button>
        </div>
      )}

      {/* table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width:40 }}><Checkbox on={allSel} indeterminate={someSel&&!allSel} onChange={toggleAll} /></th>
              <th>Company</th>
              <th className="hide-compact">Contact</th>
              <th className="hide-compact">Signals</th>
              <th>Fit</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(l => {
              const isDupe = dupes.some(p=>p.some(d=>d.id===l.id));
              return (
                <tr key={l.id} className="lead-row" onClick={()=>onOpenLead(l.id)}>
                  <td onClick={e=>e.stopPropagation()}><Checkbox on={sel.has(l.id)} onChange={()=>toggle(l.id)} /></td>
                  <td>
                    <div className="coname">
                      <Logo lead={l} />
                      <span>
                        <span style={{ display:"flex", alignItems:"center", gap:7 }}>{l.company}
                          {isDupe && <span className="tag" style={{ background:"var(--amber-50)", color:"var(--amber-600)" }}>dupe?</span>}
                        </span>
                        <span className="cmeta">{l.domain} · {l.location}</span>
                      </span>
                    </div>
                  </td>
                  <td className="hide-compact">
                    <div style={{ fontWeight:550, fontSize:13 }}>{l.contact.name}</div>
                    <div className="cmeta">{l.contact.title}</div>
                  </td>
                  <td className="hide-compact">
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", maxWidth:210 }}>
                      {l.signals.slice(0,2).map((s,i)=><SignalChip key={i} type={s.type} label={SEED.SIG[s.type].label} />)}
                    </div>
                  </td>
                  <td><FitScore value={l.fit} /></td>
                  <td>{l.approved ? <span className="status done"><span className="led" />Approved</span>
                    : <span className="status queued"><span className="led" />Pending</span>}</td>
                  <td onClick={e=>e.stopPropagation()} style={{ textAlign:"right", whiteSpace:"nowrap" }}>
                    {!l.approved
                      ? <Btn kind="ghost" size="sm" icon="check" onClick={()=>{onApprove(l.id,true); toast(`Approved ${l.company}`,"check");}}>Approve</Btn>
                      : <Btn kind="subtle" size="sm" onClick={()=>onApprove(l.id,false)}>Unapprove</Btn>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:12, color:"var(--faint)", marginTop:14, textAlign:"center" }}>
        Export includes company, contact, title, fit score, signals, source links and the personalized draft.
      </p>
    </div></div>
  );
}

Object.assign(window, { ReviewScreen });
