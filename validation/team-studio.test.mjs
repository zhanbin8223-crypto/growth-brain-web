import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('團隊首頁以目前作品為中心的角色 stage 呈現',()=>{
  const start=app.indexOf("async function renderTeamIA(active='working')");
  const end=app.indexOf("function setView",start);
  const block=app.slice(start,end);
  assert.match(block,/team-orbit-stage/);
  assert.match(block,/team-current-work/);
  assert.match(block,/team-role-node/);
  assert.match(block,/team-role-detail/);
  assert.doesNotMatch(block,/studio-scene-image|studio-floor-spatial|home-hero-workspace/);
  assert.match(css,/\.team-orbit-stage/);
  assert.match(css,/\.team-role-node/);
});

test('Hover 關係與 Click 詳細邏輯保留',()=>{
  assert.match(app,/is-related/);
  assert.match(app,/is-dim/);
  assert.match(app,/openRole\(c\.dataset\.teamRole\)/);
  assert.match(app,/合作角色/);
  assert.match(app,/作品關聯/);
});
