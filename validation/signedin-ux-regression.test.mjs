import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('個人能力名稱優先使用正式中文名稱，不退回顯示 hash skill_key',()=>{
  const start=app.indexOf("async function renderCapabilities(active='cells')");
  const end=app.indexOf("async function renderResearch",start);
  const block=app.slice(start,end);
  assert.match(block,/const nameOf=x=>x\?\.name_zh\|\|x\?\.title\|\|x\?\.name/);
});

test('作品頁直接看到新作品路徑輸入，不需先猜按鈕在哪',()=>{
  const start=app.indexOf("async function renderProjectsIA(active='gateway',notice='')");
  const end=app.indexOf("async function renderTeamIA",start);
  const block=app.slice(start,end);
  assert.match(block,/id="newProjectRouteForm"/);
  assert.match(block,/data-new-route-panel/);
  assert.doesNotMatch(block,/data-new-route-panel hidden/);
  assert.match(block,/placeholder="例如：建立一條 AI 短影音變現路徑"/);
});

test('主要頁面重新套用既有製圖素材，但不取代資訊結構',()=>{
  assert.match(app,/class="v4-page-art"/);
  assert.match(app,/assets\/ui\/home-hero-workspace\.webp/);
  assert.match(app,/assets\/ui\/home-project-cover\.webp/);
  assert.match(css,/\.v4-page-art/);
});

test('作品新增路徑表單維持候選保存 API，不會直接覆蓋主線',()=>{
  assert.match(app,/A\.savePersonalOutcomeCandidate/);
  assert.match(app,/不會自動取代目前主線/);
});
