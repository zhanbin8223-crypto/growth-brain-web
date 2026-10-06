import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('今天第一屏只聚焦主線與必要關聯',()=>{
  assert.match(app,/class="today-hero"/);
  assert.match(app,/class="today-core-grid"/);
  assert.match(app,/class="today-mainline-card"/);
  assert.match(app,/class="today-next-card"/);
  assert.match(app,/class="today-support-cards"/);
  assert.match(app,/目前主線/);
  assert.match(app,/今天唯一下一步/);
  assert.match(app,/預期證據/);
});

test('進展、學習、知識與系統資訊收進次要展開區',()=>{
  assert.match(app,/class="surface today-secondary"/);
  assert.match(app,/最近進展與其他資訊/);
  const home=app.slice(app.indexOf('function renderHome(){'),app.indexOf('async function renderProjects',app.indexOf('function renderHome(){')));
  const detailAt=home.indexOf('class="surface today-secondary"');
  const progressAt=home.indexOf('最近真實進展');
  const modeAt=home.indexOf('${modeStrip()}');
  assert.ok(detailAt>=0 && progressAt>detailAt);
  assert.ok(modeAt>detailAt);
});

test('首頁不再把 metrics KPI 列放在第一屏',()=>{
  const home=app.slice(app.indexOf('function renderHome(){'),app.indexOf('async function renderProjects',app.indexOf('function renderHome(){')));
  assert.doesNotMatch(home,/class="metrics"/);
  assert.match(css,/\.today-core-grid/);
  assert.match(css,/\.today-support-cards/);
});
