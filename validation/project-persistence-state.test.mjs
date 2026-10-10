import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const files=['project-kickoff.js','project-milestones.js'].map(name=>readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const goal='建立一個數字人 AI 的 Instagram 帳號，測試內容流量與未來變現可能性。';
const copy=value=>JSON.parse(JSON.stringify(value));
function runtime(){
  const box={innerHTML:'',handlers:{},note:'',insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelector(selector){
    const key=selector.slice(1,-1);
    if(!this.innerHTML.includes(key))return null;
    if(key==='data-project-step-evidence')return {value:this.note};
    return {disabled:false,addEventListener:(_,fn)=>{this.handlers[key]=fn;}};
  }};
  const ctx={window:{alert:()=>{}},document:{querySelector:()=>null},queueMicrotask:fn=>fn(),SYSTEM:{},
    PROJECT_TEAM_DRAFT:{goal,selectedKeys:['goal-closure-operator','logic-reality-analyst','descript'],generated:true},
    renderProjectTeamDraft:container=>{container.innerHTML='BASE';container.handlers={};},
    projectTeamCatalog:()=>[
      {key:'goal-closure-operator',name:'達案執行官',kind:'employee',autoEligible:true},
      {key:'logic-reality-analyst',name:'邏輯／真實性分析員',kind:'employee',autoEligible:true},
      {key:'descript',name:'Descript',kind:'tool',autoEligible:true}],
    projectTeamScope:x=>'scope:'+x.key,projectTeamKindLabel:x=>x.kind,
    projectGoalTags:()=>new Set(['traffic','business']),console};
  vm.createContext(ctx);files.forEach(source=>vm.runInContext(source,ctx));
  const h={ctx,box,api:ctx.window,render:()=>ctx.renderProjectTeamDraft(box,ctx.SYSTEM),
    click:key=>{assert.equal(typeof box.handlers[key],'function',key);box.handlers[key]();},
    snapshot:()=>copy({draft:ctx.PROJECT_TEAM_DRAFT,kickoff:ctx.window.GROWTH_BRAIN_PROJECT_KICKOFF.current(),brief:ctx.window.GROWTH_BRAIN_PROJECT_BRIEF.current(),milestones:ctx.window.GROWTH_BRAIN_PROJECT_MILESTONES.current()})};
  h.render();return h;
}
function generate(h){h.click('data-project-team-kickoff');h.click('data-project-brief-generate');h.click('data-build-project-milestones');}
function report(h,note){h.box.note=note;h.click('data-project-step-report');}
function restore(h,s){
  h.ctx.PROJECT_TEAM_DRAFT=copy(s.draft);
  assert.equal(h.api.GROWTH_BRAIN_PROJECT_KICKOFF.restore(s.kickoff),true);
  assert.equal(h.api.GROWTH_BRAIN_PROJECT_BRIEF.restore(s.brief),true);
  assert.equal(h.api.GROWTH_BRAIN_PROJECT_MILESTONES.restore(s.milestones),true);
  h.render();
}

test('fresh runtime restores unchanged meeting, Brief, milestone and current step without generating',()=>{
  const a=runtime();generate(a);report(a,'測試證據：只驗證軟體保存');
  const saved=a.snapshot(),b=runtime();restore(b,saved);
  assert.deepEqual(b.snapshot(),saved);
  assert.equal((b.box.innerHTML.match(/class="project-milestone-steps"/g)||[]).length,1);
  report(b,'第二步的隔離測試證據');
  assert.equal(b.snapshot().milestones.current_step,2);
  assert.equal(b.snapshot().milestones.current_steps[0].evidence_note,'測試證據：只驗證軟體保存');
});

test('moving to next milestone retains prior evidence through another runtime',()=>{
  const a=runtime();generate(a);
  const count=a.snapshot().milestones.current_steps.length;
  for(let i=0;i<count;i++)report(a,'隔離測試證據 '+i);
  a.click('data-project-next-milestone');report(a,'第二階段第一步測試證據');
  const saved=a.snapshot(),b=runtime();restore(b,saved);
  assert.equal(saved.milestones.current_milestone,1);
  assert.equal(saved.milestones.current_step,1);
  assert.deepEqual(b.snapshot(),saved);
  assert.deepEqual(saved.milestones.milestones[0].steps.map(x=>x.evidence_note),Array.from({length:count},(_,i)=>'隔離測試證據 '+i));
  assert.equal((b.box.innerHTML.match(/class="project-milestone-steps"/g)||[]).length,1);
});

for(const kind of ['team','goal'])test(kind+' edits invalidate all downstream state, including restored state',()=>{
  const a=runtime();generate(a);const b=runtime();restore(b,a.snapshot());
  if(kind==='team')b.ctx.PROJECT_TEAM_DRAFT.selectedKeys.pop();else b.ctx.PROJECT_TEAM_DRAFT.goal='另一個測試作品目標';
  b.render();
  assert.equal(b.api.GROWTH_BRAIN_PROJECT_KICKOFF.current(),null);
  assert.equal(b.api.GROWTH_BRAIN_PROJECT_BRIEF.current(),null);
  assert.equal(b.api.GROWTH_BRAIN_PROJECT_MILESTONES.current(),null);
});

test('restore rejects mismatched goal, team, meeting signature and malformed arrays',()=>{
  const a=runtime();generate(a);const saved=a.snapshot();
  for(const alter of [s=>{s.kickoff.goal+='changed';},s=>{s.kickoff.team_keys.reverse();},s=>{s.kickoff.summary.risks='invalid';},s=>{s.kickoff.contributions[0]=null;}]){
    const b=runtime(),bad=copy(saved);alter(bad);
    assert.equal(b.api.GROWTH_BRAIN_PROJECT_KICKOFF.restore(bad.kickoff),false);
    assert.equal(b.api.GROWTH_BRAIN_PROJECT_KICKOFF.current(),null);
  }
  for(const alter of [b=>{b.source_meeting_signature='stale';},b=>{b.team_keys=[];},b=>{b.boundaries=null;},b=>{b.team_responsibilities=[null];}]){
    const b=runtime();assert.ok(b.api.GROWTH_BRAIN_PROJECT_KICKOFF.restore(saved.kickoff));
    const bad=copy(saved.brief);alter(bad);assert.equal(b.api.GROWTH_BRAIN_PROJECT_BRIEF.restore(bad),false);
  }
});

test('milestone restore rejects malformed index, evidence and previous-stage state',()=>{
  const a=runtime();generate(a);const count=a.snapshot().milestones.current_steps.length;
  for(let i=0;i<count;i++)report(a,'隔離測試 '+i);
  a.click('data-project-next-milestone');const saved=a.snapshot();
  for(const alter of [p=>{p.current_step=-1;},p=>{p.current_step=999;},p=>{p.current_step=0.5;},p=>{p.current_milestone=999;},p=>{p.expanded_milestone=0;},p=>{p.current_steps=null;},p=>{p.milestones[0].steps=[];},p=>{p.milestones[0].steps[0].evidence_note=null;},p=>{p.milestones[1].steps[0].text='wrong';},p=>{p.milestones[2].steps=[];},p=>{p.verified_personal_progress=true;}]){
    const b=runtime();restore(b,saved);const bad=copy(saved.milestones);alter(bad);
    assert.equal(b.api.GROWTH_BRAIN_PROJECT_MILESTONES.restore(bad),false);
    assert.equal(b.api.GROWTH_BRAIN_PROJECT_MILESTONES.current(),null);
  }
});

// jsonb normalizes object-key order but preserves array order and string values.
const reordered=value=>Array.isArray(value)?value.map(reordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().reverse().map(k=>[k,reordered(value[k])])):value;
test('database jsonb object-key reordering preserves signatures and restores all state',()=>{
  const a=runtime();generate(a);report(a,'隔離測試資料庫 key 順序');
  const saved=a.snapshot(),databaseValue=reordered(saved);
  // Also exercise semantically equal current step objects with independently ordered keys.
  databaseValue.milestones.current_steps=copy(saved.milestones.current_steps);
  const b=runtime();restore(b,databaseValue);
  assert.deepEqual(b.snapshot(),saved);
  assert.equal(b.snapshot().brief.base_prompt,saved.brief.base_prompt);
  assert.equal(b.snapshot().milestones.current_step,1);
});
