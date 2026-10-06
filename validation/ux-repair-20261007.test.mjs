import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('研究卡片文字達到可讀尺寸',()=>{
  assert.match(css,/\.research-card-finding\{[^}]*font-size:13px/s);
  assert.match(css,/\.research-card-tags \.pill\{font-size:10px/);
  assert.match(css,/\.research-next-step b,\.research-next-step span\{font-size:11px/);
  assert.match(css,/\.research-card-actions \.ghost-btn,\.research-card-actions \.primary-btn\{font-size:11px/);
});

test('作品首頁有明確的新作品路徑入口與候選保存',()=>{
  assert.match(app,/data-new-project-route/);
  assert.match(app,/id="newProjectRouteForm"/);
  assert.match(app,/A\.savePersonalOutcomeCandidate/);
  assert.match(app,/只建立候選路徑，不會切換目前主線/);
  assert.match(app,/candidate_route/);
});

test('能力庫使用插畫式能力地圖並保留互動節點',()=>{
  assert.match(app,/assets\/ui\/capability-map-illustration\.svg/);
  assert.match(app,/capability-map-stage/);
  assert.match(app,/data-capability-key/);
  const start=app.indexOf("async function renderCapabilities(active='cells')");
  const end=app.indexOf("async function renderResearch",start);
  const block=app.slice(start,end);
  assert.doesNotMatch(block,/cap-hill|cap-road|cap-river|cap-sun|cap-person/);
});
