import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('今天頁使用製圖產生的正式視覺素材',()=>{
  assert.ok(app.includes('assets/ui/home-hero-workspace.webp'));
  assert.ok(app.includes('assets/ui/home-project-cover.webp'));
});

test('今天頁不是舊 dashboard，而是設計稿的三段構圖',()=>{
  for(const token of ['today-hero','today-core-grid','today-mainline-card','today-next-card','today-support-cards']){
    assert.ok(app.includes(token),token);
  }
  assert.ok(app.includes('今天我們繼續推進主線'));
  assert.ok(app.includes('目前主線'));
  assert.ok(app.includes('今天唯一下一步'));
  assert.ok(app.includes('相關角色'));
  assert.ok(app.includes('相關能力'));
  assert.ok(app.includes('預期證據'));
});

test('全站不再顯示第二層 global page title bar',()=>{
  assert.match(css,/\.topbar\{[^}]*display:none/s);
  assert.ok(index.includes('class="nav-tools"'));
});

test('導覽工具列承接登入狀態，不再依賴已隱藏 topbar',()=>{
  assert.doesNotMatch(app,/\$\('\.top-actions'\)\.prepend\(box\)/);
  assert.ok(app.includes("$('.nav-tools')||$('.top-actions')"));
});
