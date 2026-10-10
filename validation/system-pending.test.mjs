import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const src=app.slice(app.indexOf('const PENDING_NEEDS='),app.indexOf('async function renderSystem(){'));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const c={esc};vm.createContext(c);vm.runInContext(src+';this.f=pendingItemsFromPackages;this.h=pendingBlockHtml;',c);
const pkgs=[{title:'A',blockers:[{code:'X',title:'重跑',needs:'rerun',status:'pending'},{code:'Y',title:'登入',needs:'user',status:'pending'},{code:'Z',title:'已解決',status:'resolved'}]},{package_key:'b',blockers:[{code:'OLD',severity:'P1'}]}];
test('待處理只列未解決項目，需要本人操作排最前',()=>{
  const items=c.f(pkgs);
  assert.equal(items.length,3);
  assert.equal(items[0].code,'Y');
  assert.ok(!items.some(x=>x.code==='Z'));
  assert.equal(items.find(x=>x.code==='OLD').title,'OLD');
});
test('區塊以繁中顯示並跳脫內容',()=>{
  const html=c.h(c.f([{title:'P',blockers:[{title:'<b>x</b>',needs:'approval',status:'pending'}]}]));
  assert.match(html,/還沒完成的事（1）/);assert.match(html,/等你核准/);assert.doesNotMatch(html,/<b>x<\/b>/);
  assert.match(c.h([]),/目前沒有待處理項目/);
});
test('系統維護頁把待處理放在最上方',()=>{
  const sys=app.slice(app.indexOf('async function renderSystem(){'));
  assert.match(sys,/root\.innerHTML=pendingBlockHtml\(pendingItemsFromPackages\(pkgs\)\)\+`\s*<div class="section-head">/);
});
