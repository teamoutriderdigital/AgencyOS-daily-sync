import type { RockType, Tables } from "./database.types";

export type Rock = Tables<"rocks">;
export type RockKv = Tables<"rock_meeting_kv">;

// The rocks roster is wider than the daily team_member enum (adds Darko and
// Mostafa), so rock owners are free text drawn from this list.
export const ROCK_OWNERS = ["Jack", "Daniel", "Darko", "Leo", "Rehan", "Kas", "Mostafa"];

export const ROCK_TYPES: RockType[] = ["company", "individual"];

export const QUARTER = "Q3 2026";
export const MEETING_DATE = "Thursday 2 July 2026";

// ─── Run of show ────────────────────────────────────────────────────────────
// Numbered because meeting order carries real dependency: 7–8 can't start until
// cadence (1) and sequencing (6) are locked.

export const RUN_OF_SHOW = [
  {
    n: 1,
    title: "Sprint cadence — decide, don't re-debate.",
    detail: "Weekly-miss-→-weekend vs Leo's 2–3 wk deliverable-tied. Gates every deadline.",
    box: "5 min"
  },
  {
    n: 2,
    title: "Ratify the quarter shape.",
    detail: "H1 = internal ops · H2 = sales/growth. Consensus exists — just ratify.",
    box: "3 min"
  },
  {
    n: 3,
    title: "Lock rock owners — one name each.",
    detail: "Resolve the collisions first. No co-ownership.",
    box: "10 min"
  },
  {
    n: 4,
    title: "Darko's rocks.",
    detail: "SEO in the site workflow · internal-site ranking · compliance playbooks. Get his input before locking.",
    box: "5 min"
  },
  {
    n: 5,
    title: "Define “done” per rock — one sentence.",
    detail:
      "Kas's bar: “Jack can run 90% of the audit and generate strategy, report, proposal draft.” Or it's unfalsifiable.",
    box: "15 min"
  },
  {
    n: 6,
    title: "Sequence the dependencies.",
    detail: "Map what unblocks what before dating anything. (Leo: data governance first.)",
    box: "10 min"
  },
  {
    n: 7,
    title: "Assign deadlines per sprint.",
    detail: "Only after 1 and 6.",
    box: "10 min"
  },
  {
    n: 8,
    title: "This-week immediates + daily rhythm.",
    detail: "Rehan's click task · Kas's PRD · book the audit-pattern session · Kas+Daniel pre-sync · daily log.",
    box: "7 min"
  }
] as const;

// ─── The four decisions to lock ─────────────────────────────────────────────

export type DecisionSpec = {
  key: string;
  n: number;
  title: string;
  frame: string;
  options: { k: string; label: string }[];
  recommend: string;
  lockLabel: string;
  placeholder: string;
};

export const DECISIONS: DecisionSpec[] = [
  {
    key: "decision:cadence",
    n: 1,
    title: "Sprint cadence",
    frame:
      "Unresolved yesterday. Gates every single deadline — nothing else in the meeting can start until this is picked.",
    options: [
      { k: "Option A", label: "Every week is a sprint · miss it → weekend work" },
      { k: "Option B — Leo", label: "2–3 wk sprint tied to one defined deliverable · reflect at the end" }
    ],
    recommend:
      "Leo's B for rock-scale work (deliverable-tied, reflect at close) with a weekly heartbeat for immediates. Rocks are quarter-sized — weekly-miss-punishment doesn't fit them.",
    lockLabel: "Locked cadence",
    placeholder: "write the chosen cadence"
  },
  {
    key: "decision:quarter",
    n: 2,
    title: "Quarter shape",
    frame: "Consensus already exists. This is a ratification, not a debate — say it out loud and move.",
    options: [
      { k: "H1", label: "Internal ops" },
      { k: "H2", label: "Sales / growth" }
    ],
    recommend: "Ratify as-is: H1 internal ops → H2 sales/growth.",
    lockLabel: "Ratified",
    placeholder: "H1 ops → H2 growth"
  },
  {
    key: "decision:crm",
    n: 3,
    title: "CRM",
    frame: "Open loop from the checklist. Two live tools is drift — pick one today.",
    options: [
      { k: "Keep", label: "Attio" },
      { k: "Kill", label: "Twenty" }
    ],
    recommend:
      "Attio, kill Twenty — unless someone states an explicit reason not to. Log the reason here if so.",
    lockLabel: "CRM call",
    placeholder: "Attio (kill Twenty) — or the reason not to"
  },
  {
    key: "decision:audit-scope",
    n: 4,
    title: "Audit scope",
    frame: "Kas's audit rock can't get a “done” sentence until scope is bounded.",
    options: [
      { k: "Option A", label: "All clients" },
      { k: "Option B", label: "The three named clients" }
    ],
    recommend:
      "Scope to the three for the quarter (provable, datable) and note the AI-dev-client exception explicitly.",
    lockLabel: "Scope + exception",
    placeholder: "e.g. the three clients · AI-dev client excepted"
  }
];

