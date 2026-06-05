"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";
import type { MeResponse } from "./types";

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  signupEmail: (data: Record<string, unknown>) => Promise<void>;
  googleAuth: (idToken: string, onboarding?: Record<string, unknown>) => Promise<boolean>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await api.me());
    } catch {
      tokenStore.set(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    tokenStore.set(r.access_token);
    setMe(await api.me());
  }, []);

  const signupEmail = useCallback(async (data: Record<string, unknown>) => {
    const r = await api.signup(data);
    tokenStore.set(r.access_token);
    setMe(await api.me());
  }, []);

  const googleAuth = useCallback(async (idToken: string, onboarding?: Record<string, unknown>) => {
    const r = await api.google(idToken, onboarding);
    tokenStore.set(r.access_token);
    setMe(await api.me());
    return !!r.is_new;
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setMe(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ me, loading, refresh, loginEmail, signupEmail, googleAuth, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
