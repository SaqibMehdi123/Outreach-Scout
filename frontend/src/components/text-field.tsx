"use client";

import { useState } from "react";
import { Icon } from "./icons";

export function TextField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  err,
  autoFocus,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  err?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <span className="label">{label}</span>
      <div className="pw-wrap">
        <input
          className="input"
          type={isPw && show ? "text" : type}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ borderColor: err ? "var(--red-200)" : undefined, paddingRight: isPw ? 38 : undefined }}
        />
        {isPw && (
          <button className="eye" type="button" onClick={() => setShow(!show)} tabIndex={-1}>
            <Icon name={show ? "eyeOff" : "eye"} size={16} />
          </button>
        )}
      </div>
      {err && <span className="field-err">{err}</span>}
    </div>
  );
}
