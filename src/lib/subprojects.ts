/** Plain data shared by the server reader and compact board. No credentials. */
export type PlaneState = { id: string; name: string; group: string };
export type PlanePerson = { id: string; first_name?: string; last_name?: string; display_name?: string };
export type PlaneWorkItem = {
  id: string; name: string; sequence_id: number; parent: string | null;
  state: PlaneState | string; assignees: (PlanePerson | string)[];
  min_module_name?: string | null; target_date: string | null; updated_at: string;
  archived_at?: string | null; completed_at?: string | null; is_draft?: boolean;
};
export type SubprojectRow = {
  id: string; client: string; subproject: string; task: string; reference: string;
  owner: string; status: string; dueDate: string | null; updatedAt: string;
  url: string; activeCount: number; overdueCount: number; missingDates: number;
};
export type SubprojectSnapshot = {
  rows: SubprojectRow[]; fetchedAt: string | null; warnings: string[];
};

export const PLANE_WORKSPACE = 'project-ares';
export const PLANE_HOME = `https://app.plane.so/${PLANE_WORKSPACE}/`;
export const CLIENT_PROJECTS: Record<string, string> = {
  Redstone: 'RED', SBD: 'SBD', COD: 'COD', Vital: 'VITAL', Theraplay: 'THERA',
  'True Form Pilates': 'TFP', AOC: 'AOC', 'Supply Velocity': 'SV', 'ABS Cleaning': 'ABS',
  Joanniefit: 'JFIT'
};
const CLIENT_NAMES: Record<string, string> = {
  SBD: 'Smith Bros Detailing', AOC: 'Art of Charm', Vital: 'Vital Electronics'
};

// Explicit aliases preserve the delivery group in Plane. Unknown module names
// are kept verbatim; ungrouped work is surfaced for review, never guessed away.
export function subprojectName(moduleName: string, client: string): string {
  const aliases: Record<string, string> = {
    'Redstone Website': 'Website', 'Google Ads': 'Google Ads', 'Cold Email': 'Cold email',
    'Attio': 'CRM', 'Event Planning': 'Events',
    'Design': 'Website', 'Development': 'Website', 'Go Live': 'Website',
    'Website Recovery': 'Website', 'Technical issues': 'Website',
    'Content Production': 'SEO and content', 'Content Publishing': 'SEO and content',
    'Measurement & Reporting': 'Analytics and reporting', 'Access & Tracking': 'Onboarding',
    'Delivery Q2': 'Client delivery'
  };
  if (aliases[moduleName]) return aliases[moduleName];
  const withoutClient = moduleName.startsWith(`${client} `) ? moduleName.slice(client.length + 1) : moduleName;
  return withoutClient || moduleName;
}

// ─── Storage shape ──────────────────────────────────────────────────────────
// Rows are computed on a trusted machine and pushed into `plane_subprojects`;
// the deployment only ever reads them. Both directions live here so the pusher
// and the board can never drift apart.

export type SubprojectDbRow = {
  id: string; client: string; subproject: string; task: string; reference: string;
  owner: string; status: string; due_date: string | null; task_updated_at: string | null;
  url: string; active_count: number; overdue_count: number; missing_dates: number;
  fetched_at?: string;
};

export function rowToDb(row: SubprojectRow, fetchedAt: string): SubprojectDbRow {
  return {
    id: row.id, client: row.client, subproject: row.subproject, task: row.task,
    reference: row.reference, owner: row.owner, status: row.status, due_date: row.dueDate,
    task_updated_at: row.updatedAt, url: row.url, active_count: row.activeCount,
    overdue_count: row.overdueCount, missing_dates: row.missingDates, fetched_at: fetchedAt
  };
}

export function dbToRow(row: SubprojectDbRow): SubprojectRow {
  return {
    id: row.id, client: row.client, subproject: row.subproject, task: row.task,
    reference: row.reference, owner: row.owner, status: row.status, dueDate: row.due_date,
    updatedAt: row.task_updated_at ?? "", url: row.url, activeCount: row.active_count,
    overdueCount: row.overdue_count, missingDates: row.missing_dates
  };
}

