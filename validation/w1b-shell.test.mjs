import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('系統數字只算失敗待重試（不再算工作包待處理）',()=>{
  const src=app.slice(app.indexOf('function failedRetryCount'),app.indexOf('async function loadGearBadge'));
  const f=new Function(src+';return failedRetryCount;')();
  assert.equal(f({jobs:[{status:'failed'},{status:'pending'},{status:'failed'},{status:'completed'}]}),2);
  assert.equal(f({}),0);
  assert.match(app,/updateGearBadge\(failedRetryCount\(s\)\)/);assert.doesNotMatch(app,/updateGearBadge\(pendingItemsFromPackages/);
});
test('頭像下拉選單：帳號與設定、系統、登出；手機頭像有數字',()=>{
  assert.match(html,/<details class="me-menu" id="meMenu">/);assert.match(html,/id="avBadge"/);assert.match(html,/id="gearMenu" role="menu"/);
  assert.match(app,/data-gear-signout/);assert.match(app,/key:'account',label:'帳號與設定'/);
});
test('登入文案：信箱登入、不用密碼',()=>{assert.match(app,/用信箱登入・不用密碼/);});
