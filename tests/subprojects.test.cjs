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
const { buildSubprojectRows, deadlineLabel, boardToday } = mod.exports;
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
