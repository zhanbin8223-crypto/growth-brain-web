import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('今天第一屏只聚焦目前作品、唯一下一步與進度',()=>{
  const home=app.slice(app.indexOf('function renderTodayFocus(){'),app.indexOf('async function renderProjects',app.indexOf('function renderTodayFocus(){')));
  assert.match(home,/focus-stage/);
  assert.match(home,/focus-context/);
  assert.match(home,/focus-step/);
  assert.match(home,/focus-progress/);
  assert.match(home,/唯一下一步/);
  assert.match(home,/完成後要留下/);
  assert.doesNotMatch(home,/today-core-grid|today-support-cards|class="metrics"/);
});

test('能力、學習與最近進展收進需要時再打開',()=>{
  const home=app.slice(app.indexOf('function renderTodayFocus(){'),app.indexOf('async function renderProjects',app.indexOf('function renderTodayFocus(){')));
  assert.match(home,/focus-support-panel/);
  assert.match(home,/需要時再打開/);
  assert.match(home,/只有目前這一步真的被知識缺口卡住時/);
  assert.match(css,/\.focus-support/);
});

test('今天頁只有一個主要執行 CTA 層級',()=>{
  assert.match(css,/\.focus-primary/);
  assert.match(css,/\.focus-step/);
});
