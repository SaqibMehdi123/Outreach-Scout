/* Login / Signup / Onboarding — entry flow */

function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, err, autoFocus, icon }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className="field" style={{ marginBottom:14 }}>
      <span className="label">{label}</span>
      <div className="pw-wrap">
        <input className="input" type={isPw && show ? "text" : type} value={value} autoFocus={autoFocus}
          onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ borderColor: err ? "var(--red-200)" : undefined, paddingRight: isPw ? 38 : undefined }} />
        {isPw && <button className="eye" type="button" onClick={()=>setShow(!show)} tabIndex={-1}>
          <Icon name={show ? "eyeOff" : "eye"} size={16} /></button>}
      </div>
      {err && <span className="field-err">{err}</span>}
    </div>
  );
}

/* ---------- Showcase (left panel) ---------- */
function AuthShowcase() {
  return (
    <div className="auth-show">
      <div className="auth-grid-deco" />
      <div className="auth-brand">
        <span className="bm"><Icon name="radar" size={22} style={{ color:"#fff" }} /></span>
        <div><div className="bn">OutreachScout</div><div className="bs">Outbound research agent</div></div>
      </div>

      <div className="auth-show-mid">
        <h1 className="auth-tagline">Your AI SDR that <span className="hl">researches every account</span> while you sleep.</h1>
        <p className="auth-sub">Define your ideal customer once. The agent finds matching companies, verifies the right contact, and writes a personalized opener for each — with the work shown, step by step.</p>

        <div className="demo-card" aria-hidden="true">
          <div className="demo-head">
            <span className="demo-logo">NA</span>
            <div><div className="demo-title">Northwind Analytics</div><div className="demo-meta">northwind.io · Data Observability</div></div>
            <span className="demo-badge"><span className="d" />Researching</span>
          </div>
          <div className="demo-steps">
            <div className="demo-step"><span className="ds"><Icon name="checkSm" size={11} /></span>Found $24M Series B · Crunchbase</div>
            <div className="demo-step"><span className="ds"><Icon name="checkSm" size={11} /></span>2 SDR roles open · Greenhouse</div>
            <div className="demo-step"><span className="ds"><Icon name="checkSm" size={11} /></span>Identified Dana Whitford, VP Sales</div>
            <div className="demo-step"><span className="ds"><Icon name="sparkle" size={11} /></span>Drafted personalized opener</div>
          </div>
          <div className="demo-prog"><span /></div>
        </div>
      </div>

      <div className="auth-stats">
        <div><div className="v">9-pt</div><div className="k">fit scoring</div></div>
        <div><div className="v">40+</div><div className="k">data signals</div></div>
        <div><div className="v">2-way</div><div className="k">CRM sync</div></div>
      </div>
      <p className="auth-quote">“We replaced three hours of manual research per rep, per day.” — Head of Sales, Series B SaaS</p>
    </div>
  );
}

