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

// Execute the real renderers and handlers against a small DOM test double.
// Browser layout and actual click bubbling are verified separately in a browser.
import vm from 'node:vm';
import {projectFixture} from './project-fixture.mjs';
class Element {
  constructor(attrs={}){this.attrs=attrs;this.dataset={};this.events={};this.value='';this.children=[];for(const [k,v] of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
  set innerHTML(html){this.html=html;this.children=[...html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)].map(m=>new Element(Object.fromEntries([...m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]||'']))));}
  get innerHTML(){return this.html||'';}
  matches(s){if(s.startsWith('#'))return this.attrs.id===s.slice(1);if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));const a=s.match(/\[([\w-]+)(?:="([^"]*)")?\]/);return a?Object.hasOwn(this.attrs,a[1])&&(a[2]===undefined||this.attrs[a[1]]===a[2]):false;}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  addEventListener(type,handler){this.events[type]=handler;}
  insertAdjacentHTML(_,html){const e=new Element();e.innerHTML=html;this.children.unshift(...e.children);this.html=html+this.innerHTML;}
  async fire(type){await (this.events[type]||this['on'+type])?.({preventDefault(){},currentTarget:this});}
}
function harness(fixture=projectFixture()){
  const root=new Element({id:'view-projects'}),document=new Element();document.children=[root];
  const writes=[];
  const adapter={liveStatus:'live',getPersonalOutcome:async()=>structuredClone(fixture.outcome),getPersonalArtifacts:async()=>structuredClone(fixture.artifacts),getSnapshot:async()=>({}),recordPersonalArtifactEvidence:async input=>{
    writes.push(input);const a=fixture.artifacts.current,item=a.evidence_progress.find(x=>x.criterion_no===input.criterionNo);
    item.status='confirmed';item.evidence={text:input.evidenceText};a.progress_summary={confirmed:1,total:9,remaining:8};a.next_evidence_item=a.evidence_progress[1];
  }};
  const context=vm.createContext({window:{GROWTH_BRAIN_ADAPTER:adapter},document,console,URL,setTimeout});
  vm.runInContext(app.replace(/\ninit\(\);\s*$/,'')+'\nrenderHome=()=>{};',context);
  return {root,document,fixture,writes,adapter,render:(active='gateway',notice='')=>context.renderProjectsIA(active,notice),html:()=>root.querySelector('#projectIaPane')?.innerHTML||root.innerHTML,click:async selector=>{const e=root.querySelector(selector);assert.ok(e,selector);await e.fire('click');}};
}

test('Case 1: 真實 renderer 輸出縮圖、名稱、系列版本、status、進度及 artifact id',async()=>{
  const h=harness();await h.render();const html=h.html();
  for(const text of ['測試作品名稱','測試系列','V2','進行中','0 / 9 個目標完成','進入作品 →'])assert.ok(html.includes(text),text);
  assert.match(html,/data-artifact-id="artifact-fixture"/);
  assert.match(html,/class="project-cover"[^>]*role="img"/);
  assert.doesNotMatch(html,/V8/); // Route revision is not the artifact sequence.
});

test('Case 2: 第一層 HTML 不輸出 objective、交付要求、步驟、證據或能力說明',async()=>{
  const h=harness();await h.render();const a=h.fixture.artifacts.current;
  for(const text of [a.objective,a.deliverable,...a.done_evidence,a.skills[0].why,a.learning_focus[0]])assert.ok(!h.html().includes(text),text);
});

test('Case 3/4: 入口→詳細→入口保留目標、步驟、證據、能力及原始狀態',async()=>{
  const h=harness(),before=structuredClone(h.fixture);await h.render();await h.click('[data-open-project-detail]');
  for(const text of [before.artifacts.current.objective,...before.artifacts.current.done_evidence,'測試能力','完整學習關聯','相關概念','保存這一步的證據','幫我拆這一步'])assert.ok(h.html().includes(text),text);
  assert.ok(h.root.querySelector('#artifactEvidenceProgressForm'));
  assert.equal(h.root.querySelector('#completeArtifactForm'),null);
  await h.click('[data-project-gateway]');assert.match(h.html(),/0 \/ 9 個目標完成/);
  assert.deepEqual(h.fixture,before);assert.equal(h.writes.length,0);
});

test('Case 5: 合成保存後提示留在詳細頁，返回入口讀到最新進度',async()=>{
  const h=harness();await h.render('current');
  h.root.querySelector('#artifactEvidenceProgressText').value='合成驗證證據';
  const form=h.root.querySelector('#artifactEvidenceProgressForm');
  form.children.push(new Element({type:'submit'}));await form.fire('submit');
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].artifactId,'artifact-fixture');
  assert.match(h.html(),/這一步的證據已保存/);assert.match(h.html(),/合成驗證證據/);
  assert.ok(h.root.querySelector('[data-project-gateway]'));assert.equal(h.root.querySelector('[data-ia-tab]'),null);
  await h.click('[data-project-gateway]');assert.match(h.html(),/1 \/ 9 個目標完成/);
});

test('完成確認表單只在全部條件有證據時保留',async()=>{
  const f=projectFixture();f.artifacts.current.progress_summary={confirmed:9,total:9,remaining:0};f.artifacts.current.next_evidence_item=null;
  f.artifacts.current.evidence_progress.forEach(x=>x.status='confirmed');const h=harness(f);await h.render('current');
  assert.ok(h.root.querySelector('#completeArtifactForm'));assert.match(h.html(),/確認完成並重新規劃/);
});

test('缺少 summary 時由 evidence_progress 計數，不把未知當完成',async()=>{
  const f=projectFixture();delete f.artifacts.current.progress_summary;f.artifacts.current.evidence_progress[0].status='confirmed';
  const h=harness(f);await h.render();assert.match(h.html(),/1 \/ 9 個目標完成/);
});

test('只有主線時不把長描述當卡片，不捏造作品版本或 artifact id',async()=>{
  const f=projectFixture();f.artifacts.current=null;const h=harness(f);await h.render();
  assert.ok(!h.html().includes(f.outcome.selected_route.why_now));assert.ok(!h.html().includes(f.outcome.selected_route.success_evidence));
  assert.doesNotMatch(h.html(),/data-artifact-id|V8/);await h.click('[data-open-project-detail]');assert.ok(h.root.querySelector('[data-project-gateway]'));
});

test('替換作品資料後名稱、版本、status 與 id 都跟著資料更新',async()=>{
  const f=projectFixture();Object.assign(f.artifacts.current,{id:'another-artifact',title:'另一件作品',sequence_no:7,status:'paused'});
  const h=harness(f);await h.render();for(const text of ['另一件作品','V7','暫停','another-artifact'])assert.ok(h.html().includes(text),text);
  assert.doesNotMatch(h.html(),/測試作品名稱|蝦皮分潤/);
});
