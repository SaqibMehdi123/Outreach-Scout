/* Seed data for the Outbound Research Agent prototype.
   Scenario: a founder-led B2B SaaS sales team prospecting other B2B SaaS companies. */
(function () {
  const C = {
    violet: "#138A5E", indigo:"#C2570C", teal:"#5E9637", amber:"#D98A1F",
    rose:"#C13E66", slate:"#6E6A5C", green:"#2E9E63", blue:"#B5721A", plum:"#A8572F"
  };

  // signal type -> chip class + dot
  const SIG = {
    funded: { cls:"funded", label:"Recently funded" },
    hiring: { cls:"hiring", label:"Hiring SDRs" },
    launch: { cls:"launch", label:"New product" },
    exec:   { cls:"exec",   label:"New exec hire" },
    tech:   { cls:"tech",   label:"Tech match" },
  };

  function steps(l) {
    const s = [];
    s.push({ t:`Crawling <b>${l.domain}</b> — company profile & positioning` });
    s.push({ t:`Classifying as <b>${l.industry}</b> · ${l.size} employees · ${l.location}`});
    l.signals.forEach(sg => {
      if (sg.type === "funded") s.push({ t:`Signal confirmed: <b>${sg.detail}</b>`, src:"Crunchbase" });
      else if (sg.type === "hiring") s.push({ t:`Found <b>${sg.detail}</b> open on careers page`, src:"Greenhouse" });
      else if (sg.type === "launch") s.push({ t:`Detected <b>${sg.detail}</b>`, src:"Product Hunt" });
      else if (sg.type === "exec") s.push({ t:`Org change: <b>${sg.detail}</b>`, src:"LinkedIn" });
    });
    s.push({ t:`Mapping buying committee for ${l.industry}` });
    s.push({ t:`Identified decision-maker: <b>${l.contact.name}</b>, ${l.contact.title}`, src:"LinkedIn" });
    s.push({ t:`Verified work email · deliverability 98%`, src:"Hunter" });
    s.push({ t:`Scoring ICP fit across 9 dimensions → <b>${l.fit}</b>` });
    s.push({ t:`Drafting personalized opener referencing ${l.draftRef}` });
    return s;
  }

  let leads = [
    {
      company:"Northwind Analytics", domain:"northwind.io", mono:"NA", color:C.indigo,
      industry:"Data Observability", size:"120", location:"Austin, TX",
      signals:[{type:"funded",detail:"$24M Series B led by Redpoint"},{type:"hiring",detail:"2 SDR roles"}],
      contact:{ name:"Dana Whitford", title:"VP Sales", linkedin:"in/danawhitford" },
      fit:94, draftRef:"their Series B & SDR expansion",
      insights:[
        { t:"Closed a $24M Series B in March 2026 — explicitly earmarked for go-to-market expansion.", src:"TechCrunch", url:"#" },
        { t:"Posting 2 SDR and 1 AE role this quarter, signalling an outbound build-out.", src:"Greenhouse", url:"#" },
        { t:"Migrated to a usage-based pricing model; sales motion is shifting to PLG-assisted outbound.", src:"Northwind blog", url:"#" },
      ],
      draft:"Hi Dana — congrats on the $24M raise. With the new SDR hires ramping, the gap most teams hit is giving reps qualified, well-researched accounts on day one. We auto-build the research layer so your new SDRs book meetings in week two, not month two. Worth 15 minutes next week?"
    },
    {
      company:"Cobalt Labs", domain:"cobalt.dev", mono:"CL", color:C.violet,
      industry:"Developer Tooling", size:"85", location:"Remote (US)",
      signals:[{type:"launch",detail:"Cobalt CI v2 launch"},{type:"hiring",detail:"3 SDR roles"}],
      contact:{ name:"Marcus Lee", title:"Head of Revenue", linkedin:"in/marcuslee" },
      fit:91, draftRef:"their CI v2 launch",
      insights:[
        { t:"Launched Cobalt CI v2 last week — #2 Product of the Day on Product Hunt.", src:"Product Hunt", url:"#" },
        { t:"Self-serve heavy; only recently stood up a dedicated revenue function.", src:"LinkedIn", url:"#" },
        { t:"Founder publicly posting about moving up-market to enterprise dev teams.", src:"X / Twitter", url:"#" },
      ],
      draft:"Hi Marcus — saw Cobalt CI v2 hit #2 on Product Hunt, nice launch. Moving up-market usually means outbound to eng leaders who never self-serve. We research and personalize at the account level so your first SDRs aren't guessing. Open to a quick look?"
    },
    {
      company:"Verdant Health", domain:"verdanthealth.com", mono:"VH", color:C.teal,
      industry:"Healthtech SaaS", size:"160", location:"Boston, MA",
      signals:[{type:"funded",detail:"$40M Series B"},{type:"exec",detail:"New CRO from Veeva"}],
      contact:{ name:"Priya Nair", title:"Chief Revenue Officer", linkedin:"in/priyanair" },
      fit:88, draftRef:"her recent CRO move & GTM rebuild",
      insights:[
        { t:"Hired a new CRO from Veeva in February — typically signals a GTM rebuild within 90 days.", src:"LinkedIn", url:"#" },
        { t:"Raised $40M Series B; expanding from provider sales into payer accounts.", src:"Fierce Healthcare", url:"#" },
        { t:"HIPAA-sensitive vertical — research accuracy and compliance matter to this buyer.", src:"Verdant security page", url:"#" },
      ],
      draft:"Hi Priya — congrats on the CRO seat at Verdant. New GTM leaders usually inherit a rep team that needs faster, cleaner account research, especially moving into payer accounts. We handle that layer end-to-end, compliantly. Could I share how a similar healthtech team ramped outbound in 30 days?"
    },
    {
      company:"Lumen Freight", domain:"lumenfreight.com", mono:"LF", color:C.amber,
      industry:"Logistics SaaS", size:"140", location:"Chicago, IL",
      signals:[{type:"hiring",detail:"4 SDR roles"},{type:"tech",detail:"Uses Salesforce + Outreach"}],
      contact:{ name:"Tom Becker", title:"VP Sales", linkedin:"in/tombecker" },
      fit:83, draftRef:"their SDR team scaling",
      insights:[
        { t:"Scaling the SDR team from 6 to 10 — actively interviewing now.", src:"Greenhouse", url:"#" },
        { t:"Runs Salesforce + Outreach; we sync natively into both.", src:"BuiltWith", url:"#" },
        { t:"Mid-market logistics buyers are fragmented — research per account is high-effort manually.", src:"Industry report", url:"#" },
      ],
      draft:"Hi Tom — as you scale the SDR team to 10, the bottleneck becomes account research, not dialing. We plug into your Salesforce + Outreach stack and hand reps fully-researched accounts. Happy to run a free batch on 25 of your target accounts so you can judge the quality?"
    },
    {
      company:"Parsec Security", domain:"parsec.security", mono:"PS", color:C.slate,
      industry:"Cybersecurity", size:"95", location:"Seattle, WA",
      signals:[{type:"funded",detail:"$18M Series A"},{type:"launch",detail:"Threat graph GA"}],
      contact:{ name:"Elena Ruiz", title:"VP Marketing & Growth", linkedin:"in/elenaruiz" },
      fit:80, draftRef:"their threat-graph GA",
      insights:[
        { t:"Threat-graph product hit general availability; pivoting from design partners to scaled sales.", src:"Parsec blog", url:"#" },
        { t:"$18M Series A in January; small but well-funded GTM team.", src:"Crunchbase", url:"#" },
        { t:"Security buyers are skeptical of generic outreach — personalization is non-negotiable here.", src:"LinkedIn", url:"#" },
      ],
      draft:"Hi Elena — congrats on taking the threat graph to GA. Selling security means personalization isn't optional; buyers smell a template instantly. We research each CISO account deeply so first touches actually land. Worth comparing notes?"
    },
    {
      company:"Tidal Commerce", domain:"tidalcommerce.com", mono:"TC", color:C.blue,
      industry:"Ecommerce Infra", size:"110", location:"New York, NY",
      signals:[{type:"funded",detail:"$30M Series B"},{type:"hiring",detail:"2 SDR roles"}],
      contact:{ name:"Jordan Pak", title:"Director of Sales Dev", linkedin:"in/jordanpak" },
      fit:86, draftRef:"their post-raise SDR ramp",
      insights:[
        { t:"$30M Series B closed in April; building out a dedicated SDR org for the first time.", src:"TechCrunch", url:"#" },
        { t:"Targets DTC brands $5M–$50M GMV — a high-volume, research-heavy segment.", src:"Tidal site", url:"#" },
        { t:"Director of Sales Dev is a brand-new role, hired 6 weeks ago.", src:"LinkedIn", url:"#" },
      ],
      draft:"Hi Jordan — congrats on the new role and the raise. Standing up an SDR org from zero, the fastest win is removing manual research so reps start in conversations, not spreadsheets. We can pre-build your first 200 accounts. Open to seeing a sample this week?"
    },
    {
      company:"Mosaic HR", domain:"mosaichr.com", mono:"MH", color:C.plum,
      industry:"People Ops SaaS", size:"75", location:"Denver, CO",
      signals:[{type:"hiring",detail:"1 SDR role"},{type:"exec",detail:"New VP Sales"}],
      contact:{ name:"Sara Coleman", title:"VP Sales", linkedin:"in/saracoleman" },
      fit:78, draftRef:"her new VP Sales mandate",
      insights:[
        { t:"New VP Sales started 5 weeks ago, came from a top HR-tech competitor.", src:"LinkedIn", url:"#" },
        { t:"Small team; outbound is currently founder-led and ad hoc.", src:"Inferred", url:"#" },
        { t:"Mid-market HR buyers respond well to peer references and benchmarks.", src:"Industry report", url:"#" },
      ],
      draft:"Hi Sara — congrats on the VP Sales role at Mosaic. Early on, the highest-leverage move is systematizing account research so your first SDR scales beyond founder hustle. We build that layer. Could I send over a few sample accounts in your ICP?"
    },
    {
      company:"Beacon Finance", domain:"beaconfin.com", mono:"BF", color:C.green,
      industry:"Fintech / Treasury", size:"180", location:"San Francisco, CA",
      signals:[{type:"funded",detail:"$55M Series C"},{type:"tech",detail:"Uses HubSpot"}],
      contact:{ name:"Will Foster", title:"VP Revenue", linkedin:"in/willfoster" },
      fit:85, draftRef:"their Series C expansion",
      insights:[
        { t:"$55M Series C in March; aggressively expanding enterprise sales.", src:"Forbes", url:"#" },
        { t:"Runs HubSpot — we sync enriched accounts and drafts directly in.", src:"BuiltWith", url:"#" },
        { t:"Treasury buyers (CFO/Treasurer) require precise, numbers-led messaging.", src:"LinkedIn", url:"#" },
      ],
      draft:"Hi Will — congrats on the Series C. Selling treasury to CFOs, the difference is research depth: knowing their cash position, banking stack, and triggers. We assemble that per account and draft a numbers-led opener. Worth a 15-minute look?"
    },
    {
      company:"Quanta Robotics", domain:"quanta.so", mono:"QR", color:C.indigo,
      industry:"Industrial Automation", size:"130", location:"Pittsburgh, PA",
      signals:[{type:"launch",detail:"Fleet OS v3"},{type:"hiring",detail:"2 SDR roles"}],
      contact:{ name:"Ana Sørensen", title:"Head of Sales", linkedin:"in/anasorensen" },
      fit:74, draftRef:"their Fleet OS v3 launch",
      insights:[
        { t:"Launched Fleet OS v3 aimed at mid-size warehouses — new buyer persona to reach.", src:"Quanta blog", url:"#" },
        { t:"Long, technical sales cycle; research depth shortens discovery.", src:"Inferred", url:"#" },
      ],
      draft:"Hi Ana — Fleet OS v3 opens up a new mid-size warehouse buyer. Reaching ops leaders in that segment takes real account research to earn the first call. We can build and personalize that pipeline for your SDRs. Interested in a sample run?"
    },
    {
      company:"Drift Maps", domain:"driftmaps.com", mono:"DM", color:C.teal,
      industry:"Geospatial SaaS", size:"60", location:"Remote (US/CA)",
      signals:[{type:"funded",detail:"$12M Series A"}],
      contact:{ name:"Kevin Adler", title:"Co-founder & CEO", linkedin:"in/kevinadler" },
      fit:71, draftRef:"their early GTM stage",
      insights:[
        { t:"$12M Series A in Feb; founder still owns sales personally.", src:"Crunchbase", url:"#" },
        { t:"Pre-SDR — best fit is when they make their first sales-dev hire.", src:"Inferred", url:"#" },
      ],
      draft:"Hi Kevin — congrats on the Series A. When you make that first sales-dev hire, the research layer is what lets them ramp fast instead of flailing. Happy to be a resource when you get there — and to show you what good looks like now."
    },
    {
      company:"Stealth (TBD)", domain:"—", mono:"?", color:C.slate,
      industry:"Unknown", size:"—", location:"—",
      signals:[{type:"funded",detail:"Rumored raise"}],
      contact:{ name:"—", title:"—", linkedin:"#" },
      fit:0, draftRef:"",
      insights:[],
      draft:"", failNote:"Domain unreachable — company is in stealth with no public footprint. Skipped to avoid low-confidence data."
    },
  ];

  // assign ids, status, steps, progress
  leads = leads.map((l, i) => ({
    id: "L" + (i + 1),
    ...l,
    status: "queued",
    progress: 0,
    approved: false,
    discarded: false,
    stepData: l.failNote ? [{t:"Crawling <b>"+l.domain+"</b> — resolving company"},{t:l.failNote, fail:true}] : steps(l),
    fail: !!l.failNote,
  }));

  window.SEED = {
    leads,
    SIG,
    icp: {
      industries: ["B2B SaaS"],
      sizeMin: 50, sizeMax: 250,
      roles: ["VP Sales", "Head of Revenue", "Director of Sales Development"],
      geos: ["United States", "Canada"],
      signals: ["funded", "hiring", "launch"],
      targetCount: 50,
      valueProp: "We build the research + personalization layer so SDRs start every account in a real conversation, not a spreadsheet.",
    },
    sources: [
      { name:"LinkedIn Sales Navigator", status:"connected", detail:"OAuth · 14,200 credits", icon:"linkedin" },
      { name:"Crunchbase", status:"connected", detail:"API key · funding & firmographics", icon:"cb" },
      { name:"Hunter.io", status:"connected", detail:"Email verification · 98% deliverability", icon:"mail" },
      { name:"Greenhouse / job boards", status:"connected", detail:"Hiring-signal crawler", icon:"job" },
      { name:"Product Hunt", status:"degraded", detail:"Rate limited — retrying", icon:"ph" },
      { name:"BuiltWith", status:"disconnected", detail:"Tech-stack detection", icon:"tech" },
    ],
    crm: { name:"HubSpot", status:"connected", detail:"Workspace: Acme GTM · 2-way sync" },
  };
})();
