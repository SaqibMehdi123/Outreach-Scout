/* App shell: routing, real backend integration (auth, launch, SSE live, review). */

const DEFAULT_CONFIG = {
  industries: ["B2B SaaS"],
  sizes: ["m"],
  geos: ["United States", "Canada"],
  roles: ["VP Sales", "Head of Revenue", "Director of Sales Dev"],
  signals: ["funded", "hiring", "launch"],
  targetCount: 50,
  valueProp: SEED.icp.valueProp,
};

const CAMPAIGN_KEY = "ora_campaign_v1";
const loadCampaignId = () => { try { return localStorage.getItem(CAMPAIGN_KEY) || null; } catch (e) { return null; } };
const saveCampaignId = (id) => { try { id ? localStorage.setItem(CAMPAIGN_KEY, id) : localStorage.removeItem(CAMPAIGN_KEY); } catch (e) {} };

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#11815A",
  "density": "comfortable",
  "font": "Geist",
  "reduceMotion": false
}/*EDITMODE-END*/;

const NAV = [
  { key:"setup",    label:"New campaign",  icon:"target" },
  { key:"live",     label:"Live research", icon:"radar" },
  { key:"review",   label:"Review & export", icon:"list" },
  { key:"settings", label:"Settings",      icon:"settings" },
];

const ROLE_LABEL = { founder:"Founder", sales_lead:"Sales leader", sdr:"SDR / AE", revops:"RevOps" };

