#!/usr/bin/env node
// Check every title already on the board against docs/board-naming.md.
//
// The hint beside the text box catches what people write from now on. This
// catches the backlog of what is already there — IDS topics, to-dos and rock
// titles. Read-only: it changes nothing and never will. Renaming is a judgement
// call, and the person who owns the item makes it.
//
//   npm run audit:naming

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src/lib/board-naming.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const naming = new Module('board-naming');
naming._compile(compiled, 'board-naming.cjs');
const { titleProblems } = naming.exports;

const renamed = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src/lib/board-language.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const language = new Module('board-language');
language._compile(renamed, 'board-language.cjs');
const { BOARD_TITLES, boardTitle } = language.exports;

const ENV = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const at = trimmed.indexOf('=');
  ENV[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim().replace(/^["']|["']$/g, '');
}

async function read(table, query) {
  const key = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = await fetch(`${ENV.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`${table} → ${response.status}`);
  return response.json();
}

async function main() {
  const [ids, todos, rocks] = await Promise.all([
    read('ids_items', 'select=id,issue,archived,status'),
    read('action_items', 'select=id,item,done'),
    read('rocks', 'select=id,title,owner')
  ]);

  const groups = [
    ['IDS topics', ids.filter(i => !i.archived && i.status !== 'Solved').map(i => ({ id: `#${i.id}`, raw: i.issue, shown: boardTitle(i.issue) }))],
    ['To-dos', todos.filter(t => !t.done).map(t => ({ id: `#${t.id}`, raw: t.item, shown: t.item }))],
    ['Rocks', rocks.map(r => ({ id: `${r.owner}`, raw: r.title, shown: r.title }))]
  ];

  let flagged = 0;
  let rescued = 0;
  for (const [label, rows] of groups) {
    const bad = rows.map(row => ({ ...row, problems: titleProblems(row.shown) })).filter(row => row.problems.length);
    // A legacy title that only reads well because board-language.ts renames it
    // is still a title nobody fixed at the source.
    const masked = rows.filter(row => row.raw !== row.shown && titleProblems(row.raw).length);
    rescued += masked.length;
    console.log(`\n${label} — ${rows.length} checked, ${bad.length} to fix${masked.length ? `, ${masked.length} reading well only because of the rename list` : ''}`);
    for (const row of bad) {
      flagged++;
      console.log(`  ${row.id} ${row.shown.slice(0, 96)}`);
      for (const problem of row.problems) console.log(`      rule ${problem.rule}: ${problem.note}`);
    }
    for (const row of masked) console.log(`  ${row.id} displayed as "${row.shown.slice(0, 60)}" — source still reads "${row.raw.slice(0, 60)}"`);
  }

  console.log(`\n${flagged} title${flagged === 1 ? '' : 's'} breaking the rules, ${rescued} propped up by board-language.ts (${Object.keys(BOARD_TITLES).length} entries).`);
  console.log('Rules: docs/board-naming.md. Fix a title by editing it on the board — it saves what you type.');
}

main().catch(error => {
  console.error(`audit failed: ${error.message}`);
  process.exit(1);
});
