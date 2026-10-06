import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('歷程首頁預設是版本時間線，不是 dashboard 或 Git log',()=>{
  assert.match(app,/async function renderHistory\(active='system'\)/);
  assert.match(app,/\['system','版本歷程'\]/);
  for(const label of ['V3','互動式 Growth Brain','V2','Worker 與事件漏斗','V1.5','作品、能力、員工','V1','資料庫與基本網站']){
    assert.ok(app.includes(label),label);
  }
  assert.match(app,/history-timeline-v4/);
});

test('版本敘事與正式資料庫更新紀錄分開',()=>{
  assert.match(app,/history-formal-log/);
  assert.ok(app.includes('正式更新紀錄'));
  assert.ok(app.includes('版本敘事與正式更新紀錄分開'));
  assert.match(css,/\.history-timeline-v4/);
  assert.match(css,/\.history-formal-log/);
});

test('歷程不再使用裝飾縮圖冒充資訊結構',()=>{
  const block=app.slice(app.indexOf("async function renderHistory"),app.indexOf("async function renderSystem"));
  assert.doesNotMatch(block,/version-stage-image|home-project-cover|home-hero-workspace/);
  assert.match(block,/history-version-node/);
});
