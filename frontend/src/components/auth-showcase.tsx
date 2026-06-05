import { Icon } from "./icons";

export function AuthShowcase() {
  return (
    <div className="auth-show">
      <div className="auth-grid-deco" />
      <div className="auth-brand">
        <span className="bm"><Icon name="radar" size={22} style={{ color: "#fff" }} /></span>
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
      <p className="auth-quote">&ldquo;We replaced three hours of manual research per rep, per day.&rdquo; — Head of Sales, Series B SaaS</p>
    </div>
  );
}
