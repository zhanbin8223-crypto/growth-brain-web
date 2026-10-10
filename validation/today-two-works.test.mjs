import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const escSrc=app.match(/const esc=.*\n/)[0];
const helpers=app.slice(app.indexOf('const TODAY_COVERS'),app.indexOf('function bindTodayPick'));
function ctx(artifacts){
  const c={A:{personalArtifacts:artifacts}};
  vm.createContext(c);vm.runInContext(escSrc+helpers+';this.api={todayCandidates,todayChooseHtml,todayLoggedOutHtml,todayRing};',c);
  return c.api;
}
const w=(id,title,crit)=>({id,title,status:'candidate',objective:'o',done_evidence:crit});

test('沒有目前作品時，兩件候選都顯示成卡片，且有選這件開始',()=>{
  const api=ctx({candidates:[w('a1','單一商品完整分潤流程驗證',['找 1 筆真實商品資料','x']),w('b2','數字人 AI 的 Instagram 帳號',[])]});
  const c=api.todayCandidates();assert.equal(c.length,2);
  const html=api.todayChooseHtml(c);
  assert.equal((html.match(/data-today-pick=/g)||[]).length,2);
  assert.match(html,/今天，先選一件作品開始/);
  assert.match(html,/共 2 個完成條件/);
  assert.match(html,/完成條件待產生/);
  assert.match(html,/另一件會留在「作品」頁的等待中/);
});

test('舊版 snapshot 只有 candidate 時仍可運作，非候選被過濾',()=>{
  assert.equal(ctx({candidate:w('a','t',[])}).todayCandidates().length,1);
  assert.equal(ctx({candidates:[{...w('a','t',[]),status:'current'}]}).todayCandidates().length,0);
});

test('作品標題會被跳脫，避免 XSS',()=>{
  const api=ctx({candidates:[w('x','<img src=x onerror=1>',[])]});
  assert.doesNotMatch(api.todayChooseHtml(api.todayCandidates()),/<img src=x/);
});

test('登出價值頁有登入入口與三步循環',()=>{
  const html=ctx({}).todayLoggedOutHtml();
  assert.match(html,/data-auth/);assert.match(html,/每天只做/);assert.equal((html.match(/td-step/g)||[]).length,3);
});

test('進度環百分比與確認流程呼叫既有 set-current（decidePersonalArtifact start）',()=>{
  assert.match(ctx({}).todayRing(40),/40%/);
  const bind=app.slice(app.indexOf('function bindTodayPick'),app.indexOf('function renderHome('));
  assert.match(bind,/data-today-confirm/);
  assert.match(bind,/decidePersonalArtifact\(\{artifactId:id,decision:'start'\}\)/);
});

test('設計 token 只作用在 .td 範圍內，不改全站 :root',()=>{
  const block=css.slice(css.indexOf('Today redesign'));
  assert.doesNotMatch(block,/:root/);
  assert.match(block,/^\.td\{--td-/m);
  assert.doesNotMatch(block,/^body\{/m);
});
