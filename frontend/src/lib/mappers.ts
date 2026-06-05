import { colorFor, initials } from "@/components/ui";
import type { ApiCompany, CompanyDetail, StreamSnapshot } from "./types";

export interface Lead {
  id: string;
  company: string;
  domain: string;
  industry: string;
  size: string;
  location: string;
  mono: string;
  color: string;
  fit: number;
  signals: { type: string; detail: string }[];
  contact: { name: string; title: string; linkedin: string; email?: string | null };
  insights: { t: string; src: string; url: string }[];
  draft: string;
  draftId: string | null;
  draftStatus: string;
  approved: boolean;
  discarded: boolean;
  status: string;
  progress: number;
  fail: boolean;
  stepData: { t: string; src?: string; fail?: boolean }[];
}

export function companyToLead(c: ApiCompany, opts: Partial<Lead> = {}): Lead {
  const facts = c.insights?.facts || [];
  const signals = c.insights?.signals || [];
  const draft = c.draft;
  return {
    id: c.id,
    company: c.name,
    domain: c.domain,
    industry: c.industry || "—",
    size: c.size || "—",
    location: c.location || "—",
    mono: initials(c.name),
    color: colorFor(c.name),
    fit: Math.round(c.fit_score || 0),
    signals: signals.map((s) => ({ type: s.type, detail: s.detail || "" })),
    contact: c.contact
      ? { name: c.contact.name || "—", title: c.contact.title || "—", linkedin: c.contact.profile_url || "#", email: c.contact.email }
      : { name: "—", title: "—", linkedin: "#" },
    insights: facts.map((f) => ({ t: f.text, src: f.source || "", url: f.url || "#" })),
    draft: draft ? draft.message : "",
    draftId: draft ? draft.id : null,
    draftStatus: draft ? draft.status : "pending",
    approved: draft ? draft.status === "approved" : false,
    discarded: draft ? draft.status === "discarded" : false,
    status: "done",
    progress: 100,
    fail: false,
    stepData: [],
    ...opts,
  };
}

export function snapshotLead(l: StreamSnapshot["leads"][number]): Lead {
  return {
    id: l.job_id,
    company: l.company || "Researching…",
    domain: l.domain || "—",
    industry: "—",
    size: "—",
    location: "—",
    mono: initials(l.company || "?"),
    color: colorFor(l.company || l.job_id),
    fit: Math.round(l.fit || 0),
    signals: [],
    contact: { name: "—", title: "—", linkedin: "#" },
    insights: [],
    draft: "",
    draftId: null,
    draftStatus: "pending",
    approved: false,
    discarded: false,
    status: l.status === "researching" ? "researching" : l.status,
    progress: l.progress || 0,
    fail: l.status === "failed",
    stepData: [],
  };
}

export function traceToSteps(trace: CompanyDetail["trace"]): Lead["stepData"] {
  if (!trace || !trace.steps) return [];
  return trace.steps
    .filter((s) => s.type === "tool" || s.type === "llm")
    .map((s) =>
      s.type === "tool"
        ? { t: `${s.ok ? "Called" : "Failed"} <b>${s.tool}</b>`, src: s.source || "", fail: !s.ok }
        : { t: s.text || "Reasoning step", src: "" }
    );
}
