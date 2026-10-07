import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectFixture} from './project-fixture.mjs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('作品首頁是路徑 rail，詳細頁是第二層',()=>{
  assert.match(app,/async function renderProjectsIA\(active='gateway',notice=''\)/);
  assert.match(app,/project-route-rail/);
  assert.match(app,/project-route-node/);
  assert.match(app,/data-open-project-detail/);
  assert.match(app,/data-project-gateway/);
  assert.match(css,/\.project-route-rail/);
  assert.match(css,/\.project-detail-back/);
});

test('作品首頁只暴露進行中、已完成、預計作品三個一級分頁',()=>{
  assert.ok(app.includes("const tabs=[['gateway','進行中'],['done','已完成'],['planned','預計作品']];"));
  assert.ok(!app.includes("['path','作品路徑']"));
});

test('新增作品路徑入口直接保存候選，不切換目前主線',()=>{
  assert.match(app,/data-new-project-route/);
  assert.match(app,/id="newProjectRouteForm"/);
  assert.match(app,/A\.savePersonalOutcomeCandidate/);
  assert.match(app,/不會自動取代目前主線/);
});

class Element {
  constructor(attrs={}){this.attrs=attrs;this.dataset={};this.events={};this.value='';this.children=[];for(const [k,v] of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
  set innerHTML(html){this.html=html;this.children=[...html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)].map(m=>new Element(Object.fromEntries([...m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]||'']))));}
  get innerHTML(){return this.html||'';}
  matches(s){if(s.startsWith('#'))return this.attrs.id===s.slice(1);if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));const a=s.match(/\[([\w-]+)(?:="([^"]*)")?\]/);return a?Object.hasOwn(this.attrs,a[1])&&(a[2]===undefined||this.attrs[a[1]]===a[2]):false;}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  addEventListener(type,handler){this.events[type]=handler;}
  insertAdjacentHTML(_,html){const e=new Element();e.innerHTML=html;this.children.unshift(...e.children);this.html=html+this.innerHTML;}
  scrollIntoView(){}
  focus(){}
  async fire(type){await (this.events[type]||this['on'+type])?.({preventDefault(){},currentTarget:this});}
}

function harness(fixture=projectFixture()){
  const root=new Element({id:'view-projects'}),document=new Element();document.children=[root];
  const writes=[],routes=[];
  const adapter={
    liveStatus:'live',
    getPersonalOutcome:async()=>structuredClone(fixture.outcome),
    getPersonalArtifacts:async()=>structuredClone(fixture.artifacts),
    getSystemCockpit:async()=>({
      skill_team:{
        executable_roles:[
          {skill_key:'goal-closure-operator',role_name:'達案執行官',availability:'builtin',status:'active',priority:100},
          {skill_key:'logic-reality-analyst',role_name:'邏輯／真實性分析員',availability:'builtin',status:'active',priority:100},
          {skill_key:'ceo-orchestrator',role_name:'Growth Brain CEO',availability:'builtin',status:'active',priority:100}
        ],
        planned_roles:[
          {skill_key:'product-flow-architect',role_name:'產品流程架構師',availability:'planned',status:'candidate',priority:99}
        ]
      },
      resource_catalog:[
        {resource_key:'descript',resource_type:'tool',name:'Descript',capabilities:['video_editing','captions'],availability:'available',status:'active',priority:96},
        {resource_key:'web-search',resource_type:'tool',name:'Web Search',capabilities:['web_research','current_docs'],availability:'available',status:'active',priority:95},
        {resource_key:'business-knowledge-database',resource_type:'source',name:'Business Knowledge Database',capabilities:['business_cases','market_signals'],availability:'available',status:'conditional',priority:85},
        {resource_key:'opencli-chatgpt-web-adapter',resource_type:'tool',name:'OpenCLI ChatGPT Web Adapter',capabilities:['chatgpt_web_ask'],availability:'available',status:'active',priority:99}
      ],
      path_trial_contract:{enabled:true}
    }),
    getSnapshot:async()=>({}),
    savePersonalOutcomeCandidate:async input=>{routes.push(input);fixture.outcome.candidate_route={id:'candidate-route',...input};},
    decidePersonalOutcomeCandidate:async()=>({}),
    recordPersonalArtifactEvidence:async input=>{
      writes.push(input);const a=fixture.artifacts.current,item=a.evidence_progress.find(x=>x.criterion_no===input.criterionNo);
      item.status='confirmed';item.evidence={text:input.evidenceText};const confirmed=a.evidence_progress.filter(x=>x.status==='confirmed').length;a.progress_summary={confirmed,total:9,remaining:9-confirmed};a.next_evidence_item=a.evidence_progress.find(x=>x.status!=='confirmed')||null;
    }
  };
  const context=vm.createContext({window:{GROWTH_BRAIN_ADAPTER:adapter},document,console,URL,setTimeout,alert(){}});
  vm.runInContext(app.replace(/\ninit\(\);\s*$/,'')+'\nrenderHome=()=>{};',context);
  return {root,document,fixture,writes,routes,adapter,render:(active='gateway',notice='')=>context.renderProjectsIA(active,notice),html:()=>root.querySelector('#projectIaPane')?.innerHTML||root.innerHTML,click:async selector=>{const e=root.querySelector(selector);assert.ok(e,selector);await e.fire('click');}};
}

