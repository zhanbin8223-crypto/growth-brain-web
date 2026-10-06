import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('作品入口使用正式縮圖素材，不回到 SVG placeholder',()=>{
  const start=app.indexOf("async function renderProjectsIA(active='gateway',notice='')");
  const end=app.indexOf("async function renderTeamIA",start);
  const block=app.slice(start,end);
  assert.ok(block.includes('assets/ui/home-project-cover.webp'));
  assert.doesNotMatch(block,/project-cover[^\n]*<svg/);
});

test('作品入口有清楚的頁首、卡片分層與進度視覺',()=>{
  for(const token of ['project-page-hero','project-gallery','project-cover-image','project-card-meta','project-progress-track']){
    assert.ok(app.includes(token),token);
  }
  assert.match(css,/\.project-page-hero/);
  assert.match(css,/\.project-cover-image/);
  assert.match(css,/\.project-progress-track/);
});

test('作品卡仍保留既定資訊順序',()=>{
  const order=['project-name','project-version-title','project-status','project-progress'];
  let last=-1;
  for(const token of order){
    const at=app.indexOf(token,app.indexOf("async function renderProjectsIA"));
    assert.ok(at>last,token);
    last=at;
  }
});
