import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('作品入口使用語意路徑 rail，不靠縮圖卡片牆',()=>{
  const start=app.indexOf("async function renderProjectsIA(active='gateway',notice='')");
  const gatewayEnd=app.indexOf("\n  }else{\n    root.innerHTML=iaTabs(tabs,active)",start);
  const block=app.slice(start,gatewayEnd);
  assert.match(block,/project-route-rail/);
  assert.match(block,/project-route-node/);
  assert.doesNotMatch(block,/project-gallery|project-cover-image|project-page-hero/);
  assert.match(css,/\.project-route-rail/);
  assert.match(css,/\.project-route-node/);
});

test('作品入口保留清楚的新作品路徑入口與目前作品進入點',()=>{
  assert.match(app,/data-new-project-route/);
  assert.match(app,/id="newProjectRouteForm"/);
  assert.match(app,/data-open-project-detail/);
  assert.match(app,/route-action/);
});

test('候選節點不會被視覺宣告成目前作品',()=>{
  const start=app.indexOf("async function renderProjectsIA(active='gateway',notice='')");
  const end=app.indexOf("async function renderTeamIA",start);
  const block=app.slice(start,end);
  assert.match(block,/project-route-node candidate/);
  assert.match(block,/候選路徑|候選作品/);
  assert.match(block,/尚未成為目前主線|還不是目前作品/);
});