test('第一層只呈現路徑、目前作品、進度與候選狀態',async()=>{
  const h=harness();await h.render();const html=h.html();
  for(const text of ['內容創作 × 多元變現系統','測試作品名稱','0 / 9 個完成條件已有證據','進入作品 →'])assert.ok(html.includes(text),text);
  assert.match(html,/data-artifact-id="artifact-fixture"/);
  assert.match(html,/class="project-route-rail"/);
  assert.ok(!html.includes(h.fixture.artifacts.current.objective));
  assert.ok(!html.includes(h.fixture.artifacts.current.deliverable));
});

test('入口→詳細→入口保留目標、步驟、證據、能力及原始狀態',async()=>{
  const h=harness(),before=structuredClone(h.fixture);await h.render();await h.click('[data-open-project-detail]');
  for(const text of [before.artifacts.current.objective,...before.artifacts.current.done_evidence,'測試能力','完整學習關聯','保存這一步的證據','幫我拆這一步'])assert.ok(h.html().includes(text),text);
  assert.ok(h.root.querySelector('#artifactEvidenceProgressForm'));
  assert.equal(h.root.querySelector('#completeArtifactForm'),null);
  await h.click('[data-project-gateway]');assert.match(h.html(),/0 \/ 9 個完成條件已有證據/);
  assert.deepEqual(h.fixture,before);assert.equal(h.writes.length,0);
});

test('合成保存後返回路徑讀到最新進度',async()=>{
  const h=harness();await h.render('current');
  h.root.querySelector('#artifactEvidenceProgressText').value='合成驗證證據';
  const form=h.root.querySelector('#artifactEvidenceProgressForm');form.children.push(new Element({type:'submit'}));await form.fire('submit');
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].artifactId,'artifact-fixture');
  assert.match(h.html(),/這一步的證據已保存/);
  await h.click('[data-project-gateway]');assert.match(h.html(),/1 \/ 9 個完成條件已有證據/);
});

test('完成確認表單只在全部條件有證據時保留',async()=>{
  const f=projectFixture();f.artifacts.current.progress_summary={confirmed:9,total:9,remaining:0};f.artifacts.current.next_evidence_item=null;
  f.artifacts.current.evidence_progress.forEach(x=>x.status='confirmed');const h=harness(f);await h.render('current');
  assert.ok(h.root.querySelector('#completeArtifactForm'));assert.match(h.html(),/確認完成並重新規劃/);
});

test('只有主線時不捏造 artifact id，仍可進路徑詳細',async()=>{
  const f=projectFixture();f.artifacts.current=null;const h=harness(f);await h.render();
  assert.match(h.html(),/內容創作 × 多元變現系統/);
  assert.match(h.html(),/建立第一件作品/);
  assert.doesNotMatch(h.html(),/data-artifact-id/);
  await h.click('[data-open-project-detail]');assert.ok(h.root.querySelector('[data-project-gateway]'));
});

test('正式 artifact title、status 與 id 會反映在目前作品節點',async()=>{
  const f=projectFixture();Object.assign(f.artifacts.current,{id:'another-artifact',title:'另一件很長的作品目標標題',sequence_no:7,status:'paused'});
  const h=harness(f);await h.render();
  for(const text of ['另一件很長的作品目標標題','暫停','another-artifact'])assert.ok(h.html().includes(text),text);
});


test('作品組隊器先從現有角色與資源組小隊，可手動增刪與重新配隊',async()=>{
  const h=harness();await h.render();
  const goal=h.root.querySelector('#newProjectRouteTitle');
  goal.value='建立一個數字人 AI 的 Instagram 帳號，測試內容流量與未來變現可能性';
  await h.click('[data-project-team-recommend]');
  let html=h.html();
  for(const text of ['作品組隊器 · 第一步','目前理解','加入理由','負責範圍','重新配隊','Web Search','Business Knowledge Database','Descript'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('現有員工'));
  assert.ok(html.includes('候選／不可直接執行'));
  assert.ok(h.root.querySelector('[data-project-team-remove="descript"]'));
  await h.click('[data-project-team-remove="descript"]');
  assert.ok(h.root.querySelector('[data-project-team-add="descript"]'));
  await h.click('[data-project-team-add="descript"]');
  assert.ok(h.root.querySelector('[data-project-team-remove="descript"]'));
  await h.click('[data-project-team-reteam]');
  assert.ok(h.root.querySelector('[data-project-team-remove="goal-closure-operator"]'));
  assert.match(app,/system\?\.resource_catalog/);
  assert.match(app,/autoEligible:false/);
});

test('第一切片不會自動保存組隊草稿或建立新員工',async()=>{
  const h=harness();await h.render();
  h.root.querySelector('#newProjectRouteTitle').value='建立一個數字人 AI 的 Instagram 帳號，測試內容流量與未來變現可能性';
  await h.click('[data-project-team-recommend]');
  assert.equal(h.routes.length,0);
  assert.match(h.html(),/不會建立新員工/);
  assert.match(app,/A\.savePersonalOutcomeCandidate/);
  assert.doesNotMatch(app,/createProjectTeamEmployee|insertProjectTeamEmployee/);
});
