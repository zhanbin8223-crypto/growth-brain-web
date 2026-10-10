import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../myjobs.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../myjobs.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const lab=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../adapter.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/growth-home/index.ts',import.meta.url),'utf8');
const mig=readFileSync(new URL('../supabase/migrations/20261010_my_jobs_snapshot_v1.sql',import.meta.url),'utf8');
const c={};vm.createContext(c);vm.runInContext(src,c);const M=c.GROWTH_BRAIN_MYJOBS;
const NOW=Date.parse('2026-10-10T11:10:00Z');
const job=(o)=>({id:'j',task_type:'learning_explanation',status:'pending',scope:'real',title:'AIHOT',created_at:'2026-10-10T11:00:00Z',cancellable:true,...o});

test('五種狀態中文',()=>{for(const [k,v] of [['pending','排隊中'],['claimed','處理中'],['processing','處理中'],['completed','完成'],['failed','失敗'],['cancelled','已取消']])assert.equal(M.statusLabel(k),v);});
test('Worker 超過 10 分鐘沒心跳＝離線，不信任 stale online',()=>{
  assert.equal(M.workerState('2026-10-10T11:05:00Z',NOW).online,true);
  const off=M.workerState('2026-10-06T12:22:00Z',NOW);assert.equal(off.online,false);assert.match(off.text,/處理程式離線，最後上線 10\/6/);
  assert.equal(M.workerState(null,NOW).online,false);
});
test('等待時間與花費時間',()=>{
  assert.equal(M.waitText(job(),NOW),'已等 10 分鐘');
  assert.equal(M.waitText(job({status:'completed',completed_at:'2026-10-10T13:00:00Z'}),NOW),'花了 2 小時');
  assert.equal(M.waitText(job({status:'cancelled'}),NOW),'');
});
test('完成才有結果連結；失敗才有重試（只用既有機制）',()=>{
  assert.equal(M.resultLink(job()),null);
  assert.equal(M.resultLink(job({status:'completed'})),'#/learn/practice');
  assert.equal(M.resultLink(job({status:'completed',task_type:'event_funnel_v1'})),'#/lab/today');
  assert.equal(M.retryAction(job({status:'failed',session_id:'s1'})).kind,'learning');
  assert.equal(M.retryAction(job({status:'failed',task_type:'event_funnel_v1'})).kind,'lab');
  assert.equal(M.retryAction(job({status:'failed',task_type:'tech_radar_x'})),null);
});
test('新完成計數：只算我送出的、晚於上次查看',()=>{
  const js=[job({status:'completed',completed_at:'2026-10-10T11:05:00Z'}),job({status:'completed',completed_at:'2026-10-10T10:00:00Z'}),job({status:'completed',scope:'system',completed_at:'2026-10-10T11:05:00Z'})];
  assert.equal(M.newCompleted(js,'2026-10-10T10:30:00Z'),1);assert.equal(M.newCompleted(js,null),2);
});
test('列表：離線原因、取消按鈕依 cancellable、系統任務預設隱藏',()=>{
  const snap={worker:{last_seen_at:'2026-10-06T12:22:00Z'},jobs:[job(),job({id:'k',scope:'system',title:'SYS',cancellable:false}),job({id:'d',status:'completed',completed_at:'2026-10-10T11:05:00Z',cancellable:false,result_summary:'答案'})]};
  const h=M.pageHtml(snap,'mine',NOW);
  assert.match(h,/處理程式離線，最後上線/);assert.doesNotMatch(h,/SYS/);
  assert.equal((h.match(/data-mq-cancel=/g)||[]).length,1);assert.match(h,/看結果/);assert.match(h,/1 件等待中/);
  assert.match(M.pageHtml(snap,'all',NOW),/SYS/);
});
test('接線：收集 › 我的提問、adapter→edge→service、Learning/Lab 橫幅',()=>{
  assert.match(app,/key:'questions',label:'我的提問'/);
  assert.match(adapter,/liveRequest\('GET',undefined,'my_jobs'\)/);assert.match(adapter,/action:'cancel_job'/);
  assert.match(edge,/growth_my_jobs_snapshot_service_v1/);assert.match(edge,/growth_my_job_cancel_service_v1/);
  assert.match(app,/data-worker-inline/);assert.match(lab,/M\.workerState\(last\)/);
  assert.doesNotMatch(lab,/h\?\.status==='online'/);
});
test('DB：snapshot STABLE、cancel 只限本人且只限 pending/failed、權限只給 service_role',()=>{
  assert.match(mig,/my_jobs_snapshot_v1\(p_person_id uuid\)\nreturns jsonb language sql stable/);
  assert.match(mig,/where id=p_job_id and person_id=p_person_id/);assert.match(mig,/status not in \('pending','failed'\)/);
  assert.match(mig,/revoke all on function public\.growth_my_job_cancel_service_v1\(uuid,uuid\) from public, anon, authenticated/);
  assert.match(mig,/interval '10 minutes'/);
});
test('樣式只作用在我的提問範圍',()=>{
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@media[^{]*\{/,'').split('}').map(r=>r.split('{')[0].trim()).filter(r=>r&&!r.startsWith('--'));
  for(const r of rules)assert.match(r,/\.mq-|\.nav-item/,r);
});