// ─── Ownership collisions to resolve ────────────────────────────────────────

export type CollisionSpec = {
  key: string;
  tag: string;
  title: string;
  parties: { who: string; note: string; flag?: string }[];
  recommend: string;
  placeholder: string;
};

export const COLLISIONS: CollisionSpec[] = [
  {
    key: "collision:onboarding",
    tag: "Collision",
    title: "Pre/post-sale onboarding",
    parties: [
      { who: "Daniel", note: "owns onboarding process, form → auto-tasks" },
      { who: "Kas", note: "audit system says onboarding “sits under this”" }
    ],
    recommend:
      "Daniel owns the onboarding mechanism (form → generated tasks, pre & post-sale). Kas's audit consumes it. One rock, owner = Daniel; audit references it.",
    placeholder: "single owner + boundary"
  },
  {
    key: "collision:dashboard",
    tag: "3-way boundary",
    title: "The dashboard(s)",
    parties: [
      { who: "Leo", note: "infra / vault" },
      { who: "Kas", note: "client surface" },
      { who: "Daniel", note: "account data" }
    ],
    recommend:
      "Already drawn in the checklist — ratify it: Leo = infra/vault, Kas = client-facing surface + internal OS, Daniel = account/info-flow data. Three rocks, not one contested one.",
    placeholder: "Leo infra · Kas surface · Daniel data"
  },
  {
    key: "collision:seo",
    tag: "Collision",
    title: "SEO in the site workflow",
    parties: [
      { who: "Mostafa", note: "owns the site workflow, “tag-teamed on SEO”" },
      { who: "Darko", note: "SEO inside that workflow", flag: "absent" }
    ],
    recommend:
      "Mostafa owns the workflow rock; Darko owns the SEO step as its own rock (castans.com authority to reuse). Confirm split with Darko live in item 4 — no co-ownership.",
    placeholder: "who owns the SEO step"
  },
  {
    key: "collision:audit-build",
    tag: "Collision",
    title: "Audit system vs audit backend",
    parties: [
      { who: "Kas", note: "audit system + experience" },
      { who: "Leo", note: "audit backend build + Plane conditional logic" }
    ],
    recommend:
      "Kas owns the audit product (the “Jack runs 90%” outcome). Leo owns the backend + Plane logic that makes it run. Two rocks, clean seam at the interface.",
    placeholder: "product vs backend seam"
  }
];

// ─── Who owns what — brain-dump reference ───────────────────────────────────

export type OwnerRef = {
  name: string;
  count: string;
  absent?: boolean;
  flag?: string;
  rocks: string[];
};

