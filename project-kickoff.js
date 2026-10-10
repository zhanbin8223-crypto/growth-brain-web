(function(){
  if(typeof renderProjectTeamDraft!=='function'||typeof projectTeamCatalog!=='function')return;

  const baseRenderProjectTeamDraft=renderProjectTeamDraft;
  let currentMeeting=null;
  let currentSignature='';
  const draftSignature=()=>JSON.stringify([PROJECT_TEAM_DRAFT?.goal||'',PROJECT_TEAM_DRAFT?.selectedKeys||[]]);
  const strings=value=>Array.isArray(value)&&value.every(x=>typeof x==='string');

  const KICKOFF_META={
    'goal-closure-operator':{
      question:'這一輪最少要證明什麼，才值得繼續投入？',
      risk:'把帳號、角色設定、內容產量、流量與變現同時展開，會讓第一輪無法判斷哪個環節有效。',
      dependency:'先定義第一輪可觀察的成功／停止條件。',
      milestone:'完成第一輪最小內容測試，取得真實觸及、觀看或互動證據。'
    },
    'logic-reality-analyst':{
      question:'哪些指標能證明內容真的有需求，而不是偶然曝光？',
      risk:'把單支高流量、主觀喜好或平台推論直接當成可重複成效。',
      dependency:'先定義樣本數、觀察期與要記錄的真實指標。',
      milestone:'建立第一輪流量驗證基準，能判斷繼續、調整或停止。'
    },
    'ceo-orchestrator':{
      question:'哪些角色現在必須參與，哪些等出現證據後再加入？',
      risk:'角色太多造成重複決策，讓作品主線失焦。',
      dependency:'明確指定本輪唯一成果與每個角色的邊界。',
      milestone:'形成單一可執行主線，所有角色都只服務同一個驗收結果。'
    },
    'supabase-engineer':{
      question:'這一輪真的需要新增正式資料結構嗎？',
      risk:'太早改資料模型，把仍在驗證的流程固定成長期架構。',
      dependency:'只有需要跨工作階段保存的資料才進正式資料庫。',
      milestone:'只保存本輪必要狀態，且不污染既有個人資料與作品證據。'
    },
    'github-operator':{
      question:'本輪最小需要改哪些檔案才能完成驗收？',
      risk:'順手修改無關檔案或重構，增加部署與回歸風險。',
      dependency:'先鎖定修改範圍與原驗收。',
      milestone:'只提交與本輪功能直接相關的最小變更並保留可追溯版本。'
    },
    'work-web-operator':{
      question:'使用者在目前畫面上必須看見並完成哪一個動作？',
      risk:'把後續功能提前塞進同一畫面，造成資訊過多。',
      dependency:'沿用現有介面結構與元件，不另開無關設計。',
      milestone:'目前切片可以在既有作品流程中直接操作與看見結果。'
    },
    'work-browser-qa':{
      question:'哪一條真實互動路徑最能證明這一輪沒有壞掉？',
      risk:'只驗靜態字串，沒有驗證實際點擊與狀態切換。',
      dependency:'要有固定案例與可重跑的互動驗收。',
      milestone:'固定案例的主要互動與回歸檢查全部通過。'
    }
  };

  const escText=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const uniq=list=>[...new Set((list||[]).filter(Boolean))];

  function contribution(item){
    const meta=KICKOFF_META[item.key]||{};
    const scope=typeof projectTeamScope==='function'?projectTeamScope(item):'只負責與本作品直接相關的專業範圍。';
    return {
      key:item.key,
      name:item.name,
      scope,
      question:meta.question||'在「'+scope+'」範圍內，現在最需要先確認的未知是什麼？',
      risk:meta.risk||'如果沒有先確認「'+scope+'」的必要條件，可能造成返工或錯誤判斷。',
      dependency:meta.dependency||'需要目前作品目標、已知限制與可驗收證據。',
      milestone:meta.milestone||'完成一個只屬於「'+scope+'」的最小可驗證結果。'
    };
  }

  function consensus(goal){
    const tags=typeof projectGoalTags==='function'?projectGoalTags(goal):new Set();
    const out=['作品主線不變；先用最小測試取得真實證據，再決定是否擴大。'];
    if(tags.has('traffic'))out.push('第一輪先驗證內容能否取得可重複的真實流量，不把單次曝光當成功。');
    if(tags.has('business')||tags.has('revenue'))out.push('變現先保留為後續驗證；沒有受眾與流量證據前，不先擴張商業模型。');
    return out.slice(0,3);
  }

  function buildMeeting(system){
    const catalog=projectTeamCatalog(system),byKey=new Map(catalog.map(x=>[x.key,x]));
    const selected=(PROJECT_TEAM_DRAFT?.selectedKeys||[]).map(k=>byKey.get(k)).filter(Boolean);
    const participants=selected.filter(x=>x.kind==='employee'&&x.autoEligible);
    const participantKeys=new Set(participants.map(x=>x.key));
    const support=selected.filter(x=>!participantKeys.has(x.key));
    const contributions=participants.map(contribution);
    return {
      version:'project-kickoff-v1',
      goal:PROJECT_TEAM_DRAFT?.goal||'',
      team_keys:[...(PROJECT_TEAM_DRAFT?.selectedKeys||[])],
      participant_keys:participants.map(x=>x.key),
      support_resources:support.map(x=>({
        key:x.key,
        name:x.name,
        kind:typeof projectTeamKindLabel==='function'?projectTeamKindLabel(x):'支援資源'
      })),
      contributions,
      summary:{
        consensus:consensus(PROJECT_TEAM_DRAFT?.goal||''),
        risks:uniq(contributions.map(x=>x.risk)).slice(0,4),
        pending:uniq(contributions.map(x=>x.question)).slice(0,4),
        milestone_suggestions:uniq(contributions.map(x=>x.milestone)).slice(0,4)
      }
    };
  }

  function summaryBlock(title,items){
    return '<div class="project-kickoff-summary-block"><b>'+escText(title)+'</b><ul>'+
      (((items||[]).map(x=>'<li>'+escText(x)+'</li>').join(''))||'<li>目前沒有額外項目。</li>')+
      '</ul></div>';
  }

  function panelHtml(selected){
    const canRun=selected.some(x=>x.kind==='employee'&&x.autoEligible);
    if(!currentMeeting){
      return '<section class="project-kickoff">'+
        '<div class="project-kickoff-head"><div><span class="kicker">作品組隊器 · 第二步</span><h4>啟動會議</h4><p>只讓目前可執行員工在自己的專業範圍內提出關鍵問題、風險、依賴與建議里程碑；工具與資料來源只當支援資源，不冒充員工發言。</p></div>'+
        '<button class="primary-btn" type="button" data-project-team-kickoff '+(canRun?'':'disabled')+'>啟動會議</button></div>'+
        '<div class="project-team-empty">'+(canRun?'組隊完成後再開會；這一步不會改變作品主線，也不會提前展開完整計畫。':'目前小隊沒有可執行員工，請先重新配隊或手動加入現有員工。')+'</div>'+
      '</section>';
    }

    const contributions=Array.isArray(currentMeeting.contributions)?currentMeeting.contributions:[];
    const summary=currentMeeting.summary||{};
    const support=(currentMeeting.support_resources||[]).map(x=>x.name).filter(Boolean);
    return '<section class="project-kickoff is-ready">'+
      '<div class="project-kickoff-head"><div><span class="kicker">作品組隊器 · 第二步</span><h4>啟動會議摘要</h4><p>已收斂成同一條作品主線；這裡只保留開工前必要判斷，不展開完整執行計畫。</p></div><button class="ghost-btn small" type="button" data-project-team-kickoff>重新開會</button></div>'+
      '<div class="project-kickoff-speakers">'+contributions.map(c=>
        '<article class="project-kickoff-speaker" data-kickoff-speaker="'+escText(c.key)+'"><div><span>員工</span><b>'+escText(c.name)+'</b></div>'+
        '<p><strong>關鍵問題</strong>'+escText(c.question)+'</p>'+
        '<p><strong>主要風險</strong>'+escText(c.risk)+'</p>'+
        '<p><strong>必要依賴</strong>'+escText(c.dependency)+'</p>'+
        '<p><strong>建議里程碑</strong>'+escText(c.milestone)+'</p></article>'
      ).join('')+'</div>'+
      (support.length?'<div class="project-kickoff-support"><b>支援資源</b><span>'+escText(support.join('、'))+'</span><small>只提供工具、資料或方法，不作為員工發言。</small></div>':'')+
      '<div class="project-kickoff-summary">'+
        summaryBlock('共識',summary.consensus)+
        summaryBlock('風險',summary.risks)+
        summaryBlock('待確認',summary.pending)+
        summaryBlock('建議里程碑',summary.milestone_suggestions)+
      '</div>'+
    '</section>';
  }

  renderProjectTeamDraft=function(container,system){
    baseRenderProjectTeamDraft(container,system);
    if(!container||!PROJECT_TEAM_DRAFT?.generated){
      currentMeeting=null;
      currentSignature='';
      return;
    }

    const signature=draftSignature();
    if(signature!==currentSignature){
      currentMeeting=null;
      currentSignature=signature;
    }

    const catalog=projectTeamCatalog(system),byKey=new Map(catalog.map(x=>[x.key,x]));
    const selected=(PROJECT_TEAM_DRAFT.selectedKeys||[]).map(k=>byKey.get(k)).filter(Boolean);
    container.insertAdjacentHTML('beforeend',panelHtml(selected));

    const button=container.querySelector('[data-project-team-kickoff]');
    if(button&&!button.disabled){
      button.addEventListener('click',()=>{
        currentMeeting=buildMeeting(system);
        renderProjectTeamDraft(container,system);
      });
    }
  };

  window.GROWTH_BRAIN_PROJECT_KICKOFF={
    current:()=>clone(currentMeeting),
    restore:value=>{
      currentMeeting=null;currentSignature='';
      if(!PROJECT_TEAM_DRAFT?.generated||!value||value.version!=='project-kickoff-v1'||value.goal!==PROJECT_TEAM_DRAFT.goal)return false;
      if(!strings(value.team_keys)||JSON.stringify(value.team_keys)!==JSON.stringify(PROJECT_TEAM_DRAFT.selectedKeys)||new Set(value.team_keys).size!==value.team_keys.length)return false;
      if(!strings(value.participant_keys)||!value.participant_keys.length||new Set(value.participant_keys).size!==value.participant_keys.length||value.participant_keys.some(k=>!value.team_keys.includes(k)))return false;
      if(!Array.isArray(value.contributions)||value.contributions.length!==value.participant_keys.length||value.contributions.some((x,i)=>!x||x.key!==value.participant_keys[i]||['name','scope','question','risk','dependency','milestone'].some(k=>typeof x[k]!=='string')))return false;
      const supportKeys=value.team_keys.filter(k=>!value.participant_keys.includes(k));
      if(!Array.isArray(value.support_resources)||value.support_resources.length!==supportKeys.length||value.support_resources.some((x,i)=>!x||x.key!==supportKeys[i]||typeof x.name!=='string'||typeof x.kind!=='string'))return false;
      if(!value.summary||['consensus','risks','pending','milestone_suggestions'].some(k=>!strings(value.summary[k])))return false;
      currentMeeting=clone(value);currentSignature=draftSignature();return true;
    },
    reset:()=>{currentMeeting=null;currentSignature='';}
  };

  queueMicrotask(()=>{
    const box=document.querySelector('#projectTeamBuilderResult');
    if(box&&PROJECT_TEAM_DRAFT?.generated)renderProjectTeamDraft(box,SYSTEM);
  });
})();

