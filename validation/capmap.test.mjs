import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../capmap.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../capmap.css',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../adapter.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/growth-home/index.ts',import.meta.url),'utf8');
const mig=readFileSync(new URL('../supabase/migrations/20261010_work_skill_proposal_v1.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const c={};vm.createContext(c);vm.runInContext(src,c);const M=c.GROWTH_BRAIN_CAPMAP;
const A1='066f0e27',B2='204b53ce';
const sk=(a,key,name,state='unknown',extra={})=>({artifact_id:a,artifact_title:a===A1?'單一商品完整分潤流程驗證':'數字人 AI 的 Instagram 帳號',artifact_status:'candidate',skill_key:key,name_zh:name,evidence_state:state,evidence_refs:[],minimum_needed_now:'條件 3：x',self_claim:false,...extra});
const real=[sk(A1,'selection','選品判斷'),sk(A1,'persuasive-content','推廣文案撰寫'),sk(A1,'data-reading','點擊數據判讀','exposure'),
  sk(B2,'persona-planning','人設與內容企劃'),sk(B2,'persuasive-content','貼文製作與發布節奏'),sk(B2,'data-reading','IG 洞察數據判讀','real_project',{self_claim:true})];

test('程度只依 evidence_state 對應五級，未知值視為沒試過',()=>{
  assert.equal(M.levelOf('unknown'),0);assert.equal(M.levelOf('exposure'),1);assert.equal(M.levelOf('apply_with_help'),2);
  assert.equal(M.levelOf('apply_independently'),3);assert.equal(M.levelOf('commercialized'),4);assert.equal(M.levelOf('weird'),0);
  assert.equal(M.levelOf(undefined),0);
});
test('「我可能會」不會升級程度',()=>{
  const m=M.buildModel([sk(A1,'x','X','unknown',{self_claim:true})]);
  assert.equal(m.works[0].skills[0].level,0);assert.equal(m.known,0);assert.equal(m.works[0].skills[0].selfClaim,true);
});
test('依作品分組、計數正確、兩件都用到標記',()=>{
  const m=M.buildModel(real);
  assert.equal(m.works.length,2);assert.equal(m.total,6);assert.equal(m.known,2);assert.equal(m.unknown,4);
  const a=m.works.find(w=>w.id===A1);
  assert.equal(a.skills.find(s=>s.key==='persuasive-content').both,true);
  assert.equal(a.skills.find(s=>s.key==='selection').both,false);
  assert.equal(m.next.key,'selection');
});
test('目前作品排第一，下一個最值得補取自目前作品',()=>{
  const m=M.buildModel(real.map(s=>s.artifact_id===B2?{...s,artifact_status:'current'}:s));
  assert.equal(m.works[0].id,B2);assert.equal(m.next.key,'persona-planning');
});
test('篩選：全部／已經會／還沒會',()=>{
  const m=M.buildModel(real);const all=m.works.flatMap(w=>w.skills);
  assert.equal(M.filterSkills(all,'all').length,6);assert.equal(M.filterSkills(all,'known').length,2);assert.equal(M.filterSkills(all,'unknown').length,4);
});
test('條件編號解析（含多個）',()=>{
  assert.deepEqual([...M.criteriaOf('條件 4、5：真實數據')],[4,5]);assert.deepEqual([...M.criteriaOf('條件 1：x')],[1]);assert.deepEqual([...M.criteriaOf('')],[]);
});
test('列只顯示名稱＋一個程度標籤；頁面只有一個主要按鈕',()=>{
  const h=M.pageHtml(M.buildModel(real),'all');
  assert.equal((h.match(/class="cm-sk"/g)||[]).length,6);
  assert.equal((h.match(/cm-primary/g)||[]).length,1);
  assert.match(h,/兩件都用到/);assert.match(h,/全部 <em>6/);assert.match(h,/我已經會的 <em>2/);assert.match(h,/還沒會的 <em>4/);
  assert.doesNotMatch(h.split('cm-sks')[1]||'',/我可能會|交一個證據/);
});
test('沒有能力的作品顯示產生建議按鈕',()=>{
  const m=M.buildModel([],[{id:'z',title:'新作品',status:'candidate'}]);
  const h=M.pageHtml(m,'all');assert.match(h,/data-work-skills="z"/);assert.match(h,/依完成條件產生建議清單/);
});
test('詳情面板：等待中作品不能交證據；我可能會說明不改程度',()=>{
  const m=M.buildModel(real);const w=m.works[0];const s=w.skills[0];
  const p=M.panelHtml(s,w);assert.match(p,/到「今天」選它開始後，才能交證據/);assert.match(p,/程度不會改/);
  const p2=M.panelHtml(s,{...w,status:'current'});assert.match(p2,/data-cm-evidence/);
  const claimed=M.panelHtml({...s,selfClaim:true},w);assert.match(claimed,/待確認/);assert.doesNotMatch(claimed,/data-cm-claim/);
});
test('編輯器可改名/刪除/新增，儲存前需確認',()=>{
  const h=M.editorHtml('t',[{skill_key:'a',name_zh:'A',skill_kind:'tool'}]);
  assert.match(h,/data-ed-save/);assert.match(h,/data-ed-add/);assert.match(h,/data-ed-del="0"/);assert.match(h,/value="tool" selected/);
});
test('資料接線：adapter→edge→service function 一致',()=>{
  for(const [a,fn] of [['propose_work_skills','growth_work_skill_proposal_service_v1'],['save_work_skills','growth_work_skill_targets_save_service_v1'],['claim_skill','growth_skill_self_claim_service_v1']]){
    assert.ok(adapter.includes("action:'"+a+"'"),a);assert.ok(edge.includes('"'+a+'"'),a);assert.ok(edge.includes('"'+fn+'"'),fn);assert.ok(mig.includes('public.'+fn),fn);
  }
  assert.match(mig,/revoke all on function public\.growth_work_skill_targets_save_service_v1\(uuid,uuid,jsonb\) from public, anon, authenticated/);
  assert.match(mig,/'unknown','unknown',0/);assert.doesNotMatch(mig.split('on conflict (artifact_id,skill_key) do update set')[1].split(';')[0],/evidence_state/);
  assert.match(mig,/llm_used',false/);
});
test('樣式只作用在 .cm-a1；頁面載入 capmap',()=>{
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(r=>r.split('{')[0].trim()).filter(r=>r&&!r.startsWith('@')&&!r.startsWith('--'));
  for(const r of rules) assert.match(r,/\.cm-|#capabilityPane|#view-capabilities|body\.cm-lock|^\s*$/,r);
  assert.match(html,/capmap\.js/);assert.match(html,/capmap\.css/);
  assert.match(css,/max-width:760px[\s\S]*\.cm-panel\{top:auto/);
});
test('同一作品內依對應條件排序（條件 1 在前）',()=>{
  const m=M.buildModel([sk(A1,'d','D','unknown',{minimum_needed_now:'條件 4、5：x'}),sk(A1,'s','S','unknown',{minimum_needed_now:'條件 1：x'})]);
  assert.deepEqual([...m.works[0].skills.map(s=>s.key)],['s','d']);assert.equal(m.next.key,'s');
});
