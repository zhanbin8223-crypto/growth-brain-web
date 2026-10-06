import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('作品首頁預設是入口牆，詳細頁是第二層',()=>{
  assert.match(app,/async function renderProjectsIA\(active='gateway',notice=''\)/);
  assert.match(app,/data-open-project-detail/);
  assert.match(app,/data-project-gateway/);
  assert.match(css,/\.project-gateway-grid/);
  assert.match(css,/\.project-detail-back/);
});

test('操作完成後提示文字不會被誤當成分頁名稱',()=>{
  assert.doesNotMatch(app,/renderProjectsIA\('(?:已|這)[^']*'\)/);
  assert.match(app,/renderProjectsIA\('current','已保存。完成 GPT 整理後會先產生一件候選作品/);
  assert.match(app,/await renderProjects\(notice\)/);
});

test('作品入口只暴露入口、路徑與完成紀錄三個一級分頁',()=>{
  assert.match(app,/const tabs=\[\['gateway','作品入口'\],\['path','作品路徑'\],\['done','已完成'\]\]/);
  assert.doesNotMatch(app,/\['current','目前作品'\]/);
});
