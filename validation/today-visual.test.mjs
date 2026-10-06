import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('今天頁維持單一焦點構圖，並恢復節制的製圖素材',()=>{
  const home=app.slice(app.indexOf('function renderHome(){'),app.indexOf('async function renderProjects',app.indexOf('function renderHome(){')));
  for(const token of ['v4-page-head','focus-stage','focus-step','focus-progress'])assert.ok(home.includes(token),token);
  assert.match(home,/home-hero-workspace\.webp/);
  assert.match(home,/v4-page-art/);
  assert.doesNotMatch(home,/today-hero/);
});

test('全站不顯示第二層 global page title bar',()=>{
  assert.match(css,/\.topbar\{[^}]*display:none/s);
  assert.ok(index.includes('class="nav-tools"'));
});

test('導覽工具列承接登入狀態，不依賴已隱藏 topbar',()=>{
  assert.doesNotMatch(app,/\$\('\.top-actions'\)\.prepend\(box\)/);
  assert.ok(app.includes("$('.nav-tools')||$('.top-actions')"));
});
