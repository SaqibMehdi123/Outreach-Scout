"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Icon, IconName } from "./icons";

interface Toast { id: string; msg: string; icon: IconName }
const ToastCtx = createContext<(msg: string, icon?: IconName) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, icon: IconName = "check") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, msg, icon }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name={t.icon} size={16} style={{ color: "var(--violet-300)" }} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