export const OWNER_REFERENCE: OwnerRef[] = [
  {
    name: "Daniel",
    count: "5 rocks",
    rocks: [
      "Onboarding, full process: form → auto-generated tasks (pre & post-sale)",
      "Internal wiki / knowledge library (under SOPs)",
      "Single-owner accountability map + internal info flow",
      "Plane cleanup — open it, know your day at a glance",
      "Meeting flows & templates (largely built)"
    ]
  },
  {
    name: "Kas",
    count: "3 rocks",
    rocks: [
      "Internal dashboard — the agency OS itself. PRD due yesterday",
      "Client dashboard + full client journey / CX",
      "Audit system: Jack runs 90% → strategy, report, proposal draft"
    ]
  },
  {
    name: "Leo",
    count: "4 rocks",
    rocks: [
      "Data governance / infrastructure (Jack: “data first”)",
      "All client workflows, flowcharted end to end",
      "Audit backend build + Plane conditional logic",
      "Obsidian vault architecture on the VPS — context source of truth"
    ]
  },
  {
    name: "Jack",
    count: "4 rocks",
    rocks: [
      "Sales — high-ticket five-figure agency-OS clients",
      "Finance + contracts",
      "Legal / compliance (liability, state, contract updates)",
      "Verticalization playbook (flagged later-quarter)"
    ]
  },
  {
    name: "Mostafa",
    count: "2 rocks",
    rocks: [
      "20–30 workflows: site from zero → live, incl. UX-research + nudge/conversion step",
      "Build the internal sites (agency OS, business OS, castans.com, Jack's) as the test"
    ]
  },
  {
    name: "Rehan",
    count: "“rock to everybody”",
    rocks: [
      "Cybersecurity / ops-infra audit — hardened by day 90",
      "GitHub separation (PRD from 3 weeks ago, still open)",
      "G Suite for both domains + account-centralization research — this week",
      "VPS remote access setup",
      "The “click thing” — due tomorrow, ~20 min, top priority"
    ]
  },
  {
    name: "Darko",
    count: "absent — confirm live",
    absent: true,
    flag: "absent",
    rocks: [
      "SEO inside the site workflow",
      "Internal-site ranking (castans.com has real authority to reuse)",
      "Compliance playbooks"
    ]
  }
];

// ─── This-week immediates ───────────────────────────────────────────────────

export type Immediate = { when: string; title: string; detail: string; hot?: boolean };

export const IMMEDIATES: Immediate[] = [
  {
    when: "Due tomorrow · ~20 min · top priority",
    title: "Rehan — the “click thing”",
    detail: "Highest-priority immediate. Don't let it slip a third time.",
    hot: true
  },
  {
    when: "This week · foundational — protect it",
    title: "Rehan — G Suite · GitHub sep · VPS access",
    detail:
      "Blocking work for everyone else. G Suite (both domains) + account-centralization research; GitHub separation (3-wk-old PRD); VPS remote access.",
    hot: true
  },
  {
    when: "Overdue",
    title: "Kas — the PRD",
    detail: "Internal-dashboard PRD was due yesterday. Ship it before the OS build can be scoped.",
    hot: true
  },
  {
    when: "Book — 30 min",
    title: "Audit-pattern extraction session",
    detail: "Put it on the calendar in the room. Feeds Kas's “Jack runs 90%” bar."
  },
  {
    when: "Recurring — 15 min",
    title: "Kas + Daniel pre-meeting sync",
    detail: "Confirm the standing pre-sync so onboarding/audit seam stays clean."
  },
  {
    when: "Daily",
    title: "Log to the ops channel",
    detail: "Confirm the daily log rhythm — this L10 board feeds the weekly review."
  }
];

// ─── Exit checklist ─────────────────────────────────────────────────────────

export const CHECKLIST: { key: string; label: string }[] = [
  { key: "check:cadence", label: "Sprint cadence chosen (weekly vs 2–3 wk deliverable)" },
  { key: "check:quarter", label: "Quarter shape ratified (H1 ops / H2 growth)" },
  { key: "check:owners", label: "Every rock has ONE owner — collisions resolved" },
  { key: "check:darko", label: "Darko's three rocks confirmed with his input" },
  {
    key: "check:dashboard",
    label: "Dashboard boundary drawn: Leo infra/vault · Kas client surface · Daniel account data"
  },
  { key: "check:audit-scope", label: "Audit scope decided (all vs the three) + AI-dev-client exception noted" },
  { key: "check:audit-session", label: "Audit-pattern extraction session booked (30 min)" },
  { key: "check:crm", label: "CRM decided: Attio (kill Twenty) — or explicit reason not to" },
  { key: "check:rehan", label: "Rehan's foundational-blocking work protected (VPS, G Suite, GitHub)" },
  { key: "check:done-sentences", label: "“Done” sentence written for every rock" },
  { key: "check:deadlines", label: "Deadlines assigned per sprint" }
];

