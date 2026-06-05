/* Screen 5 — Settings: data sources, CRM, compliance */

function StatusDot({ status }) {
  const map = { connected:["var(--green-600)","Connected"], degraded:["var(--amber-600)","Degraded"], disconnected:["var(--faint)","Not connected"] };
  const [color,label] = map[status]||map.disconnected;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:560, color }}>
    <span style={{ width:7, height:7, borderRadius:99, background:color }} />{label}</span>;
}

function SettingsScreen({ toast }) {
  const [sources, setSources] = useState(SEED.sources);
  const [retention, setRetention] = useState("90");
  const [gdpr, setGdpr] = useState(true);
  const [canspam, setCanspam] = useState(true);
  const [autoSuppress, setAutoSuppress] = useState(true);
  const [newOptout, setNewOptout] = useState("");
  const [list, setList] = useState([]); // [{id, domain}]

  /* load compliance settings from the backend */
  useEffect(() => {
    (async () => {
      try {
        const c = await Api.getCompliance();
        setRetention(String(c.settings.retention_days));
        setGdpr(c.settings.gdpr_checks);
        setCanspam(c.settings.canspam_footer);
        setList(c.suppressions.map(s => ({ id: s.id, domain: s.domain })));
      } catch (e) {}
    })();
  }, []);

  const saveCompliance = async (patch) => {
    try {
      await Api.updateCompliance({ retention_days: +retention, gdpr_checks: gdpr,
        canspam_footer: canspam, ...patch });
    } catch (e) { toast(e.message || "Failed to save", "warn"); }
  };

  const addOptout = async (domain) => {
    try {
      const s = await Api.addSuppression(domain, null);
      setList(l => l.some(x => x.id === s.id) ? l : [...l, { id: s.id, domain: s.domain }]);
      toast("Added to suppression list", "shield");
    } catch (e) { toast(e.message || "Failed to add", "warn"); }
  };
  const removeOptout = async (entry) => {
    try { await Api.removeSuppression(entry.id); setList(l => l.filter(x => x.id !== entry.id)); }
    catch (e) { toast(e.message || "Failed to remove", "warn"); }
  };

  const toggleSource = (i) => {
    setSources(s => s.map((x,idx)=> idx===i ? { ...x, status: x.status==="disconnected"?"connected":"disconnected" } : x));
    toast(sources[i].status==="disconnected"?`Connected ${sources[i].name}`:`Disconnected ${sources[i].name}`, "plug");
  };

  return (
    <div className="scroll"><div className="page">
      <h1 style={{ fontSize:24, fontWeight:680, letterSpacing:"-.02em" }}>Settings</h1>
      <p style={{ color:"var(--muted)", fontSize:13.5, marginTop:6, marginBottom:28 }}>Connect data sources, your CRM, and the compliance controls that govern every run.</p>

      {/* DATA SOURCES */}
      <div className="card card-pad" style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <span className="ic-sec"><Icon name="database" size={17} /></span>
          <div><div className="section-title" style={{ fontSize:15 }}>Data sources & API status</div>
            <p className="section-hint">The agent enriches accounts from these providers. Status updates in real time.</p></div>
        </div>
        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:10 }}>
          {sources.map((s,i)=>(
            <div key={s.name} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", border:"1px solid var(--line)",
              borderRadius:12, background: s.status==="degraded"?"var(--amber-50)":"var(--surface)" }}>
              <span style={{ width:38, height:38, borderRadius:10, background:"var(--violet-50)", color:"var(--violet-600)",
                display:"grid", placeItems:"center", flex:"none" }}><Icon name={srcIcon(s.icon)} size={19} /></span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{s.name}</div>
                <div style={{ fontSize:12, color:"var(--muted)" }}>{s.detail}</div>
              </div>
              <StatusDot status={s.status} />
              <Btn kind={s.status==="disconnected"?"ghost":"subtle"} size="sm"
                onClick={()=>toggleSource(i)}>
                {s.status==="disconnected"?"Connect": s.status==="degraded"?"Retry":"Manage"}
              </Btn>
            </div>
          ))}
        </div>
      </div>

      {/* CRM */}
      <div className="card card-pad" style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span className="ic-sec"><Icon name="sync" size={17} /></span>
          <div><div className="section-title" style={{ fontSize:15 }}>CRM connection</div>
            <p className="section-hint">Approved leads and drafts sync here, two-way.</p></div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", border:"1px solid var(--violet-200)",
          borderRadius:14, background:"var(--violet-50)" }}>
          <span style={{ width:46, height:46, borderRadius:12, background:"#fff", border:"1px solid var(--violet-200)", color:"#FF7A59",
            display:"grid", placeItems:"center", flex:"none", fontWeight:800, fontSize:18 }}>H</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:650, fontSize:15 }}>{SEED.crm.name}</span>
              <StatusDot status="connected" />
            </div>
            <div style={{ fontSize:12.5, color:"var(--muted)", marginTop:2 }}>{SEED.crm.detail}</div>
          </div>
          <Btn kind="ghost" size="sm" icon="settings">Configure</Btn>
          <Btn kind="danger" size="sm" onClick={()=>toast("Disconnect requires confirmation","warn")}>Disconnect</Btn>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:14, padding:"0 2px" }}>
          <div><div style={{ fontSize:13, fontWeight:560 }}>Auto-create tasks for approved leads</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>Drops a sequenced task on the owner's queue.</div></div>
          <Toggle on={autoSuppress} onChange={setAutoSuppress} />
        </div>
      </div>

      {/* COMPLIANCE */}
      <div className="card card-pad">
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span className="ic-sec" style={{ background:"var(--green-50)", color:"var(--green-600)" }}><Icon name="shield" size={17} /></span>
          <div><div className="section-title" style={{ fontSize:15 }}>Compliance & data controls</div>
            <p className="section-hint">Guardrails applied to every account before the agent drafts or syncs.</p></div>
        </div>

        {/* opt-out list */}
        <div style={{ marginBottom:22 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <Icon name="flag" size={15} style={{ color:"var(--muted)" }} />
            <span style={{ fontSize:13.5, fontWeight:560 }}>Opt-out / suppression list</span>
            <span className="tag">{list.length} domains</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10 }}>
            {list.map((d)=>(
              <span key={d.id} className="chip tech" style={{ paddingRight:6 }}>
                {d.domain}
                <button onClick={()=>removeOptout(d)} style={{ border:"none", background:"none", color:"var(--faint)", display:"grid", placeItems:"center", padding:0, marginLeft:2 }}><Icon name="x" size={13} /></button>
              </span>
            ))}
          </div>
          <form onSubmit={e=>{e.preventDefault(); if(newOptout.trim()){ addOptout(newOptout.trim()); setNewOptout(""); }}}
            style={{ display:"flex", gap:8, maxWidth:420 }}>
            <input className="input" placeholder="add domain to never contact…" value={newOptout} onChange={e=>setNewOptout(e.target.value)} />
            <Btn kind="ghost" icon="plus" type="submit">Add</Btn>
          </form>
        </div>

        <hr className="divider" />

        {/* retention */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:18, marginBottom:18, flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <Icon name="clock" size={16} style={{ color:"var(--muted)", marginTop:2 }} />
            <div><div style={{ fontSize:13.5, fontWeight:560 }}>Data-retention window</div>
              <div style={{ fontSize:12, color:"var(--muted)", maxWidth:380 }}>Researched data is auto-purged after this period unless a lead is synced to your CRM.</div></div>
          </div>
          <select className="select" value={retention} onChange={e=>{setRetention(e.target.value); saveCompliance({retention_days:+e.target.value}); toast("Retention updated","shield");}} style={{ width:180 }}>
            <option value="30">30 days</option><option value="90">90 days</option>
            <option value="180">180 days</option><option value="365">1 year</option>
          </select>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderTop:"1px solid var(--line-2)" }}>
          <div><div style={{ fontSize:13.5, fontWeight:560 }}>GDPR / lawful-basis checks</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>Flag EU contacts lacking a lawful basis for outreach.</div></div>
          <Toggle on={gdpr} onChange={v=>{setGdpr(v); saveCompliance({gdpr_checks:v});}} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderTop:"1px solid var(--line-2)" }}>
          <div><div style={{ fontSize:13.5, fontWeight:560 }}>CAN-SPAM footer enforcement</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>Require physical address + unsubscribe in every sequence.</div></div>
          <Toggle on={canspam} onChange={v=>{setCanspam(v); saveCompliance({canspam_footer:v});}} />
        </div>
      </div>
    </div></div>
  );
}

function srcIcon(k) {
  return ({ linkedin:"user", cb:"database", mail:"mail", job:"building", ph:"rocket", tech:"bolt" })[k] || "globe";
}

Object.assign(window, { SettingsScreen });
