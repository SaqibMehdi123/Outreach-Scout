"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Renders the official Google Sign-In button. On success it hands the ID token
 * to ``onCredential`` (which exchanges it at the backend). Hidden when no client
 * ID is configured.
 */
export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !CLIENT_ID || !window.google || !ref.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (resp: { credential: string }) => onCredential(resp.credential),
    });
    window.google.accounts.id.renderButton(ref.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill", // capsule — rendered natively by Google
      text: "continue_with",
      logo_alignment: "center", // logo sits next to the text, both centered together
      width: 320,
    });
  }, [ready, onCredential]);

  if (!CLIENT_ID) {
    return (
      <div className="auth-or" style={{ fontSize: 11.5 }}>
        Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in
      </div>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" onLoad={() => setReady(true)} />
      {/* Google renders the capsule (pill) shape itself via shape:"pill", so no CSS
          clipping is needed. inline-flex just lets the wrapper hug + center the button. */}
      <div style={{ display: "flex", justifyContent: "center", minHeight: 44 }}>
        <div ref={ref} style={{ display: "inline-flex" }} />
      </div>
    </>
  );
}