function emptyStats() { return { queued:0, researching:0, done:0, failed:0, avgFit:0, eta:0 }; }

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [leads, setLeads] = useState([]);
  const [campaignId, setCampaignId] = useState(loadCampaignId());
  const [launched, setLaunched] = useState(false);
  const [running, setRunning] = useState(false);
  const [liveStats, setLiveStats] = useState(emptyStats());
  const [openId, setOpenId] = useState(null);
  const [viewport, setViewport] = useState("desktop");
  const [toasts, setToasts] = useState([]);
  const esRef = useRef(null);

  const toast = useCallback((msg, icon="check") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, msg, icon }]);
    setTimeout(() => setToasts(ts => ts.filter(x=>x.id!==id)), 2600);
  }, []);

  /* ---------- restore session ---------- */
  useEffect(() => {
    (async () => {
      if (Api.isAuthed()) {
        try {
          const me = await Api.me();
          setAuthUser({ ...me.user, company: me.org.name });
          if (me.org.value_prop) setConfig(c => ({ ...c, valueProp: me.org.value_prop }));
          if (campaignId) await loadCampaign(campaignId);
        } catch (e) { Api.logout(); }
      }
      setAuthChecked(true);
    })();
    return () => { if (esRef.current) esRef.current.close(); };
  }, []);

  /* ---------- live stream ---------- */
  const startStream = useCallback((id) => {
    if (esRef.current) esRef.current.close();
    setRunning(true);
    esRef.current = Api.streamCampaign(id, async (snap) => {
      const s = snap.stats || {};
      const pending = (s.queued||0) + (s.researching||0);
      setLiveStats({ queued:s.queued||0, researching:s.researching||0, done:s.done||0,
        failed:s.failed||0, avgFit: s.avg_fit||0, eta: Math.max(0, Math.ceil(pending*1.6)) });
      // live rows from snapshot (minimal); full data fetched on completion
      setLeads(prev => {
        const byId = Object.fromEntries(prev.map(l => [l.id, l]));
        return (snap.leads||[]).map(l => {
          const existing = byId[l.id];
          if (existing && existing.status === "done" && !existing._snapshot) return existing;
          return { ...Mappers.snapshotLead(l), _snapshot: true };
        });
      });
      if (snap.done) {
        setRunning(false);
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        await loadCampaign(id);
      }
    }, () => { /* transient SSE errors auto-retry */ });
  }, []);

  async function loadCampaign(id) {
    try {
      const page = await Api.listCompanies(id, 1, 200);
      setLeads((page.items || []).map(c => Mappers.companyToLead(c)));
      setLaunched(true);
      const camp = await Api.getCampaign(id);
      const s = camp.stats || {};
      setLiveStats({ queued:s.queued||0, researching:s.researching||0, done:s.done||0,
        failed:s.failed||0, avgFit:s.avg_fit||0, eta:0 });
      if (camp.status === "running") startStream(id);
    } catch (e) { /* ignore */ }
  }

  /* ---------- actions ---------- */
  const launch = async () => {
    try {
      const icp = await Api.createIcp({
        name: `${(config.industries[0]||"ICP")} — ${new Date().toLocaleDateString()}`,
        criteria: { industries:config.industries, sizes:config.sizes, geos:config.geos,
                    roles:config.roles, signals:config.signals },
        value_prop: config.valueProp,
      });
      const camp = await Api.launchCampaign({ target_count: config.targetCount, icp_profile_id: icp.id });
      setCampaignId(camp.id); saveCampaignId(camp.id);
      setLeads([]); setLaunched(true); setLiveStats(emptyStats());
      setScreen("live");
      startStream(camp.id);
      toast("Campaign launched", "rocket");
    } catch (e) { toast(e.message || "Launch failed", "warn"); }
  };

  const setLead = (id, patch) =>
    setLeads(ls => ls.map(l => l.id===id ? { ...l, ...(typeof patch==="function"?patch(l):patch) } : l));

  const approve = async (id, val=true) => {
    const lead = leads.find(l=>l.id===id); if (!lead || !lead.draftId) { setLead(id,{approved:val}); return; }
    try { await (val ? Api.approveDraft(lead.draftId) : Api.unapproveDraft(lead.draftId));
      setLead(id, { approved: val, discarded:false, draftStatus: val?"approved":"pending" });
    } catch (e) { toast(e.message, "warn"); }
  };
  const discard = async (id) => {
    const lead = leads.find(l=>l.id===id);
    try { if (lead && lead.draftId) await Api.discardDraft(lead.draftId); } catch (e) {}
    setLead(id, { discarded:true, approved:false, draftStatus:"discarded" }); setOpenId(null);
    toast("Lead discarded","trash");
  };
  const saveDraft = async (id, draft) => {
    const lead = leads.find(l=>l.id===id);
    setLead(id, { draft });
    try { if (lead && lead.draftId) await Api.editDraft(lead.draftId, draft); } catch (e) { toast(e.message,"warn"); }
  };
  const openLead = async (id) => {
    setOpenId(id);
    // hydrate full detail (insights + trace) on open
    try {
      const d = await Api.getCompany(id);
      setLead(id, { stepData: Mappers.traceToSteps(d.trace),
        insights: ((d.insights&&d.insights.facts)||[]).map(f=>({t:f.text,src:f.source||"",url:f.url||"#"})) });
    } catch (e) {}
  };

  const exportCsv = async (rows) => {
    if (!campaignId) return;
    try {
      await Api.exportCampaignCsv(campaignId);
      toast(`Exported ${rows.length} approved leads to CSV`, "download");
      await loadCampaign(campaignId);   // statuses flip to exported
    } catch (e) { toast(e.message || "Nothing approved to export", "warn"); }
  };
  const sync = async () => {
    if (!campaignId) return;
    try {
      const res = await Api.syncCampaign(campaignId);
      toast(`Synced ${res.synced} leads to ${SEED.crm.name}`, "sync");
      await loadCampaign(campaignId);
    } catch (e) { toast(e.message || "Sync failed", "warn"); }
  };

  /* ---------- auth ---------- */
  const onAuthed = async (me) => {
    setAuthUser({ ...me.user, company: me.org.name });
    if (me.org && me.org.value_prop) setConfig(c => ({ ...c, valueProp: me.org.value_prop }));
    setScreen("setup");
  };
  const signOut = () => {
    Api.logout(); saveCampaignId(null);
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setAuthUser(null); setAuthMode("login"); setLeads([]); setLaunched(false); setCampaignId(null);
  };

  /* ---------- derived ---------- */
  const stats = useMemo(() => {
    // prefer server stats; recompute avg from loaded leads when available
    const doneLeads = leads.filter(l => l.status==="done" && !l.fail);
    const avg = doneLeads.length ? Math.round(doneLeads.reduce((a,b)=>a+(b.fit||0),0)/doneLeads.length) : (liveStats.avgFit||0);
    return { ...liveStats, avgFit: avg };
  }, [leads, liveStats]);

  const compact = viewport !== "desktop";
  const openLeadObj = openId ? leads.find(l=>l.id===openId) : null;
  const navBadge = { live: running ? stats.researching || null : (stats.done || null),
                     review: leads.filter(l=>l.approved).length || null };

  const rootStyle = {
    "--accent": t.accent,
    "--accent-2": `color-mix(in oklab, ${t.accent}, white 20%)`,
    "--accent-grad": `linear-gradient(135deg, color-mix(in oklab, ${t.accent}, white 16%) 0%, ${t.accent} 55%, color-mix(in oklab, ${t.accent}, black 20%) 100%)`,
    "--density": t.density === "compact" ? 0.62 : 1,
    "--motion": t.reduceMotion ? 0.35 : 1,
    "--ff": t.font === "Inter" ? '"Inter", system-ui, sans-serif' : '"Geist", system-ui, sans-serif',
  };
  const appCls = `app ${compact?"compact":""} ${viewport==="mobile"?"is-mobile":""} ${viewport==="tablet"?"is-tablet":""}`;
  const title = { setup:"New campaign", live:"Live research", review:"Review & export", settings:"Settings" }[screen];

  /* ---------- auth gate ---------- */
  if (!authChecked) return <div className="viewport-host desktop" style={rootStyle} />;
  if (!authUser) {
    return (
      <div className="viewport-host desktop" style={rootStyle}>
        <div className="viewport-frame">
          <AuthGate initialMode={authMode} onAuthed={onAuthed} onToast={toast} />
        </div>
      </div>
    );
  }

  const initials = (authUser.name||"AG").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  return (
    <div className={`viewport-host ${viewport}`} style={rootStyle}>
      <div className="viewport-frame">
        <div className={appCls}>
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-mark"><Icon name="radar" size={19} style={{ color:"#fff" }} /></div>
              <div><div className="brand-name">Outreach<span style={{ color:"var(--violet-300)" }}>Scout</span></div>
                <div className="brand-sub">Outbound research agent</div></div>
            </div>
            <nav className="nav">
              <div className="nav-label">Workspace</div>
              {NAV.map(n => (
                <button key={n.key} className={`nav-item ${screen===n.key?"active":""}`} onClick={()=>setScreen(n.key)}>
                  <Icon name={n.icon} size={18} className="ico" />{n.label}
                  {navBadge[n.key] && <span className="nav-badge">{navBadge[n.key]}</span>}
                </button>
              ))}
            </nav>
            <div className="side-foot">
              {launched && (
                <div className="run-pill" style={{ marginBottom:12 }}>
                  <span className="dot" style={{ background: running?"var(--violet-400)":"var(--green-200)", animation: running?"pulseLed 1.3s infinite":"none" }} />
                  <div style={{ lineHeight:1.25 }}>
                    <div className="t">{running?"Researching…":"Run complete"}</div>
                    <div className="s">{stats.done}/{leads.length||0} done · {stats.avgFit||"—"} avg fit</div>
                  </div>
                </div>
              )}
              <div className="user-row">
                <div className="user-av">{initials}</div>
                <div style={{ lineHeight:1.2, minWidth:0, flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:560, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{authUser.name||"You"}</div>
                  <div style={{ fontSize:11, color:"#94A89E", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {(authUser.company||"Acme")}{authUser.role && ` · ${ROLE_LABEL[authUser.role]||""}`}</div>
                </div>
                <button onClick={signOut} title="Sign out"
                  style={{ border:"none", background:"transparent", color:"#94A89E", padding:6, borderRadius:8, display:"grid", placeItems:"center" }}>
                  <Icon name="external" size={15} />
                </button>
              </div>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              {viewport==="mobile" && <div className="brand-mark" style={{ width:30, height:30 }}><Icon name="radar" size={16} style={{ color:"#fff" }} /></div>}
              <div className="crumb hide-compact"><span>OutreachScout</span><Icon name="chevRight" size={13} /><b>{title}</b></div>
              <span className="page-title" style={{ display: viewport==="mobile"?"block":"none" }}>{title}</span>
              <div className="spacer" />
              <div className="viewport-toggle">
                {[["desktop","desktop"],["tablet","tablet"],["mobile","mobile"]].map(([k,ic])=>(
                  <button key={k} className={viewport===k?"active":""} onClick={()=>setViewport(k)} title={k}><Icon name={ic} size={16} /></button>
                ))}
              </div>
              {screen!=="setup" && <Btn kind="ghost" size="sm" icon="plus" className="hide-compact" onClick={()=>setScreen("setup")}>New</Btn>}
            </header>

            {screen==="setup" && <SetupScreen config={config} setConfig={setConfig} onLaunch={launch} />}
            {screen==="live" && (launched
              ? <LiveScreen leads={leads.filter(l=>!l.discarded)} stats={stats} running={running} compact={compact}
                  onPause={()=>{ if(esRef.current){esRef.current.close();esRef.current=null;} setRunning(false); }}
                  onResume={()=>campaignId && startStream(campaignId)}
                  onOpenLead={openLead} onGoReview={()=>setScreen("review")} />
              : <LiveReady onStart={()=>setScreen("setup")} />)}
            {screen==="review" && <ReviewScreen leads={leads} onApprove={approve} onDiscard={discard}
              onOpenLead={openLead} onExport={exportCsv} onSync={sync} toast={toast} />}
            {screen==="settings" && <SettingsScreen toast={toast} />}
          </div>

          {viewport==="mobile" && (
            <nav className="mobile-tabs">
              {NAV.map(n => (
                <button key={n.key} className={screen===n.key?"active":""} onClick={()=>setScreen(n.key)} style={{ position:"relative" }}>
                  {navBadge[n.key] && <span className="mt-badge">{navBadge[n.key]}</span>}
                  <Icon name={n.icon} size={20} />{n.label.split(" ")[0]}
                </button>
              ))}
            </nav>
          )}

          {openLeadObj && <LeadDrawer lead={openLeadObj} onClose={()=>setOpenId(null)}
            onApprove={(id)=>{ approve(id,true); toast("Lead approved","check"); setOpenId(null); }}
            onDiscard={discard} onSaveDraft={saveDraft} toast={toast} />}

          <div className="toast-wrap">
            {toasts.map(t => <div className="toast" key={t.id}><Icon name={t.icon} size={16} style={{ color:"var(--violet-300)" }} />{t.msg}</div>)}
          </div>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent} options={["#11815A","#0D6A49","#C2570C","#C13E66","#B5721A"]} onChange={v=>setTweak("accent",v)} />
        <TweakRadio label="Typeface" value={t.font} options={["Geist","Inter"]} onChange={v=>setTweak("font",v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["comfortable","compact"]} onChange={v=>setTweak("density",v)} />
        <TweakToggle label="Reduce motion" value={t.reduceMotion} onChange={v=>setTweak("reduceMotion",v)} />
      </TweaksPanel>
    </div>
  );
}

function LiveReady({ onStart }) {
  return (
    <div className="scroll"><div className="page">
      <div className="card empty">
        <span className="eico"><Icon name="radar" size={28} /></span>
        <h3>No active research run</h3>
        <p>Define your ideal customer and launch a campaign — leads will stream in here in real time as the agent researches each account.</p>
        <div style={{ marginTop:18 }}><Btn kind="primary" icon="rocket" onClick={onStart}>Set up a campaign</Btn></div>
      </div>
    </div></div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
