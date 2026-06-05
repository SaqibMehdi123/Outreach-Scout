/* Map backend API shapes → the prototype's lead/data shapes the screens expect. */

(function () {
  const COLORS = ["#138A5E", "#C2570C", "#5E9637", "#D98A1F", "#C13E66",
                  "#6E6A5C", "#2E9E63", "#B5721A", "#A8572F"];

  function colorFor(seed) {
    let h = 0;
    for (let i = 0; i < (seed || "").length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return COLORS[Math.abs(h) % COLORS.length];
  }
  function mono(name) {
    return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  // company (API) → lead (prototype). `liveStatus`/`progress` come from SSE.
  function companyToLead(c, opts = {}) {
    const facts = (c.insights && c.insights.facts) || [];
    const signals = (c.insights && c.insights.signals) || [];
    const draft = c.draft || null;
    return {
      id: c.id,
      company: c.name,
      domain: c.domain,
      industry: c.industry || "—",
      size: c.size || "—",
      location: c.location || "—",
      mono: mono(c.name),
      color: colorFor(c.name),
      fit: Math.round(c.fit_score || 0),
      signals: signals.map(s => ({ type: s.type, detail: s.detail || "" })),
      contact: c.contact
        ? { name: c.contact.name || "—", title: c.contact.title || "—",
            linkedin: c.contact.profile_url || "#", email: c.contact.email }
        : { name: "—", title: "—", linkedin: "#" },
      insights: facts.map(f => ({ t: f.text, src: f.source || "", url: f.url || "#" })),
      draft: draft ? draft.message : "",
      draftId: draft ? draft.id : null,
      draftStatus: draft ? draft.status : "pending",
      approved: draft ? draft.status === "approved" : false,
      discarded: draft ? draft.status === "discarded" : false,
      status: opts.status || "done",
      progress: opts.progress != null ? opts.progress : 100,
      revealed: 0,
      fail: false,
      stepData: opts.stepData || [],
    };
  }

  // trace.steps (API) → stepData (prototype agent-activity rows)
  function traceToSteps(trace) {
    if (!trace || !trace.steps) return [];
    return trace.steps
      .filter(s => s.type === "tool" || s.type === "llm")
      .map(s => {
        if (s.type === "tool") {
          return { t: `${s.ok ? "Called" : "Failed"} <b>${s.tool}</b>`,
                   src: s.source || "", fail: !s.ok };
        }
        return { t: s.text || "Reasoning step", src: "" };
      });
  }

  // SSE lead snapshot → minimal row for the live table (pre-completion)
  function snapshotLead(l) {
    return {
      id: l.job_id,
      company: l.company || "Researching…",
      domain: l.domain || "—",
      industry: "—", size: "—", location: "—",
      mono: mono(l.company || "?"), color: colorFor(l.company || l.job_id),
      fit: Math.round(l.fit || 0),
      signals: [], contact: { name: "—", title: "—", linkedin: "#" }, insights: [],
      draft: "", draftId: null, draftStatus: "pending",
      approved: false, discarded: false,
      status: l.status === "researching" ? "researching" : l.status,
      progress: l.progress || 0, revealed: 0,
      fail: l.status === "failed", stepData: [],
    };
  }

  window.Mappers = { companyToLead, traceToSteps, snapshotLead, colorFor, mono };
})();
