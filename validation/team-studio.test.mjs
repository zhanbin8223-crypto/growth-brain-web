import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('團隊首頁是工作室場景，不是員工卡片牆',()=>{
  const start=app.indexOf("async function renderTeamIA(active='working')");
  const end=app.indexOf("function setView",start);
  const block=app.slice(start,end);
  assert.match(block,/studio-floor-spatial/);
  assert.match(block,/assets\/ui\/home-hero-workspace\.webp/);
  assert.match(block,/studio-people spatial/);
  assert.match(block,/studio-person s/);
  assert.match(block,/team-summary-strip/);
  assert.match(css,/\.studio-person\.s1/);
  assert.match(css,/\.studio-scene-image/);
});

test('Hover 關係與 Click 詳細邏輯仍保留',()=>{
  assert.match(app,/is-related/);
  assert.match(app,/is-dim/);
  assert.match(app,/openRole\(c\.dataset\.teamRole\)/);
  assert.match(app,/合作角色/);
  assert.match(app,/作品關聯/);
});