/* ---------- Login / Signup ---------- */
function AuthForm({ mode, onSwitch, onGoogle, onSuccess, onNeedOnboarding }) {
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (signup && !name.trim()) er.name = "Enter your name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) er.email = "Enter a valid work email";
    if (pw.length < 6) er.pw = "At least 6 characters";
    setErr(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      if (signup) {
        onNeedOnboarding({ name: name || email.split("@")[0], email, password: pw });
      } else {
        await Api.login(email, pw);
        onSuccess(await Api.me());
      }
    } catch (ex) {
      setErr({ pw: ex.message || (signup ? "Sign up failed" : "Sign in failed") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-panel">
      <div className="auth-panel-top">
        <span className="auth-brand" style={{ gap:9 }}>
          <span className="bm" style={{ width:30, height:30, boxShadow:"none" }}><Icon name="radar" size={17} style={{ color:"#fff" }} /></span>
          <b style={{ color:"var(--ink)", fontWeight:680 }}>OutreachScout</b>
        </span>
        <span className="sw" style={{ color:"var(--muted)" }}>
          {signup ? "Have an account?" : "New here?"}{" "}
          <button className="auth-link" onClick={()=>onSwitch(signup ? "login" : "signup")}>{signup ? "Sign in" : "Create account"}</button>
        </span>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <h2 className="auth-h">{signup ? "Create your account" : "Welcome back"}</h2>
        <p className="auth-p">{signup ? "Start researching your ideal customers in minutes." : "Sign in to pick up where your agent left off."}</p>

        <button type="button" className="gbtn" style={{ marginTop:24 }} onClick={onGoogle}>
          <GoogleG /> Continue with Google
        </button>
        <div className="auth-or">or continue with email</div>

        {signup && <TextField label="Full name" value={name} onChange={setName} placeholder="Alex Greer" err={err.name} autoFocus />}
        <TextField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" err={err.email} autoFocus={!signup} />
        <div style={{ marginBottom:4 }}>
          <TextField label={signup ? "Create password" : "Password"} type="password" value={pw} onChange={setPw} placeholder="••••••••" err={err.pw} />
        </div>
        {!signup && <div style={{ textAlign:"right", marginBottom:8 }}><button type="button" className="auth-link" style={{ fontSize:12.5 }}>Forgot password?</button></div>}

        <Btn kind="primary" size="lg" type="submit" className="btnfull" disabled={loading}
          iconRight={loading ? undefined : "chevRight"} style={{ width:"100%", marginTop:10 }}>
          {loading ? <><Icon name="refresh" size={16} className="spin" /> {signup ? "Creating…" : "Signing in…"}</>
            : signup ? "Create account" : "Sign in"}
        </Btn>

        <p className="auth-meta">
          {signup ? <>By creating an account you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>. SOC 2 Type II · GDPR ready.</>
            : <>Protected by enterprise SSO &amp; SOC 2 Type II controls.</>}
        </p>
      </form>
    </div>
  );
}

/* ---------- Onboarding ---------- */
const OB_ROLES = [
  { key:"founder", icon:"rocket", t:"Founder / CEO", d:"I'm running sales myself for now" },
  { key:"sales_lead", icon:"trend", t:"Sales / Revenue leader", d:"VP Sales, Head of Revenue, CRO" },
  { key:"sdr", icon:"radar", t:"SDR / AE", d:"I do outbound day to day" },
  { key:"revops", icon:"settings", t:"RevOps / Growth", d:"I build the GTM systems" },
];
const OB_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];
const OB_CRMS = [
  { key:"hubspot", t:"HubSpot", letter:"H", color:"#FF7A59" },
  { key:"salesforce", t:"Salesforce", letter:"S", color:"#00A1E0" },
  { key:"pipedrive", t:"Pipedrive", letter:"P", color:"#1A1A1A" },
  { key:"none", t:"No CRM yet", letter:"—", color:"#8A958F" },
];

function Onboarding({ user, onFinish }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    name: user.name || "", role:"", company:"", website:"", size:"", sells:"", crm:"",
  });
  const set = (k,v)=>setD({ ...d, [k]:v });
  const STEPS = 4;

  const canNext = [
    d.name.trim() && d.role,
    d.company.trim() && d.size,
    d.sells.trim().length > 8,
    true,
  ][step];

  const next = () => step < STEPS-1 ? setStep(step+1) : onFinish(d);

  return (
    <div className="ob-host">
      <div className="ob-top">
        <span className="bm"><Icon name="radar" size={18} style={{ color:"#fff" }} /></span>
        <b style={{ fontWeight:680, fontSize:15 }}>OutreachScout</b>
        <div className="ob-steps">{Array.from({length:STEPS}).map((_,i)=><span key={i} className={`ob-dot ${i<=step?"on":""}`} />)}</div>
      </div>

      <div className="ob-card" key={step}>
        {step===0 && <>
          <div className="ob-eyebrow">STEP 1 OF 4 · ABOUT YOU</div>
          <h2 className="ob-h">Welcome{user.name?`, ${user.name.split(" ")[0]}`:""} 👋</h2>
          <p className="ob-sub">We'll tailor the agent to how you sell. First, what's your role?</p>
          <div style={{ marginTop:20 }}>
            <TextField label="Your name" value={d.name} onChange={v=>set("name",v)} placeholder="Alex Greer" autoFocus />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:6 }} className="resp-2">
            {OB_ROLES.map(r=>(
              <button key={r.key} className={`opt-card ${d.role===r.key?"on":""}`} onClick={()=>set("role",r.key)}>
                <span className="oi"><Icon name={r.icon} size={19} /></span>
                <span><span style={{ display:"block", fontWeight:600, fontSize:13.5 }}>{r.t}</span>
                  <span style={{ fontSize:11.5, color:"var(--muted)" }}>{r.d}</span></span>
              </button>
            ))}
          </div>
        </>}

        {step===1 && <>
          <div className="ob-eyebrow">STEP 2 OF 4 · YOUR COMPANY</div>
          <h2 className="ob-h">Tell us about your company</h2>
          <p className="ob-sub">This sets the sender context for every drafted message.</p>
          <div style={{ marginTop:20 }}>
            <TextField label="Company name" value={d.company} onChange={v=>set("company",v)} placeholder="Acme GTM" autoFocus />
            <div className="field" style={{ marginBottom:14 }}>
              <span className="label">Website <span className="opt">· helps the agent learn your offering</span></span>
              <div className="input-affix"><span className="pre">https://</span>
                <input className="input" value={d.website} onChange={e=>set("website",e.target.value)} placeholder="acme.com" /></div>
            </div>
            <div className="field">
              <span className="label">How big is your sales team?</span>
              <div className="seg">{OB_SIZES.map(s=>(
                <button key={s} className={`seg-opt ${d.size===s?"on":""}`} onClick={()=>set("size",s)}>{d.size===s && <Icon name="checkSm" size={14} />}{s}</button>
              ))}</div>
            </div>
          </div>
        </>}

        {step===2 && <>
          <div className="ob-eyebrow">STEP 3 OF 4 · WHAT YOU SELL</div>
          <h2 className="ob-h">What do you help customers achieve?</h2>
          <p className="ob-sub">This becomes your primary value proposition — the agent weaves it into every personalized opener. Be specific about the outcome.</p>
          <div className="field" style={{ marginTop:20 }}>
            <span className="label"><Icon name="sparkle" size={14} style={{ color:"var(--accent)" }} /> Your value proposition</span>
            <textarea className="textarea" rows="4" value={d.sells} autoFocus onChange={e=>set("sells",e.target.value)}
              placeholder="e.g. We build the research + personalization layer so SDRs start every account in a real conversation, not a spreadsheet." />
            <span style={{ fontSize:11.5, color:"var(--faint)" }}>{d.sells.trim().length} characters{d.sells.trim().length<=8 && " · add a little more detail"}</span>
          </div>
        </>}

        {step===3 && <>
          <div className="ob-eyebrow">STEP 4 OF 4 · CONNECT</div>
          <h2 className="ob-h">Where should approved leads go?</h2>
          <p className="ob-sub">Pick your CRM and we'll sync researched accounts and drafts two-way. You can change this later in Settings.</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:20 }} className="resp-2">
            {OB_CRMS.map(c=>(
              <button key={c.key} className={`opt-card ${d.crm===c.key?"on":""}`} onClick={()=>set("crm",c.key)}>
                <span className="oi" style={ d.crm===c.key ? {} : { background:"#fff", border:"1px solid var(--line)", color:c.color, fontWeight:800, fontSize:16 }}>
                  {d.crm===c.key ? <Icon name="checkSm" size={18} /> : c.letter}</span>
                <span style={{ fontWeight:600, fontSize:14 }}>{c.t}</span>
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginTop:16, padding:"12px 14px",
            background:"var(--violet-50)", border:"1px solid var(--violet-200)", borderRadius:12 }}>
            <Icon name="shield" size={16} style={{ color:"var(--accent)", marginTop:1 }} />
            <span style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.5 }}>
              Your data stays yours. We're SOC 2 Type II, GDPR-ready, and auto-purge researched data on a retention window you control.</span>
          </div>
        </>}

        <div className="ob-foot">
          {step>0 && <Btn kind="ghost" icon="arrowLeft" onClick={()=>setStep(step-1)}>Back</Btn>}
          <div style={{ flex:1 }} />
          {step===3 && <Btn kind="subtle" onClick={()=>onFinish(d)}>Skip for now</Btn>}
          <Btn kind="primary" iconRight={step<STEPS-1?"chevRight":"check"} disabled={!canNext} onClick={next}>
            {step<STEPS-1 ? "Continue" : "Launch OutreachScout"}
          </Btn>
        </div>
      </div>
      <p style={{ fontSize:12, color:"var(--faint)", marginTop:18 }}>Step {step+1} of {STEPS} · takes under a minute</p>
    </div>
  );
}

