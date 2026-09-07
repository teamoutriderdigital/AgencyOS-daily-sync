const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const code = ts.transpileModule(fs.readFileSync('src/lib/plane-retention-actions.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const url='https://app.plane.so/project-ares/projects/11111111-1111-1111-1111-111111111111/work-items/22222222-2222-2222-2222-222222222222/';
function action({authorized=true,group='backlog',archived=false}={}) {
  const writes=[]; const reads=[];
  const query={select(){return this},eq(){return this},single:async()=>({data:{discuss:'Existing notes',archived}}),update(patch){writes.push(patch);return this},then(resolve){resolve({error:null})}};
  const context={exports:{},process:{env:{SITE_PASSWORD:'test',PLANE_API_KEY:'test'}},URL,AbortSignal,fetch:async address=>{reads.push(address);return {ok:true,json:async()=>({state:{group}})}},require(name){
    if(name==='next/headers')return {cookies:()=>({get:()=>({value:authorized?'test':'wrong'})})};
    if(name==='next/cache')return {revalidatePath:()=>{}};
    if(name==='./supabase-server')return {createClient:()=>({from:()=>query})};
    if(name==='./subprojects')return {PLANE_HOME:'https://app.plane.so/project-ares/',PLANE_WORKSPACE:'project-ares'};
    throw new Error(name);
  }};
  vm.runInNewContext(code,context);
  return {run:context.exports.retainIssueInPlane,writes,reads};
}
test('unauthenticated removal cannot read Plane or update the board',async()=>{
  const a=action({authorized:false});await assert.rejects(a.run(39,url),/Sign in/);assert.equal(a.writes.length,0);assert.equal(a.reads.length,0);
});
test('foreign workspace links are rejected before any request',async()=>{
  const a=action();await assert.rejects(a.run(39,url.replace('project-ares','other')),/AgencyOS/);assert.equal(a.reads.length,0);
});
test('active or unknown Plane state cannot hide a blocker',async()=>{
  for(const group of ['started','unstarted',undefined]){const a=action({group:group??'unknown'});await assert.rejects(a.run(39,url),/still active/);assert.equal(a.writes.length,0);}
});
test('backlog removal preserves discussion and does not claim completion',async()=>{
  const a=action();await a.run(39,url);assert.equal(a.writes.length,1);assert.equal(a.writes[0].archived,true);assert.equal(a.writes[0].completed_at,null);assert.match(a.writes[0].discuss,/Existing notes/);assert.ok(a.writes[0].discuss.includes(url));assert.equal(a.writes[0].status,undefined);
});
test('already archived topic is idempotent',async()=>{
  const a=action({archived:true});await a.run(39,url);assert.equal(a.writes.length,0);
});
