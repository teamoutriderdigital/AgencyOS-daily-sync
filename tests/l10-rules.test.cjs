const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const code = ts.transpileModule(fs.readFileSync('src/lib/l10-rules.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('l10-rules'); mod._compile(code, 'l10-rules.cjs');
const { defaultTodoDue, solveTodoProblem, solvedNote, ratingNeedsReason, ratingIssueTitle, offTrackIssueTitle } = mod.exports;

test('a solved issue needs a to-do with an owner and a date inside a week', () => {
  const today = '2026-10-05';
  assert.equal(defaultTodoDue(today), '2026-10-12');
  const ok = { item: 'Send Eric the legal pages', assignee: 'Jack', due_date: '2026-10-09' };
  assert.equal(solveTodoProblem(ok, today), null);
  assert.equal(solveTodoProblem({ ...ok, item: '  ' }, today), 'Write the to-do.');
  assert.equal(solveTodoProblem({ ...ok, assignee: '' }, today), 'Pick an owner.');
  assert.equal(solveTodoProblem({ ...ok, due_date: '' }, today), 'Pick a date.');
  assert.equal(solveTodoProblem({ ...ok, due_date: '2026-10-04' }, today), 'The date is in the past.');
  assert.equal(solveTodoProblem({ ...ok, due_date: '2026-10-12' }, today), null);
  assert.equal(solveTodoProblem({ ...ok, due_date: '2026-10-13' }, today), 'Pick a date within 7 days.');
  assert.equal(solvedNote(ok), 'To-do: Send Eric the legal pages (Jack, by 2026-10-09)');
});

test('under 8 needs a reason, and the reason reads as an issue', () => {
  assert.equal(ratingNeedsReason(7), true);
  assert.equal(ratingNeedsReason(8), false);
  assert.equal(ratingNeedsReason(null), false);
  assert.equal(ratingIssueTitle('Kas', 7, ' ran over on rocks '), 'Meeting rated 7 by Kas: ran over on rocks');
});

test('an off-track rock becomes a named issue', () => {
  assert.equal(offTrackIssueTitle('Client Dashboard'), 'Rock off track: Client Dashboard');
  assert.equal(offTrackIssueTitle(''), 'Rock off track: untitled rock');
});
