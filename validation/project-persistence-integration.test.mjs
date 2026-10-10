import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
function adapterHarness({mismatch=false}={}){
 const calls=[];let saved=null;
 const c={URL,console,localStorage:{getItem:()=>null},window:{GROWTH_BRAIN_DEMO:{},GROWTH_BRAIN_CONFIG:{edgeFunctionUrl:'https://example.test/growth-home',publishableKey:'test-public'},GROWTH_BRAIN_AUTH:{getValidSession:async()=>({access_token:'test-only'})}},
 fetch:async(url,options)=>{calls.push({url,...options});if(options.method==='POST'){saved=JSON.parse(options.body).builder_state;return {ok:true,json:async()=>({ok:true})};}return {ok:true,json:async()=>({data:{candidate_route:{id:'test-route',version:1,source_evidence:{artifact_team_builder:mismatch?{}:saved}}}})};}};
 vm.createContext(c);vm.runInContext(read('adapter.js'),c);const a=c.window.GROWTH_BRAIN_ADAPTER;a.mode='live';return {a,calls};
}
const state={version:'artifact-team-builder-v1',goal:'Test goal',team:{selectedKeys:[],generated:false},kickoff:null,brief:null,milestones:null};
test('adapter sends complete plan and verifies independent GET after POST',async()=>{
 const {a,calls}=adapterHarness();a.personalOutcome={candidate_route:{id:'stale'}};
 const r=await a.savePersonalOutcomeCandidate({title:state.goal,successEvidence:'Evidence',builderState:state,routeId:'test-route',expectedVersion:1});
 assert.equal(r.candidate_route.id,'test-route');assert.equal(calls.length,2);assert.equal(calls[0].method,'POST');assert.equal(calls[1].method,'GET');
 assert.deepEqual(JSON.parse(calls[0].body).builder_state,state);assert.equal(JSON.parse(calls[0].body).expected_version,1);
});
test('adapter refuses false success when backend read-back differs',async()=>{
 const {a}=adapterHarness({mismatch:true});await assert.rejects(a.savePersonalOutcomeCandidate({title:state.goal,successEvidence:'Evidence',builderState:state}),/不一致/);
});
test('force outcome read bypasses old session cache',async()=>{
 const {a,calls}=adapterHarness();a.personalOutcome={cached:true};await a.getPersonalOutcome();assert.equal(calls.length,0);await a.getPersonalOutcome({force:true});assert.equal(calls.length,1);
});
test('failed route restore cannot leave a saveable partial document',()=>{
 const app=read('app.js');const fn=app.slice(app.indexOf('function restoreProjectTeamRoute('),app.indexOf('async function renderProjectsIA('));
 const c={window:{}};for(const k of ['KICKOFF','BRIEF','MILESTONES'])c.window['GROWTH_BRAIN_PROJECT_'+k]={reset:()=>{},restore:()=>k!=='BRIEF'};
 vm.createContext(c);vm.runInContext("let PROJECT_TEAM_DRAFT={};let PROJECT_TEAM_ROUTE=null;"+fn,c);
 c.route={id:'route',version:1,title:state.goal,source_evidence:{artifact_team_builder:{...state,kickoff:{},brief:{}}}};
 assert.equal(vm.runInContext('restoreProjectTeamRoute(route)',c),false);assert.equal(vm.runInContext('PROJECT_TEAM_DRAFT.goal',c),'');assert.equal(vm.runInContext('PROJECT_TEAM_ROUTE',c),null);
});
test('Edge builder save verifies user and does not enqueue a replacement plan',async()=>{
 let handler;const calls=[];
 const c={URL,Response,console,Deno:{env:{get:k=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'test-only'})[k]},serve:fn=>{handler=fn;}},fetch:async(url,options)=>{
  calls.push({url,...options});return new Response(JSON.stringify(url.endsWith('/auth/v1/user')?{id:'verified-user'}:{accepted:true,snapshot:{candidate_route:{id:'test'}}}),{status:200});}};
 vm.createContext(c);vm.runInContext(stripTypeScriptTypes(read('supabase/functions/growth-home/index.ts')),c);
 const res=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify({action:'save_personal_outcome_candidate',title:state.goal,success_evidence:'Evidence',builder_state:state})}));
 assert.equal(res.status,200);assert.equal(calls.length,2);assert.match(calls[0].url,/auth\/v1\/user$/);assert.match(calls[1].url,/growth_artifact_team_builder_save_service_v1$/);
 assert.equal(JSON.parse(calls[1].body).p_auth_user_id,'verified-user');
 const unauth=await handler(new Request('https://example.test',{method:'POST'}));assert.equal(unauth.status,401);
});
