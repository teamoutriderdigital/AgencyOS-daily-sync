const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
// Compile this pure module in memory; no framework server or live data needed.
const code = ts.transpileModule(fs.readFileSync('src/lib/subprojects.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('subprojects'); mod._compile(code, 'subprojects.cjs');
const { buildSubprojectRows, deadlineLabel, boardToday, rowToDb, dbToRow, sortRows, buildClientCard, whenPhrase, firstNames } = mod.exports;
const project = { id: 'p', identifier: 'RED' };
const task = (id, extra = {}) => ({ id, name: id, sequence_id: 1, parent: null, state: { id:'todo', name: 'Todo', group:'unstarted' }, assignees: [], min_module_name:'Redstone Website', target_date:null, updated_at:'2026-09-07T10:00:00Z', ...extra });
const rows = items => buildSubprojectRows('Redstone', project, items, [], [], '2026-09-07');
test('one row per subproject, oldest overdue task wins even over a newer update', () => {
  const result = rows([task('new'), task('old', {target_date:'2026-09-01'}), task('late',{target_date:'2026-09-03'}),task('ads',{min_module_name:'Google Ads'})]);
  assert.equal(result.length,2);
  assert.equal(result.find(r=>r.subproject==='Website').task,'old');
  assert.equal(result.find(r=>r.subproject==='Website').overdueCount,2);
});
test('latest active task wins without overdue work; due today is not overdue', () => {
  const result=rows([task('earlier',{target_date:'2026-09-07',updated_at:'2026-09-06T10:00:00Z'}),task('latest')]);
  assert.equal(result[0].task,'latest');assert.equal(result[0].missingDates,1);assert.equal(result[0].overdueCount,0);
});
test('backlog, completed, cancelled, archived and drafts stay out, blocked remains', () => {
  const inactive=['backlog','completed','cancelled'].map(group=>task(group,{state:{id:group,name:group,group}}));
  assert.deepEqual(rows([...inactive,task('archived',{archived_at:'2026-09-01'}),task('draft',{is_draft:true}),task('done',{completed_at:'2026-09-01'})]),[]);
  assert.equal(rows([task('blocked',{state:{id:'blocked',name:'Blocked',group:'started'}})])[0].status,'Blocked');
});
test('child inherits module; loops terminate and ungrouped work stays visible', () => {
  const result=rows([task('parent'),task('child',{parent:'parent',min_module_name:null,target_date:'2026-09-01'}),task('loop',{parent:'loop',min_module_name:null})]);
  assert.equal(result.length,2);assert.equal(result.find(r=>r.subproject==='Website').task,'child');assert.ok(result.some(r=>r.subproject==='Other active work'));
});
test('bare state and assignee IDs resolve from reference lists; missing state fails explicitly', () => {
  const item=task('a',{state:'todo',assignees:['person']});
  const result=buildSubprojectRows('Redstone',project,[item],[{id:'todo',name:'Todo',group:'unstarted'}],[{id:'person',first_name:'Daniel'}],'2026-09-07');
  assert.equal(result[0].owner,'Daniel'); assert.throws(()=>rows([item]),/unknown Plane state/);
});
test('deadline labels and board day use consistent dates at UTC midnight', () => {
  assert.equal(boardToday(new Date('2026-09-07T02:00:00Z')),'2026-09-06');
  assert.equal(deadlineLabel(null,'2026-09-07'),'No deadline');
  assert.equal(deadlineLabel('2026-09-07','2026-09-07'),'7 Sept 2026 · Today');
  assert.match(deadlineLabel('2026-09-06','2026-09-07'),/Overdue/);
});

test('website phases collapse into one subproject', () => {
  const result=rows(['Design','Development','Go Live','Website Recovery'].map((name,i)=>task(String(i),{min_module_name:name})));
  assert.equal(result.length,1);assert.equal(result[0].subproject,'Website');assert.equal(result[0].activeCount,4);
});

test('a row survives the round trip through the database shape', () => {
  const [row] = rows([task('only', { target_date: '2026-09-01' })]);
  const stored = rowToDb(row, '2026-09-07T12:00:00.000Z');
  assert.equal(stored.due_date, '2026-09-01');
  assert.equal(stored.active_count, 1);
  assert.equal(stored.fetched_at, '2026-09-07T12:00:00.000Z');
  assert.deepEqual(dbToRow(stored), row);
});

test('rows are ordered by client then subproject, whatever order they arrive in', () => {
  const make = (client, subproject) => ({ ...rows([task('t')])[0], id: client + subproject, client, subproject });
  const sorted = sortRows([make('SBD', 'Website'), make('ABS', 'Website'), make('SBD', 'Google Ads')]);
  assert.deepEqual(sorted.map(r => `${r.client}/${r.subproject}`), ['ABS/Website', 'SBD/Google Ads', 'SBD/Website']);
});

// ─── the client card the meeting reads ──────────────────────────────────────

const row = (over = {}) => ({
  id: 'x', client: 'SBD', subproject: 'Website', task: 'Fix the banner', reference: 'SBD-301',
  owner: 'Rehan Saleem', status: 'In Progress', dueDate: null, updatedAt: '2026-09-06T10:00:00Z',
  url: 'https://app.plane.so/x', activeCount: 1, overdueCount: 0, missingDates: 0, ...over
});

test('a card reads as sentences, and overdue work leads the tick list', () => {
  const card = buildClientCard('SBD', [
    row({ subproject: 'Website', missingDates: 1 }),
    row({ subproject: 'Google Ads', dueDate: '2026-08-15', overdueCount: 2, activeCount: 3, reference: 'SBD-304', task: 'Shift ad weighting' })
  ], '2026-09-07');
  assert.match(card.headline, /^2 of the 4 open tasks are late, and 1 has no date at all\.$/);
  assert.equal(card.tasks[0], 'Google Ads: Shift ad weighting — Rehan, 23 days late (SBD-304)');
  assert.equal(card.tasks[1], 'Website: Fix the banner — Rehan, no date set (SBD-301)');
});

test('unassigned, undated and unfiled work is named plainly, never hidden', () => {
  const card = buildClientCard('SBD', [
    row({ subproject: 'Other active work', owner: 'Unassigned', activeCount: 4, overdueCount: 4, missingDates: 3, task: 'Post 2 GBP', reference: 'SBD-287', dueDate: '2026-09-06' }),
    row({ subproject: 'Website', owner: 'Unassigned', activeCount: 2, missingDates: 2, task: 'Nav polish', reference: 'SBD-9' })
  ], '2026-09-07');
  assert.match(card.tasks[0], /^Not in a subproject: Post 2 GBP — no one on it, 1 day late \(SBD-287\)\./);
  // This line's task has a date, so all 3 undated others are still counted.
  assert.match(card.tasks[0], /4 tasks here need filing, 3 more here with no date$/);
  assert.match(card.headline, /4 of the 6 open tasks are late, and 5 have no date at all\./);
  // This line's own task is undated, so the tail counts only the other one.
  assert.match(card.tasks[1], /^Website: Nav polish — no one on it, no date set \(SBD-9\)\. 1 more here with no date$/);
});

test('silence and wins both make the headline; a missing project stops the card', () => {
  const quiet = buildClientCard('Theraplay', [row({ dueDate: '2026-09-01', overdueCount: 1 })], '2026-09-07',
    { lastTouch: '2026-08-07', closedSinceLastMeeting: 2, lastMeeting: '2026-09-04' });
  assert.match(quiet.headline, /^Nothing has moved here in 31 days\./);
  assert.match(quiet.headline, /2 tasks finished since Friday\.$/);
  const none = buildClientCard('Key Healthcare', [], '2026-09-07', { hasPlaneProject: false });
  assert.match(none.headline, /no Plane project for this client/);
  assert.equal(none.tasks.length, 1);
});

test('time is said the way it would be said out loud', () => {
  assert.equal(whenPhrase(null, '2026-09-07'), 'no date set');
  assert.equal(whenPhrase('2026-09-07', '2026-09-07'), 'due today');
  assert.equal(whenPhrase('2026-09-08', '2026-09-07'), 'due tomorrow');
  assert.equal(whenPhrase('2026-09-10', '2026-09-07'), 'due Thursday');
  assert.equal(whenPhrase('2026-09-06', '2026-09-07'), '1 day late');
  // "Sep" or "Sept" depending on the ICU build — either reads fine in a sentence.
  assert.match(whenPhrase('2026-09-21', '2026-09-07'), /^due 21 Sept?$/);
});

test('people are named the way the room names them', () => {
  assert.equal(firstNames('Rasika Salinda'), 'Rasika');
  assert.equal(firstNames('Mubshar Hussain, Daniel Seselovsky'), 'Mubshar and Daniel');
  assert.equal(firstNames('A B, C D, E F'), 'A, C +1');
  assert.equal(firstNames('Unassigned'), 'no one on it');
});