(function(){
if(typeof renderProjectTeamDraft!=='function')return;
const base=renderProjectTeamDraft;
let brief=null,sig='';
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const integrators=[
 ['ceo-orchestrator','Growth Brain CEO（總控）'],
 ['product-flow-architect','Product Flow Architect（產品流程架構師）'],
 ['goal-closure-operator','Goal Closure Operator（達案執行官）'],
 ['logic-reality-analyst','Logic & Reality Analyst（邏輯／真實性分析員）']
];
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
function signature(m){return m?JSON.stringify(stable([m.version,m.goal,m.team_keys,m.participant_keys,m.summary])):''}
function integrator(m){
 const set=new Set(m?.participant_keys||[]);
 for(const [key,name] of integrators)if(set.has(key))return {key,name};
 return {key:'growth-brain-integrator',name:'Growth Brain 整合角色'};
}
function prompt(b){
 const lines=(a,f=x=>x)=>a.length?a.map(x=>'- '+f(x)).join('\n'):'- 目前沒有額外項目。';
 return [
  '【作品目標】',b.objective,'',
  '【這一輪成功重點】',b.success_focus,'',
  '【執行邊界】',lines(b.boundaries),'',
  '【團隊責任】',lines(b.team_responsibilities,x=>x.name+'：'+x.scope),'',
  '【主要風險】',lines(b.key_risks),'',
  '【待確認】',lines(b.open_questions),'',
  '【里程碑候選】',lines(b.milestone_seed),'',
  '【證據規則】',b.evidence_rule,'',
  '只依以上內容建立後續作品路徑；不要改寫原始目標，不要自行新增無關功能，也不要在本階段展開完整細步驟。'
 ].join('\n');
}
function build(m){
 const s=m.summary||{},i=integrator(m),c=Array.isArray(m.contributions)?m.contributions:[],cons=uniq(s.consensus||[]);
 const b={
  version:'project-brief-v1',source_meeting_version:m.version||'',source_meeting_signature:signature(m),goal:m.goal||'',objective:m.goal||'',
  integrator_key:i.key,integrator_name:i.name,team_keys:[...(m.team_keys||[])],participant_keys:[...(m.participant_keys||[])],
  success_focus:cons[1]||cons[0]||'先完成最小可驗證成果，取得真實證據後再決定是否擴大。',
  boundaries:[
   '維持使用者原始作品目標，不由員工自行改寫主線。',
   '這一階段只整合啟動會議，不提前建立正式里程碑或展開細步驟。',
   '工具、資料來源與方法只提供支援，不冒充可執行員工。',
   '沒有真實作品或平台證據前，不把 AI 推論當成完成成果。'
  ],
  team_responsibilities:c.map(x=>({key:x.key,name:x.name,scope:x.scope})),
  key_risks:uniq(s.risks||[]).slice(0,4),open_questions:uniq(s.pending||[]).slice(0,4),
  milestone_seed:uniq(s.milestone_suggestions||[]).slice(0,4),
  evidence_rule:'所有進度都要以真實作品、平台數據或可追溯紀錄驗證；AI 產生的建議本身不算完成證據。'
 };
 b.base_prompt=prompt(b);return b;
}
function list(title,items){
 return '<div class="project-brief-block"><b>'+esc(title)+'</b><ul>'+((items||[]).map(x=>'<li>'+esc(x)+'</li>').join('')||'<li>目前沒有額外項目。</li>')+'</ul></div>';
}
function panel(m){
 if(!m)return '<section class="project-brief is-locked"><div class="project-brief-head"><div><span class="kicker">作品組隊器 · 第三步</span><h4>會後整合／Project Brief</h4><p>先完成啟動會議，整合角色才會把共識收斂成一份統一的作品基礎提示詞。</p></div><button class="primary-btn" disabled>產生基礎提示詞</button></div></section>';
 if(!brief){
  const i=integrator(m);
  return '<section class="project-brief"><div class="project-brief-head"><div><span class="kicker">作品組隊器 · 第三步</span><h4>會後整合／Project Brief</h4><p>由 '+esc(i.name)+' 收斂會議結果；只整合，不改作品主線。</p></div><button class="primary-btn" data-project-brief-generate>產生基礎提示詞</button></div><div class="project-team-empty">這一步只產生統一 Brief，不會建立正式里程碑或展開細步驟。</div></section>';
 }
 const team=brief.team_responsibilities.map(x=>x.name+'：'+x.scope);
 return '<section class="project-brief is-ready"><div class="project-brief-head"><div><span class="kicker">作品組隊器 · 第三步</span><h4>作品基礎提示詞／Project Brief</h4><p>整合角色：'+esc(brief.integrator_name)+'。下一階段拆里程碑會沿用這份內容。</p></div><button class="ghost-btn small" data-project-brief-generate>重新整合</button></div>'+
 '<div class="project-brief-core"><div><span>作品目標</span><b>'+esc(brief.objective)+'</b></div><div><span>成功重點</span><b>'+esc(brief.success_focus)+'</b></div></div>'+
 '<div class="project-brief-grid">'+list('執行邊界',brief.boundaries)+list('團隊責任',team)+list('主要風險',brief.key_risks)+list('待確認',brief.open_questions)+list('里程碑候選',brief.milestone_seed)+list('證據規則',[brief.evidence_rule])+'</div>'+
 '<details class="project-brief-prompt"><summary><b>查看基礎提示詞</b><span>下一階段沿用</span></summary><pre>'+esc(brief.base_prompt)+'</pre></details>'+
 '<small class="project-brief-note">目前只完成會後整合；正式里程碑、目前里程碑細步驟與永久保存留到後續切片。</small></section>';
}
renderProjectTeamDraft=function(container,system){
 base(container,system);
 if(!container||!PROJECT_TEAM_DRAFT?.generated){brief=null;sig='';return;}
 const m=window.GROWTH_BRAIN_PROJECT_KICKOFF?.current?.()||null,next=signature(m);
 if(next!==sig){brief=null;sig=next;}
 container.insertAdjacentHTML('beforeend',panel(m));
 const btn=container.querySelector('[data-project-brief-generate]');
 btn?.addEventListener('click',()=>{
  const latest=window.GROWTH_BRAIN_PROJECT_KICKOFF?.current?.()||null;
  if(!latest)return;
  sig=signature(latest);brief=build(latest);renderProjectTeamDraft(container,system);
 });
};
window.GROWTH_BRAIN_PROJECT_BRIEF={
 current:()=>clone(brief),
 restore:value=>{
  brief=null;sig='';
  const m=window.GROWTH_BRAIN_PROJECT_KICKOFF?.current?.();
  if(!m||!value||value.version!=='project-brief-v1'||value.source_meeting_version!==m.version||value.source_meeting_signature!==signature(m)||value.goal!==m.goal||value.objective!==m.goal)return false;
  if(JSON.stringify(value.team_keys)!==JSON.stringify(m.team_keys)||JSON.stringify(value.participant_keys)!==JSON.stringify(m.participant_keys))return false;
  if(['integrator_key','integrator_name','success_focus','evidence_rule','base_prompt'].some(k=>typeof value[k]!=='string')||!value.base_prompt)return false;
  if(['boundaries','key_risks','open_questions','milestone_seed'].some(k=>!Array.isArray(value[k])||value[k].some(x=>typeof x!=='string')))return false;
  if(!Array.isArray(value.team_responsibilities)||value.team_responsibilities.length!==m.participant_keys.length||value.team_responsibilities.some((x,i)=>!x||x.key!==m.participant_keys[i]||typeof x.name!=='string'||typeof x.scope!=='string'))return false;
  brief=clone(value);sig=signature(m);return true;
 },
 reset:()=>{brief=null;sig='';}
};
queueMicrotask(()=>{const box=document.querySelector('#projectTeamBuilderResult');if(box&&PROJECT_TEAM_DRAFT?.generated)renderProjectTeamDraft(box,SYSTEM);});
})();