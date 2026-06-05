/* Shared UI: icons, primitives. Exported to window for other babel scripts. */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icon set (stroke, currentColor) ---------- */
const PATHS = {
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor" stroke="none"/>',
  radar: '<path d="M12 4a8 8 0 1 0 8 8"/><path d="M12 12 19 7"/><path d="M12 12a4 4 0 1 0 4 4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkSm: '<path d="M5 12l4 4L19 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 13 7 5h10l2 8v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 11a8 8 0 0 1 8-8c2 0 3 1 3 3a8 8 0 0 1-8 8l-3-3z"/><circle cx="14.5" cy="9.5" r="1.4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 6 8.3l-.4-.4a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 5.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V11a2 2 0 1 1 0 4z"/>',
  chevDown:'<path d="m6 9 6 6 6-6"/>',
  chevRight:'<path d="m9 6 6 6-6 6"/>',
  arrowLeft:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  external:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 9h3a2 2 0 0 1 2 2v10"/><path d="M8 7h3M8 11h3M8 15h3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
  trash:'<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  sync:'<path d="M4 4v5h5M20 20v-5h-5"/><path d="M20 9a8 8 0 0 0-14-3L4 9M4 15a8 8 0 0 0 14 3l2-3"/>',
  warn:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  shield:'<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  database:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  desktop:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  tablet:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  plug:'<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  trend:'<path d="M3 17l6-6 4 4 7-7"/><path d="M21 8v4h-4"/>',
  flag:'<path d="M4 21V4M4 4h11l-2 4 2 4H4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M3 5h18l-7 8v5l-4 2v-7z"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3"/><path d="M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.9-.8"/>',
};
function Icon({ name, size = 18, sw = 1.7, style, className }) {
  return (
    <svg className={(className||"") + " ico"} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={style} dangerouslySetInnerHTML={{ __html: PATHS[name] || "" }} />
  );
}

/* ---------- primitives ---------- */
function Btn({ kind = "ghost", size, icon, iconRight, children, className = "", ...p }) {
  const cls = `btn btn-${kind} ${size === "lg" ? "btn-lg" : ""} ${size === "sm" ? "btn-sm" : ""} ${!children ? "btn-icon" : ""} ${className}`;
  return (
    <button className={cls} {...p}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 16} />}
    </button>
  );
}

function Logo({ lead, size = 34 }) {
  return <div className="logo" style={{ background: lead.color, width: size, height: size, fontSize: size*0.38 }}>{lead.mono}</div>;
}

function SignalChip({ type, label }) {
  const meta = SEED.SIG[type] || SEED.SIG.tech;
  return <span className={`chip ${meta.cls}`}><span className="gem" />{label || meta.label}</span>;
}

function StatusBadge({ status }) {
  const map = { queued:"Queued", researching:"Researching", done:"Done", failed:"Failed" };
  return <span className={`status ${status}`}><span className="led" />{map[status]}</span>;
}

function FitScore({ value, size = 34 }) {
  if (!value) return <span style={{ color:"var(--faint)", fontSize:13 }}>—</span>;
  const color = value >= 85 ? "var(--green-600)" : value >= 75 ? "var(--violet-600)" : value >= 65 ? "var(--amber-600)" : "var(--faint)";
  const r = (size-5)/2, c = 2*Math.PI*r, off = c*(1 - value/100);
  return (
    <span className="fit">
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3.5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition:"stroke-dashoffset .6s ease" }} />
      </svg>
      <span className="fit-num" style={{ color }}>{value}</span>
    </span>
  );
}

function Progress({ value, indeterminate }) {
  return <div className={`prog ${indeterminate ? "indet":""}`}><span style={{ width: (value||0)+"%" }} /></div>;
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width:40, height:23, borderRadius:99, border:"none", padding:2, transition:"background .18s",
        background: on ? "var(--accent)" : "var(--surface-3)", display:"inline-flex", alignItems:"center" }}>
      <span style={{ width:19, height:19, borderRadius:99, background:"#fff", boxShadow:"var(--sh-sm)",
        transform: on ? "translateX(17px)":"translateX(0)", transition:"transform .18s" }} />
    </button>
  );
}

function Avatar({ name, color = "var(--violet-400)", size = 30 }) {
  const initials = (name||"?").split(" ").map(w=>w[0]).slice(0,2).join("");
  return <div style={{ width:size, height:size, borderRadius:99, background:color, color:"#102019",
    display:"grid", placeItems:"center", fontWeight:650, fontSize:size*0.38, flex:"none" }}>{initials}</div>;
}

Object.assign(window, { Icon, Btn, Logo, SignalChip, StatusBadge, FitScore, Progress, Toggle, Avatar,
  useState, useEffect, useRef, useMemo, useCallback });
