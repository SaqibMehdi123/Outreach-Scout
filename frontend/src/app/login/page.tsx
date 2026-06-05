"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShowcase } from "@/components/auth-showcase";
import { GoogleButton } from "@/components/google-button";
import { Onboarding, OnboardingData } from "@/components/onboarding";
import { TextField } from "@/components/text-field";
import { Icon } from "@/components/icons";
import { ACCENT_STYLE, Btn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

type Stage = "login" | "signup" | "onboarding";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { loginEmail, signupEmail, googleAuth } = useAuth();
  const [stage, setStage] = useState<Stage>("login");
  const [pending, setPending] = useState<{ name: string; email: string; password: string } | null>(null);

  const done = () => router.replace("/setup");

  const onGoogle = async (idToken: string) => {
    try { await googleAuth(idToken); done(); }
    catch (e) { toast((e as ApiError).message || "Google sign-in failed", "warn"); }
  };

  const finishSignup = async (d: OnboardingData) => {
    if (!pending) return;
    try {
      await signupEmail({
        name: pending.name, email: pending.email, password: pending.password,
        company: d.company || undefined, role: d.role || undefined,
        value_prop: d.sells.trim() || undefined,
        crm_provider: d.crm && d.crm !== "none" ? d.crm : undefined,
      });
      done();
    } catch (e) { toast((e as ApiError).message || "Sign up failed", "warn"); setStage("signup"); }
  };

  if (stage === "onboarding" && pending) {
    return (
      <div className="viewport-host desktop" style={ACCENT_STYLE}>
        <div className="viewport-frame">
          <Onboarding name={pending.name} onFinish={finishSignup} />
        </div>
      </div>
    );
  }

  return (
    <div className="viewport-host desktop" style={ACCENT_STYLE}>
      <div className="viewport-frame">
        <div className="auth-host">
          <AuthShowcase />
          <AuthForm
            mode={stage}
            onSwitch={setStage}
            onGoogle={onGoogle}
            onLogin={async (email, password) => { await loginEmail(email, password); done(); }}
            onNeedOnboarding={(p) => { setPending(p); setStage("onboarding"); }}
          />
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  mode, onSwitch, onGoogle, onLogin, onNeedOnboarding,
}: {
  mode: Stage;
  onSwitch: (s: Stage) => void;
  onGoogle: (idToken: string) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onNeedOnboarding: (p: { name: string; email: string; password: string }) => void;
}) {
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (signup && !name.trim()) er.name = "Enter your name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) er.email = "Enter a valid work email";
    if (pw.length < 6) er.pw = "At least 6 characters";
    setErr(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      if (signup) onNeedOnboarding({ name: name || email.split("@")[0], email, password: pw });
      else await onLogin(email, pw);
    } catch (ex) {
      setErr({ pw: (ex as ApiError).message || (signup ? "Sign up failed" : "Sign in failed") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-panel">
      <div className="auth-panel-top">
        <span className="auth-brand" style={{ gap: 9 }}>
          <span className="bm" style={{ width: 30, height: 30, boxShadow: "none" }}><Icon name="radar" size={17} style={{ color: "#fff" }} /></span>
          <b style={{ color: "var(--ink)", fontWeight: 680 }}>OutreachScout</b>
        </span>
        <span className="sw" style={{ color: "var(--muted)" }}>
          {signup ? "Have an account?" : "New here?"}{" "}
          <button className="auth-link" onClick={() => onSwitch(signup ? "login" : "signup")}>{signup ? "Sign in" : "Create account"}</button>
        </span>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <h2 className="auth-h">{signup ? "Create your account" : "Welcome back"}</h2>
        <p className="auth-p">{signup ? "Start researching your ideal customers in minutes." : "Sign in to pick up where your agent left off."}</p>

        <div style={{ marginTop: 24, marginBottom: 4 }}>
          <GoogleButton onCredential={onGoogle} />
        </div>
        <div className="auth-or">or continue with email</div>

        {signup && <TextField label="Full name" value={name} onChange={setName} placeholder="Alex Greer" err={err.name} autoFocus />}
        <TextField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" err={err.email} autoFocus={!signup} />
        <div style={{ marginBottom: 4 }}>
          <TextField label={signup ? "Create password" : "Password"} type="password" value={pw} onChange={setPw} placeholder="••••••••" err={err.pw} />
        </div>

        <Btn kind="primary" size="lg" type="submit" className="btnfull" disabled={loading}
          iconRight={loading ? undefined : "chevRight"} style={{ width: "100%", marginTop: 10 }}>
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
