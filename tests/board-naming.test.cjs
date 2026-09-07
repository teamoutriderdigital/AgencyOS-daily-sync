const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const code = ts.transpileModule(fs.readFileSync('src/lib/board-naming.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('board-naming'); mod._compile(code, 'board-naming.cjs');
const { titleProblems, namingHint } = mod.exports;

test("Kas's own example is caught, and the rewrite passes clean", () => {
  const problems = titleProblems('Security/access is 0/32 — scope the 32 into a datable sprint or it never closes');
  assert.equal(problems.length, 1);
  assert.equal(problems[0].rule, 1);
  assert.match(problems[0].note, /“0\/32” is a progress count/);
  assert.deepEqual(titleProblems('Finish and share the security setup skill'), []);
});

test('percentages, bare dates and mid-sentence references are flagged', () => {
  assert.equal(titleProblems('Internal dashboard is 70% done').length, 1);
  assert.equal(titleProblems('Ship the audit by 2026-09-30')[0].rule, 5);
  assert.equal(titleProblems('Merge SBD-304 before the ads go live')[0].rule, 3);
});

test('a reference at the end in brackets is the correct form, not a problem', () => {
  assert.deepEqual(titleProblems('Shift ad weighting toward mobile window tint (SBD-304)'), []);
  assert.deepEqual(titleProblems('Publish the location pages (SBD-51, SBD-59)'), []);
});

test('good titles stay silent — a hint that cries wolf gets ignored', () => {
  for (const title of [
    'Create the employee offboarding checklist',
    'Agree who owns our GitHub, Vercel and hosting accounts',
    'Move Twenty to the VPS',
    'Decide whether to proceed with Project Eros and who owns compliance',
    ''
  ]) assert.deepEqual(titleProblems(title), [], title);
  assert.equal(namingHint('Move Twenty to the VPS'), null);
});

test('a paragraph masquerading as a title is called out', () => {
  const long = 'GA4 / analytics best-practice checklist across every client including PostHog, built from the COD setup by Rehan and executed by Mubshar before the end of September';
  assert.equal(titleProblems(long).some(p => p.rule === 7), true);
});

test('several problems collapse into one line', () => {
  assert.match(namingHint('Security/access is 0/32 and 40% done'), /progress count.*\(\+1 more\)$/);
});