// Board order: client first, then subproject, so a client's rows sit together
// however the rows came back from the database.
export function sortRows(rows: SubprojectRow[]): SubprojectRow[] {
  return [...rows].sort((a, b) => a.client.localeCompare(b.client) || a.subproject.localeCompare(b.subproject));
}

export function boardToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}
export function deadlineLabel(date: string | null, today: string): string {
  if (!date) return 'No deadline';
  const formatted = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  if (date < today) return `${formatted} · Overdue`;
  if (date === today) return `${formatted} · Today`;
  return formatted;
}

// ─── The client card the meeting reads ──────────────────────────────────────
// One card per client: a couple of plain sentences, then a tick list with one
// line per subproject. The rules these follow are written down in
// docs/board-naming.md — the short version is: say what a person has to do,
// name them by their first name, put time in words, and never dress up a gap.

export type ClientCard = { client: string; headline: string; tasks: string[] };

export function daysSince(dateISO: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateISO}T00:00:00Z`)) / 86400000);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// People are called what the room calls them. "Rasika Salinda" is a database
// record; "Rasika" is a colleague.
export function firstNames(owner: string): string {
  if (!owner || owner === "Unassigned") return "no one on it";
  const names = owner.split(",").map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

// Time is said the way it would be said out loud: "12 days late", "due
// Thursday". A bare date makes the reader do the arithmetic.
export function whenPhrase(date: string | null, today: string): string {
  if (!date) return "no date set";
  const gap = daysSince(date, today);
  if (gap > 0) return `${plural(gap, "day")} late`;
  if (gap === 0) return "due today";
  if (gap === -1) return "due tomorrow";
  const when = new Date(`${date}T12:00:00Z`);
  if (gap > -7) return `due ${when.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}`;
  return `due ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

