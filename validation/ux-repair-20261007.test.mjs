import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const lab=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');

test('研究主內容達到可讀尺寸',()=>{
  assert.match(css,/--v4-reading-size:14px/);
  assert.match(css,/\.research-stream-finding[^}]*font-size:var\(--v4-reading-size\)/s);
  assert.match(css,/\.research-stream-main h3[^}]*font-size:22px/s);
});

test('作品首頁有明確的新作品路徑入口與候選保存',()=>{
  assert.match(app,/data-new-project-route/);
  assert.match(app,/id="newProjectRouteForm"/);
  assert.match(app,/A\.savePersonalOutcomeCandidate/);
  assert.match(app,/不會自動取代目前主線/);
  assert.match(app,/candidate_route/);
});

test('能力庫不再使用失真的插畫地圖，改用 evidence state 節點',()=>{
  const start=app.indexOf("async function renderCapabilities(active='cells')");
  const end=app.indexOf("async function renderResearch",start);
  const block=app.slice(start,end);
  assert.match(block,/capability-orbit/);
  assert.match(block,/capability-zone/);
  assert.match(block,/data-capability-key/);
  assert.doesNotMatch(block,/capability-map-illustration|capability-landscape|cap-hill|cap-road/);
});

test('研究室不再用 research card grid',()=>{
  assert.match(lab,/research-stream/);
  assert.doesNotMatch(lab,/research-card-grid/);
});
