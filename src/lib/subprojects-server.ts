import 'server-only';
import { getClients } from './clients-server';
import {
  boardToday, buildSubprojectRows, CLIENT_PROJECTS, PLANE_WORKSPACE,
  type PlaneWorkItem, type PlaneState, type PlanePerson, type SubprojectSnapshot
} from './subprojects';

type Page<T> = { results: T[]; next_page_results?: boolean; next_cursor?: string };
// Source reads are always fresh. The completed snapshot is cached below.
// We never cache an error as an empty successful board.
async function list<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
  const key = process.env.PLANE_API_KEY;
  if (!key) throw new Error('Plane connection is not configured.');
  const rows: T[] = [];
  const seen = new Set<string>();
  let cursor = '';
  do {
    const params = new URLSearchParams({ per_page: '100', ...query, ...(cursor ? { cursor } : {}) });
    const response = await fetch(`https://api.plane.so/api/v1/workspaces/${PLANE_WORKSPACE}${path}?${params}`, {
      headers: { 'X-API-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Plane read failed (${response.status}).`);
    const data: Page<T> | T[] = await response.json();
    if (Array.isArray(data)) return [...rows, ...data];
    if (!Array.isArray(data.results)) throw new Error('Plane returned an incomplete response.');
    rows.push(...data.results);
    if (!data.next_page_results) return rows;
    if (!data.next_cursor || seen.has(data.next_cursor)) throw new Error('Plane pagination could not finish.');
    cursor = data.next_cursor;
    seen.add(cursor);
  } while (seen.size < 100);
  throw new Error('Plane returned too many pages.');
}

async function collectSubprojectSnapshot(): Promise<SubprojectSnapshot> {
  const [clients, projects, people] = await Promise.all([
    getClients(), list<{ id: string; identifier: string }>('/projects/'), list<PlanePerson>('/members/')
  ]);
  if (!clients.length) throw new Error('The client list is unavailable.');
  const snapshot: SubprojectSnapshot = { rows: [], fetchedAt: null, warnings: [] };
  // Serial projects keep the first refresh within Plane's API request limit.
  // Work-item reads include module names to avoid an API call per subproject.
  for (const client of clients.filter(client => client.stage !== 'Churned')) {
    const identifier = CLIENT_PROJECTS[client.name];
    const project = projects.find(project => project.identifier === identifier);
    if (!project) {
      snapshot.warnings.push(`${client.name}: no linked Plane project.`);
      continue;
    }
    try {
      const [items, states] = await Promise.all([
        list<PlaneWorkItem>(`/projects/${project.id}/work-items/`, {
          expand: 'state,assignees',
          fields: 'id,name,sequence_id,parent,state,assignees,min_module_name,target_date,updated_at,archived_at,completed_at,is_draft'
        }),
        list<PlaneState>(`/projects/${project.id}/states/`)
      ]);
      snapshot.rows.push(...buildSubprojectRows(client.name, project, items, states, people, boardToday()));
    } catch {
      snapshot.warnings.push(`${client.name}: could not refresh from Plane. Try again shortly.`);
    }
  }
  snapshot.fetchedAt = new Date().toISOString();
  return snapshot;
}

// Deduplicate simultaneous visits and refreshes in the same server instance.
// A cold server reads Plane again rather than reporting a stale cache as fresh.
let cached: SubprojectSnapshot | null = null;
let expiresAt = 0;
let pending: Promise<SubprojectSnapshot> | null = null;
export async function getSubprojectSnapshot(): Promise<SubprojectSnapshot> {
  if (cached && Date.now() < expiresAt) return cached;
  if (pending) return pending;
  pending = collectSubprojectSnapshot().then(snapshot => {
    cached = snapshot;
    expiresAt = Date.now() + 5 * 60 * 1000;
    return snapshot;
  }).finally(() => { pending = null; });
  return pending;
}
