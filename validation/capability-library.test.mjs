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

test('能力方法與作戰手冊不使用固定 placeholder 清單',()=>{
  assert.doesNotMatch(app,/\['任務定義','Context 脈絡','搜尋與證據'/);
  assert.match(app,/library\?\.cells/);
  assert.match(app,/library\?\.playbooks/);
  assert.match(app,/library\?\.personal_skills/);
});

test('能力方法仍可展開正式使用步驟與證據要求（收在方法庫）',()=>{
  assert.match(app,/data-capability-key/);
  assert.match(app,/quick_use/);
  assert.match(app,/required_evidence/);
  assert.match(app,/failure_points/);
  assert.match(app,/cm-meth/);
});

test('能力圖譜改用 capmap（依作品分組＋程度標籤），不把方法當個人掌握',()=>{
  assert.ok(app.includes("['cells','能力圖譜']"));
  assert.match(app,/GROWTH_BRAIN_CAPMAP\.render\(pane,A/);
  assert.match(app,/方法存在不等於掌握/);
  const block=app.slice(app.indexOf("async function renderCapabilities"),app.indexOf("async function renderResearch"));
  assert.doesNotMatch(block,/capability-map-illustration|capability-landscape|cap-hill|cap-road|capability-orbit-center"><strong>'\+evidenceCount/);
});