/* ---------- Gate orchestrator ---------- */
function AuthGate({ initialMode = "login", onAuthed, onToast }) {
  const [stage, setStage] = useState(initialMode); // login | signup | onboarding
  const [pending, setPending] = useState(null);    // {name, email, password}

  const finishSignup = async (d) => {
    try {
      await Api.signup({
        name: pending.name, email: pending.email, password: pending.password,
        company: d.company || undefined,
        role: d.role || undefined,
        value_prop: (d.sells || "").trim() || undefined,
        crm_provider: d.crm && d.crm !== "none" ? d.crm : undefined,
      });
      onAuthed(await Api.me());
    } catch (ex) {
      if (onToast) onToast(ex.message || "Sign up failed", "warn");
      setStage("signup");
    }
  };

  if (stage === "onboarding" && pending)
    return <Onboarding user={{ name: pending.name }} onFinish={finishSignup} />;

  return (
    <div className="auth-host">
      <AuthShowcase />
      <AuthForm mode={stage} onSwitch={setStage}
        onGoogle={() => onToast && onToast("Use email sign-in in this demo", "warn")}
        onSuccess={onAuthed}
        onNeedOnboarding={(p) => { setPending(p); setStage("onboarding"); }} />
    </div>
  );
}

Object.assign(window, { AuthGate });
