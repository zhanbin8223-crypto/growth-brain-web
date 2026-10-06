import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('今天頁使用員工審查後的單一焦點構圖，不靠裝飾主圖',()=>{
  const home=app.slice(app.indexOf('function renderHome(){'),app.indexOf('async function renderProjects',app.indexOf('function renderHome(){')));
  for(const token of ['v4-page-head','focus-stage','focus-step','focus-progress'])assert.ok(home.includes(token),token);
  assert.doesNotMatch(home,/home-hero-workspace|home-project-cover|today-hero/);
});

test('全站不顯示第二層 global page title bar',()=>{
  assert.match(css,/\.topbar\{[^}]*display:none/s);
  assert.ok(index.includes('class="nav-tools"'));
});

test('導覽工具列承接登入狀態，不依賴已隱藏 topbar',()=>{
  assert.doesNotMatch(app,/\$\('\.top-actions'\)\.prepend\(box\)/);
  assert.ok(app.includes("$('.nav-tools')||$('.top-actions')"));
});
