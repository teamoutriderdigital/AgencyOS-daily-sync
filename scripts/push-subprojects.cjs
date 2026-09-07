#!/usr/bin/env node
// Push the "Client work" snapshot into Supabase.
//
// Reads Plane with the key in .env.local, groups the active work into one row
// per subproject, and replaces the `plane_subprojects` table. The deployment
// never talks to Plane — it only reads what this script leaves behind — so the
// Plane API key stays on trusted machines and off Vercel.
//
//   npm run push:subprojects            # push
//   npm run push:subprojects -- --dry   # print what would be pushed
//
// Safe to re-run: it upserts by the stable "<project id>:<subproject>" key and
// deletes rows that no longer exist. A partial Plane failure is recorded as a
// warning on the snapshot and shown on the board, rather than silently emptying
// a client's rows.

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

// The board's own grouping rules, compiled from source so this script and the
// page can never disagree about what a subproject is. tests/subprojects.test.cjs
// covers this module.
const compiled = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src/lib/subprojects.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('subprojects');
mod._compile(compiled, 'subprojects.cjs');
const { buildSubprojectRows, rowToDb, boardToday, CLIENT_PROJECTS, PLANE_WORKSPACE } = mod.exports;

function env() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) throw new Error('No .env.local — this script only runs on a machine that has the credentials.');
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const at = trimmed.indexOf('=');
    out[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const ENV = env();
const need = key => {
  const value = ENV[key];
  if (!value) throw new Error(`Missing ${key} in .env.local`);
  return value;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, options, attempt = 0) {
  const response = await fetch(url, options);
  // Plane rate-limits a burst of project reads; back off rather than reporting
  // a throttled read as "this client has no work".
  if ([429, 502, 503].includes(response.status) && attempt < 4) {
    await sleep(8000 * (attempt + 1));
    return request(url, options, attempt + 1);
  }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${new URL(url).pathname} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function plane(pathname, params = {}) {
  const rows = [];
  let cursor = '';
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({ per_page: '100', ...params, ...(cursor ? { cursor } : {}) });
    const data = await request(`https://api.plane.so/api/v1/workspaces/${PLANE_WORKSPACE}${pathname}?${query}`, {
      headers: { 'X-API-Key': need('PLANE_API_KEY'), Accept: 'application/json' }
    });
    await sleep(1200);
    if (Array.isArray(data)) return rows.concat(data);
    rows.push(...(data.results ?? []));
    if (!data.next_page_results) return rows;
    cursor = data.next_cursor;
  }
  throw new Error('Plane returned too many pages.');
}

function supabase(table, { method = 'GET', query = '', body } = {}) {
  const key = need('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (method === 'POST') headers.Prefer = 'resolution=merge-duplicates,return=minimal';
  else if (method !== 'GET') headers.Prefer = 'return=minimal';
  return request(`${need('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function main() {
  const today = boardToday();
  const warnings = [];
  const [clients, projects, people] = await Promise.all([
    supabase('clients', { query: 'select=name,stage&order=sort_order' }),
    plane('/projects/'),
    plane('/members/')
  ]);
  if (!clients.length) throw new Error('The clients table came back empty — refusing to publish an empty board.');

  const rows = [];
  for (const client of clients.filter(c => c.stage !== 'Churned')) {
    const identifier = CLIENT_PROJECTS[client.name];
    const project = projects.find(p => p.identifier === identifier);
    if (!project) {
      warnings.push(`${client.name}: no linked Plane project.`);
      continue;
    }
    try {
      const items = await plane(`/projects/${project.id}/work-items/`, {
        expand: 'state,assignees',
        fields: 'id,name,sequence_id,parent,state,assignees,min_module_name,target_date,updated_at,archived_at,completed_at,is_draft'
      });
      const states = await plane(`/projects/${project.id}/states/`);
      rows.push(...buildSubprojectRows(client.name, project, items, states, people, today));
      process.stdout.write(`  ${client.name}: ${rows.length} rows so far\n`);
    } catch (cause) {
      warnings.push(`${client.name}: could not be read from Plane on the last push.`);
      process.stdout.write(`  ${client.name}: FAILED — ${cause.message}\n`);
    }
  }

  const fetchedAt = new Date().toISOString();
  const payload = rows.map(row => rowToDb(row, fetchedAt));
  console.log(`\n${payload.length} subproject rows${warnings.length ? `, ${warnings.length} warning(s)` : ''} at ${fetchedAt}`);
  for (const row of payload) console.log(`  ${row.client} · ${row.subproject} — ${row.reference} ${row.task.slice(0, 54)} [${row.owner}] ${row.due_date ?? 'no date'}`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
  if (DRY) return console.log('\ndry run — nothing written. Drop --dry to push.');

  // Every client failing means Plane is unreachable, not that the work is gone.
  if (!payload.length && warnings.length) throw new Error('Nothing could be read from Plane — leaving the previous snapshot in place.');

  await supabase('plane_subprojects', { method: 'POST', body: payload });
  const keep = payload.map(row => `"${row.id}"`).join(',');
  // Drop whatever Plane no longer reports, so a finished subproject disappears.
  await supabase('plane_subprojects', { method: 'DELETE', query: keep ? `id=not.in.(${encodeURIComponent(keep)})` : 'id=not.is.null' });
  await supabase('plane_snapshot_meta', {
    method: 'PATCH', query: 'id=eq.1',
    body: { fetched_at: fetchedAt, warnings, pushed_by: 'push-subprojects' }
  });
  console.log('\npushed — open /dashboard or /weekly, the boards update live.');
}

main().catch(error => {
  console.error(`\npush failed: ${error.message}`);
  process.exit(1);
});
