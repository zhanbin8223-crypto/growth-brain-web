import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const theme=read('theme-w1b.css'),html=read('index.html');
const all=['styles.css','capmap.css','myjobs.css','project-kickoff.css','project-milestones.css','theme-w1b.css'].map(read).join('\n');
test('W1b token 組：調色盤、圓角、作品色',()=>{
  for(const t of ['--w-bg:#f3f0eb','--w-side:#eae7e1','--w-card:#fcfbf8','--w-or:#ab5c37','--w-or-wash:#f5e9e2','--w-vi:#90636d','--w-te:#6e7a5a','--w-r-md:16px','--w-r-lg:24px'])assert.ok(theme.includes(t),t);
});
test('theme 最後載入，舊 token 全部指向 W1b',()=>{
  const links=[...html.matchAll(/href="([^"?]+\.css)/g)].map(m=>m[1]);assert.equal(links.at(-1),'theme-w1b.css');
  for(const v of ['--bg:var(--w-bg)','--paper:var(--w-card)','--accent:var(--w-or)','--v4-reading-size:16px'])assert.ok(theme.includes(v),v);
});
test('能力圖譜不再是深色',()=>{const c=read('capmap.css');assert.doesNotMatch(c,/#0c0e18|#131628|#1a1e34/);assert.match(c,/var\(--w-card\)/);});
test('字級下限 12px',()=>{assert.doesNotMatch(all,/font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/);});
test('桌面左側欄、手機底部分頁',()=>{assert.match(theme,/grid-template-columns:248px minmax\(0,1fr\)/);assert.match(theme,/@media \(max-width:760px\)\{[\s\S]*\.nav\{position:fixed!important;left:0;right:0;bottom:0/);});
