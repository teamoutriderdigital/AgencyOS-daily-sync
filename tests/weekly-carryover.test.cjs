const {test}=require('node:test'); const assert=require('node:assert/strict');
const ts=require('typescript');const fs=require('node:fs');const Module=require('node:module');
const m=new Module('weekly');m._compile(ts.transpileModule(fs.readFileSync('src/lib/weekly.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,'weekly.cjs');
const {itemInWeek}=m.exports;const current={year:2026,week:37};
test('unfinished items appear in current week without a manual sync',()=>assert.equal(itemInWeek({year_number:2026,week_number:36},current,current,true),true));
test('completed old work and future commitments do not carry into this week',()=>{
 assert.equal(itemInWeek({year_number:2026,week_number:36},current,current,false),false);
 assert.equal(itemInWeek({year_number:2026,week_number:38},current,current,true),false);
});
test('past-week browsing remains date-scoped, including across year boundaries',()=>{
 assert.equal(itemInWeek({year_number:2025,week_number:52},current,current,true),true);
 assert.equal(itemInWeek({year_number:2026,week_number:35},{year:2026,week:36},current,true),false);
});
