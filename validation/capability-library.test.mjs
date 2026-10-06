import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../adapter.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('能力庫從正式 capabilities surface 讀取',()=>{
  assert.match(adapter,/async getCapabilities\(\{force=false\}=\{\}\)/);
  assert.match(adapter,/liveRequest\('GET',undefined,'capabilities'\)/);
  assert.match(app,/await A\.getCapabilities\(\{force:true\}\)/);
});

test('能力細胞與作戰手冊不再使用固定 placeholder 清單',()=>{
  assert.doesNotMatch(app,/\['任務定義','Context 脈絡','搜尋與證據'/);
  assert.doesNotMatch(app,/\['研究一個陌生主題','建立可運行網站'/);
  assert.match(app,/library\?\.cells/);
  assert.match(app,/library\?\.playbooks/);
  assert.match(app,/library\?\.personal_skills/);
});

test('能力細胞可展開正式使用步驟與證據要求',()=>{
  assert.match(app,/data-capability-key/);
  assert.match(app,/quick_use/);
  assert.match(app,/required_evidence/);
  assert.match(app,/failure_points/);
  assert.match(css,/\.capability-visual-layout/);
  assert.match(css,/\.capability-map-node/);
});

test('能力首頁改成地圖與證據總覽，不把參考方法當個人掌握',()=>{
  assert.ok(app.includes("['cells','能力地圖']"));
  assert.match(app,/capability-landscape/);
  assert.match(app,/capability-overview/);
  assert.match(app,/capability-ring/);
  assert.match(app,/已有證據/);
  assert.match(app,/方法存在不等於掌握/);
});
