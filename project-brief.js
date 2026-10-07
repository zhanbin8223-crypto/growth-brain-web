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
function signature(m){return m?JSON.stringify([m.version,m.goal,m.team_keys,m.participant_keys,m.summary]):''}
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
  version:'project-brief-v1',source_meeting_version:m.version||'',goal:m.goal||'',objective:m.goal||'',
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
window.GROWTH_BRAIN_PROJECT_BRIEF={current:()=>clone(brief),reset:()=>{brief=null;sig='';}};
queueMicrotask(()=>{const box=document.querySelector('#projectTeamBuilderResult');if(box&&PROJECT_TEAM_DRAFT?.generated)renderProjectTeamDraft(box,SYSTEM);});
})();