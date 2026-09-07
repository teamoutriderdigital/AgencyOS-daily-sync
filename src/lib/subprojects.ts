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
