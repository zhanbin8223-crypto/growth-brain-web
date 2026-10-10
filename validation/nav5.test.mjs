import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
const app=read('app.js'),lab=read('event-lab.js'),index=read('index.html'),css=read('styles.css');
const navSrc=app.slice(app.indexOf('/* ===== 5-page navigation'),app.indexOf('function renderTodayWaiting'));

function load(){
  const calls=[];
  const rec=name=>(...a)=>{calls.push([name,...a.filter(x=>x!==undefined)]);};
  const c={calls,location:{hash:''},history:{pushState(){},replaceState(){}},console,
    renderHome:rec('renderHome'),renderTodayWaiting:rec('renderTodayWaiting'),renderTodayProgress:rec('renderTodayProgress'),
    renderProjectsIA:rec('renderProjectsIA'),renderHistory:rec('renderHistory'),renderLearn:rec('renderLearn'),
    renderCapabilities:rec('renderCapabilities'),renderSynapse:rec('renderSynapse'),renderSystemPending:rec('renderSystemPending'),
    renderTeamIA:rec('renderTeamIA'),renderResearch:rec('renderResearch'),
    window:{GROWTH_BRAIN_LAB:{renderResearch:(el,tab,o)=>calls.push(['lab.renderResearch',tab,o.filter])},GROWTH_BRAIN_INBOX:{render:rec('renderInbox')}},
    $:()=>null,$$:()=>[],esc:s=>String(s)};
  vm.createContext(c);
  vm.runInContext(navSrc+';this.api={NAV_PAGES,LEGACY_ROUTES,resolveLegacy,navFind,parseNavHash,navGo,setView};',c);
  return c;
}
// Every legacy view/subtab that existed before (from the old setView + in-view tab arrays) and the
// renderer call the old setView made for it. The new route must make the SAME call (same data source).
const LEGACY=[
  ['home',null,'today/step',['renderHome']],
  ['projects',null,'works/active',['renderProjectsIA','gateway']],
  ['projects','gateway','works/active',['renderProjectsIA','gateway']],
  ['projects','current','works/active',['renderProjectsIA','current']],
  ['projects','done','works/done',['renderProjectsIA','done']],
  ['projects','planned','works/waiting',['renderProjectsIA','planned']],
  ['capabilities',null,'learn/abilities/map',['renderCapabilities','cells']],
  ['capabilities','cells','learn/abilities/map',['renderCapabilities','cells']],
  ['capabilities','skills','learn/abilities/evidence',['renderCapabilities','skills']],
  ['capabilities','playbooks','learn/playbooks',['renderCapabilities','playbooks']],
  ['capabilities','relations','learn/relations',['renderSynapse']],
  ['research',null,'lab/today',['lab.renderResearch','today','active']],
  ['research','today','lab/today',['lab.renderResearch','today','active']],
  ['research','ai','lab/ai',['lab.renderResearch','ai','active']],
  ['research','distribution','lab/distribution',['lab.renderResearch','distribution','active']],
  ['research','opportunity','lab/opportunity',['lab.renderResearch','opportunity','active']],
  ['research','growthbrain','system/status/research',['renderResearch','growthbrain']],
  ['ceo',null,'system/team/working',['renderTeamIA','working']],
  ['ceo','working','system/team/working',['renderTeamIA','working']],
  ['ceo','teachers','system/team/teachers',['renderTeamIA','teachers']],
  ['ceo','researchers','system/team/researchers',['renderTeamIA','researchers']],
  ['ceo','system','system/status/maint',['renderTeamIA','system']],
  ['history',null,'works/review',['renderHistory','personal']],
  ['history','system','system/status/versions',['renderHistory','system']],
  ['history','personal','works/review',['renderHistory','personal']],
  ['history','skills','learn/abilities/changes',['renderHistory','skills']],
  ['history','research','lab/notes/history',['renderHistory','research']],
  ['inbox',null,'collect/inbox',['renderInbox']],
  ['learn',null,'learn/practice',['renderLearn']],
  ['synapse',null,'learn/relations',['renderSynapse']],
];

test('每個舊路由都導向對照表中的新頁＋分頁，並呼叫原本的資料渲染',()=>{
  for(const [view,sub,where,call] of LEGACY){
    const c=load();c.calls.length=0;
    c.api.setView(view,sub??undefined);
    const r=c.api.resolveLegacy(view,sub??undefined);
    assert.equal(r.slice(0,3).filter(Boolean).join('/'),where,view+'/'+sub);
    assert.deepEqual(c.calls.at(-1),call,'data binding '+view+'/'+sub);
  }
});

test('舊 hash 路由與新 hash 路由都能解析；登入連結的 token hash 不被當成路由',()=>{
  const {api}=load();
  assert.deepEqual([...api.parseNavHash('#capabilities')].slice(0,3),['learn','abilities','map']);
  assert.deepEqual([...api.parseNavHash('#/history/system')].slice(0,3),['system','status','versions']);
  assert.deepEqual([...api.parseNavHash('#/lab/notes/trying')].slice(0,3),['lab','notes','trying']);
  assert.deepEqual([...api.parseNavHash('#/works/nope')].slice(0,2),['works','active']);
  assert.equal(api.parseNavHash('#access_token=abc&refresh_token=x'),null);
  assert.equal(api.parseNavHash('#/unknown'),null);
});