export const FACILITATOR_KEY = "facilitator";

// ─── Draft rocks (seed) ─────────────────────────────────────────────────────
// The "Insert draft rocks" button loads these from the brain-dump so the team
// refines rather than types from scratch.

export type RockSeed = { title: string; owner: string; rock_type: RockType; smart: string };

export const SEED_ROCKS: RockSeed[] = [
  { title: "Onboarding engine", owner: "Daniel", rock_type: "individual", smart: "Form → auto-generated tasks live for both pre-sale and post-sale, run end-to-end without manual setup." },
  { title: "Internal wiki / SOP library", owner: "Daniel", rock_type: "company", smart: "Searchable knowledge library stood up; every core SOP has a home and an owner." },
  { title: "Accountability map + info flow", owner: "Daniel", rock_type: "company", smart: "Single-owner map published: who sends what, where, how — no orphaned handoffs." },
  { title: "Plane cleanup", owner: "Daniel", rock_type: "company", smart: "Anyone opens Plane and knows their day at a glance; no stale/ownerless items." },
  { title: "Internal dashboard (agency OS)", owner: "Kas", rock_type: "company", smart: "PRD shipped and the internal OS scoped; first working surface demoable." },
  { title: "Client dashboard + CX", owner: "Kas", rock_type: "company", smart: "Client journey mapped end-to-end with a client-facing dashboard surface." },
  { title: "Audit system", owner: "Kas", rock_type: "company", smart: "Jack can run 90% of the audit and generate strategy, report, and proposal rough draft." },
  { title: "Data governance / infra", owner: "Leo", rock_type: "company", smart: "Data model + governance in place first — the foundation everything else builds on." },
  { title: "Client workflows flowcharted", owner: "Leo", rock_type: "company", smart: "Every client workflow charted beginning to end and validated with owners." },
  { title: "Audit backend + Plane logic", owner: "Leo", rock_type: "company", smart: "Audit backend built with Plane conditional logic driving Kas's audit product." },
  { title: "Obsidian vault on VPS", owner: "Leo", rock_type: "company", smart: "Vault architecture live on the VPS as the context source of truth." },
  { title: "Site workflow (0 → live)", owner: "Mostafa", rock_type: "company", smart: "20–30 workflows take a site zero → published, incl. UX-research + nudge/conversion step." },
  { title: "Internal sites built", owner: "Mostafa", rock_type: "company", smart: "Agency OS, business OS, castans.com and Jack's site built as the test of the workflow." },
  { title: "SEO step + internal ranking", owner: "Darko", rock_type: "individual", smart: "SEO step defined inside the site workflow; internal sites ranking, reusing castans.com authority." },
  { title: "Compliance playbooks", owner: "Darko", rock_type: "individual", smart: "Reusable compliance playbooks documented and handed to the workflow." },
  { title: "Sales — agency OS clients", owner: "Jack", rock_type: "individual", smart: "Pipeline for five-figure agency-OS clients live with first qualified opportunities." },
  { title: "Finance + contracts", owner: "Jack", rock_type: "individual", smart: "Finance + contract process standardized and running." },
  { title: "Legal / compliance", owner: "Jack", rock_type: "company", smart: "Liability, state compliance and contract updates reviewed and current." },
  { title: "Ops-infra security audit", owner: "Rehan", rock_type: "company", smart: "Cyber / ops-infra hardened to best practice by day 90; GitHub separated, VPS + G Suite done." }
];

// Master-dashboard export line, matching the meeting doc's rock format.
export function rockToLine(rock: Pick<Rock, "title" | "owner" | "rock_type" | "deadline" | "smart">): string {
  return (
    `- [ ] ROCK: ${rock.title || "{title}"} · @${rock.owner || "owner"} · ` +
    `type:${rock.rock_type} · quarter:${QUARTER} · deadline:${rock.deadline || "YYYY-MM-DD"} · ` +
    `SMART:${rock.smart || "{done}"}`
  );
}
