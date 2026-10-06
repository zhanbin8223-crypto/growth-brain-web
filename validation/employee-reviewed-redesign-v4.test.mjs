import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const lab=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');

test('今天頁只有一個主焦點，不再是卡片牆',()=>{
  assert.match(app,/focus-stage/);
  assert.match(app,/focus-step/);
  assert.match(app,/focus-progress/);
  assert.doesNotMatch(app,/today-support-cards/);
  assert.doesNotMatch(app,/today-core-grid/);
});

test('作品頁保留清楚新增路徑入口，並以路徑 rail 呈現',()=>{
  assert.match(app,/data-new-project-route/);
  assert.match(app,/project-route-rail/);
  assert.match(app,/project-route-node/);
});

test('能力庫改為語意節點，不使用裝飾山景地圖',()=>{
  assert.match(app,/capability-orbit/);
  assert.match(app,/capability-zone/);
  assert.match(app,/data-capability-key/);
  assert.doesNotMatch(app,/capability-map-illustration/);
  assert.doesNotMatch(app,/cap-hill|cap-road|cap-river|cap-sun|cap-person/);
});

test('研究室使用可讀 stream，不再三欄小字卡',()=>{
  assert.match(lab,/research-stream/);
  assert.match(lab,/research-stream-item/);
  assert.doesNotMatch(lab,/research-card-grid/);
  assert.match(css,/\.research-stream-item[^}]*font-size/s);
});

test('團隊是角色 stage，不是員工卡片牆',()=>{
  assert.match(app,/team-orbit-stage/);
  assert.match(app,/team-current-work/);
  assert.match(app,/team-role-node/);
  assert.doesNotMatch(app,/studio-scene-image/);
});

test('歷程回到單一路徑 timeline，不放裝飾縮圖',()=>{
  assert.match(app,/history-timeline-v4/);
  assert.doesNotMatch(app,/version-stage-image/);
  assert.match(css,/\.history-timeline-v4/);
});

test('新版視覺不靠大量卡片與 9px 主文案',()=>{
  assert.match(css,/--v4-reading-size:14px/);
  assert.doesNotMatch(css,/\.research-card-finding\{[^}]*font-size:9px/s);
});