test('舊程式裡所有分頁都還找得到（沒有功能被刪除）',()=>{
  const tabArrays=[...app.matchAll(/const tabs=\[(\[.*?\])\];/g)].map(m=>m[1]);
  const keys=new Set(LEGACY.map(([v,s])=>v+'/'+(s||'')));
  const owner={"cells":"capabilities","playbooks":"capabilities","skills":null,"relations":"capabilities","today":"research","ai":"research","distribution":"research","opportunity":"research","growthbrain":"research","system":null,"personal":"history","research":"history","gateway":"projects","done":"projects","planned":"projects","working":"ceo","teachers":"ceo","researchers":"ceo"};
  for(const arr of tabArrays)for(const m of arr.matchAll(/\['([a-z]+)','/g)){
    const k=m[1];
    assert.ok([...keys].some(x=>x.endsWith('/'+k)),'legacy tab '+k+' has a new home');
  }
  for(const v of ['home','projects','capabilities','research','ceo','history','inbox','learn','synapse'])
    assert.ok(index.includes('id="view-'+v+'"'),'view section kept: '+v);
});

test('每個分頁與子分頁都可執行，且只呼叫既有資料來源',()=>{
  const allowed=new Set(['renderHome','renderTodayWaiting','renderTodayProgress','renderProjectsIA','renderHistory','renderLearn','renderCapabilities','renderSynapse','renderSystemPending','renderTeamIA','renderResearch','lab.renderResearch','renderInbox']);
  const c=load();
  for(const p of c.api.NAV_PAGES)for(const t of p.tabs)for(const s of (t.segs||[null])){
    c.calls.length=0;c.api.navGo(p.key,t.key,s?.key);
    assert.equal(c.calls.length,1,p.key+'/'+t.key);
    assert.ok(allowed.has(c.calls[0][0]),c.calls[0][0]);
    assert.ok(index.includes('id="view-'+(s||t).view+'"'),'view exists '+(s||t).view);
    assert.ok((t.desc||'').length>4,'plain description '+p.key+'/'+t.key);
  }
});

test('主導覽恰好 5 頁且順序固定；系統在齒輪，待處理第一',()=>{
  const {api}=load();
  const pages=[...index.matchAll(/data-page="([a-z]+)"/g)].map(m=>m[1]);
  assert.deepEqual(pages,['today','works','learn','lab','collect']);
  assert.deepEqual(pages.map(k=>api.NAV_PAGES.find(p=>p.key===k).label),['今天','作品','學習','研究室','收集']);
  const sys=api.NAV_PAGES.find(p=>p.key==='system');
  assert.ok(sys.gear);assert.deepEqual([...sys.tabs.map(t=>t.label)],['待處理','AI 團隊','系統狀態']);
  assert.ok(api.NAV_PAGES.find(p=>p.key==='works').tabs.some(t=>t.label==='回顧'));
  assert.deepEqual([...api.NAV_PAGES.find(p=>p.key==='lab').tabs.map(t=>t.label)],['今日探索','AI 技術','流量分發','商業機會','研究筆記']);
  assert.match(index,/id="gearBadge"/);
  assert.match(css,/\.gear-badge\{[^}]*background:#6f645b/);
});

test('連結檢查：所有 data-jump、lab 導覽與 setView 呼叫都能解析到存在的頁',()=>{
  const {api}=load();
  const files=readdirSync(root).filter(f=>f.endsWith('.js'));
  const targets=new Set();
  for(const f of files){
    const s=read(f);
    for(const m of s.matchAll(/data-jump=\\?"([a-z-]+)/g))targets.add(m[1]);
    for(const m of s.matchAll(/setView\('([a-z-]+)'/g))targets.add(m[1]);
    for(const m of s.matchAll(/navigate\('([a-z-]+)'/g))targets.add(m[1]);
  }
  for(const m of lab.matchAll(/routes=\{([^}]*)\}/g))for(const r of m[1].matchAll(/'([a-z_]+)'\]/g))targets.add(r[1]);
  assert.ok(targets.size>=4);
  for(const t of targets){
    const ok=api.NAV_PAGES.some(p=>p.key===t)||api.resolveLegacy(t);
    assert.ok(ok,'dead link target: '+t);
  }
  assert.doesNotMatch(index+app,/href="javascript:/);
});

test('今日探索：一張推薦卡、一個主要按鈕；換一件與先收起來是次要；詳情只有一個主要行動且需確認',()=>{
  const reco=lab.slice(lab.indexOf('function paintReco'),lab.indexOf('function bindReco'));
  const card=reco.slice(reco.indexOf("recoIdx=recoIdx%items.length"),reco.indexOf("pane.querySelector('[data-reco-next]')"));
  assert.equal((card.match(/primary-btn/g)||[]).length,1);
  assert.match(card,/看這件事/);assert.match(card,/換一件/);assert.match(card,/先收起來/);
  assert.match(reco,/recoIdx=\(recoIdx\+1\)%items\.length/);
  const bind=lab.slice(lab.indexOf('function bindReco'),lab.indexOf('function paintResearch'));
  assert.match(bind,/data-reco-confirm/);assert.match(bind,/openFunnel\(\{kind:'current_artifact'/);
  assert.match(lab,/data-reco-add>加進作品的下一步/);
  assert.match(lab,/<summary>其他做法<\/summary>/,'old actions kept under 其他做法');
});

test('術語白話化：移除英文眉標與未解釋術語',()=>{
  for(const bad of ['LAB · 研究室','資料庫 Context','研究沙盒','本機執行器','待採用審查'])assert.ok(!lab.includes(bad),bad);
  assert.match(lab,/Worker）/);assert.match(lab,/送進試驗（讓 AI 小規模試做）/);
  assert.match(css,/\.v4-eyebrow\{display:none!important\}/);
  assert.match(app,/作戰手冊＝做過的事整理成的步驟筆記/);
});
