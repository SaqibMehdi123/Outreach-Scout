"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, IconName } from "@/components/icons";
import { ACCENT_STYLE, Btn, initials } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { DashboardProvider, useDashboard } from "@/lib/dashboard";

const NAV: { href: string; label: string; icon: IconName; key: string }[] = [
  { href: "/setup", label: "New campaign", icon: "target", key: "setup" },
  { href: "/live", label: "Live research", icon: "radar", key: "live" },
  { href: "/review", label: "Review & export", icon: "list", key: "review" },
  { href: "/settings", label: "Settings", icon: "settings", key: "settings" },
];
const ROLE_LABEL: Record<string, string> = { founder: "Founder", sales_lead: "Sales leader", sdr: "SDR / AE", revops: "RevOps" };
const TITLES: Record<string, string> = { setup: "New campaign", live: "Live research", review: "Review & export", settings: "Settings" };

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [me, loading, router]);

  if (loading || !me) return <div className="viewport-host desktop" style={ACCENT_STYLE} />;

  return (
    <DashboardProvider>
      <Shell>{children}</Shell>
    </DashboardProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const { stats, running, launched, leads } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const active = (NAV.find((n) => pathname.startsWith(n.href))?.key) || "setup";
  const title = TITLES[active];
  const navBadge: Record<string, number | null> = {
    live: running ? stats.researching || null : stats.done || null,
    review: leads.filter((l) => l.approved).length || null,
  };

  const signOut = () => { logout(); router.replace("/login"); };
  const user = me!.user;

  return (
    <div className="viewport-host desktop" style={ACCENT_STYLE}>
      <div className="viewport-frame">
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-mark"><Icon name="radar" size={19} style={{ color: "#fff" }} /></div>
              <div>
                <div className="brand-name">Outreach<span style={{ color: "var(--violet-300)" }}>Scout</span></div>
                <div className="brand-sub">Outbound research agent</div>
              </div>
            </div>
            <nav className="nav">
              <div className="nav-label">Workspace</div>
              {NAV.map((n) => (
                <Link key={n.key} href={n.href} className={`nav-item ${active === n.key ? "active" : ""}`}>
                  <Icon name={n.icon} size={18} className="ico" />{n.label}
                  {navBadge[n.key] && <span className="nav-badge">{navBadge[n.key]}</span>}
                </Link>
              ))}
            </nav>
            <div className="side-foot">
              {launched && (
                <div className="run-pill" style={{ marginBottom: 12 }}>
                  <span className="dot" style={{ background: running ? "var(--violet-400)" : "var(--green-200)", animation: running ? "pulseLed 1.3s infinite" : "none" }} />
                  <div style={{ lineHeight: 1.25 }}>
                    <div className="t">{running ? "Researching…" : "Run complete"}</div>
                    <div className="s">{stats.done}/{leads.length || 0} done · {stats.avgFit || "—"} avg fit</div>
                  </div>
                </div>
              )}
              <div className="user-row">
                <div className="user-av">{initials(user.name)}</div>
                <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "You"}</div>
                  <div style={{ fontSize: 11, color: "#94A89E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {me!.org.name}{user.role && ` · ${ROLE_LABEL[user.role] || ""}`}
                  </div>
                </div>
                <button onClick={signOut} title="Sign out"
                  style={{ border: "none", background: "transparent", color: "#94A89E", padding: 6, borderRadius: 8, display: "grid", placeItems: "center" }}>
                  <Icon name="external" size={15} />
                </button>
              </div>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              <div className="crumb hide-compact"><span>OutreachScout</span><Icon name="chevRight" size={13} /><b>{title}</b></div>
              <div className="spacer" />
              {active !== "setup" && (
                <Btn kind="ghost" size="sm" icon="plus" className="hide-compact" onClick={() => router.push("/setup")}>New</Btn>
              )}
            </header>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