// "since Friday" beats "since 2026-09-04" for anything inside the last week.
function sincePhrase(dateISO: string, today: string): string {
  const gap = daysSince(dateISO, today);
  if (gap <= 0) return "today";
  if (gap === 1) return "yesterday";
  if (gap < 7) return new Date(`${dateISO}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return new Date(`${dateISO}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const UNFILED = "Other active work";

export function buildClientCard(
  client: string,
  rows: SubprojectRow[],
  today: string,
  context: { closedSinceLastMeeting?: number; lastMeeting?: string | null; lastTouch?: string | null; hasPlaneProject?: boolean } = {}
): ClientCard {
  const { closedSinceLastMeeting = 0, lastMeeting = null, lastTouch = null, hasPlaneProject = true } = context;
  const closed = closedSinceLastMeeting && lastMeeting
    ? `${plural(closedSinceLastMeeting, "task")} finished since ${sincePhrase(lastMeeting, today)}.`
    : "";

  if (!hasPlaneProject) {
    return {
      client,
      headline: "There is no Plane project for this client, so none of the work is being tracked. Staff it or park it.",
      tasks: ["Set the project up and put the first tasks in it — or park the client and take it off the board"]
    };
  }
  if (!rows.length) {
    return {
      client,
      headline: ["Nothing active in Plane.", closed, "What is left is backlog or already done."].filter(Boolean).join(" "),
      tasks: ["Say whether this account is parked, or put the next piece of work in Plane"]
    };
  }

  // Late work leads, then the busiest — the order it should be read out in.
  const ordered = [...rows].sort((a, b) =>
    (b.overdueCount > 0 ? 1 : 0) - (a.overdueCount > 0 ? 1 : 0) ||
    b.overdueCount - a.overdueCount ||
    b.activeCount - a.activeCount ||
    a.subproject.localeCompare(b.subproject));
  const active = ordered.reduce((n, r) => n + r.activeCount, 0);
  const overdue = ordered.reduce((n, r) => n + r.overdueCount, 0);
  const undated = ordered.reduce((n, r) => n + r.missingDates, 0);

  const sentences: string[] = [];
  if (lastTouch && daysSince(lastTouch, today) >= 7) sentences.push(`Nothing has moved here in ${plural(daysSince(lastTouch, today), "day")}.`);
  const late = overdue === active
    ? `All ${plural(active, "open task")} ${active === 1 ? "is" : "are"} late`
    : overdue
      ? `${overdue} of the ${plural(active, "open task")} ${overdue === 1 ? "is" : "are"} late`
      : `${plural(active, "open task")}, none late`;
  sentences.push(undated ? `${late}, and ${undated} ${undated === 1 ? "has" : "have"} no date at all.` : `${late}.`);
  if (closed) sentences.push(closed);

  const tasks = ordered.map(row => {
    const who = firstNames(row.owner);
    const when = whenPhrase(row.dueDate, today);
    // The task on this line may itself be the undated one — don't count it twice.
    const others = row.missingDates - (row.dueDate ? 0 : 1);
    const more = others > 0 ? `. ${others} more here with no date` : "";
    return row.subproject === UNFILED
      ? `Not in a subproject: ${row.task} — ${who}, ${when} (${row.reference}). ${plural(row.activeCount, "task")} here need filing${more.replace(". ", ", ")}`
      : `${row.subproject}: ${row.task} — ${who}, ${when} (${row.reference})${more}`;
  });
  return { client, headline: sentences.join(" "), tasks };
}

export function buildSubprojectRows(
  client: string, project: { id: string; identifier: string }, items: PlaneWorkItem[],
  states: PlaneState[], people: PlanePerson[], today: string
): SubprojectRow[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const stateById = new Map(states.map(state => [state.id, state]));
  const peopleById = new Map(people.map(person => [person.id, person]));
  const stateOf = (item: PlaneWorkItem) => typeof item.state === 'string' ? stateById.get(item.state) : item.state;
  const groups = new Map<string, PlaneWorkItem[]>();
  for (const item of items) {
    const state = stateOf(item);
    if (!state) throw new Error('A task has an unknown Plane state.');
    if (!['started', 'unstarted'].includes(state.group) || item.archived_at || item.completed_at || item.is_draft) continue;
    let ancestor: PlaneWorkItem | undefined = item;
    let moduleName = item.min_module_name;
    const seen = new Set<string>();
    while (!moduleName && ancestor?.parent && !seen.has(ancestor.id)) {
      seen.add(ancestor.id);
      ancestor = byId.get(ancestor.parent);
      moduleName = ancestor?.min_module_name;
    }
    const name = moduleName ? subprojectName(moduleName, client) : 'Other active work';
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups].map(([subproject, active]) => {
    // The oldest overdue task takes precedence; otherwise show the last updated
    // active task. Stable IDs break ties so refreshes don't reshuffle equal rows.
    active.sort((a, b) => {
      const aLate = !!a.target_date && a.target_date < today;
      const bLate = !!b.target_date && b.target_date < today;
      if (aLate !== bLate) return aLate ? -1 : 1;
      if (aLate && a.target_date !== b.target_date) return a.target_date!.localeCompare(b.target_date!);
      return b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id);
    });
    const task = active[0];
    const owners = task.assignees.map(person => typeof person === 'string' ? peopleById.get(person) : person);
    return {
      id: `${project.id}:${subproject}`, client: CLIENT_NAMES[client] ?? client, subproject,
      task: task.name, reference: `${project.identifier}-${task.sequence_id}`,
      owner: owners.length ? owners.map(person => person ? ([person.first_name, person.last_name].filter(Boolean).join(' ') || person.display_name || 'Unknown owner') : 'Unknown owner').join(', ') : 'Unassigned',
      status: stateOf(task)!.name, dueDate: task.target_date, updatedAt: task.updated_at,
      url: `${PLANE_HOME}projects/${project.id}/work-items/${task.id}/`,
      activeCount: active.length,
      overdueCount: active.filter(item => item.target_date && item.target_date < today).length,
      missingDates: active.filter(item => !item.target_date).length
    };
  }).sort((a, b) => a.subproject.localeCompare(b.subproject));
}
