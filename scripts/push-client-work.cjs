#!/usr/bin/env node
// Push the day's client work onto the board.
//
// Reads Plane with the key in .env.local, groups each client's active work by
// subproject, and writes two things:
//
//   1. the `plane_subprojects` snapshot (per-subproject counts), and
//   2. the client cards the meeting actually reads — one card per client with a
//      plain-English headline and a tick list of action items, in the same
//      `daily_headlines` / `headline_tasks` shape every previous daily sync and
//      L10 has used, so the room can tick them off live.
//
// The deployment never talks to Plane — it only reads what this script leaves
// behind — so the Plane API key stays on trusted machines and off Vercel.
//
//   npm run push:client-work                     # snapshot + today's cards
//   npm run push:client-work -- --dry            # print, write nothing
//   npm run push:client-work -- --date=2026-09-08
//   npm run push:client-work -- --replace        # rewrite a day already seeded
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
const REPLACE = process.argv.includes('--replace');
const DATE = (process.argv.find(a => a.startsWith('--date=')) || '').slice(7);

// The board's own grouping rules, compiled from source so this script and the
// page can never disagree about what a subproject is. tests/subprojects.test.cjs
// covers this module.
const compiled = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src/lib/subprojects.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('subprojects');
mod._compile(compiled, 'subprojects.cjs');
const { buildSubprojectRows, buildClientCard, rowToDb, boardToday, CLIENT_PROJECTS, PLANE_WORKSPACE } = mod.exports;

// daily_headlines.owner / headline_tasks.owner are the team_member enum, so a
// client owned by someone outside it (Leo, Darko) is left unowned on purpose —
// that gap is the decision the meeting owes, not something to paper over.
const TEAM = ['Jack', 'Daniel', 'Leonardo', 'Rehan', 'Kas', 'Rasika', 'Mubshar', 'Lianna'];

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
  const today = DATE || boardToday();
  // "closed since the last meeting" counts from the previous board day, so the
  // wins on a card are the ones the room has not already heard.
  const priorDays = await supabase('daily_headlines', { query: `select=headline_date&headline_date=lt.${today}&order=headline_date.desc&limit=1` });
  const lastMeeting = priorDays[0]?.headline_date ?? today;
  const warnings = [];
  const [clients, projects, people] = await Promise.all([
    supabase('clients', { query: 'select=name,stage,owner&order=sort_order' }),
    plane('/projects/'),
    plane('/members/')
  ]);
  if (!clients.length) throw new Error('The clients table came back empty — refusing to publish an empty board.');

  const rows = [];
  const cards = [];
  for (const client of clients.filter(c => c.stage !== 'Churned')) {
    const identifier = CLIENT_PROJECTS[client.name];
    const project = projects.find(p => p.identifier === identifier);
    if (!project) {
      warnings.push(`${client.name}: no linked Plane project.`);
      cards.push({ ...buildClientCard(client.name, [], today, { hasPlaneProject: false }), owner: client.owner });
      continue;
    }
    try {
      const items = await plane(`/projects/${project.id}/work-items/`, {
        expand: 'state,assignees',
        fields: 'id,name,sequence_id,parent,state,assignees,min_module_name,target_date,updated_at,archived_at,completed_at,is_draft'
      });
      const states = await plane(`/projects/${project.id}/states/`);
      const clientRows = buildSubprojectRows(client.name, project, items, states, people, today);
      rows.push(...clientRows);
      // Context the counts alone can't carry: what shipped, and how long the
      // open work has been sitting untouched.
      const stateById = new Map(states.map(state => [state.id, state]));
      const groupOf = item => (typeof item.state === 'string' ? stateById.get(item.state) : item.state)?.group;
      const live = items.filter(item => !item.archived_at && !item.is_draft);
      const closedSinceLastMeeting = live.filter(item =>
        groupOf(item) === 'completed' && (item.completed_at || item.updated_at || '').slice(0, 10) >= lastMeeting).length;
      const touches = live.filter(item => ['started', 'unstarted'].includes(groupOf(item))).map(item => (item.updated_at || '').slice(0, 10)).filter(Boolean);
      cards.push({
        ...buildClientCard(client.name, clientRows, today, {
          closedSinceLastMeeting, lastMeeting, lastTouch: touches.length ? touches.sort().at(-1) : null
        }),
        owner: client.owner
      });
      process.stdout.write(`  ${client.name}: ${clientRows.length} subproject rows\n`);
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
  console.log(`\nClient cards for ${today} (wins counted since ${lastMeeting}):`);
  for (const card of cards) {
    // Show what will actually be stored: an owner outside the team list is
    // recorded as no owner, and that gap is the point.
    const stored = TEAM.includes(card.owner) ? card.owner : null;
    console.log(`\n  ${card.client} — ${stored || `no owner${card.owner ? ` (${card.owner} is not on the team list)` : ''}`}`);
    console.log(`    ${card.headline}`);
    for (const task of card.tasks) console.log(`      [ ] ${task}`);
  }
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
  // Cards are the meeting's working surface: never overwrite a day the team has
  // already been ticking unless asked to.
  const existing = await supabase('daily_headlines', { query: `select=id&headline_date=eq.${today}` });
  if (existing.length && !REPLACE) {
    console.log(`\nsnapshot pushed. ${today} already has ${existing.length} client cards — left alone. Pass --replace to rewrite them.`);
    return;
  }
  if (existing.length) {
    await supabase('headline_tasks', { method: 'DELETE', query: `headline_date=eq.${today}` });
    await supabase('daily_headlines', { method: 'DELETE', query: `headline_date=eq.${today}` });
  }
  for (const card of cards) {
    const owner = TEAM.includes(card.owner) ? card.owner : null;
    const [headline] = await request(`${need('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/daily_headlines`, {
      method: 'POST',
      headers: {
        apikey: need('NEXT_PUBLIC_SUPABASE_ANON_KEY'), Authorization: `Bearer ${need('NEXT_PUBLIC_SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json', Prefer: 'return=representation'
      },
      body: JSON.stringify({ headline_date: today, client: card.client, text: card.headline, created_by: 'Daniel', owner })
    });
    await supabase('headline_tasks', {
      method: 'POST',
      body: card.tasks.map((text, sort_order) => ({ headline_id: headline.id, headline_date: today, text, owner, sort_order }))
    });
  }
  console.log(`\npushed — ${cards.length} client cards and ${cards.reduce((n, c) => n + c.tasks.length, 0)} action items for ${today}. Open /dashboard or /weekly.`);
}

main().catch(error => {
  console.error(`\npush failed: ${error.message}`);
  process.exit(1);
});
