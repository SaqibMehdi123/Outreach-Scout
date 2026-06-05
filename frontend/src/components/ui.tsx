import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { Icon, IconName } from "./icons";

type BtnKind = "primary" | "ghost" | "subtle" | "danger";

export function Btn({
  kind = "ghost",
  size,
  icon,
  iconRight,
  children,
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: BtnKind;
  size?: "sm" | "lg";
  icon?: IconName;
  iconRight?: IconName;
}) {
  const cls = `btn btn-${kind} ${size === "lg" ? "btn-lg" : ""} ${
    size === "sm" ? "btn-sm" : ""
  } ${!children ? "btn-icon" : ""} ${className}`;
  return (
    <button className={cls} {...p}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 16} />}
    </button>
  );
}

const COLORS = ["#138A5E", "#C2570C", "#5E9637", "#D98A1F", "#C13E66", "#6E6A5C", "#2E9E63", "#B5721A", "#A8572F"];
export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
export function initials(name: string | null | undefined): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function Logo({ name, color, size = 34 }: { name: string; color?: string; size?: number }) {
  return (
    <div className="logo" style={{ background: color || colorFor(name), width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  );
}

export function Avatar({ name, color = "var(--violet-400)", size = 30 }: { name: string | null; color?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 99, background: color, color: "#102019", display: "grid", placeItems: "center", fontWeight: 650, fontSize: size * 0.38, flex: "none" }}>
      {initials(name)}
    </div>
  );
}

const SIG_LABEL: Record<string, string> = {
  funded: "Recently funded", hiring: "Hiring SDRs", launch: "New product",
  exec: "New exec hire", tech: "Tech match",
};
const SIG_CLS: Record<string, string> = { funded: "funded", hiring: "hiring", launch: "launch", exec: "exec", tech: "tech" };
export function SignalChip({ type, label }: { type: string; label?: string }) {
  return <span className={`chip ${SIG_CLS[type] || "tech"}`}><span className="gem" />{label || SIG_LABEL[type] || type}</span>;
}
export function signalLabel(type: string) { return SIG_LABEL[type] || type; }

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { queued: "Queued", researching: "Researching", done: "Done", failed: "Failed" };
  return <span className={`status ${status}`}><span className="led" />{map[status] || status}</span>;
}

export function FitScore({ value, size = 34 }: { value: number | null; size?: number }) {
  if (!value) return <span style={{ color: "var(--faint)", fontSize: 13 }}>—</span>;
  const color = value >= 85 ? "var(--green-600)" : value >= 75 ? "var(--violet-600)" : value >= 65 ? "var(--amber-600)" : "var(--faint)";
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <span className="fit">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <span className="fit-num" style={{ color }}>{value}</span>
    </span>
  );
}

export function Progress({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return <div className={`prog ${indeterminate ? "indet" : ""}`}><span style={{ width: (value || 0) + "%" }} /></div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 40, height: 23, borderRadius: 99, border: "none", padding: 2, transition: "background .18s", background: on ? "var(--accent)" : "var(--surface-3)", display: "inline-flex", alignItems: "center" }}>
      <span style={{ width: 19, height: 19, borderRadius: 99, background: "#fff", boxShadow: "var(--sh-sm)", transform: on ? "translateX(17px)" : "translateX(0)", transition: "transform .18s" }} />
    </button>
  );
}

export const ACCENT_STYLE: CSSProperties = {
  // Default accent theme applied at the app root.
  ["--accent" as string]: "#11815A",
  ["--accent-2" as string]: "color-mix(in oklab, #11815A, white 20%)",
  ["--accent-grad" as string]: "linear-gradient(135deg, color-mix(in oklab, #11815A, white 16%) 0%, #11815A 55%, color-mix(in oklab, #11815A, black 20%) 100%)",
  ["--density" as string]: 1,
  ["--motion" as string]: 1,
  ["--ff" as string]: '"Geist", system-ui, sans-serif',
};
