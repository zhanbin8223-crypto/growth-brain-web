import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../w1b-pages.js',import.meta.url),'utf8'),c);const W=c.GROWTH_BRAIN_W1P;
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const inbox=fs.readFileSync(new URL('../inbox.js',import.meta.url),'utf8');
const now=new Date('2026-10-11T10:00:00+08:00');
test('回顧：週從星期一開始，月從 1 號開始，前後期可切換',()=>{
  const w=W.periodRange('week',0,now);assert.equal(w.s.getDay(),1);assert.equal((w.e-w.s)/864e5,7);
  const m=W.periodRange('month',-1,now);assert.equal(m.s.getDate(),1);assert.equal(m.s.getMonth(),8);
});
test('回顧：只算期間內的真實紀錄；沒有就顯示空狀態；下一期在本期時停用',()=>{
  const g={personal:[{type:'evidence',title:'交證據',occurred_at:'2026-10-09T03:00:00Z'},{type:'decision',title:'舊的',occurred_at:'2026-09-01T00:00:00Z'}],skills:[],research:[{title:'研究 A',status:'active',occurred_at:'2026-10-06T00:00:00Z'}]};
  const h=W.reviewHtml(g,'week',0,now);assert.ok(h.includes('交證據'));assert.ok(!h.includes('舊的'));assert.ok(h.includes('研究 A'));assert.match(h,/data-rv-step="1"[^>]*disabled/);
  assert.ok(W.reviewHtml(g,'week',-10,now).includes('這週還沒有紀錄'));
  assert.ok(W.reviewHtml(g,'month',0,now).includes('2026 年 10 月'));
});
test('需要你決定：只用既有資料，沒有項目就不輸出',()=>{
  assert.equal(W.decideHtml(W.decideItems({waiting:[{title:'B',done_evidence:['x']}],unsorted:0})),'');
  const h=W.decideHtml(W.decideItems({waiting:[{title:'B',done_evidence:[]}],unsorted:3,unsortedSince:'10/6'}));
  assert.ok(h.includes('需要你決定'));assert.ok(h.includes('3 則收集還沒分類'));assert.ok(h.includes('#/collect/inbox'));
});
test('系統待處理：失敗、排隊、決定紀錄分組，數字只算失敗',()=>{
  const h=W.sysPendingHtml({jobs:[{status:'failed',title:'F'},{status:'pending'},{status:'completed'}],worker:{online:false}},[{title:'D',needsLabel:'等你決定'}]);
  assert.ok(h.includes('失敗、等你重試 <span class="ttag">1</span>'));assert.ok(h.includes('排隊中，不用處理 <span class="ttag">1</span>'));assert.ok(h.includes('D'));
  assert.doesNotMatch(app,/updateGearBadge\(items\.length\)/);
});
test('作品標題列有「新增作品」，今天空狀態連到既有建立入口',()=>{
  assert.ok(W.worksHtml({current:{title:'A',done_evidence:['x']},candidates:[]}).includes('data-new-work'));
  assert.match(app,/function todayEmptyHtml/);assert.match(app,/建立第一件作品/);
});
test('收集：GB 自動分類標籤與篩選，保留既有表單 id',()=>{
  for(const k of ['GB 自動分類','data-co-tag','id="inboxForm"','id="inboxContent"','id="inboxUrl"','id="inboxMsg"','id="inboxItems"'])assert.ok(inbox.includes(k),k);
});
test('學習：沒卡住／卡住兩種版面，保留學習表單 id',()=>{
  for(const k of ['下一個建議練習','現在的練習','id="learningInputForm"','id="learningText"','id="liveLessonList"','id="liveLessonDetail"'])assert.ok(app.includes(k),k);
});
