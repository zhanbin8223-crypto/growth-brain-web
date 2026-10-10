const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const A=window.GROWTH_BRAIN_ADAPTER;
let D=null;
let SYSTEM=null;
let PROJECT_TEAM_DRAFT={goal:'',selectedKeys:[],generated:false};
let PROJECT_TEAM_ROUTE=null;

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pct=v=>`${Math.round((Number(v)||0)*100)}%`;
const pill=s=>{const k=String(s||'unknown').toLowerCase();const cls=['completed','available','live','active','selected'].includes(k)?'success':['blocked','blocked_external','danger','rejected'].includes(k)?'danger':['current','planned','pending','supporting_only','candidate','candidate_only','paused'].includes(k)?'warn':'';return `<span class="pill ${cls}">${esc(statusText(s||'unknown'))}</span>`};
const human=s=>{
  const raw=String(s||'');
  const labels={
    remote_income:'遠端收入',
    synapse_graph:'知識連結圖',
    repeated_core_logic:'重複核心邏輯',
    unified_stream:'統一資訊流',
    spec_kit_workflow:'Spec Kit 規格工作流',
    'spec-kit-workflow':'Spec Kit 規格工作流',
    'event-clustering':'事件聚類',
    'filter-before-learning':'先過濾再學習',
    'pipeline-vs-learning':'資料流程與學習流程的差別',
    goal_closure_recovery:'卡住後的達案恢復',
    intent_evidence_before_implementation:'先確認需求與證據再實作',
    spec_before_code:'先規格後寫程式'
  };
  const key=raw.replace(/^concept:/,'').replace(/^logic:/,'').trim();
  const normalized=key.toLowerCase().replace(/\s+/g,'_');
  return labels[key]||labels[normalized]||key.replaceAll('_',' ').replaceAll('-',' ');
};
const home=()=>D?.personalHome||{};
const attempt=u=>A.latestAttempt(u.id);
const statusText=s=>({
  completed:'已完成',available:'可使用',live:'已連線',active:'進行中',
  blocked:'受阻',danger:'異常',current:'目前進行',planned:'規劃中',
  pending:'等待中',supporting_only:'支援用途',candidate:'候選',
  selected:'已選定',rejected:'已拒絕',paused:'暫停',
  blocked_external:'外部服務尚未接通',candidate_only:'僅候選',unknown:'未驗證',confirmed:'使用者已確認',verified:'已驗證',
  personal_outcome_route_selected:'已選定個人主線',
  personal_outcome_candidate_available:'有候選主線待確認',
  personal_artifact_candidate_available:'有候選作品待確認',
  personal_artifact_current:'目前作品進行中',
  personal_artifact_current_step:'目前作品下一步',
  personal_artifact_ready_to_complete:'作品可完成',
  personal_artifact_replanning:'正在重新規劃下一件作品',
  needs_personal_outcome_route:'尚未選定個人主線'
}[String(s||'').toLowerCase()]||String(s||''));

function modeStrip(){
  const live=A.liveStatus==='live';
  return `<div class="system-strip"><div><span class="system-kicker">資料狀態</span><b>${live?'已連線正式資料':'尚未讀取正式個人資料'}</b><span>私人單人模式</span></div><p>${live?'首頁正在讀取登入後的正式個人資料；系統資料只有進入系統頁才載入。':'登出時不顯示快取或示範個人資料；登入後才讀取正式內容。'}</p></div>`;
}

const TODAY_COVERS=['a','b'];
function todayDateLabel(d=new Date()){return '星期'+'日一二三四五六'[d.getDay()]+'・'+(d.getMonth()+1)+' 月 '+d.getDate()+' 日'}
function todayCandidates(){
  const s=A.personalArtifacts||{};
  const list=Array.isArray(s.candidates)?s.candidates:(s.candidate?[s.candidate]:[]);
  return list.filter(x=>x&&x.status==='candidate'&&x.id);
}
function todayCriteria(w){return Array.isArray(w?.done_evidence)?w.done_evidence:[]}
function todayLoggedOutHtml(){
  return `<div class="td"><section class="td-hero"><div><span class="td-chip td-chip-brand">你的個人成長系統</span>
    <h1>每天只做<em>一件事</em>，<br>做完就看得見成長</h1>
    <p>第二大腦幫你選定一件作品、拆成小步驟，做完留下證據，能力會跟著真實紀錄長大。</p>
    <div class="td-actions"><button class="td-btn td-btn-primary" data-auth>用信箱登入 →</button><a class="td-btn td-btn-ghost" href="#td-loop">看它怎麼運作</a></div></div>
    <div class="td-art"><img src="assets/ui/home-hero-workspace.webp" alt="" aria-hidden="true">
      <div class="td-card td-float td-f1"><span class="td-dot td-ok"></span>今天的一步完成了</div>
      <div class="td-card td-float td-f2"><span class="td-dot td-violet"></span>能力 +1：選品判斷</div></div></section>
    <section class="td-loop" id="td-loop">
      <div class="td-card td-step"><i class="td-soft-brand">①</i><div><h3>選一件作品</h3><p>真實要完成的事，不是待辦清單</p></div></div>
      <div class="td-card td-step"><i class="td-soft-teal">②</i><div><h3>一次一小步</h3><p>系統只給你唯一下一步</p></div></div>
      <div class="td-card td-step"><i class="td-soft-violet">③</i><div><h3>證據變能力</h3><p>只有真實證據會改變你的能力</p></div></div>
    </section></div>`;
}
function todayChooseHtml(cands,msg=''){
  const cards=cands.map((w,i)=>{
    const c=/數字人|Instagram|\bIG\b/i.test(String(w.title||''))?'b':'a',crit=todayCriteria(w);
    return `<article class="td-card td-work" data-work="${esc(w.id)}"><div class="td-cover td-cover-${c}"><span class="td-chip">尚未開始</span></div>
      <div class="td-wbody"><h2>${esc(w.title)}</h2><p>${esc(w.objective||'')}</p>
      <div class="td-first td-first-${c}"><span class="td-n">1</span><div><small>第一步</small><b>${esc(crit[0]||'開始後由系統產生第一步')}</b></div></div>
      <div class="td-meta"><span>🎯 ${crit.length?'共 '+crit.length+' 個完成條件':'完成條件待產生'}</span></div>
      <div class="td-pick"><button class="td-btn td-btn-primary td-btn-${c}" type="button" data-today-pick="${esc(w.id)}">選這件開始 →</button></div></div></article>`;
  }).join('');
  return `<div class="td"><div class="td-greet"><div class="td-eyebrow">${esc(todayDateLabel())}</div>
    <h1>${cands.length>1?'今天，先選一件作品開始':'今天，開始這件作品'}</h1>
    <p>${cands.length>1?'兩件都還沒開始。一次只推一件，另一件會安全地等你。':'這件作品還沒開始，按下開始後會給你第一步。'}</p></div>
    ${msg?'<p class="td-msg" role="status">'+esc(msg)+'</p>':''}
    <div class="td-works">${cards}</div>
    <div class="td-note">🔒 選了之後，另一件會留在「作品」頁的等待中，不會消失。</div>
    <div class="td-card td-how"><b>怎麼運作</b><span>🛠 做一小步</span><span>→</span><span>📎 留下證據</span><span>→</span><span>🌱 能力更新</span></div></div>`;
}
function todayRing(pctv){
  const r=34,c=2*Math.PI*r,off=c*(1-pctv/100);
  return `<svg class="td-ring" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="${r}" fill="none" stroke="var(--td-line)" stroke-width="8"/><circle cx="44" cy="44" r="${r}" fill="none" stroke="var(--td-brand)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 44 44)"/><text x="44" y="50" text-anchor="middle" font-size="18" font-weight="800" fill="var(--td-ink)">${pctv}%</text></svg>`;
}
function bindTodayPick(){
  $$('#view-home [data-today-pick]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.todayPick,box=btn.closest('.td-pick'),title=btn.closest('.td-work')?.querySelector('h2')?.textContent||'';
    box.innerHTML=`<div class="td-confirm"><p>確定先做「${esc(title)}」？另一件會留在等待中。</p><div class="td-actions"><button class="td-btn td-btn-primary" type="button" data-today-confirm>確定開始</button><button class="td-btn td-btn-ghost" type="button" data-today-cancel>再想想</button></div></div>`;
    box.querySelector('[data-today-cancel]').onclick=()=>renderHome();
    box.querySelector('[data-today-confirm]').onclick=async e=>{
      e.target.disabled=true;e.target.textContent='開始中…';
      try{
        await A.decidePersonalArtifact({artifactId:id,decision:'start'});
        D=await A.getSnapshot();renderHome();
        renderProjectsIA?.();
      }catch(err){renderHome(err.message||'開始作品失敗，請再試一次。')}
    };
  });
}

function renderHome(notice=''){
  if(A.liveStatus==='signed_out'){$('#view-home').innerHTML=todayLoggedOutHtml();return;}
  if(A.liveStatus==='live'&&!home().artifact_summary?.current){
    if(!A.personalArtifacts){
      $('#view-home').innerHTML='<div class="td"><p class="td-msg">正在讀取你的作品…</p></div>';
      A.getPersonalArtifacts().then(()=>renderHome(notice)).catch(e=>{$('#view-home').innerHTML='<div class="td"><p class="td-msg">讀取作品失敗：'+esc(e.message||e)+'</p></div>'});
      return;
    }
    const cands=todayCandidates();
    if(cands.length){$('#view-home').innerHTML=todayChooseHtml(cands,notice);bindTodayPick();return;}
  }
  renderTodayFocus();
}

function renderTodayFocus(){
  const H=home(),dir=H.primary_direction||{},action=H.primary_action||{},learn=H.learning_support||{},progress=(H.recent_real_progress?.items||[]).slice(0,4);
  const currentArtifact=H.artifact_summary?.current||null;
  const artifactProgress=currentArtifact?.progress_summary||{};
  const currentSkills=Array.isArray(currentArtifact?.skills)?currentArtifact.skills:[];
  const confirmed=Number(artifactProgress.confirmed||0);
  const total=Number(artifactProgress.total||0);
  const progressPct=total?Math.max(0,Math.min(100,Math.round(confirmed/total*100))):0;
  const currentTitle=currentArtifact?.title||dir.goal||dir.title||'尚未選定目前作品';
  const currentSummary=currentArtifact?.objective||dir.goal||'登入後會顯示目前作品與唯一下一步。';
  const stepTitle=action.title||currentArtifact?.next_evidence_item?.criterion_text||'先選一個真實下一步';
  const stepWhy=action.why||'先把目前作品往前推一小步，不開新的支線。';
  const stepEvidence=action.success_evidence||currentArtifact?.next_evidence_item?.criterion_text||'完成後留下可追溯的真實證據。';
  const latest=progress[0]||null;
  const waiting=currentArtifact?todayCandidates().filter(w=>w.id!==currentArtifact.id):[];
  const directSkills=currentSkills.filter(s=>s.minimum_needed_now||String(s.evidence_state||'').toLowerCase()==='unknown').slice(0,3);

  let cta='';
  if(A.liveStatus==='signed_out') cta='<button class="primary-btn focus-primary" data-auth>登入讀取我的主線</button>';
  else if(action.status==='needs_personal_outcome_route') cta='<button class="primary-btn focus-primary" data-jump="projects">建立作品路徑</button>';
  else if(action.status==='personal_outcome_candidate_available') cta='<button class="primary-btn focus-primary" data-jump="projects">確認候選路徑</button>';
  else if(action.status==='personal_artifact_candidate_available') cta='<button class="primary-btn focus-primary" data-jump="projects">開始候選作品</button>';
  else if(action.status==='personal_artifact_ready_to_complete') cta='<button class="primary-btn focus-primary" data-jump="projects">完成作品</button>';
  else if(action.status==='personal_artifact_replanning') cta='<button class="primary-btn focus-primary" data-jump="projects">查看下一件作品</button>';
  else cta='<button class="primary-btn focus-primary" data-jump="projects">開始這一步 →</button>';

  const skillSupport=directSkills.length
    ?directSkills.map(s=>'<button class="focus-support-row" type="button" data-jump="capabilities"><span>'+esc(s.name_zh||s.name||human(s.skill_key||'能力'))+'</span><small>'+esc(s.minimum_needed_now||'目前仍待作品證據驗證')+'</small></button>').join('')
    :'<div class="focus-support-empty">目前這一步沒有需要先補的能力。</div>';

  if(currentArtifact&&window.GROWTH_BRAIN_W1P){
    const W=window.GROWTH_BRAIN_W1P;
    const ctaW=cta.replace('class="primary-btn focus-primary"','class="btn btn-primary focus-primary"');
    const funnelW=A.liveStatus==='live'&&stepTitle?'<button class="btn btn-ghost" data-funnel-kind="current_artifact" data-funnel-id="'+esc(currentArtifact.id)+'" data-funnel-goal="'+esc(currentArtifact?.next_evidence_item?.criterion_text||stepTitle)+'">我卡住了，幫我拆小</button>':'';
    const ds=directSkills[0];
    const learnHtml=ds?'<div class="learn-row"><span class="ibox te">'+W.icon('lightbulb','i')+'</span><div><h3>學習補一下：'+esc(ds.name_zh||ds.name||human(ds.skill_key||'能力'))+'</h3><p class="muted small">'+esc(ds.minimum_needed_now||'只補這一步用得到的部分')+'</p></div></div><a class="link" href="#/learn/practice">去練習'+W.icon('chevron-right')+'</a>'
      :'<div class="learn-row"><span class="ibox te">'+W.icon('lightbulb','i')+'</span><div><h3>目前不用先學</h3><p class="muted small">'+esc(learn.primary_card?.next_action||'沒有缺口就繼續做作品，不先學一堆。')+'</p></div></div>';
    const extra='<details class="card tile w1p-extra"><summary><b>最近進展</b><span class="muted small">只看真實紀錄</span></summary><div class="focus-progress-list-v4">'+(progress.length?progress.map(p=>'<div><span>'+esc(p.occurred_at?new Date(p.occurred_at).toLocaleDateString('zh-TW'):'')+'</span><b>'+esc(p.title||'真實進展')+'</b></div>').join(''):'<p class="muted small">還沒有真實進展紀錄。</p>')+'</div></details>';
    $('#view-home').innerHTML=W.todayHtml({current:currentArtifact,waiting,stepTitle,stepWhy,stepEvidence,ctaHtml:ctaW,funnelHtml:funnelW,learnHtml,extraHtml:extra});
    return;
  }
  $('#view-home').innerHTML=`<div class="td td-focus">
    <header class="v4-page-head">
      <span class="v4-eyebrow">TODAY · 今天</span>
      <div><h2>現在只做這一步</h2><p>第二大腦的其他內容都先退後，直到它真的能幫目前這一步。</p></div>
      <img class="v4-page-art" data-image-placement="today.hero" src="assets/ui/home-hero-workspace.webp" alt="" aria-hidden="true">
    </header>

    <section class="focus-stage">
      <aside class="focus-context">
        <span class="focus-label">目前作品</span>
        <h3>${esc(currentTitle)}</h3>
        <p>${esc(currentSummary)}</p>
        <button class="focus-link" type="button" data-jump="projects">打開作品 →</button>
      </aside>

      <main class="focus-step">
        <span class="focus-label">唯一下一步</span>
        <h1>${esc(stepTitle)}</h1>
        <p class="focus-why">${esc(stepWhy)}</p>
        <div class="focus-evidence">
          <span>完成後要留下</span>
          <b>${esc(stepEvidence)}</b>
        </div>
        <div class="focus-actions">
          ${cta}
          ${A.liveStatus==='live'&&stepTitle?'<button class="ghost-btn" data-funnel-kind="'+(currentArtifact?'current_artifact':'user_event')+'" data-funnel-id="'+esc(currentArtifact?.id||'')+'" data-funnel-goal="'+esc(currentArtifact?.next_evidence_item?.criterion_text||stepTitle)+'">我卡住了，幫我拆這一步</button>':''}
        </div>
      </main>

      <aside class="focus-progress">
        <div class="focus-progress-head"><span>作品進度</span><strong>${total?confirmed+' / '+total:'—'}</strong></div>
        ${todayRing(progressPct)}
        <small>${total?'已確認 '+confirmed+' 個，還差 '+(total-confirmed)+' 個':'等待正式作品資料'}</small>
        ${latest?'<div class="focus-latest"><span>最近進展</span><b>'+esc(latest.title||latest.summary||'已有新進展')+'</b></div>':''}
      </aside>
    </section>
    ${waiting.length?'<section class="td-waiting td-card"><span class="focus-label">等待中的作品</span>'+waiting.map(w=>'<div><b>'+esc(w.title)+'</b><small>目前先不做，會安全地等你；可在「作品」頁切換。</small></div>').join('')+'</section>':''}

    <section class="focus-support">
      <details class="focus-support-panel">
        <summary><span>需要時再打開</span><b>能力／學習支援</b></summary>
        <div class="focus-support-body">
          <div>
            <span class="focus-label">這一步可能需要的能力</span>
            ${skillSupport}
          </div>
          <div>
            <span class="focus-label">學習規則</span>
            <p>${esc(learn.primary_card?.description||'只有目前這一步真的被知識缺口卡住時，才把學習拉到前面。')}</p>
            <small>${esc(learn.primary_card?.next_action||'沒有缺口就繼續做作品，不先學一堆。')}</small>
          </div>
        </div>
      </details>
      <details class="focus-support-panel">
        <summary><span>只看真實紀錄</span><b>最近進展</b></summary>
        <div class="focus-progress-list-v4">${progress.length?progress.map(p=>'<div><span>'+esc(p.occurred_at?new Date(p.occurred_at).toLocaleDateString('zh-TW'):'')+'</span><b>'+esc(p.title||'真實進展')+'</b><p>'+esc(p.summary||'')+'</p></div>').join(''):'<div class="focus-support-empty">目前還沒有可追溯的真實進展。</div>'}</div>
      </details>
    </section></div>`;
}

async function renderProjects(notice=''){
  const root=$('#view-projects');
  const H=home(),dir=H.primary_direction||{};

  if(A.liveStatus!=='live'){
    root.innerHTML=`<div class="section-head"><div><h2>目標與作品</h2><p>登入後，你的方向才會交給第二大腦整理成可驗證作品，並保存成正式作品序列。</p></div></div><div class="surface"><b>目前尚未連線正式資料</b><p>登入後才能讀取你的目標、作品、技能證據與學習紀錄。</p><button class="primary-btn" data-auth>登入</button></div>`;
    return;
  }

  root.innerHTML='<div class="empty">正在讀取你的目標、作品與技能狀態…</div>';

  let outcome,artifacts;
  try{
    [outcome,artifacts]=await Promise.all([
      A.getPersonalOutcome(),
      A.getPersonalArtifacts({force:true})
    ]);
  }catch(e){
    root.innerHTML=`<div class="empty">作品資料載入失敗：${esc(e.message||e)}</div>`;
    return;
  }

  const selected=outcome?.selected_route||null;
  const candidate=outcome?.candidate_route||null;
  const planningRoute=candidate||selected||null;
  const planJob=artifacts?.next_plan_job||planningRoute?.path_plan||null;
  const currentArtifact=artifacts?.current||null;
  const progressItems=Array.isArray(currentArtifact?.evidence_progress)?currentArtifact.evidence_progress:[];
  const nextEvidence=currentArtifact?.next_evidence_item||progressItems.find(x=>x.status!=='confirmed')||null;
  const candidateArtifact=artifacts?.candidate||null;
  const history=Array.isArray(artifacts?.history)?artifacts.history:[];

  const aiLabels={
    pending:'等待本機執行器',
    claimed:'已被執行器取走',
    processing:'GPT 正在整理',
    completed:'GPT 已整理',
    failed:'這次整理失敗',
    cancelled:'已取消'
  };

  const skillStateLabel=s=>({
    unknown:'尚未驗證',
    exposure:'接觸過',
    acknowledged:'知道這是什麼',
    understood:'已理解',
    can_explain:'能用自己的話解釋',
    apply_with_help:'可在協助下應用',
    apply_independently:'可獨立應用',
    retained:'隔一段時間仍能使用',
    real_project:'已在真實作品驗證',
    commercialized:'已用於商業成果'
  }[String(s||'').toLowerCase()]||'尚未驗證');

  const aiStateLabel=s=>({
    unknown:'尚未判斷',
    exposure:'接觸過',
    understood:'可能已理解',
    apply_with_help:'可能可在協助下應用',
    apply_independently:'可能可獨立應用'
  }[String(s||'').toLowerCase()]||human(s||'尚未判斷'));

  const linkCounts=artifact=>{
    const links=Array.isArray(artifact?.links)?artifact.links:[];
    return {
      learning:links.filter(x=>x.link_kind==='learning_session').length,
      concepts:links.filter(x=>x.link_kind==='synapse_concept').length,
      evidence:links.filter(x=>['learning_evidence','artifact_evidence'].includes(x.link_kind)).length
    };
  };

  const skillHtml=artifact=>{
    const skills=Array.isArray(artifact?.skills)?artifact.skills:[];
    const editBtn='<button class="ghost-btn small" type="button" data-work-skills-global="'+esc(artifact?.id||'')+'" data-work-title="'+esc(artifact?.title||'')+'">'+(skills.length?'修改能力清單':'依完成條件產生建議清單')+'</button>';
    if(!skills.length) return '<div class="empty">這件作品還沒有能力清單。'+editBtn+'</div>';
    const core=skills.filter(s=>s.skill_kind==='core');
    const tools=skills.filter(s=>s.skill_kind==='tool');
    const card=s=>{
      const coverage=typeof s.evidence_coverage==='number'?Math.round(s.evidence_coverage*100):null;
      return `<article class="surface">
        <div class="row-between">
          <div><b>${esc(s.name_zh||human(s.skill_key))}</b><p>${esc(s.why||'')}</p></div>
          <span class="pill ${s.evidence_state&&s.evidence_state!=='unknown'?'success':''}">${esc(skillStateLabel(s.evidence_state))}</span>
        </div>
        ${s.minimum_needed_now?`<div class="evidence-box"><b>目前只需要學到</b><span>${esc(s.minimum_needed_now)}</span></div>`:''}
        <small class="muted">
          ${coverage===null?'目前還沒有足夠作品證據':`目前作品證據覆蓋約 ${coverage}%`}
          ${s.ai_suggested_state?` · AI 初步判斷：${esc(aiStateLabel(s.ai_suggested_state))}（不算正式能力）`:''}
        </small>
      </article>`;
    };
    return `
      ${core.length?`<div class="stack">${core.map(card).join('')}</div>`:''}
      ${tools.length?`<details class="surface" style="margin-top:10px"><summary><b>工具能力（會隨技術更新）</b></summary><p>這些工具可以替換；底層能力沒有失效時，不會因此推翻整條路徑。</p><div class="stack">${tools.map(card).join('')}</div></details>`:''}

      <div style="margin-top:10px">${editBtn}</div>
    `;
  };

  const currentPanel=currentArtifact?(()=>{
    const counts=linkCounts(currentArtifact);
    const done=Array.isArray(currentArtifact.done_evidence)?currentArtifact.done_evidence:[];
    const progress=currentArtifact.progress_summary||{total:progressItems.length,confirmed:progressItems.filter(x=>x.status==='confirmed').length,remaining:progressItems.filter(x=>x.status!=='confirmed').length};
    const latestUnblock=currentArtifact.latest_unblock||null;
    const activeUnblock=latestUnblock&&nextEvidence&&Number(latestUnblock.criterion_no)===Number(nextEvidence.criterion_no)?latestUnblock:null;
    const allEvidenceConfirmed=Number(progress.total||0)>0&&Number(progress.remaining||0)===0;
    const learning=Array.isArray(currentArtifact.learning_focus)?currentArtifact.learning_focus:[];
    const branches=Array.isArray(currentArtifact.next_branch_candidates)?currentArtifact.next_branch_candidates:[];
    const progressRows=progressItems.length
      ?progressItems.map(item=>'<div class="row-between" style="gap:14px"><div><b>'+(item.status==='confirmed'?'✓ ':'○ ')+esc(item.criterion_text)+'</b>'+(item.status==='confirmed'&&item.evidence?.text?'<p class="muted">'+esc(item.evidence.text)+'</p>':'')+'</div><span class="pill '+(item.status==='confirmed'?'success':'')+'">'+(item.status==='confirmed'?'已留證據':'待完成')+'</span></div>').join('')
      :'<div class="empty">正在建立作品證據清單…</div>';
    const progressHtml='<details class="surface" style="margin-top:18px"><summary><b>作品進度 '+esc(progress.confirmed||0)+'/'+esc(progress.total||0)+'</b><span class="muted"> · 展開查看全部完成條件</span></summary><p class="muted">完整清單只用來查看進度；目前先處理上方這一步。</p><div class="stack" style="margin-top:12px">'+progressRows+'</div></details>';
    const evidenceHint=nextEvidence&&Number(nextEvidence.criterion_no)===1&&String(currentArtifact.title||'').includes('3 支內容')
      ?'你已排除 YouTube；目前候選是 X、Threads、Instagram。這輪先選 1 個主平台，再寫清楚內容主題與目標受眾；只是第一輪假設，不會永久綁死。'
      :nextEvidence&&/商品/.test(String(nextEvidence.criterion_text||''))
        ?'第一步請記錄：商品名稱、商品連結、目前分潤資訊，以及你為什麼先選它。無法確認的欄位就明確寫「尚未確認」，不要猜。'
        :'只記錄你真的做過或可以追溯的結果；AI 推測不算證據。';
    const nextEvidenceHtml=nextEvidence
      ?'<form class="surface project-form" id="artifactEvidenceProgressForm"><span class="kicker">現在只做第 '+esc(nextEvidence.criterion_no)+' 項</span><h3>'+esc(nextEvidence.criterion_text)+'</h3><p class="muted">'+esc(evidenceHint)+'</p><label><b>這一步的真實結果／證據</b><textarea id="artifactEvidenceProgressText" placeholder="寫下實際資料、結果或可驗證紀錄"></textarea></label><label><b>參考連結（可選，每行一個）</b><textarea id="artifactEvidenceProgressRefs" placeholder="https://..."></textarea></label><div class="row-between"><div id="artifactEvidenceProgressMsg" class="muted">保存後才會前進到下一個完成條件。</div><button type="submit" class="primary-btn">保存這一步的證據</button></div></form>'
      :'<div class="surface"><div class="row-between"><div><b>所有完成條件都有證據</b><p>現在才進入整件作品的完成確認與技能驗證。</p></div><span class="pill success">可完成作品</span></div></div>';
    const unblockStateLabel={
      reported:'已收到卡點',
      diagnosing:'正在拆解目前這一步',
      reviewing:'正在複核拆解結果',
      ready:'拆解完成',
      failed:'這次拆解失敗',
      resolved:'已解決',
      dismissed:'已略過'
    };
    const guidance=activeUnblock?.final_guidance||{};
    const learningNeed=guidance?.learning_needed||{};
    const unblockResultHtml=activeUnblock
      ?activeUnblock.status==='ready'
        ?'<article class="surface" style="margin-top:12px"><div class="row-between"><div><span class="kicker">拆解結果</span><h3>'+esc(guidance.problem_summary||'已找到目前卡點')+'</h3></div><span class="pill success">已複核</span></div><div class="evidence-box"><b>你現在只做這一步</b><span>'+esc(guidance.smallest_next_action||'先完成目前階段最小可執行動作')+'</span></div>'+(Array.isArray(guidance.micro_steps)&&guidance.micro_steps.length?'<details><summary><b>如果還是太大，再拆成 '+guidance.micro_steps.length+' 小步</b></summary><p>'+guidance.micro_steps.map((x,i)=>(i+1)+'. '+esc(typeof x==='string'?x:(x.title||x.step||''))).join('<br>')+'</p></details>':'')+(learningNeed?.needed?'<p><b>這次只需要補的學習：</b>'+esc(learningNeed.minimum||learningNeed.target||'目前階段最低必要內容')+'</p>':'')+'<small class="muted">卡住是診斷訊號，不會直接降低能力狀態，也不會自動重做整條路徑。</small></article>'
        :'<article class="surface" style="margin-top:12px"><div class="row-between"><div><b>'+esc(unblockStateLabel[activeUnblock.status]||'正在處理目前這一步')+'</b><p>會先拆小目前這一步，再檢查建議是否真的可執行。</p></div><span class="pill warn">'+esc(activeUnblock.signal_count||1)+' 次卡點訊號</span></div><small class="muted">這不會改變你的能力等級。</small></article>'
      :'';
    const unblockFormHtml=nextEvidence
      ?'<details class="surface" style="margin-top:12px"><summary><b>卡住了？幫我拆這一步</b></summary><p>只描述你現在卡在哪裡。系統先嘗試解釋或拆小步驟；同一階段反覆卡住時，才考慮重切這個階段。</p><form class="project-form" id="artifactUnblockForm"><label><b>我卡在</b><textarea id="artifactUnblockNote" placeholder="例如：我不知道 X、Threads、IG 要用什麼標準選；或我看懂概念但不知道下一個實際動作"></textarea></label><div class="row-between"><div id="artifactUnblockMsg" class="muted">卡住不等於能力下降；只處理目前這一步。</div><button type="submit" class="ghost-btn">幫我拆這一步</button></div></form></details>'
      :'';
    return `
      <section>
        <div class="section-head"><div><h2>現在只做這一件作品</h2><p>學習、知識連結與技能驗證都應該回到這件作品，而不是另外長出一堆支線。</p></div><span class="pill success">進行中</span></div>
        <article class="hero-card">
          <span class="kicker">作品 ${esc(currentArtifact.sequence_no||1)}</span>
          <h2>${esc(currentArtifact.title)}</h2>
          <p>${esc(currentArtifact.objective||'')}</p>
          ${currentArtifact.deliverable?`<div class="evidence-box"><b>這次要做出什麼</b><span>${esc(currentArtifact.deliverable)}</span></div>`:''}
          <div class="metrics compact">
            <div><strong>${counts.learning}</strong><span>相關學習</span></div>
            <div><strong>${counts.concepts}</strong><span>相關概念</span></div>
            <div><strong>${counts.evidence}</strong><span>正式證據</span></div>
          </div>
        </article>

        ${nextEvidence?`<div class="context-bar"><div><b>這一步還不清楚？</b><span>先拆出卡點與一個最小動作。</span></div><button class="ghost-btn" data-funnel-kind="current_artifact" data-funnel-id="${esc(currentArtifact.id)}" data-funnel-goal="${esc(nextEvidence.criterion_text)}">拆解這件事</button></div>`:''}
        ${nextEvidenceHtml}
        ${progressHtml}
        ${unblockResultHtml}
        ${unblockFormHtml}

        <details class="surface" style="margin-top:18px">
          <summary><b>這件作品會驗證哪些能力（${(currentArtifact.skills||[]).length}）</b></summary>
          <p>先做作品；能力狀態只會依真實回答、操作與作品證據更新。</p>
          ${skillHtml(currentArtifact)}
        </details>

        ${learning.length?`<details class="surface" style="margin-top:18px"><summary><b>現在真正需要補的學習（${learning.length}）</b></summary><p>只學能幫目前作品往前走的缺口，不預先學完整工具鏈。</p><div class="stack">${learning.map(x=>{const isText=typeof x==='string';const title=isText?'學習原則':human(x.skill_key)||x.skill_key||'學習重點';const body=isText?x:(x.reason||x.minimum_needed_now||'能支援目前作品');return `<div><b>${esc(title)}</b><p>${esc(body)}</p></div>`}).join('')}</div></details>`:''}

        ${branches.length?`<details class="surface" style="margin-top:18px"><summary><b>完成後可能往哪裡走</b></summary><p>這些只是候選。真正下一件作品要等這次結果出來再生成。</p>${branches.map(b=>`<p><b>${esc(b.branch||b.title||'候選方向')}</b><br><small class="muted">條件：${esc(b.condition||'看作品結果再決定')}</small></p>`).join('')}</details>`:''}

        ${allEvidenceConfirmed?`
        <div class="section-head"><div><h2>最後確認</h2><p>完成條件都有證據後，才確認作品結果與真正驗證到的技能。</p></div></div>
        <form class="surface project-form" id="completeArtifactForm">
          <label><b>這輪實際做出了什麼／結果如何</b><textarea id="artifactResultText" placeholder="例如：已發布 3 支內容，取得第一輪觀看與互動資料，並決定下一輪優先測試 Threads 的 AI 工具實測內容"></textarea></label>
          <label><b>補充證據（可選，每行一項）</b><textarea id="artifactEvidenceItems" placeholder="上方逐項清單已是主要證據；這裡只補充額外資訊"></textarea></label>
          ${(currentArtifact.skills||[]).length?`
            <div><b>這次作品真的驗證到哪些技能</b><p class="muted">沒有把握就不要勾；未勾選的技能維持原本證據狀態。</p>
              <div class="stack" style="margin-top:8px">
                ${(currentArtifact.skills||[]).map(s=>`<label class="surface" style="padding:12px;display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-complete-skill value="${esc(s.skill_key)}" style="width:auto;margin-top:4px"><span><b>${esc(s.name_zh||human(s.skill_key))}</b><br><small class="muted">${esc(s.minimum_needed_now||s.why||'只有作品證據足夠時才勾選')}</small></span></label>`).join('')}
              </div>
            </div>`:''}
          <div class="row-between">
            <div id="completeArtifactMsg" class="muted">完成後會保存結果與證據，再產生下一件候選作品；不會一次固定整條未來路徑。</div>
            <button type="submit" class="primary-btn">確認完成並重新規劃</button>
          </div>
        </form>`:`
        <div class="empty" style="margin-top:18px">先把目前 9 項證據清單走完；最後完成與技能確認現在先不佔畫面。</div>`}

      </section>
    `;
  })():'';

  const candidatePanel=candidateArtifact?(()=>{
    const done=Array.isArray(candidateArtifact.done_evidence)?candidateArtifact.done_evidence:[];
    const canStart=Boolean(selected && selected.id===candidateArtifact.route_id);
    return `
      <section>
        <div class="section-head"><div><h2>${history.some(x=>x.status==='completed')?'GPT 建議的下一件作品':'GPT 建議的第一件作品'}</h2><p>這只是候選。你確認後它才會成為「目前作品」，之後學習與知識才會自動掛到它。</p></div><span class="pill warn">待確認</span></div>
        <article class="surface">
          <h2>${esc(candidateArtifact.title)}</h2>
          <p>${esc(candidateArtifact.objective||'')}</p>
          ${candidateArtifact.deliverable?`<div class="evidence-box"><b>預計交付物</b><span>${esc(candidateArtifact.deliverable)}</span></div>`:''}
          <div class="evidence-box"><b>預計完成證據</b><span>${done.length?done.map(x=>`• ${esc(x)}`).join('<br>'):'等待確認'}</span></div>
          ${skillHtml(candidateArtifact)}
          <div class="project-actions" style="margin-top:16px">
            <button class="primary-btn" id="startArtifact" ${canStart?'':'disabled'}>${canStart?'開始這件作品':'先確認正式主線'}</button>
            <button class="ghost-btn" id="rejectArtifact">不要做這件</button>
          </div>
          <div id="artifactDecisionMsg" class="muted" style="margin-top:8px">${canStart?'開始後，同時只能有一件進行中的作品。':'主線仍是候選，所以作品不能先開始。'}</div>
        </article>
      </section>
    `;
  })():'';

  const waitingPanel=(!currentArtifact&&!candidateArtifact)?(()=>{
    if(!planningRoute){
      return '<section><div class="section-head"><div><h2>下一步</h2><p>先輸入你想達成的方向，系統才有東西可以拆成作品。</p></div></div><div class="empty">目前還沒有目標或作品。</div></section>';
    }
    if(!planJob){
      return '<section><div class="section-head"><div><h2>AI 路徑整理</h2><p>這個方向還沒有建立 GPT 路徑任務。</p></div></div><div class="empty">重新保存方向後會自動建立整理任務。</div></section>';
    }
    if(['pending','claimed','processing'].includes(planJob.status)){
      const replanning=history.some(x=>x.status==='completed')||String(planJob.source_ref||'').startsWith('artifact:');
      return `<section><div class="section-head"><div><h2>${replanning?'正在依上一件作品重新規劃':'正在產生第一件作品'}</h2><p>${replanning?'上一件作品的結果與證據已進資料庫，現在只生成下一件候選作品。':'第二大腦已把目標與相關資料放進 AI 任務；完成後會先生成候選作品，不會直接改成你已學會。'}</p></div><span class="pill warn">${esc(aiLabels[planJob.status]||'處理中')}</span></div><div class="surface"><b>${esc(aiLabels[planJob.status]||'處理中')}</b><p>${planJob.status==='pending'?'目前還在等待本機執行器取走。結果與 Context Pack 都已安全留在資料庫。':'GPT 正在整理作品結果、技能缺口與下一件候選作品。'}</p></div></section>`;
    }
    if(planJob.status==='failed'){
      return '<section><div class="section-head"><div><h2>這次 AI 整理沒有完成</h2><p>原始目標還在資料庫，不會因此遺失或被當成失敗的學習證據。</p></div><span class="pill danger">待重試</span></div></section>';
    }
    return '<section><div class="empty">GPT 已有回覆，但目前還沒有形成可用的候選作品；系統會保留原始回覆，不直接污染作品紀錄。</div></section>';
  })():'';

  const sequence=[...history];
  if(currentArtifact) sequence.unshift(currentArtifact);
  const sequencePanel=sequence.length?`
    <section>
      <div class="section-head"><div><h2>作品序列</h2><p>只有真的做過或正在做的作品才進這裡；未來階段不會提前寫死。</p></div><span>${sequence.length} 件</span></div>
      <div class="stack">
        ${sequence.map(a=>`<article class="surface row-between"><div><b>作品 ${esc(a.sequence_no)} · ${esc(a.title)}</b><p>${esc(a.objective||'')}</p></div><span class="pill ${a.status==='completed'?'success':a.status==='current'?'warn':''}">${a.status==='completed'?'已完成':a.status==='current'?'進行中':a.status==='abandoned'?'已停止':'已拒絕'}</span></article>`).join('')}
      </div>
    </section>`:''; 

  root.innerHTML=`
    <div class="section-head"><div><h2>目標與作品</h2><p>方向可以很大，但系統一次只讓你做一件可驗證作品；學習與知識都要服務現在這件事。</p></div>${pill(selected?'selected':candidate?'candidate':'unknown')}</div>

    <div class="hero-grid">
      <article class="surface">
        <span class="kicker">目前正式主線</span>
        <h3>${esc(selected?.title||'尚未選定')}</h3>
        <p>${esc(selected?.success_evidence||'先輸入你想達成的方向；GPT 可以幫你拆，但只有你能確認正式主線。')}</p>
        ${selected?'<span class="pill success">已確認</span>':''}
      </article>
      <article class="surface">
        <span class="kicker">長期方向</span>
        <h3>${esc(dir.key?human(dir.key):'尚未形成')}</h3>
        <p>${esc(dir.goal||'長期方向會依作品結果、新技術與你的能力證據調整。')}</p>
        <small class="muted">底層能力沒有失效時，不會因工具更新就整條重來。</small>
      </article>
    </div>

    ${candidate?`
      <div class="section-head"><div><h2>待你確認的新主線</h2><p>GPT 可以先整理候選作品，但在你確認前不能開始正式作品。</p></div></div>
      <article class="surface">
        <h3>${esc(candidate.title)}</h3>
        <p><b>目前完成方向：</b>${esc(candidate.success_evidence)}</p>
        ${candidate.why_now?`<p><b>為什麼現在做：</b>${esc(candidate.why_now)}</p>`:''}
        <div class="project-actions">
          <button class="primary-btn" id="selectCandidate">確認為目前主線</button>
          <button class="ghost-btn" id="rejectCandidate">不要走這條</button>
        </div>
      </article>`:''}

    ${currentPanel}
    ${candidatePanel}
    ${waitingPanel}
    ${sequencePanel}

    <div class="section-head"><div><h2>${candidate?'調整這個方向':'輸入一個想走的方向'}</h2><p>你只需要先說「想達成什麼」。GPT 會拆第一件作品，但正式作品與能力仍由你的確認與證據決定。</p></div></div>
    <form class="surface project-form" id="projectForm">
      <label><b>我想往哪裡走／想完成什麼</b><textarea id="projectTitle" placeholder="例如：我想把 AI 自動化學到可以接遠端工作，先從能做出實際作品開始">${esc(candidate?.title||'')}</textarea></label>
      <label><b>如果你已經知道，怎樣算達成（可選）</b><textarea id="projectEvidence" placeholder="不知道可以留空，GPT 會先拆成第一件可驗證作品">${esc(candidate?.success_evidence||'')}</textarea></label>
      <details><summary>補充：為什麼現在想做</summary><textarea id="projectWhy" placeholder="可選填">${esc(candidate?.why_now||'')}</textarea></details>
      <div class="row-between">
        <div id="projectMsg" class="muted">${esc(notice||'保存後會自動建立 GPT 路徑任務；AI 只產生候選，不會直接提升技能。')}</div>
        <button type="submit" class="primary-btn">保存並交給 GPT 整理</button>
      </div>
    </form>`;

  $('#projectForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const title=$('#projectTitle').value.trim();
    const providedEvidence=$('#projectEvidence').value.trim();
    const successEvidence=providedEvidence||'先由 GPT 拆解第一件可驗證作品，再以作品結果逐步確認完成標準。';
    const whyNow=$('#projectWhy').value.trim();
    const msg=$('#projectMsg');
    if(title.length<3){msg.textContent='請至少告訴我你想往哪裡走或想完成什麼。';return;}
    try{
      msg.textContent='正在保存，並把相關資料交給 GPT 整理…';
      await A.savePersonalOutcomeCandidate({title,successEvidence,whyNow,directionKey:dir.key||null});
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','已保存。完成 GPT 整理後會先產生一件候選作品，由你確認是否開始。');
    }catch(e){msg.textContent=e.message||'保存失敗';}
  });

  $('#selectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#selectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'select'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','已確認為正式主線。現在可以確認 GPT 建議的第一件作品。');
    }catch(e){btn.disabled=false;const msg=$('#projectMsg');if(msg)msg.textContent=e.message||'設定失敗';}
  });

  $('#rejectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#rejectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'reject'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','這個方向與底下尚未開始的候選作品都已退出主線。');
    }catch(e){btn.disabled=false;const msg=$('#projectMsg');if(msg)msg.textContent=e.message||'拒絕失敗';}
  });

  $('#artifactEvidenceProgressForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!currentArtifact||!nextEvidence) return;
    const evidenceText=$('#artifactEvidenceProgressText')?.value?.trim()||'';
    const evidenceRefs=($('#artifactEvidenceProgressRefs')?.value||'')
      .split(/\r?\n/)
      .map(x=>x.trim())
      .filter(Boolean);
    const msg=$('#artifactEvidenceProgressMsg');
    const submit=e.currentTarget.querySelector('button[type="submit"]');

    if(evidenceText.length<3){
      if(msg) msg.textContent='請寫下這一步真的取得了什麼資料或結果。';
      return;
    }

    submit.disabled=true;
    try{
      if(msg) msg.textContent='正在保存正式作品證據…';
      await A.recordPersonalArtifactEvidence({
        artifactId:currentArtifact.id,
        criterionNo:nextEvidence.criterion_no,
        evidenceText,
        evidenceRefs,
        metadata:{capture_surface:'projects'}
      });
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','這一步的證據已保存，現在前進到下一個完成條件。');
    }catch(err){
      submit.disabled=false;
      if(msg) msg.textContent=err.message||'作品證據保存失敗';
    }
  });
  $('#artifactUnblockForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!currentArtifact||!nextEvidence) return;
    const note=$('#artifactUnblockNote')?.value?.trim()||'';
    const msg=$('#artifactUnblockMsg');
    const submit=e.currentTarget.querySelector('button[type="submit"]');
    if(note.length<2){
      if(msg) msg.textContent='至少寫一句你現在卡在哪裡。';
      return;
    }
    submit.disabled=true;
    try{
      if(msg) msg.textContent='正在分析你卡在這一步的原因…';
      await A.requestArtifactStageUnblock({
        artifactId:currentArtifact.id,
        userNote:note
      });
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','已開始拆解目前這一步；完成後只會留下最小下一步。');
    }catch(err){
      submit.disabled=false;
      if(msg) msg.textContent=err.message||'卡點拆解任務建立失敗';
    }
  });

  $('#completeArtifactForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!currentArtifact) return;
    const resultText=$('#artifactResultText')?.value?.trim()||'';
    const evidenceItems=($('#artifactEvidenceItems')?.value||'')
      .split(/\r?\n/)
      .map(x=>x.trim())
      .filter(Boolean);
    const demonstratedSkillKeys=[...root.querySelectorAll('[data-complete-skill]:checked')]
      .map(el=>el.value)
      .filter(Boolean);
    const msg=$('#completeArtifactMsg');
    const submit=e.currentTarget.querySelector('button[type="submit"]');

    if(resultText.length<3){
      if(msg) msg.textContent='請先寫下這件作品實際做出了什麼。';
      return;
    }
    submit.disabled=true;
    try{
      if(msg) msg.textContent='正在保存作品結果、證據，並建立下一件候選作品規劃…';
      await A.completePersonalArtifact({
        artifactId:currentArtifact.id,
        resultText,
        evidenceItems,
        demonstratedSkillKeys
      });
      D=await A.getSnapshot();
      renderHome();
      await renderProjectsIA('current','作品已完成並保存證據。下一件作品只會先以候選方式產生，等你確認後才開始。');
    }catch(err){
      submit.disabled=false;
      if(msg) msg.textContent=err.message||'作品完成提交失敗';
    }
  });

  $('#startArtifact')?.addEventListener('click',async()=>{
    const btn=$('#startArtifact'),msg=$('#artifactDecisionMsg');
    btn.disabled=true;
    try{
      await A.decidePersonalArtifact({artifactId:candidateArtifact.id,decision:'start'});
      await renderProjectsIA('current','作品已開始。之後新增的學習、概念與證據會自動掛回這件作品。');
    }catch(e){btn.disabled=false;if(msg)msg.textContent=e.message||'開始作品失敗';}
  });

  $('#rejectArtifact')?.addEventListener('click',async()=>{
    const btn=$('#rejectArtifact'),msg=$('#artifactDecisionMsg');
    btn.disabled=true;
    try{
      await A.decidePersonalArtifact({artifactId:candidateArtifact.id,decision:'reject'});
      await renderProjectsIA('current','這件候選作品已拒絕。主線本身不受影響，之後可以重新產生下一個候選作品。');
    }catch(e){btn.disabled=false;if(msg)msg.textContent=e.message||'拒絕作品失敗';}
  });
}

async function renderLearn(notice=''){
  const root=$('#view-learn');
  if(!root) return;

  if(A.liveStatus!=='live'){
    root.innerHTML='<div class="section-head"><div><h2>學習陪伴</h2><p>登入後，真實文字才能進入正式學習流程。</p></div></div><div class="surface"><b>目前沒有讀取正式學習資料</b><p>這裡不會用示範內容或 localStorage 冒充你的正式學習紀錄。</p><button class="primary-btn" data-auth>登入</button></div>';
    return;
  }

  root.innerHTML='<div class="empty">正在載入正式學習資料…</div>';
  let learning,artifacts;
  try{
    [learning,artifacts]=await Promise.all([
      A.getLearning(),
      A.getPersonalArtifacts({force:true})
    ]);
  }catch(e){root.innerHTML=`<div class="empty">學習資料載入失敗：${esc(e.message||e)}</div>`;return;}

  const currentArtifact=artifacts?.current||null;
  const artifactLinks=Array.isArray(currentArtifact?.links)?currentArtifact.links:[];
  const linkedSessionIds=new Set(
    artifactLinks.filter(x=>x.link_kind==='learning_session').map(x=>String(x.target_ref))
  );
  const sessions=learning?.sessions||[];
  const units=sessions.flatMap(s=>(s.units||[]).map(u=>({...u,session:s})));
  const currentStep=currentArtifact?.next_evidence_item||null;
  const latestUnblock=currentArtifact?.latest_unblock||null;
  const unblockLearning=latestUnblock?.status==='ready'?latestUnblock?.final_guidance?.learning_needed:null;
  const stageLearningNeeded=Boolean(unblockLearning?.needed);

  root.innerHTML=`
    <div class="section-head">
      <div><h2>學習陪伴</h2><p>貼入真實內容後，系統會保留原文，再讓你用自己的話回答。需要 AI 幫忙時會交給 GPT；還沒完成就會明確顯示等待，不會假裝已產生結果。</p></div>
      <span class="pill success">正式資料</span>
    </div>

    ${currentArtifact?`
    <article class="surface">
      <span class="kicker">目前作品的這一步</span>
      <h3>${esc(currentStep?.criterion_text||currentArtifact.title)}</h3>
      <p>${stageLearningNeeded?'這一步已確認有知識缺口，只補最低必要內容。':'目前沒有證據顯示你必須先學；可以直接繼續做這一步。'}</p>
      ${stageLearningNeeded?`<div class="evidence-box"><b>這次最低只要學到</b><span>${esc(unblockLearning.minimum||unblockLearning.target||'能支援目前這一步')}</span></div>`:''}
    </article>`:`
    <div class="empty">目前沒有進行中的作品。學習可以保存，但不會自動變成你的主線。</div>`}

    <details class="surface" style="margin-top:18px" ${stageLearningNeeded?'open':''}>
      <summary><b>${stageLearningNeeded?'開始補目前這一步需要的內容':'我想主動學一段內容'}</b></summary>
      <p class="muted">${stageLearningNeeded?'只處理目前卡住的最低必要範圍。':'這是你主動選擇的學習，不代表系統認為你現在必須學。'}</p>
      <form class="project-form" id="learningInputForm">
        <label><b>學習內容</b><textarea id="learningText" placeholder="貼入你真的想理解的一段文字"></textarea></label>
        <div class="hero-grid">
          <label><b>標題（可選）</b><input id="learningTitle" placeholder="例如：目前這一步需要理解的概念"></label>
          <label><b>最低要學到什麼（可選）</b><input id="learningGoal" value="${esc(stageLearningNeeded?(unblockLearning.minimum||unblockLearning.target||''):'')}" placeholder="例如：能解釋並實際用一次"></label>
        </div>
        <div class="row-between">
          <div id="learningInputMsg" class="muted">${esc(notice||'AI 解釋不算你的能力；只有回答、操作或作品結果才會形成證據。')}</div>
          <button class="primary-btn" type="submit">建立學習單元</button>
        </div>
      </form>
    </details>

    <div class="section-head">
      <div><h2>我的正式學習</h2><p>只顯示你真的輸入、回答或完成的學習紀錄；測試資料與系統建置資料不會混進來。</p></div>
      <span>${sessions.length} 個來源 · ${units.length} 個單元</span>
    </div>

    <div class="lesson-layout">
      <div class="lesson-list" id="liveLessonList">
        ${units.length?units.map((u,i)=>{
          const supportsCurrent=linkedSessionIds.has(String(u.session?.id||''));
          return `<button class="lesson-item ${i===0?'active':''}" data-live-unit="${esc(u.id)}"><span>${esc(u.session?.title||'學習來源')}</span><b>${esc(u.presentation?.title||u.session?.title||'學習單元')}</b><small>${supportsCurrent?`支援作品：${esc(currentArtifact?.title||'目前作品')} · `:''}${esc(u.latest_submission?.status?statusText(u.latest_submission.status):'未作答')}</small></button>`;
        }).join(''):'<div class="empty">目前還沒有正式學習單元。把一段真實文字貼進上方即可開始。</div>'}
      </div>
      <article class="lesson-detail" id="liveLessonDetail"></article>
    </div>`;

  $('#learningInputForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const text=$('#learningText').value.trim();
    const title=$('#learningTitle').value.trim();
    const goal=$('#learningGoal').value.trim();
    const msg=$('#learningInputMsg');
    if(text.length<6){msg.textContent='請至少貼入一小段真實內容。';return;}
    try{
      msg.textContent='正在建立正式學習單元…';
      await A.createLearningText({rawContent:text,title,goal,sourceLanguage:'zh-Hant'});
      D=await A.getSnapshot();
      renderHome();
      await renderLearn(currentArtifact?'已建立正式學習單元，並自動掛到目前作品；AI 解釋仍不算你的能力證據。':'已建立正式學習單元；目前沒有進行中作品，所以暫不自動建立作品關聯。');
    }catch(err){msg.textContent=err.message||'建立失敗';}
  });

  let active=units[0]||null;
  const draw=()=>{
    const detail=$('#liveLessonDetail');
    if(!detail) return;
    if(!active){
      detail.innerHTML='<div class="empty">目前沒有學習單元。學習單元就是一次要理解、練習或驗證的一小段內容。</div>';
      return;
    }
    const sub=active.latest_submission||null;
    const pending=sub?.status==='pending';
    const promoted=sub?.status==='promoted'&&sub?.promoted_learning_evidence_id;
    const ai=active.session?.ai_job||null;
    const aiLabels={pending:'等待執行',claimed:'已領取',processing:'處理中',completed:'已完成',failed:'失敗',cancelled:'已取消'};
    const aiLabel=ai?aiLabels[ai.status]||ai.status:'尚未建立';
    const aiText=ai?.status==='completed'?(ai?.result?.text||''):null;
    const aiError=ai?.status==='failed'?(ai?.error?.message||'執行失敗，可重新排入任務。'):null;
    const canQueue=!ai||ai.status==='failed';
    const supportsCurrent=linkedSessionIds.has(String(active.session?.id||''));
    detail.innerHTML=`
      <span class="kicker">正式來源</span>
      <h2>${esc(active.presentation?.title||active.session?.title||'學習單元')}</h2>
      <p class="teach">${esc(active.zh_explanation||'尚未產生 AI 解釋。')}</p>
      <details open><summary>原始內容</summary><p>${esc(active.original_text||'')}</p></details>
      <div class="provenance">來源：${esc(active.session?.source_ref||'未記錄')} · 資料：你的正式學習紀錄${supportsCurrent&&currentArtifact?` · 支援作品：${esc(currentArtifact.title)}`:''}</div>
      <div class="evidence-box">
        <b>AI 解釋任務 · ${esc(aiLabel)}</b>
        <span>${aiText?esc(aiText):aiError?esc(aiError):ai?'你的 Mac 上 AI 執行器處理完成後，GPT 的整理結果會顯示在這裡。':'尚未建立 AI 解釋任務；你仍可先自己閱讀與作答。'}${ai&&['pending','claimed','processing'].includes(ai.status)?'<span class="mq-inline-worker" data-worker-inline>正在確認處理程式狀態…</span><a href="#/collect/questions">到「我的提問」看進度 →</a>':''}</span>
        ${canQueue?'<button class="ghost-btn small" id="enqueueLearningAi">'+(ai?.status==='failed'?'重新排隊':'建立 AI 解釋任務')+'</button>':''}
        <small>AI 解釋只是輔助，不會自動算成你已學會。</small>
      </div>
      <div class="answer">
        <b>你的驗證題</b>
        <p>${esc(active.interaction_prompt||'請用自己的話說明你理解到的重點。')}</p>
        <textarea id="answerInput">${esc(sub?.response_text||'')}</textarea>
        <button class="primary-btn" id="submitAnswer" ${pending?'disabled':''}>${pending?'等待審核':'送出可審核回答'}</button>
        <div id="answerMsg" class="muted">${promoted?'這筆回答已通過審核並形成學習證據。':sub?.status==='rejected'?'上一筆回答未通過審核，可修改後再提交。':sub?.status==='reviewed'?'上一筆只完成審核，沒有升成個人學習證據。':'回答送出後只會先進待審核，不會直接算已學會。'}</div>
      </div>`;
    const wInline=$('[data-worker-inline]',detail);if(wInline&&window.GROWTH_BRAIN_MYJOBS)window.GROWTH_BRAIN_MYJOBS.workerBannerText(A).then(t=>{wInline.textContent=t||'處理程式狀態無法讀取。';});
    $('#enqueueLearningAi')?.addEventListener('click',async()=>{
      const btn=$('#enqueueLearningAi');
      try{
        if(btn){btn.disabled=true;btn.textContent='排入中…';}
        await A.enqueueLearningAi(active.session.id);
        await renderLearn(ai?.status==='failed'?'已重新交給 AI 整理。':'已交給 AI 整理。');
      }catch(e){
        if(btn){btn.disabled=false;btn.textContent=ai?.status==='failed'?'重新排隊':'建立 AI 解釋任務';}
        const m=$('#answerMsg');if(m)m.textContent=e.message||'AI 任務建立失敗';
      }
    });
    $('#submitAnswer')?.addEventListener('click',async()=>{
      const m=$('#answerMsg');
      try{
        m.textContent='正在送出…';
        await A.submitAttempt({unitId:active.id,response:$('#answerInput').value,evidenceType:active.expected_evidence_type});
        D=await A.getSnapshot();
        renderHome();
        await renderLearn('回答已送出等待審核；目前不會直接升級學習狀態。');
      }catch(e){m.textContent=e.message||'送出失敗';}
    });
  };

  root.querySelectorAll('[data-live-unit]').forEach(el=>el.addEventListener('click',()=>{
    root.querySelectorAll('[data-live-unit]').forEach(x=>x.classList.remove('active'));
    el.classList.add('active');
    active=units.find(x=>x.id===el.dataset.liveUnit)||null;
    draw();
  }));
  draw();
}

async function renderSynapse(){
  const root=$('#view-synapse');
  if(A.liveStatus!=='live'){
    root.innerHTML='<div class="section-head"><div><h2>知識連結</h2><p>登入後才會從你的正式資料來源、學習紀錄與證據建立關係。</p></div></div><div class="empty">目前沒有讀取正式個人資料，不會用示範圖冒充你的知識狀態。</div>';
    return;
  }

  root.innerHTML='<div class="empty">正在讀取你的來源、概念、作品與學習證據…</div>';
  let synapse=D?.synapse||null,artifacts=null;
  try{
    if(!synapse?.nodes){synapse=await A.getPersonalSynapse();D.synapse=synapse;}
    artifacts=await A.getPersonalArtifacts({force:true});
  }catch(e){root.innerHTML=`<div class="empty">知識連結載入失敗：${esc(e.message||e)}</div>`;return;}

  const currentArtifact=artifacts?.current||null;
  const artifactLinks=Array.isArray(currentArtifact?.links)?currentArtifact.links:[];
  const artifactConceptIds=new Set(
    artifactLinks.filter(x=>x.link_kind==='synapse_concept').map(x=>String(x.target_ref))
  );
  const artifactEvidenceCount=artifactLinks.filter(x=>['learning_evidence','artifact_evidence'].includes(x.link_kind)).length;

  const rawNodes=Array.isArray(synapse?.nodes)?synapse.nodes:[];
  const edges=Array.isArray(synapse?.edges)?synapse.edges:[];
  const sources=rawNodes.filter(n=>n.type==='source');
  const concepts=rawNodes.filter(n=>n.type!=='source');
  const summary=synapse?.summary||{};

  if(!rawNodes.length){
    root.innerHTML='<div class="section-head"><div><h2>知識連結</h2><p>當你有正式來源、學習或作品證據後，這裡才會形成關係。</p></div></div><div class="empty">目前還沒有足夠的正式資料形成知識連結。</div>';
    return;
  }

  const sourceTypeLabel={article:'文章',video:'影片',chat:'對話',text:'文字',learning:'學習來源'};
  const relationLabel={
    source_contains_concept:'來源包含此概念',
    supports_artifact:'概念支援目前作品',
    supports_completion:'證據支援作品完成'
  };
  const levelLabel={
    unknown:'尚未驗證',
    exposure:'看過／接觸過',
    can_paraphrase:'能用自己的話說明',
    understood:'已理解',
    apply_with_help:'可在協助下應用',
    apply_independently:'可獨立應用'
  };
  const sourceRef=n=>{
    const ref=String(n.source_ref||'');
    if(/^https?:\/\//i.test(ref)) return `<a href="${esc(ref)}" target="_blank" rel="noopener">查看原始來源</a>`;
    if(ref.startsWith('inbox:')) return '來自資料入口中的正式紀錄';
    return esc(ref||'來源已記錄');
  };

  const sourceCards=sources.map(s=>`<article class="surface">
    <div class="row-between"><b>${esc(sourceTypeLabel[s.source_type]||'正式來源')}</b><span class="pill success">資料庫來源</span></div>
    <p>${sourceRef(s)}</p>
    <small class="muted">收進時間：${esc(s.observed_at?new Date(s.observed_at).toLocaleString('zh-TW'):'未記錄')}</small>
  </article>`).join('');

  const conceptCards=concepts.map(n=>{
    const evidence=Number(n.learning_evidence_count)||0;
    const state=levelLabel[n.learning_level_name]||'尚未驗證';
    const supportsCurrent=currentArtifact&&artifactConceptIds.has(String(n.id));
    return `<article class="surface">
      <div class="row-between"><div><b>${esc(human(n.label||n.id))}</b></div><span class="pill ${supportsCurrent||evidence?'success':''}">${supportsCurrent?'支援目前作品':esc(state)}</span></div>
      <p>目前連到 ${esc(n.source_count??0)} 個真實來源；正式學習證據 ${esc(evidence)} 筆。</p>
      <small class="muted">${supportsCurrent&&currentArtifact?`目前關聯作品：${esc(currentArtifact.title)} · `:''}${n.independent_application_verified?'已有獨立應用證據':'目前還不能宣稱已能獨立應用'}</small>
      <details style="margin-top:8px"><summary>查看技術識別碼</summary><small class="muted">${esc(n.id)}</small></details>
    </article>`;
  }).join('');

  const spread=(items,x)=>items.map((n,i)=>({...n,x,y:items.length===1?50:15+(70*i/Math.max(items.length-1,1))}));
  const artifactNode=currentArtifact?{id:'artifact:'+currentArtifact.id,type:'artifact',label:currentArtifact.title,x:88,y:50}:null;
  const graphNodes=[...spread(sources,12),...spread(concepts,55),...(artifactNode?[artifactNode]:[])];
  const graphEdges=[
    ...edges,
    ...(artifactNode?[...artifactConceptIds].map(id=>({source:id,target:artifactNode.id,relation:'supports_artifact'})):[])
  ];

  root.innerHTML=`
    <div class="section-head"><div><h2>知識連結</h2><p>Synapse（知識關係層）：把你的真實來源、概念與證據連起來，方便之後支援作品與學習。</p></div><span class="pill success">只讀正式個人資料</span></div>

    <div class="metrics">
      <div><strong>${esc(summary.source_count??sources.length)}</strong><span>真實來源</span></div>
      <div><strong>${esc(summary.concept_count??concepts.length)}</strong><span>概念</span></div>
      <div><strong>${esc(summary.learning_evidence_count??0)}</strong><span>正式學習證據</span></div>
    </div>

    ${currentArtifact?`
    <article class="surface">
      <span class="kicker">目前作品已接入知識關係</span>
      <h3>${esc(currentArtifact.title)}</h3>
      <p>新建立的學習與概念會自動掛回目前作品。概念關係不等於已學會；正式能力仍要看回答、操作與作品結果。</p>
      <div class="metrics compact">
        <div><strong>${artifactConceptIds.size}</strong><span>支援作品的概念</span></div>
        <div><strong>${artifactEvidenceCount}</strong><span>作品相關學習證據</span></div>
        <div><strong>${(currentArtifact.skills||[]).length}</strong><span>待驗證技能</span></div>
      </div>
    </article>`:`
    <div class="empty">目前還沒有進行中的作品，所以知識連結先保留「來源 → 概念 → 證據」。當作品開始後，新學習會自動接成「來源 → 概念 → 作品」。</div>`}

    <div class="section-head"><div><h2>這些資料從哪裡來</h2><p>不是 AI 猜的節點；每一筆都要能追到資料庫中的正式來源。</p></div></div>
    <div class="stack">${sourceCards||'<div class="empty">目前沒有來源。</div>'}</div>

    <div class="section-head"><div><h2>目前形成的概念</h2><p>「有連結」只代表你接觸過這個概念；有作品或回答證據後才會提高能力狀態。</p></div></div>
    <div class="stack">${conceptCards||'<div class="empty">目前沒有概念。</div>'}</div>

    <details class="surface" style="margin-top:18px">
      <summary><b>查看關係圖（Synapse／知識關係圖）</b></summary>
      <p>這張圖只說明資料怎麼連在一起，不代表你已經學會。</p>
      <div class="flow"><span>來源</span><i>包含</i><span>概念</span><i>支援</i><span>目前作品</span></div>
      <p class="muted">「來源包含概念」＝這個來源提到或承載該概念；「概念支援作品」＝目前作品可能需要這個概念。兩者都不是能力證明。</p>
      <div class="graph" id="graph"></div>
      <div class="provenance">${esc(summary.edge_count??edges.length)} 條有來源可追溯的關係；關係本身不等於已學會。</div>
    </details>`;

  const g=$('#graph');
  if(!g) return;
  graphEdges.forEach(e=>{
    const a=graphNodes.find(n=>n.id===e.source),b=graphNodes.find(n=>n.id===e.target);
    if(!a||!b)return;
    const line=document.createElement('div');
    line.className='edge';
    const dx=b.x-a.x,dy=b.y-a.y;
    line.style.left=a.x+'%';
    line.style.top=a.y+'%';
    line.style.width=Math.hypot(dx,dy)+'%';
    line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
    line.title=relationLabel[e.relation]||e.label||'知識關係';
    g.appendChild(line);
  });
  graphNodes.forEach(n=>{
    const b=document.createElement('button');
    b.className='node '+(n.type==='source'?'center':n.type==='artifact'?'artifact':'');
    b.style.left=n.x+'%';
    b.style.top=n.y+'%';
    b.textContent=n.type==='source'?(sourceTypeLabel[n.source_type]||'來源'):n.type==='artifact'?`作品：${n.label}`:human(n.label||n.id);
    b.title=n.type==='source'?'正式個人來源':n.type==='artifact'?'目前正在做的作品':'概念關係；不代表已熟練';
    g.appendChild(b);
  });
}


const IA_TODO_KEYS=new Set([
  'information-architecture-v1',
  'capability-cells-playbooks-v1',
  'research-history-separation-v1',
  'external-reuse-scout-v1',
  'assistant-channel-adapters-v1'
]);

function iaTabs(items,active){
  return '<div class="subtabs" role="tablist">'+items.map(([key,label])=>'<button class="subtab '+(key===active?'active':'')+'" data-ia-tab="'+esc(key)+'">'+esc(label)+'</button>').join('')+'</div>';
}

async function renderCapabilities(active='cells'){
  const root=$('#view-capabilities');
  if(!root)return;
  const tabs=[['cells','能力圖譜'],['playbooks','作戰手冊'],['skills','我的技能'],['relations','知識關係']];
  root.innerHTML=iaTabs(tabs,active)+'<div id="capabilityPane" class="tab-pane"><div class="empty">正在讀取能力庫…</div></div>';
  const pane=$('#capabilityPane');
  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderCapabilities(b.dataset.iaTab));

  if(active==='relations'){
    pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">RELATIONS · 關係</span><div><h2>知識怎麼幫目前作品</h2><p>先回答有沒有用、用在哪裡；完整來源與關係圖再進詳細頁。</p></div></div>'+
      '<div class="v4-empty-action"><b>正式知識關係仍使用原資料</b><p>關係存在不等於已學會，也不會自動提升能力。</p><button class="ghost-btn" data-jump="synapse">打開知識關係 →</button></div>';
    return;
  }

  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">CAPABILITIES · 能力庫</span><div><h2>能力不是地圖裝飾，是證據狀態</h2><p>登入後才顯示你的真實能力節點；方法庫與個人掌握會分開。</p></div></div>'+
      '<section class="capability-orbit is-locked">'+
        '<div class="capability-orbit-center"><strong>能力</strong><span>作品證據決定狀態</span></div>'+
        '<div class="capability-zone verified"><span>作品驗證</span><small>有真實作品證據</small></div>'+
        '<div class="capability-zone independent"><span>可獨立</span><small>能自己完成</small></div>'+
        '<div class="capability-zone developing"><span>發展中</span><small>理解或可在協助下做</small></div>'+
        '<div class="capability-zone exploring"><span>探索中</span><small>尚未驗證</small></div>'+
        '<div class="capability-lock"><b>登入後載入你的能力證據</b><button class="primary-btn" data-auth>登入查看能力</button></div>'+
      '</section>';
    return;
  }

  try{
    const library=await A.getCapabilities({force:true});
    const cells=Array.isArray(library?.cells)?library.cells:[];
    const playbooks=Array.isArray(library?.playbooks)?library.playbooks:[];
    const personalSkills=Array.isArray(library?.personal_skills)?library.personal_skills:[];

    const nameOf=x=>x?.name_zh||x?.title||x?.name||human(x?.key||x?.skill_key||'能力');
    const stateLabel=s=>({
      unknown:'尚未驗證',exposure:'接觸過',acknowledged:'知道是什麼',understood:'已理解',
      can_explain:'能解釋',apply_with_help:'可在協助下應用',apply_independently:'可獨立應用',
      retained:'可保留使用',real_project:'真實作品驗證',commercialized:'已商業化'
    }[String(s||'').toLowerCase()]||statusText(s||'unknown'));
    const bucketOf=s=>{
      const st=String(s.evidence_state||s.status||'unknown').toLowerCase();
      if(['commercialized','real_project','retained'].includes(st))return 'verified';
      if(st==='apply_independently')return 'independent';
      if(['can_explain','apply_with_help','understood'].includes(st))return 'developing';
      return 'exploring';
    };
    const bucketLabel={verified:'作品驗證',independent:'可獨立',developing:'發展中',exploring:'探索中'};
    const resourceHtml=x=>{
      const labels=(Array.isArray(x?.resources)?x.resources.map(r=>r.name||r.key):Array.isArray(x?.resource_keys)?x.resource_keys:[]).filter(Boolean);
      return labels.length?'<div class="cap-detail"><b>可用資源</b><span>'+labels.map(esc).join('、')+'</span></div>':'';
    };
    const listHtml=(title,items,ordered=false)=>Array.isArray(items)&&items.length
      ?'<div class="cap-detail"><b>'+esc(title)+'</b><'+(ordered?'ol':'ul')+'>'+items.map(v=>'<li>'+esc(typeof v==='string'?v:(v.title||v.step||String(v)))+'</li>').join('')+'</'+(ordered?'ol':'ul')+'></div>':'';
    const detailHtml=x=>
      (x.when_to_use?'<div class="cap-detail"><b>什麼時候用</b><span>'+esc(x.when_to_use)+'</span></div>':'')+
      listHtml('快速使用',x.quick_use,true)+listHtml('常見失敗',x.failure_points)+listHtml('成功證據',x.required_evidence)+resourceHtml(x)+
      (x.practice?'<div class="cap-detail"><b>實作</b><span>'+esc(x.practice)+'</span></div>':'');

    if(active==='cells'){
      root.querySelector('.subtabs')?.classList.add('cm-hide-tabs');
      await window.GROWTH_BRAIN_CAPMAP.render(pane,A,{afterPaint:(slot,lib)=>{
        if(!slot)return;
        const list=Array.isArray(lib?.cells)?lib.cells:cells;
        slot.innerHTML='<details class="cm-card cm-meth"><summary><b>方法庫</b><span class="cm-muted">'+list.length+' 個參考方法（做事的套路，不是你的能力）</span></summary><div class="cm-meth-grid">'+
          (list.map(x=>'<button type="button" class="cm-meth-b" data-capability-key="'+esc(x.key||'')+'">'+esc(nameOf(x))+'</button>').join('')||'<p class="cm-muted">目前沒有能力方法資料。</p>')+
          '</div><div class="cm-meth-detail" id="capabilityDetail"><p class="cm-muted">點一個方法，展開怎麼用。方法存在不等於掌握。</p></div></details>';
        const detail=$('#capabilityDetail',slot);
        $$('[data-capability-key]',slot).forEach(btn=>btn.onclick=()=>{
          const x=list.find(v=>String(v.key||'')===btn.dataset.capabilityKey);
          if(!x)return;
          detail.innerHTML='<h3>'+esc(nameOf(x))+'</h3><p>'+esc(x.principle||x.summary||'這是一個可重用方法。')+'</p>'+detailHtml(x)+'<div class="cap-detail"><b>個人能力規則</b><span>方法存在不等於掌握；只有真實證據才會改變能力程度。</span></div>';
        });
      }});
    }else if(active==='playbooks'){
      const card=x=>'<details class="v4-list-row"><summary><span><small>'+esc(x.when_to_use||'需要時使用')+'</small><b>'+esc(nameOf(x))+'</b></span><span>展開</span></summary><p>'+esc(x.principle||x.summary||'把多個能力方法組合成可執行流程。')+'</p>'+detailHtml(x)+'</details>';
      pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">PLAYBOOKS · 作戰手冊</span><div><h2>需要時照著做</h2><p>不是課程清單；只有目前作品需要時才打開。</p></div></div>'+
        (playbooks.length?'<div class="v4-list">'+playbooks.map(card).join('')+'</div>':'<div class="empty">目前沒有作戰手冊資料。</div>');
    }else{
      pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">EVIDENCE · 我的技能</span><div><h2>只看真的有證據的能力</h2><p>AI 猜測、方法存在、看過內容都不算能力升級。</p></div></div>'+
        (personalSkills.length?'<div class="v4-list">'+personalSkills.map(s=>'<article class="v4-list-row"><div><small>'+esc(s.artifact_title||'尚無關聯作品')+'</small><b>'+esc(nameOf(s))+'</b><p>'+esc(s.why||s.summary||'')+'</p></div><span class="v4-state">'+esc(stateLabel(s.evidence_state||s.status))+'</span></article>').join('')+'</div>':'<div class="empty">目前還沒有可展示的個人技能證據。</div>');
    }
  }catch(e){
    pane.innerHTML='<div class="empty">能力庫載入失敗：'+esc(e.message||e)+'</div>';
  }
}

async function renderResearch(active='today'){
  const root=$('#view-research');
  if(!root)return;
  if(active!=='growthbrain')return window.GROWTH_BRAIN_LAB.renderResearch(root,active);
  const tabs=[['today','今日探索'],['ai','AI 技術'],['distribution','流量分發'],['opportunity','商業機會'],['growthbrain','Growth Brain']];
  root.innerHTML=iaTabs(tabs,active)+'<div id="researchPane" class="tab-pane"></div>';
  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderResearch(b.dataset.iaTab));
  const pane=$('#researchPane');

  pane.innerHTML='<div class="empty">正在讀取 Growth Brain 正式待做事項…</div>';
  if(A.liveStatus!=='live'){pane.innerHTML='<div class="empty">登入後才能讀取正式系統待辦。</div>';return;}
  try{
    SYSTEM=SYSTEM||await A.getSystemCockpit();
    const pkgs=(SYSTEM?.work_queue?.packages||[]).filter(p=>(IA_TODO_KEYS.has(p.package_key)||p.package_key==='event-funnel-self-exploration-v1')&&!['completed','cancelled'].includes(p.status));
    pane.innerHTML='<div class="section-head"><div><h2>Growth Brain 正式待做</h2><p>這些是已確認要做但尚未完成的系統工作；不和你的個人作品進度混在一起。</p></div><span>'+pkgs.length+' 項</span></div>'+
      (pkgs.length?'<div class="stack">'+pkgs.sort((a,b)=>(b.priority||0)-(a.priority||0)).map(p=>{
        const steps=Array.isArray(p.steps)?p.steps:[];
        const st=String(p.status||'ready');
        return '<article class="surface"><div class="row-between"><div><b>'+esc(p.title||p.package_key)+'</b><p>'+esc(p.objective||'')+'</p></div>'+pill(st)+'</div>'+
          (steps.length?'<div class="flow">'+steps.map(s=>'<span>'+(['completed'].includes(s.status)?'✓ ':['current','in_progress'].includes(s.status)?'→ ':'')+esc(s.title||'')+'</span>').join('<i>›</i>')+'</div>':'')+
          '<button class="ghost-btn small" data-funnel-kind="system_work_package" data-funnel-id="'+esc(p.package_key)+'" data-funnel-goal="'+esc(p.objective||p.title)+'">拆解這件事</button></article>';
      }).join('')+'</div>':'<div class="empty">目前沒有這一組正式待做事項。</div>');
  }catch(e){pane.innerHTML='<div class="empty">正式待辦載入失敗：'+esc(e.message||e)+'</div>'}
}

async function renderHistory(active='system'){
  const root=$('#view-history');
  if(!root)return;
  const tabs=[['system','版本歷程'],['personal','我的歷程'],['skills','能力變化'],['research','研究歷程']];
  root.innerHTML=iaTabs(tabs,active)+'<div id="historyPane" class="tab-pane"><div class="empty">正在讀取正式歷程…</div></div>';
  const pane=$('#historyPane');

  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">HISTORY · 歷程</span><div><h2>只看真的發生過什麼</h2><p>登入後才顯示正式個人與系統歷程，不用示範資料補空白。</p></div></div><div class="v4-empty-action"><button class="primary-btn" data-auth>登入查看歷程</button></div>';
  }else{
    try{
      const H=await A.getHistory({force:true});
      const groups={
        personal:Array.isArray(H?.personal)?H.personal:[],
        skills:Array.isArray(H?.skills)?H.skills:[],
        research:Array.isArray(H?.research)?H.research:[],
        system:Array.isArray(H?.system)?H.system:[]
      };
      const eventHtml=e=>'<article class="history-event-v4">'+
        '<div class="history-event-dot"></div>'+
        '<div><time>'+esc(e.occurred_at?new Date(e.occurred_at).toLocaleString('zh-TW'):'時間未記錄')+'</time>'+
        '<h3>'+esc(e.title||'歷程事件')+'</h3>'+
        (e.summary?'<p>'+esc(e.summary)+'</p>':'')+
        '<small>'+esc(e.source_type||'正式資料')+(e.status?' · '+esc(statusText(e.status)):'')+(e.evidence_level?' · 證據：'+esc(statusText(e.evidence_level)):'')+'</small></div>'+
      '</article>';

      if(active==='system'){
        const list=groups.system;
        const stages=[
          {version:'V3',title:'互動式 Growth Brain',state:'now',summary:'把今天、作品、能力、研究、團隊與歷程收斂成同一條成長旅程。'},
          {version:'V2',title:'Worker 與事件漏斗',state:'past',summary:'任務能送到固定 GPT 對話、回寫結果與證據，研究候選不污染正式真相。'},
          {version:'V1.5',title:'作品、能力、員工',state:'past',summary:'從只有資料，走到作品序列、能力證據與 AI 角色分工。'},
          {version:'V1',title:'資料庫與基本網站',state:'past',summary:'建立 Supabase 與基本網站，讓正式資料不只存在聊天裡。'}
        ];
        const stageHtml=stages.map(s=>'<article class="history-version-node '+esc(s.state)+'">'+
          '<div class="history-version-mark"><span>'+esc(s.version)+'</span></div>'+
          '<div><small>'+(s.state==='now'?'目前階段':'較早階段')+'</small><h3>'+esc(s.title)+'</h3><p>'+esc(s.summary)+'</p></div>'+
        '</article>').join('');
        pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">HISTORY · 版本歷程</span><div><h2>第二大腦怎麼一路長到現在</h2><p>版本敘事與正式更新紀錄分開；這裡不做 Git log，也不拿現在狀態冒充歷史。</p></div><img class="v4-page-art" data-image-placement="history.hero" src="assets/ui/home-project-cover.webp" alt="" aria-hidden="true"></div>'+
          '<section class="history-timeline-v4">'+stageHtml+'</section>'+
          '<details class="history-formal-log"><summary><span>正式更新紀錄</span><b>'+list.length+' 筆</b></summary>'+
            (list.length?'<div class="history-event-list">'+list.slice(0,30).map(eventHtml).join('')+'</div>':'<div class="empty">目前沒有可讀取的正式系統更新紀錄。</div>')+
          '</details>';
      }else{
        const meta={
          personal:['MY HISTORY · 我的歷程','我真的做過什麼','只收真實選擇、完成與有證據的個人事件。'],
          skills:['SKILL EVIDENCE · 能力變化','哪些證據真的改變能力狀態','不把 AI 建議、看過內容或方法存在算成成長。'],
          research:['RESEARCH · 研究歷程','候選怎麼被保留、試驗或放棄','研究生命週期獨立，不直接升級作品或能力。']
        };
        const list=groups[active]||[];
        const [eyebrow,title,desc]=meta[active]||meta.personal;
        pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">'+eyebrow+'</span><div><h2>'+title+'</h2><p>'+desc+'</p></div></div>'+
          (list.length?'<section class="history-timeline-v4 event-mode">'+list.slice(0,40).map(eventHtml).join('')+'</section>':'<div class="empty">目前還沒有符合條件的正式紀錄。</div>');
      }
    }catch(e){
      pane.innerHTML='<div class="empty">歷程資料載入失敗：'+esc(e.message||e)+'</div>';
    }
  }
  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderHistory(b.dataset.iaTab));
}

const PENDING_NEEDS={user:'需要你本人操作',approval:'等你核准',decision:'等你決定',worker:'需要 Mac Worker',rerun:'待重新檢查'};
const PENDING_ORDER=['user','decision','approval','worker','rerun'];
function pendingItemsFromPackages(pkgs){
  const items=[];
  (Array.isArray(pkgs)?pkgs:[]).forEach(p=>(Array.isArray(p?.blockers)?p.blockers:[]).forEach(b=>{
    if(!b||b.status==='resolved'||b.status==='done')return;
    items.push({code:b.code||b.type||'',title:b.title||b.code||b.reason||'未命名待辦',reason:b.title?(b.reason||''):'',needs:PENDING_NEEDS[b.needs]?b.needs:'rerun',severity:b.severity||'',ref:b.ref||'',pkg:p.title||p.package_key||''});
  }));
  const rank=x=>{const i=PENDING_ORDER.indexOf(x.needs);return i<0?99:i;};
  return items.sort((a,b)=>rank(a)-rank(b)||String(a.severity).localeCompare(String(b.severity)));
}
function pendingBlockHtml(items){
  if(!items.length)return '<article class="surface pending-block"><span class="kicker">待處理</span><h3>目前沒有待處理項目</h3></article>';
  return '<article class="surface pending-block"><div class="row-between"><div><span class="kicker">待處理</span><h3 style="margin:6px 0 0">還沒完成的事（'+items.length+'）</h3></div></div>'+
    '<p class="muted">這些都還沒完成，先記下來，之後依序處理。</p><ul class="pending-list">'+
    items.map(x=>'<li class="pending-item"><span class="pill '+(x.needs==='rerun'||x.needs==='worker'?'warn':'danger')+'">'+esc(PENDING_NEEDS[x.needs])+'</span> <b>'+esc(x.title)+'</b>'+(x.reason?'<br><small>'+esc(x.reason)+'</small>':'')+(x.pkg?'<br><small class="muted">屬於：'+esc(x.pkg)+'</small>':'')+'</li>').join('')+
    '</ul></article>';
}

async function renderSystem(){
  const root=$('#view-ceo');
  if(A.liveStatus!=='live'){
    root.innerHTML='<div class="section-head"><div><h2>AI 團隊與系統狀態</h2><p>這一頁只顯示目前資料庫中的真實員工、工作包與阻塞；未登入時不再顯示舊 demo 狀態。</p></div></div><div class="surface"><b>請先登入讀取最新系統狀態</b><p>登入後才會看到目前真的可調用員工、候選員工、工作包、GPT 任務與阻塞項目。</p><button class="primary-btn" data-auth>登入</button></div>';
    return;
  }
  root.innerHTML='<div class="empty">正在讀取系統狀態與 AI 團隊…</div>';
  SYSTEM=null;
  try{SYSTEM=await A.getSystemCockpit();}catch(e){SYSTEM={error:e.code||e.message}}
  if(SYSTEM?.error){
    root.innerHTML=`<div class="empty">系統狀態讀取失敗：${esc(SYSTEM.error)}。這不會影響個人作品與學習資料。</div>`;
    return;
  }

  const ceo=SYSTEM?.ceo||{};
  const latest=SYSTEM?.ceo_latest||{};
  const cur=latest.current||ceo.current||{};
  const pkgs=SYSTEM?.work_queue?.packages||[];
  const team=SYSTEM?.skill_team||{};
  const roles=team.executable_roles||[];
  const planned=team.planned_roles||[];
  const recentUsage=team.recent_usage||[];
  const workerHealth=SYSTEM?.worker_health||{};
  const workers=Array.isArray(workerHealth.workers)?workerHealth.workers:[];
  const queue=workerHealth.queue||{};

  const roleNames={
    'ceo-orchestrator':'Growth Brain CEO（總控）',
    'goal-closure-operator':'Goal Closure Operator（達案執行官）',
    'logic-reality-analyst':'Logic & Reality Analyst（邏輯／真實性分析員）',
    'safe-sql-execution':'DB Safety Engineer（資料庫安全工程師）',
    'supabase-engineer':'Supabase Engineer（Supabase 後端工程師）',
    'postgres-safety-reviewer':'Postgres Safety Reviewer（資料庫安全審查員）',
    'work-browser-qa':'Browser QA（瀏覽器驗收員）',
    'github-operator':'GitHub Operator（GitHub 操作員）',
    'work-web-operator':'Web Implementer（網站實作員）',
    'plugin-resource-scout':'Resource Scout（工具／資源偵查員）',
    'product-flow-architect':'Product Flow Architect（產品流程架構師）',
    'impeccable':'Impeccable Reviewer（介面審查員）',
    'frontend-design-lead':'Frontend Design Lead（前端視覺設計主管）',
    'synapse-visualization-specialist':'Knowledge Map Visualizer（知識連結視覺化員工）',
    'interview-me':'Requirement Interviewer（需求訪談官）',
    'architect':'System Architect（系統架構師）',
    'evaluation':'Employee Evaluator（員工考核官）'
  };
  const roleDescriptions={
    'ceo-orchestrator':'讀取目前狀態、決定唯一主線、分派員工與最後驗收。',
    'goal-closure-operator':'把卡住的工作推到可驗證完成，不讓任務只停在規劃。',
    'logic-reality-analyst':'檢查推論是否有證據、是否把測試資料誤當真實進展。',
    'safe-sql-execution':'保護資料庫寫入，避免危險 SQL 或權限外洩。',
    'supabase-engineer':'負責 Supabase、資料契約、Edge Function、權限與 AI 任務佇列。',
    'postgres-safety-reviewer':'獨立檢查資料庫權限、RLS 與 SQL 風險。',
    'work-browser-qa':'用真實瀏覽器檢查登入、互動與手機／桌面顯示。',
    'github-operator':'讀寫 GitHub 正式來源、版本與部署相關檔案。',
    'work-web-operator':'實作前端頁面、互動與整合。',
    'plugin-resource-scout':'找目前缺少的外部工具或可接入資源。',
    'product-flow-architect':'把目標、作品、技能、學習、證據與下一步排成可理解流程。',
    'impeccable':'檢查資訊層級、術語、文案、認知負擔與介面清晰度。',
    'frontend-design-lead':'流程穩定後，建立正式視覺方向與設計系統。',
    'synapse-visualization-specialist':'把來源、概念、證據與作品做成可互動知識關係圖。',
    'interview-me':'只有需求真的缺關鍵資訊時才追問，不重問已知內容。',
    'architect':'處理大型資料流、模組邊界與長期架構。',
    'evaluation':'比較重複員工的實際成績，低分且無獨特能力者退役。'
  };
  const roleCard=(r,kind='active')=>{
    const key=r.skill_key||'';
    const name=roleNames[key]||r.role_name||human(key);
    const desc=r.trigger_summary||roleDescriptions[key]||'依任務需要調用。';
    const state=kind==='active'?'可直接調用':'候選／試用';
    const cls=kind==='active'?'success':'warn';
    return `<article class="surface"><div class="row-between"><div><b>${esc(name)}</b><div class="muted">技術代號：${esc(key)}</div></div><span class="pill ${cls}">${state}</span></div><p>${esc(desc)}</p></article>`;
  };

  const packageStatus=s=>{
    const x=String(s||'');
    if(x==='completed')return {label:'已完成',cls:'success'};
    if(x==='in_progress'||x==='current')return {label:'進行中',cls:'warn'};
    if(x.includes('pending'))return {label:'已實作，待驗收',cls:'warn'};
    if(x==='blocked')return {label:'受阻',cls:'danger'};
    return {label:statusText(x||'planned'),cls:''};
  };

  const packageBlockers=pkgs.flatMap(p=>{
    const list=Array.isArray(p.blockers)?p.blockers:[];
    return list.map(b=>({...b,package_title:p.title,package_key:p.package_key}));
  });
  const oldBlockers=ceo.parallel_blockers||[];
  const blockers=packageBlockers.length?packageBlockers:oldBlockers;

  const importantCandidates=['product-flow-architect','impeccable','frontend-design-lead','synapse-visualization-specialist'];
  const currentCandidates=planned.filter(r=>importantCandidates.includes(r.skill_key));
  const otherCandidates=planned.filter(r=>!importantCandidates.includes(r.skill_key));

  const packageHtml=pkgs.map(p=>{
    const st=packageStatus(p.status);
    const steps=Array.isArray(p.steps)?p.steps:[];
    const done=steps.filter(s=>s.status==='completed').length;
    const currentSteps=steps.filter(s=>['current','in_progress','implemented_pending_real_result'].includes(s.status));
    return `<article class="surface">
      <div class="row-between"><div><span class="kicker">工作包</span><h3 style="margin:6px 0 0">${esc(p.title||p.package_key)}</h3></div><span class="pill ${st.cls}">${esc(st.label)}</span></div>
      <p>${esc(p.objective||'')}</p>
      ${steps.length?`<div class="flow">${steps.map(s=>`<span title="${esc(s.title||'')}">${s.status==='completed'?'✓ ':['current','in_progress','implemented_pending_real_result'].includes(s.status)?'→ ':''}${esc(s.title||human(s.key))}</span>`).join('<i>›</i>')}</div><small class="muted">${done}/${steps.length} 個步驟已完成${currentSteps.length?` · 現在：${esc(currentSteps[0].title||'進行中')}`:''}</small>`:''}
    </article>`;
  }).join('');

  const usageHtml=recentUsage.slice(0,6).map(u=>`<div class="surface"><div class="row-between"><b>${esc(roleNames[u.skill_key]||u.skill_key)}</b><span class="pill success">實際使用 ${esc(u.usefulness??'-')}/5</span></div><p>${esc(u.notes||'')}</p><small class="muted">返工 ${esc(u.rework_count??0)} · 發現問題 ${esc(u.defects_found??0)} · 越界 ${esc(u.scope_violations??0)}</small></div>`).join('');

  root.innerHTML=pendingBlockHtml(pendingItemsFromPackages(pkgs))+`
    <div class="section-head"><div><h2>系統建置與 AI 團隊</h2><p>這裡只看第二大腦本身怎麼運作、誰在做什麼、哪裡卡住；不會混進你的個人成長成果。</p></div>${pill(cur.status||'current')}</div>

    <article class="surface">
      <span class="kicker">目前系統主線</span>
      <h2 style="margin:8px 0">${esc(cur.title||'正在整理最新系統狀態')}</h2>
      <p>${esc(cur.objective||latest.reason||'')}</p>
      ${latest.next_action?.action?`<div class="evidence-box"><b>下一個系統動作</b><span>${esc(latest.next_action.action)}</span></div>`:''}
    </article>

    ${window.GrowthImageFlow?.render(SYSTEM?.image_flow)||''}
    <div class="section-head"><div><h2>GPT 與資料庫怎麼連起來</h2><p>GPT 負責推理；Supabase 負責長期狀態與證據。未來換 API 或本地模型，網站流程不需要重寫。</p></div></div>
    <div class="surface">
      <div class="flow"><span>網站輸入</span><i>›</i><span>Supabase 保存</span><i>›</i><span>AI 任務</span><i>›</i><span>本機執行器</span><i>›</i><span>GPT 網頁版／API</span><i>›</i><span>結果＋證據回寫</span><i>›</i><span>網站顯示</span></div>
      <div class="metrics compact">
        <div><strong>${esc(workerHealth.online_count??0)}</strong><span>在線執行器</span></div>
        <div><strong>${esc(queue.pending??0)}</strong><span>等待 AI 任務</span></div>
        <div><strong>${esc((queue.claimed??0)+(queue.processing??0))}</strong><span>執行中</span></div>
      </div>
      <div class="evidence-box">
        <b>本機執行器：${workerHealth.status==='online'?'在線':workerHealth.status==='offline'?'離線':'尚未回報心跳'}</b>
        <span>${workerHealth.status==='online'?'系統最近 30 秒內收到 Worker 心跳，可以自動領取 AI 任務。':workers.length?'最近一次心跳已超過 30 秒；任務會留在資料庫等待，不會消失。':'新版 Worker 尚未送出第一個心跳；目前待處理任務會繼續留在 queue。'}</span>
      </div>
      ${workers.length?`<details><summary>查看執行器細節</summary>${workers.map(w=>`<p><b>${esc(w.worker_id)}</b> · ${esc(w.provider_key)} · ${w.online_now?'在線':'離線'}<br><small class="muted">最後回報：${esc(w.last_seen_at?new Date(w.last_seen_at).toLocaleString('zh-TW'):'未回報')}</small></p>`).join('')}</details>`:''}
    </div>

    <div class="section-head"><div><h2>目前工作包</h2><p>工作包就是一組要一起完成、而且可以驗收的系統工作。</p></div><span>${pkgs.length} 個</span></div>
    <div class="stack">${packageHtml||'<div class="empty">目前沒有工作包。</div>'}</div>

    <div class="section-head"><div><h2>目前阻塞</h2><p>只列真正影響下一步的卡點，不把舊問題和已解掉的問題混在一起。</p></div><span>${blockers.length} 個</span></div>
    <div class="stack">${blockers.map(b=>`<article class="surface"><div class="row-between"><b>${esc(b.package_title||b.title||'目前阻塞')}</b><span class="pill danger">待處理</span></div><p>${esc(b.reason||b.blocker?.reason||b.blocker||'')}</p>${b.next_action||b.blocker?.next_action?`<div class="evidence-box"><b>解除方式</b><span>${esc(b.next_action||b.blocker?.next_action)}</span></div>`:''}</article>`).join('')||'<div class="empty">目前沒有影響主線的阻塞。</div>'}</div>

    <div class="section-head"><div><h2>現在可直接調用的員工</h2><p>這些角色可以直接參與任務；CEO 只在能力匹配時調用，不會每次全部叫上。</p></div><span>${roles.length} 人</span></div>
    <div class="stack">${roles.map(r=>roleCard(r,'active')).join('')||'<div class="empty">目前沒有可執行角色。</div>'}</div>

    <div class="section-head"><div><h2>目前候選／試用員工</h2><p>已加入技能庫，但還要靠真實任務成績決定是否升為正式員工。</p></div></div>
    <div class="stack">${currentCandidates.map(r=>roleCard(r,'candidate')).join('')||'<div class="empty">目前沒有優先試用員工。</div>'}</div>
    ${otherCandidates.length?`<details class="surface"><summary><b>其他候選員工（${otherCandidates.length}）</b></summary><div class="stack" style="margin-top:12px">${otherCandidates.map(r=>roleCard(r,'candidate')).join('')}</div></details>`:''}

    <div class="section-head"><div><h2>最近真的有被調用的員工</h2><p>只有實際參與任務才記錄；這些紀錄也會用於之後的員工評分與淘汰。</p></div></div>
    <div class="stack">${usageHtml||'<div class="empty">目前還沒有員工使用紀錄。</div>'}</div>`;
}


const TEAM_ROLE_LABELS={
  'ceo-orchestrator':'Growth Brain CEO',
  'goal-closure-operator':'達案執行官',
  'logic-reality-analyst':'邏輯／真實性分析員',
  'product-flow-architect':'產品流程架構師',
  'impeccable':'介面審查員',
  'frontend-design-lead':'前端視覺設計主管',
  'evaluation':'員工考核官',
  'plugin-resource-scout':'工具／資源偵查員',
  'synapse-visualization-specialist':'知識連結視覺化研究員',
  'architect':'系統架構師',
  'supabase-engineer':'Supabase 後端工程師',
  'github-operator':'GitHub 操作員',
  'work-browser-qa':'瀏覽器驗收員',
  'work-web-operator':'網站實作員'
};

function teamRoleName(r){
  const key=r?.skill_key||'';
  return TEAM_ROLE_LABELS[key]||r?.role_name||human(key||'AI 角色');
}

const PROJECT_TEAM_META={
  'goal-closure-operator':{tags:['goal','execution','validation'],reason:'把目標收斂成可驗收成果，避免團隊各自開支線。',scope:'守住作品主線、驗收條件與唯一下一步。'},
  'logic-reality-analyst':{tags:['validation','research','traffic','business'],reason:'把流量、變現與內容成效拆成可驗證假設，不把推論當成果。',scope:'假設、證據、風險與停止條件。'},
  'ceo-orchestrator':{tags:['goal','coordination'],reason:'在多角色參與時維持單一決策主線。',scope:'角色分工、衝突收斂與整合。'},
  'supabase-engineer':{tags:['database','data'],reason:'只有作品需要正式保存或資料流程時才加入。',scope:'資料庫、資料狀態與後端存取。'},
  'github-operator':{tags:['repository','deploy','web'],reason:'只有作品需要程式庫或部署時才加入。',scope:'版本控制、程式庫讀寫與部署來源。'},
  'work-web-operator':{tags:['web','frontend','implementation'],reason:'只有作品本身需要網站實作時才加入。',scope:'前端實作與頁面修改。'},
  'work-browser-qa':{tags:['web','validation','qa'],reason:'只有需要真實網站互動驗收時才加入。',scope:'瀏覽器流程與響應式驗收。'},
  'product-flow-architect':{tags:['product','workflow','ux'],reason:'可協助整理產品流程，但目前仍是候選角色。',scope:'資訊架構與產品流程。'},
  'impeccable':{tags:['ux','review','web'],reason:'可協助介面審查，但目前仍是候選角色。',scope:'視覺層級、中文可理解性與介面審查。'},
  'frontend-design-lead':{tags:['frontend','design','web'],reason:'可協助視覺設計，但目前仍是候選角色。',scope:'前端視覺方向與設計一致性。'},
  'descript':{tags:['content','video','social','media'],reason:'現有影音工具可處理影片匯入、字幕、轉錄與剪輯。',scope:'影音製作流程、字幕與基本後製。'},
  'web-search':{tags:['research','social','traffic','business','platform'],reason:'需要查平台規則、受眾、流量或市場資訊時使用最新網路資料。',scope:'外部研究、平台規則與可追溯來源。'},
  'business-knowledge-database':{tags:['business','market','revenue','research'],reason:'現有商業資料來源可提供案例、機會、失敗模式與市場訊號。',scope:'變現假設、商業案例與市場訊號。'},
  'opencli-chatgpt-web-adapter':{tags:['ai','reasoning'],reason:'可沿用既有 ChatGPT Web 推理工作層，不新增付費 API。',scope:'需要 AI 推理的文字分析與任務交付。'},
  'github-growth-brain-web':{tags:['repository','deploy','web'],reason:'Growth Brain 既有正式前端程式庫。',scope:'網站原始碼、版本控制與部署來源。'},
  'method:path-artifact-trial':{tags:['validation','experiment'],reason:'沿用既有作品／路徑試跑規則，先用小作品與真實結果決定是否繼續。',scope:'階段驗證、繼續／轉向／停止判斷。'}
};

function projectGoalTags(goal){
  const s=String(goal||'').toLowerCase(),tags=new Set(['goal']);
  const rules=[
    [/數字人|digital\s*(human|avatar)|avatar|虛擬人物|ai\s*人物|人工智慧/,['ai','content','video']],
    [/instagram|ig\b|reels?|threads|tiktok|短影音|社群/,['social','platform','content']],
    [/影片|影音|video|剪輯|字幕|腳本|內容/,['content','video']],
    [/流量|觀看|觸及|互動|粉絲|engagement|traffic|views?/,['traffic','validation']],
    [/變現|收入|營收|商業|賺錢|moneti[sz]|revenue|affiliate|聯盟/,['business','revenue','market']],
    [/測試|驗證|experiment|test|mvp|假設/,['validation','experiment']],
    [/研究|比較|規則|政策|市場|受眾|research|market/,['research','market']],
    [/網站|網頁|前端|web|landing|頁面/,['web','frontend']],
    [/資料庫|supabase|postgres|資料表/,['database','data']],
    [/github|部署|deploy|repository|repo/,['repository','deploy']],
    [/ai|gpt|模型|推理/,['ai','reasoning']]
  ];
  rules.forEach(([re,add])=>{if(re.test(s))add.forEach(x=>tags.add(x));});
  return tags;
}

function projectTeamCatalog(system){
  const out=[],seen=new Set(),team=system?.skill_team||{};
  const add=item=>{if(!item?.key||seen.has(item.key))return;seen.add(item.key);out.push(item);};
  (team.executable_roles||[]).forEach(r=>add({
    key:r.skill_key,name:teamRoleName(r),kind:'employee',availability:r.availability||'available',
    status:r.status||'active',priority:Number(r.priority||50),autoEligible:true,raw:r
  }));
  (team.planned_roles||[]).forEach(r=>add({
    key:r.skill_key,name:teamRoleName(r),kind:'candidate',availability:r.availability||'planned',
    status:r.status||'candidate',priority:Number(r.priority||40),autoEligible:false,raw:r
  }));
  (system?.resource_catalog||[]).forEach(r=>add({
    key:r.resource_key,name:r.name||human(r.resource_key),kind:r.resource_type||'tool',
    availability:r.availability||'unknown',status:r.status||'unknown',priority:Number(r.priority||40),
    autoEligible:r.availability==='available'&&['active','conditional'].includes(String(r.status||'')),raw:r
  }));
  if(system?.path_trial_contract)add({
    key:'method:path-artifact-trial',name:'作品／路徑試跑法',kind:'method',
    availability:'available',status:'active',priority:88,autoEligible:true,raw:system.path_trial_contract
  });
  return out;
}

function projectTeamTags(item){
  const meta=PROJECT_TEAM_META[item.key],tags=new Set(meta?.tags||[]);
  const rawCaps=Array.isArray(item?.raw?.capabilities)?item.raw.capabilities:[];
  rawCaps.forEach(c=>String(c).toLowerCase().split(/[_\s/-]+/).filter(Boolean).forEach(x=>tags.add(x)));
  return tags;
}

function projectTeamScore(item,goalTags){
  if(!item.autoEligible)return -1;
  const tags=projectTeamTags(item);
  let matched=0;
  goalTags.forEach(t=>{if(tags.has(t))matched+=1;});
  let score=matched*10+(Number(item.priority||0)/100);
  if(item.key==='goal-closure-operator')score+=15;
  if(item.kind==='employee'&&matched>0)score+=1;
  return score;
}

function recommendProjectTeam(goal,system){
  const tags=projectGoalTags(goal);
  const ranked=projectTeamCatalog(system)
    .map(item=>({item,score:projectTeamScore(item,tags)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||b.item.priority-a.item.priority);
  const chosen=ranked.slice(0,5).map(x=>x.item.key);
  if(!chosen.includes('goal-closure-operator')&&ranked.some(x=>x.item.key==='goal-closure-operator')){
    if(chosen.length>=5)chosen.pop();
    chosen.unshift('goal-closure-operator');
  }
  return chosen;
}

function projectTeamKindLabel(item){
  return {employee:'現有員工',candidate:'候選員工',tool:'工具',source:'資料來源',library:'方法／工具庫',role:'角色資源',reviewer:'審查資源',method:'方法'}[item?.kind]||'現有資源';
}

function projectTeamReason(item){
  const meta=PROJECT_TEAM_META[item.key];
  if(meta?.reason)return meta.reason;
  const caps=Array.isArray(item?.raw?.capabilities)?item.raw.capabilities.slice(0,3).map(human):[];
  return caps.length?'因為它具備：'+caps.join('、')+'。':'因為它與這次作品的需求有直接能力交集。';
}

function projectTeamScope(item){
  const meta=PROJECT_TEAM_META[item.key];
  if(meta?.scope)return meta.scope;
  const caps=Array.isArray(item?.raw?.capabilities)?item.raw.capabilities.slice(0,3).map(human):[];
  return caps.length?caps.join('、'):'只負責與本作品直接相關的專業範圍。';
}

function projectTeamGoalSummary(goal){
  const tags=projectGoalTags(goal),labels={
    ai:'AI／數字人',content:'內容',video:'影音',social:'社群平台',platform:'平台',
    traffic:'流量驗證',validation:'驗證',experiment:'試驗',business:'變現',revenue:'收入',
    market:'市場',research:'研究',web:'網站',frontend:'前端',database:'資料庫',
    repository:'程式庫',deploy:'部署',reasoning:'AI 推理'
  };
  const picked=[...tags].filter(t=>labels[t]).map(t=>labels[t]).slice(0,6);
  return picked.length?picked.join(' · '):'一般作品目標';
}

function renderProjectTeamDraft(container,system){
  if(!container)return;
  if(!PROJECT_TEAM_DRAFT.generated){
    container.innerHTML='<div class="project-team-empty">先輸入作品目標，再按「幫我組隊」。這一步不會建立新員工，也不會改目前主線。</div>';
    return;
  }
  const catalog=projectTeamCatalog(system),byKey=new Map(catalog.map(x=>[x.key,x]));
  const selected=PROJECT_TEAM_DRAFT.selectedKeys.map(k=>byKey.get(k)).filter(Boolean);
  const unselected=catalog.filter(x=>!PROJECT_TEAM_DRAFT.selectedKeys.includes(x.key));
  const card=item=>{
    const candidate=!item.autoEligible;
    return '<article class="project-team-member'+(candidate?' is-candidate':'')+'">'+
      '<div class="project-team-member-head"><span class="project-team-kind">'+esc(projectTeamKindLabel(item))+'</span>'+
      '<b>'+esc(item.name)+'</b><button class="ghost-btn small" type="button" data-project-team-remove="'+esc(item.key)+'">移除</button></div>'+
      '<p><strong>加入理由</strong>'+esc(projectTeamReason(item))+'</p>'+
      '<p><strong>負責範圍</strong>'+esc(projectTeamScope(item))+'</p>'+
      (candidate?'<small>候選狀態：可手動放進草稿討論，但目前不能冒充可直接執行員工。</small>':'')+
    '</article>';
  };
  const library=unselected.map(item=>
    '<button class="project-team-library-item" type="button" data-project-team-add="'+esc(item.key)+'" '+(PROJECT_TEAM_DRAFT.selectedKeys.length>=8?'disabled':'')+'>'+
      '<span><b>'+esc(item.name)+'</b><small>'+esc(projectTeamKindLabel(item))+(item.autoEligible?'':' · 候選／不可直接執行')+'</small></span><i>加入</i>'+
    '</button>'
  ).join('');
  container.innerHTML=
    '<div class="project-team-summary"><div><span class="kicker">目前理解</span><b>'+esc(projectTeamGoalSummary(PROJECT_TEAM_DRAFT.goal))+'</b><small>'+esc(PROJECT_TEAM_DRAFT.goal)+'</small></div>'+
    '<button class="ghost-btn small" type="button" data-project-team-reteam>重新配隊</button></div>'+
    '<div class="project-team-grid">'+(selected.length?selected.map(card).join(''):'<div class="project-team-empty">目前小隊是空的，可從下方手動加入。</div>')+'</div>'+
    '<details class="project-team-library"><summary>手動增刪現有員工／技能／工具／方法</summary>'+
      '<div class="project-team-library-list">'+(library||'<div class="project-team-empty">目前沒有其他可加入項目。</div>')+'</div></details>';
  $$('[data-project-team-remove]',container).forEach(btn=>btn.addEventListener('click',()=>{
    PROJECT_TEAM_DRAFT.selectedKeys=PROJECT_TEAM_DRAFT.selectedKeys.filter(k=>k!==btn.dataset.projectTeamRemove);
    renderProjectTeamDraft(container,system);
  }));
  $$('[data-project-team-add]',container).forEach(btn=>btn.addEventListener('click',()=>{
    if(PROJECT_TEAM_DRAFT.selectedKeys.length>=8)return;
    if(!PROJECT_TEAM_DRAFT.selectedKeys.includes(btn.dataset.projectTeamAdd))PROJECT_TEAM_DRAFT.selectedKeys.push(btn.dataset.projectTeamAdd);
    renderProjectTeamDraft(container,system);
  }));
  $('[data-project-team-reteam]',container)?.addEventListener('click',()=>{
    PROJECT_TEAM_DRAFT.selectedKeys=recommendProjectTeam(PROJECT_TEAM_DRAFT.goal,system);
    renderProjectTeamDraft(container,system);
  });
}

function projectTeamPlanSnapshot(){
  return {
    version:'artifact-team-builder-v1',goal:PROJECT_TEAM_DRAFT.goal,
    team:{selectedKeys:[...PROJECT_TEAM_DRAFT.selectedKeys],generated:PROJECT_TEAM_DRAFT.generated},
    kickoff:window.GROWTH_BRAIN_PROJECT_KICKOFF?.current?.()||null,
    brief:window.GROWTH_BRAIN_PROJECT_BRIEF?.current?.()||null,
    milestones:window.GROWTH_BRAIN_PROJECT_MILESTONES?.current?.()||null
  };
}

function restoreProjectTeamRoute(route){
  const value=route?.source_evidence?.artifact_team_builder;
  if(!value||value.version!=='artifact-team-builder-v1'||value.goal!==route.title||
    !Array.isArray(value.team?.selectedKeys)||!value.team.selectedKeys.every(k=>typeof k==='string'))return false;
  window.GROWTH_BRAIN_PROJECT_KICKOFF?.reset?.();
  window.GROWTH_BRAIN_PROJECT_BRIEF?.reset?.();
  window.GROWTH_BRAIN_PROJECT_MILESTONES?.reset?.();
  PROJECT_TEAM_DRAFT={goal:value.goal,selectedKeys:[...value.team.selectedKeys],generated:value.team.generated===true};
  PROJECT_TEAM_ROUTE={id:route.id,version:route.version};
  const failed=()=>{
    PROJECT_TEAM_DRAFT={goal:'',selectedKeys:[],generated:false};PROJECT_TEAM_ROUTE=null;
    window.GROWTH_BRAIN_PROJECT_KICKOFF?.reset?.();
    window.GROWTH_BRAIN_PROJECT_BRIEF?.reset?.();
    window.GROWTH_BRAIN_PROJECT_MILESTONES?.reset?.();
    return false;
  };
  if(value.kickoff&&!window.GROWTH_BRAIN_PROJECT_KICKOFF?.restore?.(value.kickoff))return failed();
  if(value.brief&&!window.GROWTH_BRAIN_PROJECT_BRIEF?.restore?.(value.brief))return failed();
  if(value.milestones&&!window.GROWTH_BRAIN_PROJECT_MILESTONES?.restore?.(value.milestones))return failed();
  return true;
}

async function renderProjectsIA(active='gateway',notice=''){
  const root=$('#view-projects');
  if(!root)return;
  const tabs=[['gateway','進行中'],['done','已完成'],['planned','預計作品']];

  if(active==='current'){
    await renderProjects(notice);
    root.insertAdjacentHTML('afterbegin','<div class="project-detail-back"><button class="ghost-btn small" type="button" data-project-gateway>← 回作品入口</button><span>作品詳細</span></div>');
    $('[data-project-gateway]',root)?.addEventListener('click',()=>renderProjectsIA('gateway'));
    return;
  }else if(active==='gateway'){
    root.innerHTML=iaTabs(tabs,active)+'<div id="projectIaPane" class="tab-pane"><div class="empty">正在整理作品路徑…</div></div>';
    if(A.liveStatus==='live'&&window.GROWTH_BRAIN_W1P){A.getPersonalArtifacts().then(pa=>{const html=window.GROWTH_BRAIN_W1P.worksHtml(pa);const pane=$('#projectIaPane');if(html&&pane&&!root.querySelector('.w1p-works')){pane.insertAdjacentHTML('beforebegin',html+'<details class="w1p-more"><summary><b>作品路徑與新作品</b><span>建立新路徑、組隊、里程碑都在這裡</span></summary></details>');root.querySelector('.w1p-more').appendChild(pane);root.querySelector('[data-open-current]')?.addEventListener('click',()=>renderProjectsIA('current'));}}).catch(()=>{});}
    const pane=$('#projectIaPane');
    const hero='<header class="v4-page-head project-v4-head"><span class="v4-eyebrow">ARTIFACTS · 作品</span><div><h2>我的作品路徑</h2><p>先看現在在哪、下一個候選在哪。登入後可直接在下方輸入一條新作品路徑。</p><button class="primary-btn project-new-route-btn" type="button" '+(A.liveStatus==='live'?'data-new-project-route':'data-auth')+'>'+(A.liveStatus==='live'?'↓ 輸入新作品路徑':'登入後新增路徑')+'</button></div><img class="v4-page-art" data-image-placement="projects.hero" src="assets/ui/home-project-cover.webp" alt="" aria-hidden="true"></header>';

    if(A.liveStatus!=='live'){
      pane.innerHTML=hero+
        '<section class="project-route-rail is-locked">'+
          '<article class="project-route-node selected"><span class="route-dot"></span><small>目前路徑</small><h3>登入後讀取</h3><p>不使用示範作品冒充你的資料。</p></article>'+
          '<article class="project-route-node current"><span class="route-dot"></span><small>目前作品</small><h3>等待正式資料</h3><p>完成進度與下一步會顯示在這裡。</p><button class="primary-btn" data-auth>登入同步作品</button></article>'+
        '</section>';
    }else{
      try{
        const [outcome,artifacts]=await Promise.all([A.getPersonalOutcome({force:true}),A.getPersonalArtifacts({force:true})]);
        const selected=outcome?.selected_route||null;
        const candidateRoute=outcome?.candidate_route||null;
        const current=artifacts?.current||null;
        const candidateArtifact=artifacts?.candidate||null;
        if(!PROJECT_TEAM_DRAFT.goal&&candidateRoute){
          if(candidateRoute.source_evidence?.artifact_team_builder){
            if(!restoreProjectTeamRoute(candidateRoute))throw new Error('已保存規劃的內容不一致，請保留資料並檢查後再繼續。');
          }else{
            PROJECT_TEAM_ROUTE={id:candidateRoute.id,version:candidateRoute.version};
          }
        }
        const routeForm='<section class="project-new-route-panel" data-new-route-panel>'+
          '<div><span class="kicker">建立候選路徑</span><h3>直接輸入你想做的新作品路徑</h3><p>這只建立候選路徑，不會切換目前主線；若已有候選，會更新那一條。</p></div>'+
          '<form id="newProjectRouteForm" class="project-form project-route-form-inline">'+
            '<label><b>作品目標／想完成什麼</b><input id="newProjectRouteTitle" type="text" placeholder="例如：建立一條 AI 短影音變現路徑"></label>'+
            '<section class="project-team-builder">'+
              '<div class="project-team-builder-head"><div><span class="kicker">作品組隊器 · 第一步</span><h4>先理解目標，再挑一小隊</h4><p>只從現有員工、技能、工具、資料來源與方法中挑選；候選角色不會自動冒充可執行員工。</p></div><button class="primary-btn" type="button" data-project-team-recommend>幫我組隊</button></div>'+
              '<div id="projectTeamBuilderResult"><div class="project-team-empty">先輸入作品目標，再按「幫我組隊」。這一步不會建立新員工，也不會改目前主線。</div></div>'+
            '</section>'+
            '<label><b>怎樣算往前一步（可留空）</b><textarea id="newProjectRouteEvidence" placeholder="例如：先完成 3 支內容並取得真實流量；不知道可留空"></textarea></label>'+
            '<details><summary>補充：為什麼現在想做</summary><textarea id="newProjectRouteWhy" placeholder="可選填"></textarea></details>'+
            '<div class="row-between"><div id="newProjectRouteMsg" class="muted">保存團隊、會議、基礎提示詞與目前步驟，下次可繼續；不會自動取代目前主線。</div><button class="primary-btn" type="submit">建立候選路徑</button></div>'+
          '</form>'+
        '</section>';

        const nodes=[];
        if(selected){
          nodes.push('<article class="project-route-node selected"><span class="route-dot"></span><small>目前路徑</small><h3>'+esc(selected.title||'已選定作品路徑')+'</h3><p>'+esc(selected.success_evidence||selected.why_now||'沿著這條路徑累積可驗證作品。')+'</p></article>');
        }
        if(current){
          const p=current.progress_summary||{};
          const items=Array.isArray(current.evidence_progress)?current.evidence_progress:[];
          const total=p.total??items.length;
          const confirmed=p.confirmed??items.filter(x=>x.status==='confirmed').length;
          const status=current.status==='current'?'進行中':statusText(current.status||'unknown');
          nodes.push('<button class="project-route-node current" type="button" data-open-project-detail data-artifact-id="'+esc(current.id)+'">'+
            '<span class="route-dot"></span><small>現在 · '+esc(status)+'</small><h3>'+esc(current.title||'目前作品')+'</h3>'+
            '<p>'+esc(confirmed)+' / '+esc(total)+' 個完成條件已有證據</p>'+
            '<span class="project-route-progress"><i style="width:'+(total?Math.round(confirmed/total*100):0)+'%"></i></span>'+
            '<b class="route-action">進入作品 →</b></button>');
        }else if(selected){
          nodes.push('<button class="project-route-node current" type="button" data-open-project-detail><span class="route-dot"></span><small>下一步</small><h3>建立第一件作品</h3><p>路徑已選定，等待進入作品執行。</p><b class="route-action">查看路徑 →</b></button>');
        }
        if(candidateArtifact){
          nodes.push('<article class="project-route-node candidate"><span class="route-dot"></span><small>候選作品</small><h3>'+esc(candidateArtifact.title||'下一件候選作品')+'</h3><p>還不是目前作品，確認後才會進入執行。</p></article>');
        }else if(candidateRoute){
          nodes.push('<article class="project-route-node candidate"><span class="route-dot"></span><small>候選路徑</small><h3>'+esc(candidateRoute.title||'下一條候選路徑')+'</h3><p>'+esc(candidateRoute.success_evidence||'尚未成為目前主線。')+'</p></article>');
        }
        if(!nodes.length){
          nodes.push('<article class="project-route-node empty"><span class="route-dot"></span><small>尚未開始</small><h3>建立第一條作品路徑</h3><p>用上方「＋ 新作品路徑」直接輸入你想做的方向。</p></article>');
        }

        pane.innerHTML=hero+
          (notice?'<div class="project-route-notice">'+esc(notice)+'</div>':'')+
          routeForm+
          '<section class="project-route-rail">'+nodes.join('<span class="project-route-connector" aria-hidden="true">→</span>')+'</section>'+
          '<p class="project-route-note">實心／高亮節點是現在；候選節點不代表一定會發生。點「目前作品」才展開完整步驟與證據。</p>';

        $('[data-open-project-detail]',pane)?.addEventListener('click',()=>renderProjectsIA('current'));
        const routePanel=$('[data-new-route-panel]',pane);
        $('[data-new-project-route]',pane)?.addEventListener('click',()=>{
          routePanel.hidden=false;
          $('#newProjectRouteTitle',pane)?.focus();
          routePanel.scrollIntoView({behavior:'smooth',block:'nearest'});
        });
        $('[data-cancel-new-route]',pane)?.addEventListener('click',()=>{routePanel.hidden=true;});
        const teamGoalInput=$('#newProjectRouteTitle',pane);
        const teamBox=$('#projectTeamBuilderResult',pane);
        const teamRecommend=$('[data-project-team-recommend]',pane);
        if(PROJECT_TEAM_DRAFT.goal&&!teamGoalInput.value)teamGoalInput.value=PROJECT_TEAM_DRAFT.goal;
        if(candidateRoute&&PROJECT_TEAM_ROUTE?.id===candidateRoute.id){
          $('#newProjectRouteEvidence',pane).value=candidateRoute.success_evidence||'';
          $('#newProjectRouteWhy',pane).value=candidateRoute.why_now||'';
          $('#newProjectRouteForm button[type="submit"]',pane).textContent='保存規劃與進度';
        }
        if(PROJECT_TEAM_DRAFT.generated){
          try{
            SYSTEM=SYSTEM||await A.getSystemCockpit();
            renderProjectTeamDraft(teamBox,SYSTEM);
          }catch(err){
            teamBox.innerHTML='<div class="project-team-empty">目前無法讀取現有團隊資料：'+esc(err.message||err)+'</div>';
          }
        }
        teamGoalInput?.addEventListener('input',()=>{
          const next=teamGoalInput.value.trim();
          if(PROJECT_TEAM_DRAFT.generated&&next!==PROJECT_TEAM_DRAFT.goal){
            PROJECT_TEAM_DRAFT={goal:next,selectedKeys:[],generated:false};
            renderProjectTeamDraft(teamBox,SYSTEM);
          }else PROJECT_TEAM_DRAFT.goal=next;
        });
        teamRecommend?.addEventListener('click',async()=>{
          const goal=teamGoalInput?.value?.trim()||'';
          if(goal.length<3){
            teamBox.innerHTML='<div class="project-team-empty">請先寫至少 3 個字的作品目標，我才能判斷要找誰。</div>';
            return;
          }
          teamRecommend.disabled=true;
          try{
            SYSTEM=SYSTEM||await A.getSystemCockpit();
            PROJECT_TEAM_DRAFT={goal,selectedKeys:recommendProjectTeam(goal,SYSTEM),generated:true};
            renderProjectTeamDraft(teamBox,SYSTEM);
          }catch(err){
            teamBox.innerHTML='<div class="project-team-empty">組隊資料載入失敗：'+esc(err.message||err)+'</div>';
          }finally{
            teamRecommend.disabled=false;
          }
        });
        $('#newProjectRouteForm',pane)?.addEventListener('submit',async e=>{
          e.preventDefault();
          const title=$('#newProjectRouteTitle',pane)?.value?.trim()||'';
          const providedEvidence=$('#newProjectRouteEvidence',pane)?.value?.trim()||'';
          const successEvidence=providedEvidence||'先由 GPT 拆解第一件可驗證作品，再以真實作品結果逐步確認完成標準。';
          const whyNow=$('#newProjectRouteWhy',pane)?.value?.trim()||'';
          const msg=$('#newProjectRouteMsg',pane);
          const submit=e.currentTarget.querySelector('button[type="submit"]');
          if(title.length<3){msg.textContent='請至少寫 3 個字，告訴我這條路徑想完成什麼。';return;}
          renderProjectTeamDraft(teamBox,SYSTEM);
          const controls=[...e.currentTarget.querySelectorAll('input,textarea,button')].map(el=>[el,el.disabled]);
          controls.forEach(([el])=>{el.disabled=true;});
          try{
            msg.textContent='正在保存候選路徑…';
            const saved=await A.savePersonalOutcomeCandidate({title,successEvidence,whyNow,directionKey:null,
              builderState:projectTeamPlanSnapshot(),routeId:PROJECT_TEAM_ROUTE?.id||null,
              expectedVersion:PROJECT_TEAM_ROUTE?.version??null});
            PROJECT_TEAM_ROUTE={id:saved.candidate_route.id,version:saved.candidate_route.version};
            submit.disabled=false;
            submit.textContent='保存規劃與進度';
            msg.textContent='團隊與規劃已永久保存，並已重新讀取核對；下次開啟作品即可繼續。';
          }catch(err){
            submit.disabled=false;
            msg.textContent=err.code==='candidate_version_conflict'?'這條路徑已有較新的修改。請重新開啟作品讀取最新內容後再保存。':err.message||'候選路徑保存失敗';
          }finally{
            controls.forEach(([el,disabled])=>{el.disabled=disabled;});
          }
        });
      }catch(e){
        pane.innerHTML=hero+'<div class="empty">作品路徑載入失敗：'+esc(e.message||e)+'</div>';
      }
    }
  }else{
    root.innerHTML=iaTabs(tabs,active)+'<div id="projectIaPane" class="tab-pane"><div class="empty">正在整理作品資料…</div></div>';
    const pane=$('#projectIaPane');

    if(A.liveStatus!=='live'){
      pane.innerHTML='<div class="empty">登入後才會顯示正式作品資料。</div>';
    }else{
      try{
        const [outcome,artifacts]=await Promise.all([A.getPersonalOutcome({force:true}),A.getPersonalArtifacts({force:true})]);
        const current=artifacts?.current||null;
        const candidate=artifacts?.candidate||null;
        const candidateRoute=outcome?.candidate_route||null;
        const planningJob=artifacts?.next_plan_job||candidateRoute?.path_plan||null;
        const history=Array.isArray(artifacts?.history)?artifacts.history:[];

        if(active==='planned'){
          const plannedCards=[];
          if(candidateRoute){
            plannedCards.push('<article class="project-route-candidate">'+
              '<div><span class="kicker">候選作品路徑</span><h3>'+esc(candidateRoute.title||'未命名候選路徑')+'</h3><p>'+esc(candidateRoute.success_evidence||'等待補上完成方向')+'</p>'+
                (candidateRoute.why_now?'<small>'+esc(candidateRoute.why_now)+'</small>':'')+
              '</div>'+
              '<div class="project-actions">'+(candidateRoute.source_evidence?.artifact_team_builder?'<button class="ghost-btn" type="button" data-resume-project-team>繼續團隊規劃</button>':'')+'<button class="primary-btn" type="button" data-select-route-id="'+esc(candidateRoute.id)+'">設為目前主線</button><button class="ghost-btn" type="button" data-reject-route-id="'+esc(candidateRoute.id)+'">刪除候選</button></div>'+
            '</article>');
          }
          const candidateList=(Array.isArray(artifacts?.candidates)&&artifacts.candidates.length?artifacts.candidates:(candidate?[candidate]:[])).filter(c=>c&&c.status==='candidate');
          candidateList.forEach(candidate=>{
            plannedCards.push('<article class="project-gateway-card is-locked">'+
              '<span class="project-cover"><img class="project-cover-image" data-image-placement="projects.cover" src="assets/ui/home-project-cover.webp" alt="" aria-hidden="true"><span class="project-cover-badge muted">預計作品</span></span>'+
              '<span class="project-gateway-copy"><span class="project-family-row"><b class="project-name">'+esc(candidate.title||'下一件候選作品')+'</b></span><b class="project-version-title">等待你確認</b><span class="project-status">'+esc(statusText(candidate.status||'candidate'))+'</span><span class="project-progress">確認後才會進入正式作品，不會先算成進度。</span><span class="project-progress-track"><i style="width:0%"></i></span><button class="ghost-btn small" type="button" data-work-skills-global="'+esc(candidate.id||'')+'" data-work-title="'+esc(candidate.title||'')+'">'+((candidate.skills||[]).length?'需要的能力（'+(candidate.skills||[]).length+'）':'依完成條件產生能力清單')+'</button></span>'+
            '</article>');
          });
          if(planningJob&&planningJob.status&&!['completed','cancelled'].includes(String(planningJob.status).toLowerCase())){
            plannedCards.push('<article class="project-gateway-card is-locked">'+
              '<span class="project-cover"><img class="project-cover-image" data-image-placement="projects.cover" src="assets/ui/home-project-cover.webp" alt="" aria-hidden="true"><span class="project-cover-badge muted">規劃中</span></span>'+
              '<span class="project-gateway-copy"><span class="project-family-row"><b class="project-name">下一件作品正在整理</b></span><b class="project-version-title">等待 GPT 規劃結果</b><span class="project-status">'+esc(statusText(planningJob.status||'pending'))+'</span><span class="project-progress">這只是規劃狀態，尚未成為正式作品。</span><span class="project-progress-track"><i style="width:0%"></i></span></span>'+
            '</article>');
          }
          pane.innerHTML='<div class="page-intro"><span class="kicker">接下來</span><h2>預計作品</h2><p>候選作品路徑、候選作品與規劃中的下一件作品都放在這裡；候選不等於目前主線。</p></div>'+
            (notice?'<div class="project-route-notice">'+esc(notice)+'</div>':'')+
            (plannedCards.length?'<div class="project-planned-stack">'+plannedCards.join('')+'</div>':'<div class="empty">目前沒有預計作品。回到「進行中」可用「＋ 新作品路徑」建立候選。</div>');
          $('[data-resume-project-team]',pane)?.addEventListener('click',async()=>{
            const latest=await A.getPersonalOutcome({force:true});
            if(!restoreProjectTeamRoute(latest.candidate_route)){alert('目前無法完整恢復規劃，請保留資料並檢查。');return;}
            await renderProjectsIA('gateway','已讀取保存的團隊與規劃。');
          });
          $('[data-select-route-id]',pane)?.addEventListener('click',async e=>{
            const btn=e.currentTarget;btn.disabled=true;
            try{
              await A.decidePersonalOutcomeCandidate({routeId:btn.dataset.selectRouteId,decision:'select'});
              D=await A.getSnapshot();renderHome();
              await renderProjectsIA('gateway','候選路徑已設為目前主線；GPT 會依這條路徑整理下一件候選作品。');
            }catch(err){btn.disabled=false;pane.querySelector('.project-route-notice')?.remove();alert(err.message||'設定主線失敗');}
          });
          $('[data-reject-route-id]',pane)?.addEventListener('click',async e=>{
            const btn=e.currentTarget;btn.disabled=true;
            try{
              await A.decidePersonalOutcomeCandidate({routeId:btn.dataset.rejectRouteId,decision:'reject'});
              D=await A.getSnapshot();renderHome();
              await renderProjectsIA('planned','候選路徑已刪除，沒有改動目前主線。');
            }catch(err){btn.disabled=false;alert(err.message||'刪除候選失敗');}
          });
        }else{
          const completed=history.filter(x=>['completed','done'].includes(String(x.status||'').toLowerCase())||x.completed_at);
          pane.innerHTML='<div class="page-intro"><span class="kicker">完成紀錄</span><h2>已完成作品</h2><p>這裡只展示已存在的正式作品紀錄，不用系統工作包冒充個人成果。</p></div>'+
            (completed.length?'<div class="completed-grid">'+completed.map(a=>'<article class="completed-item"><span class="completed-mark">✓</span><div><b>'+esc(a.title||'已完成作品')+'</b><p>'+esc(a.objective||a.summary||'')+'</p><small>'+esc(a.completed_at?new Date(a.completed_at).toLocaleString('zh-TW'):'已有完成紀錄')+'</small></div></article>').join('')+'</div>':'<div class="empty">目前還沒有正式完成作品。</div>');
        }
      }catch(e){
        pane.innerHTML='<div class="empty">作品資料載入失敗：'+esc(e.message||e)+'</div>';
      }
    }
  }

  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderProjectsIA(b.dataset.iaTab));
  $('[data-project-current]',root)?.addEventListener('click',()=>renderProjectsIA('current'));
}

async function renderTeamIA(active='working'){
  const root=$('#view-ceo');
  if(!root)return;
  const tabs=[['working','正在工作'],['teachers','我的老師'],['researchers','研究員'],['system','系統維護']];

  if(active==='system'){
    await renderSystem();
    root.insertAdjacentHTML('afterbegin',iaTabs(tabs,active));
    $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderTeamIA(b.dataset.iaTab));
    return;
  }

  root.innerHTML=iaTabs(tabs,active)+'<div id="teamIaPane" class="tab-pane"><div class="empty">正在整理團隊…</div></div>';
  const pane=$('#teamIaPane');

  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">TEAM · 團隊</span><div><h2>先看誰正在幫目前這一步</h2><p>登入後才顯示真實角色、工作與關聯，不用假員工填畫面。</p></div></div>'+
      '<section class="team-orbit-stage is-locked"><div class="team-current-work"><span>目前作品</span><b>登入後載入</b></div><div class="team-lock"><button class="primary-btn" data-auth>登入查看團隊</button></div></section>';
  }else{
    try{
      const [system,artifactData]=await Promise.all([
        SYSTEM||A.getSystemCockpit(),
        A.getPersonalArtifacts({force:false}).catch(()=>null)
      ]);
      SYSTEM=system;
      const team=SYSTEM?.skill_team||{};
      const roles=Array.isArray(team.executable_roles)?team.executable_roles:[];
      const planned=Array.isArray(team.planned_roles)?team.planned_roles:[];
      const recent=Array.isArray(team.recent_usage)?team.recent_usage:[];
      const packages=Array.isArray(SYSTEM?.work_queue?.packages)?SYSTEM.work_queue.packages:[];
      const artifacts=[artifactData?.current,artifactData?.candidate,...(Array.isArray(artifactData?.history)?artifactData.history:[])].filter(Boolean);
      const currentArtifact=artifactData?.current||null;
      const byKey=new Map([...roles,...planned].map(r=>[r.skill_key,r]));
      const mergeUsage=u=>({...byKey.get(u.skill_key),...u,skill_key:u.skill_key});
      const unique=list=>list.filter((r,i,a)=>r?.skill_key&&a.findIndex(x=>x?.skill_key===r.skill_key)===i);
      const allRoles=unique([...roles,...planned,...recent.map(mergeUsage)]);
      const packageText=p=>JSON.stringify(p||{});
      const relatedPackages=key=>packages.filter(p=>packageText(p).includes('"'+key+'"')).slice(0,6);
      const relatedRoles=key=>{
        const ps=relatedPackages(key);
        return allRoles.filter(r=>r.skill_key!==key&&ps.some(p=>packageText(p).includes('"'+r.skill_key+'"'))).slice(0,5);
      };
      const relatedArtifacts=key=>{
        const ps=relatedPackages(key);
        if(!ps.length)return [];
        return artifacts.filter(a=>a?.id&&ps.some(p=>packageText(p).includes('"'+a.id+'"'))).slice(0,4);
      };
      const roleTools=r=>(Array.isArray(r.runtime_skill_uris)?r.runtime_skill_uris:[]).map(x=>String(x).split('/').pop()).filter(Boolean);
      const roleState=r=>{
        const catalog=String(r.catalog_state||'').toLowerCase();
        const status=String(r.status||'').toLowerCase();
        if(catalog==='trial'||status==='candidate')return {text:'試用中',cls:'trial'};
        if(catalog==='planned'||r.availability==='planned')return {text:'候選',cls:'planned'};
        if(catalog==='runtime'||['active','available','installed','builtin'].includes(status)||['builtin','installed'].includes(r.availability))return {text:'可調用',cls:'ready'};
        return {text:'待驗證',cls:'unknown'};
      };
      let shown=[];
      let heading='';
      let desc='';
      if(active==='working'){
        shown=unique(recent.map(mergeUsage)).slice(0,5);
        if(!shown.length)shown=roles.slice(0,5);
        heading='現在誰在幫目前這一步';
        desc='角色只在真的參與過任務時優先浮上來；技術資訊不搶畫面。';
      }else if(active==='teachers'){
        const keys=new Set(['ceo-orchestrator','goal-closure-operator','logic-reality-analyst','product-flow-architect','impeccable','frontend-design-lead','evaluation','instructional-design-specialist']);
        shown=allRoles.filter(r=>keys.has(r.skill_key)).slice(0,5);
        heading='陪你完成作品的人';
        desc='正式可調用與候選／試用角色會分開標示，不混在一起。';
      }else{
        const pattern=/scout|architect|synapse|research|impeccable|frontend|graph|instructional/i;
        shown=allRoles.filter(r=>pattern.test(r.skill_key||'')).slice(0,5);
        heading='把未知變成候選的人';
        desc='研究結果先是候選或試驗，不會直接改你的作品與能力。';
      }

      const roleNode=(r,i)=>{
        const state=roleState(r);
        const ps=relatedPackages(r.skill_key);
        return '<button class="team-role-node n'+(i+1)+'" type="button" data-team-role="'+esc(r.skill_key)+'">'+
          '<span class="team-role-avatar">'+esc((teamRoleName(r)||'AI').slice(0,1))+'</span>'+
          '<span class="team-role-copy"><b>'+esc(teamRoleName(r))+'</b><small>'+esc(state.text)+(ps.length?' · '+ps.length+' 個工作':'')+'</small></span>'+
        '</button>';
      };
      const workTitle=currentArtifact?.title||'目前沒有 current 作品';
      const workStep=currentArtifact?.next_evidence_item?.criterion_text||currentArtifact?.objective||'先維持單一主線，沒有證據就不製造假任務。';

      pane.innerHTML='<div class="v4-page-head"><span class="v4-eyebrow">TEAM · 團隊</span><div><h2>'+esc(heading)+'</h2><p>'+esc(desc)+'</p></div><img class="v4-page-art" data-image-placement="team.hero" src="assets/ui/home-hero-workspace.webp" alt="" aria-hidden="true"></div>'+
        '<div class="team-stage-layout">'+
          '<section class="team-orbit-stage">'+
            '<button class="team-current-work" type="button" data-jump="projects"><span>目前作品</span><b>'+esc(workTitle)+'</b><small>'+esc(workStep)+'</small></button>'+
            '<div class="team-role-layer">'+(shown.length?shown.map(roleNode).join(''):'<div class="team-stage-empty">目前沒有符合這個區域的真實角色資料。</div>')+'</div>'+
            '<div class="team-stage-hint">Hover 看正式合作關係 · Click 看角色詳細</div>'+
          '</section>'+
          '<aside class="team-role-detail" id="teamRoleDetail"><span class="kicker">角色詳細</span><h3>選一位角色</h3><p>第一屏只看角色與目前工作；工具、工作包、合作角色和證據點擊後才展開。</p></aside>'+
        '</div>';

      const panel=$('#teamRoleDetail',pane);
      const cards=$$('.team-role-node',pane);
      const relationSet=key=>new Set(relatedRoles(key).map(r=>r.skill_key));
      const focusRole=key=>{
        const related=relationSet(key);
        cards.forEach(c=>{
          const same=c.dataset.teamRole===key;
          const linked=related.has(c.dataset.teamRole);
          c.classList.toggle('is-focus',same);
          c.classList.toggle('is-related',!same&&linked);
          c.classList.toggle('is-dim',!same&&!linked);
        });
      };
      const clearFocus=()=>cards.forEach(c=>c.classList.remove('is-focus','is-related','is-dim'));
      const openRole=key=>{
        const r=allRoles.find(x=>x.skill_key===key)||{};
        const state=roleState(r);
        const ps=relatedPackages(key);
        const rr=relatedRoles(key);
        const tools=roleTools(r);
        const ars=relatedArtifacts(key);
        panel.innerHTML='<div class="team-role-detail-head"><span class="team-role-avatar large">'+esc((teamRoleName(r)||'AI').slice(0,1))+'</span><div><span class="kicker">'+esc(state.text)+'</span><h3>'+esc(teamRoleName(r))+'</h3></div></div>'+
          '<p>'+esc(r.trigger_summary||r.notes||'依目前任務需要提供專業支援。')+'</p>'+
          '<div class="team-detail-group"><b>現在／近期工作</b>'+(ps.length?ps.map(p=>'<span>'+esc(p.title||p.package_key)+' · '+esc(statusText(p.status||'unknown'))+'</span>').join(''):'<small>尚無正式關聯工作</small>')+'</div>'+
          '<div class="team-detail-group"><b>合作角色</b>'+(rr.length?rr.map(x=>'<button type="button" data-related-role="'+esc(x.skill_key)+'">'+esc(teamRoleName(x))+'</button>').join(''):'<small>尚無正式合作關聯</small>')+'</div>'+
          '<div class="team-detail-group"><b>工具</b>'+(tools.length?tools.map(x=>'<span>'+esc(x)+'</span>').join(''):'<small>未登記專用工具</small>')+'</div>'+
          '<div class="team-detail-group"><b>作品關聯</b>'+(ars.length?ars.map(a=>'<button type="button" data-jump="projects">'+esc(a.title||'作品')+'</button>').join(''):'<small>目前沒有可由正式 ID 確認的作品關聯</small>')+'</div>';
        $$('[data-related-role]',panel).forEach(btn=>btn.onclick=()=>{
          const target=cards.find(c=>c.dataset.teamRole===btn.dataset.relatedRole);
          if(target){target.click();target.focus();}
        });
      };
      cards.forEach(c=>{
        c.addEventListener('mouseenter',()=>focusRole(c.dataset.teamRole));
        c.addEventListener('mouseleave',clearFocus);
        c.addEventListener('focus',()=>focusRole(c.dataset.teamRole));
        c.addEventListener('blur',clearFocus);
        c.addEventListener('click',()=>openRole(c.dataset.teamRole));
      });
    }catch(e){
      pane.innerHTML='<div class="empty">團隊資料載入失敗：'+esc(e.message||e)+'</div>';
    }
  }

  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderTeamIA(b.dataset.iaTab));
}

/* ===== 5-page navigation (openspec/changes/navigation-5-pages) =====
   Each tab reuses the existing renderer and data call; only placement changes. */
const lab=()=>window.GROWTH_BRAIN_LAB;
const NAV_PAGES=[
  {key:'today',label:'今天',icon:'☀',tabs:[
    {key:'step',label:'今天這一步',view:'home',desc:'推進目前作品的唯一下一步。',run:()=>renderHome()},
    {key:'waiting',label:'等待中的作品',view:'home',desc:'還沒開始的作品，安全地放在這裡等你。',run:()=>renderTodayWaiting()},
    {key:'progress',label:'最近進展',view:'home',desc:'只列真的發生過、有紀錄的進展。',run:()=>renderTodayProgress()}]},
  {key:'works',label:'作品',icon:'◎',tabs:[
    {key:'active',label:'進行中',view:'projects',desc:'目前作品的路徑、完成條件與證據。',run:sub=>renderProjectsIA(sub==='current'?'current':'gateway')},
    {key:'waiting',label:'等待中',view:'projects',desc:'預計要做、還沒開始的作品。',run:()=>renderProjectsIA('planned')},
    {key:'done',label:'已完成',view:'projects',desc:'已經完成並留下證據的作品。',run:()=>renderProjectsIA('done')},
    {key:'review',label:'回顧',view:'history',desc:'回頭看你真的做過什麼（依時間排列）。',run:()=>renderHistory('personal')}]},
  {key:'learn',label:'學習',icon:'✎',tabs:[
    {key:'practice',label:'下一個練習',view:'learn',desc:'只補目前作品真的用得到的能力。',run:()=>renderLearn()},
    {key:'abilities',label:'我的能力',view:'capabilities',desc:'能力狀態只看真實證據，不看 AI 猜測。',segs:[
      {key:'map',label:'能力圖譜',view:'capabilities',run:()=>renderCapabilities('cells')},
      {key:'evidence',label:'有證據的能力',view:'capabilities',run:()=>renderCapabilities('skills')},
      {key:'changes',label:'能力變化',view:'history',run:()=>renderHistory('skills')}]},
    {key:'playbooks',label:'作戰手冊',view:'capabilities',desc:'作戰手冊＝做過的事整理成的步驟筆記，需要時照著做。',run:()=>renderCapabilities('playbooks')},
    {key:'relations',label:'知識關係',view:'synapse',desc:'看你存的知識之間怎麼連起來、能幫哪個作品。',run:()=>renderSynapse()}]},
  {key:'lab',label:'研究室',icon:'✦',tabs:[
    {key:'today',label:'今日探索',view:'research',desc:'AI 研究員自己上網找資料、反覆想，只推薦值得你看的一件事。',run:()=>lab().renderResearch($('#view-research'),'today',{filter:'active'})},
    {key:'ai',label:'AI 技術',view:'research',desc:'AI 研究員找到的 AI 工具與技術。',run:()=>lab().renderResearch($('#view-research'),'ai',{filter:'active'})},
    {key:'distribution',label:'流量分發',view:'research',desc:'讓內容被更多人看到的方法（流量分發＝內容怎麼被平台推給人）。',run:()=>lab().renderResearch($('#view-research'),'distribution',{filter:'active'})},
    {key:'opportunity',label:'商業機會',view:'research',desc:'可能賺錢的方向，還沒驗證前都只是候選。',run:()=>lab().renderResearch($('#view-research'),'opportunity',{filter:'active'})},
    {key:'notes',label:'研究筆記',view:'history',desc:'AI 研究員做過的研究，以及正在試做的事。',segs:[
      {key:'history',label:'研究歷程',view:'history',run:()=>renderHistory('research')},
      {key:'trying',label:'正在試做',view:'research',run:()=>lab().renderResearch($('#view-research'),'today',{filter:'trial'})}]}]},
  {key:'collect',label:'收集',icon:'＋',tabs:[
    {key:'inbox',label:'收件匣',view:'inbox',desc:'先把想法、連結丟進來，之後再分類。',run:()=>window.GROWTH_BRAIN_INBOX?.render()},
            {key:'questions',label:'我的提問',view:'inbox',desc:'你送出、需要 AI 處理的事：排到哪、等多久、做完沒有。',run:()=>window.GROWTH_BRAIN_MYJOBS?.render($('#view-inbox'),A)},
    {key:'saved',label:'收藏',view:'research',desc:'研究室推薦中你先收起來的事。',run:()=>lab().renderResearch($('#view-research'),'today',{filter:'saved'})},
    {key:'ignored',label:'已略過',view:'research',desc:'你略過的推薦；需要時可以再拿回來看。',run:()=>lab().renderResearch($('#view-research'),'today',{filter:'ignored'})}]},
  {key:'system',label:'系統',icon:'⚙',gear:true,tabs:[
    {key:'pending',label:'待處理',view:'ceo',desc:'還沒完成、等你處理的事。',run:()=>renderSystemPending()},
    {key:'team',label:'AI 團隊',view:'ceo',desc:'幫你做事的 AI 角色與它們最近做了什麼。',segs:[
      {key:'working',label:'正在工作',view:'ceo',run:()=>renderTeamIA('working')},
      {key:'teachers',label:'我的老師',view:'ceo',run:()=>renderTeamIA('teachers')},
      {key:'researchers',label:'研究員',view:'ceo',run:()=>renderTeamIA('researchers')}]},
    {key:'status',label:'系統狀態',view:'ceo',desc:'工作包、Worker（你電腦上的 AI 執行程式）與版本紀錄。',segs:[
      {key:'maint',label:'系統維護',view:'ceo',run:()=>renderTeamIA('system')},
      {key:'versions',label:'版本歷程',view:'history',run:()=>renderHistory('system')},
      {key:'research',label:'系統研究',view:'research',run:()=>renderResearch('growthbrain')}]},
    {key:'account',label:'帳號與設定',view:'ceo',desc:'你的帳號、登入方式與登出。',run:()=>renderAccount()}]}
];
/* old view key (+ old subtab) -> [page, tab, seg?, sub?] */
const LEGACY_ROUTES={
  home:{_:['today','step']},

  projects:{_:['works','active'],gateway:['works','active'],current:['works','active',null,'current'],planned:['works','waiting'],done:['works','done']},
  capabilities:{_:['learn','abilities','map'],cells:['learn','abilities','map'],skills:['learn','abilities','evidence'],playbooks:['learn','playbooks'],relations:['learn','relations']},
  research:{_:['lab','today'],today:['lab','today'],ai:['lab','ai'],distribution:['lab','distribution'],opportunity:['lab','opportunity'],growthbrain:['system','status','research']},
  ceo:{_:['system','team','working'],working:['system','team','working'],teachers:['system','team','teachers'],researchers:['system','team','researchers'],system:['system','status','maint']},
  history:{_:['works','review'],system:['system','status','versions'],personal:['works','review'],skills:['learn','abilities','changes'],research:['lab','notes','history']},
  inbox:{_:['collect','inbox']},
  learn:{_:['learn','practice']},
  synapse:{_:['learn','relations']}
};
function resolveLegacy(view,sub){
  const m=LEGACY_ROUTES[view];
  if(!m)return null;
  return (sub&&m[sub])||m._;
}
function navFind(pageKey,tabKey,segKey){
  const page=NAV_PAGES.find(p=>p.key===pageKey)||NAV_PAGES[0];
  const tab=page.tabs.find(t=>t.key===tabKey)||page.tabs[0];
  const seg=tab.segs?(tab.segs.find(s=>s.key===segKey)||tab.segs[0]):null;
  return {page,tab,seg};
}
function navHash(p,t,s){return '#/'+p+'/'+t+(s?'/'+s:'')}
function parseNavHash(hash){
  const h=String(hash||'');
  if(!h||h.includes('=')||h.includes('access_token'))return null;
  const parts=h.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  if(!parts.length)return null;
  if(NAV_PAGES.some(p=>p.key===parts[0])){const r=navFind(parts[0],parts[1],parts[2]);return [r.page.key,r.tab.key,r.seg?.key||null];}
  const legacy=resolveLegacy(parts[0],parts[1]);
  return legacy?[legacy[0],legacy[1],legacy[2]||null,legacy[3]||null]:null;
}
let NAV_STATE={page:'today',tab:'step',seg:null};
function renderNavShell(page,tab,seg){
  const shell=$('#pageShell');if(!shell)return;
  shell.innerHTML='<div class="nav5-where"><span>'+esc(page.label)+'</span><i aria-hidden="true">›</i><b>'+esc(tab.label)+'</b>'+(seg?'<i aria-hidden="true">›</i><b>'+esc(seg.label)+'</b>':'')+'</div>'+
    '<p class="nav5-desc">'+esc(tab.desc||'')+'</p>'+
    '<nav class="nav5-shortcuts" aria-label="'+esc(page.label)+'的功能">'+page.tabs.map(t=>'<a href="'+navHash(page.key,t.key)+'" class="'+(t.key===tab.key?'on':'')+'" data-nav-tab="'+esc(t.key)+'"'+(t.key===tab.key?' aria-current="page"':'')+'>'+esc(t.label)+'</a>').join('')+'</nav>'+
    (tab.segs?'<div class="nav5-segs" role="group" aria-label="'+esc(tab.label)+'">'+tab.segs.map(s=>'<a href="'+navHash(page.key,tab.key,s.key)+'" class="'+(seg&&s.key===seg.key?'on':'')+'" data-nav-seg="'+esc(s.key)+'">'+esc(s.label)+'</a>').join('')+'</div>':'');
}
function navGo(pageKey,tabKey,segKey,opts={}){
  const {page,tab,seg}=navFind(pageKey,tabKey,segKey);
  NAV_STATE={page:page.key,tab:tab.key,seg:seg?.key||null};
  const target=(seg||tab).view;
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+target));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page.key));
  $('#gearBtn')?.classList.toggle('active',page.key==='system');
  const t=$('#pageTitle');if(t)t.textContent=page.label+'：'+tab.label;
  renderNavShell(page,tab,seg);
  const hash=navHash(page.key,tab.key,seg?.key);
  if(!opts.fromHash&&location.hash!==hash)history[opts.replace?'replaceState':'pushState'](null,'',hash);
  try{(seg||tab).run(opts.sub);}catch(e){console.warn('render failed',e);}
}
function setView(name,subtab){
  if(NAV_PAGES.some(p=>p.key===name))return navGo(name,subtab);
  const r=resolveLegacy(name,subtab);
  if(!r)return navGo('today','step');
  navGo(r[0],r[1],r[2],{sub:r[3]});
}
function routeFromHash(replace=false){
  const r=parseNavHash(location.hash);
  if(!r){navGo('today','step',null,{fromHash:!location.hash||location.hash.includes('='),replace:true});return;}
  navGo(r[0],r[1],r[2],{sub:r[3],replace:true});
}
function renderTodayWaiting(){
  const root=$('#view-home');
  if(A.liveStatus!=='live'){root.innerHTML='<div class="td"><div class="td-card nav5-empty"><b>登入後才看得到你的作品</b><button class="td-btn td-btn-primary" data-auth>用信箱登入</button></div></div>';return;}
  if(!A.personalArtifacts){root.innerHTML='<div class="td"><p class="td-msg">正在讀取你的作品…</p></div>';A.getPersonalArtifacts().then(()=>{if(NAV_STATE.tab==='waiting'&&NAV_STATE.page==='today')renderTodayWaiting();});return;}
  const cur=A.personalArtifacts.current;
  const list=todayCandidates().filter(w=>!cur||w.id!==cur.id);
  if(!cur&&list.length){root.innerHTML=todayChooseHtml(list);bindTodayPick();return;}
  root.innerHTML='<div class="td"><div class="nav5-list">'+(list.length?list.map(w=>'<article class="td-card nav5-row"><div><b>'+esc(w.title)+'</b><p>'+esc(w.objective||'')+'</p><small>目前先不做，會安全地等你。要換成這件，請先完成或暫停目前作品。</small></div><button class="td-btn td-btn-ghost" data-jump="projects">到作品頁看</button></article>').join(''):'<div class="td-card nav5-empty"><b>目前沒有等待中的作品</b><p>新的候選作品出現時會放在這裡。</p></div>')+'</div></div>';
}
function renderTodayProgress(){
  const root=$('#view-home');
  const items=home().recent_real_progress?.items||[];
  if(A.liveStatus!=='live'){root.innerHTML='<div class="td"><div class="td-card nav5-empty"><b>登入後才看得到你的進展</b><button class="td-btn td-btn-primary" data-auth>用信箱登入</button></div></div>';return;}
  root.innerHTML='<div class="td"><div class="nav5-list">'+(items.length?items.map(p=>'<article class="td-card nav5-row"><div><small>'+esc(p.occurred_at?new Date(p.occurred_at).toLocaleDateString('zh-TW'):'')+'</small><b>'+esc(p.title||'真實進展')+'</b><p>'+esc(p.summary||'')+'</p></div></article>').join(''):'<div class="td-card nav5-empty"><b>目前還沒有可追溯的真實進展</b><p>交出第一個證據後，這裡就會出現紀錄。</p></div>')+'</div></div>';
}
async function renderSystemPending(){
  const root=$('#view-ceo');
  if(A.liveStatus!=='live'){root.innerHTML='<div class="surface"><b>登入後才看得到待處理事項</b><p>系統資料只給本人看。</p><button class="primary-btn" data-auth>登入</button></div>';return;}
  root.innerHTML='<div class="empty">正在讀取待處理事項…</div>';
  try{
    SYSTEM=await A.getSystemCockpit();
    const items=pendingItemsFromPackages(SYSTEM?.work_queue?.packages||[]);
    updateGearBadge(items.length);
    root.innerHTML=pendingBlockHtml(items);
  }catch(e){root.innerHTML='<div class="empty">待處理事項讀取失敗：'+esc(e.message||e)+'</div>';}
}
let GEAR_COUNT=0;
function updateGearBadge(n){
  GEAR_COUNT=n||0;
  const b=$('#gearBadge'),v=$('#avBadge'),txt=n>99?'99+':String(n||'');
  if(b){b.hidden=!n;b.textContent=txt;}
  if(v){v.hidden=!n;v.textContent=txt;}
  $('#gearBtn')?.setAttribute('aria-label','系統'+(n?'（'+n+' 項失敗待重試）':''));
  const mc=$('#gearMenu [data-gear-tab="pending"] .mcount');if(mc){mc.hidden=!n;mc.textContent=txt;}
}
/* W1b 定案：系統數字只算「失敗待重試」的提問／工作 */
function failedRetryCount(snap){return (Array.isArray(snap?.jobs)?snap.jobs:[]).filter(j=>j&&j.status==='failed').length;}
async function loadGearBadge(){
  if(A.liveStatus!=='live')return;
  try{const s=await A.getMyJobs();updateGearBadge(failedRetryCount(s));}catch{}
}
function accountEmail(){try{return localStorage.getItem('growth-brain-auth-email-v1')||''}catch{return ''}}
function renderAccount(){
  const root=$('#view-ceo');if(!root)return;
  const live=A.liveStatus==='live',mail=accountEmail();
  root.innerHTML='<div class="w1p w1p-account"><section class="head"><span class="eyebrow">帳號與設定</span><h1>帳號與設定</h1><p>你的帳號、登入方式與登出。</p></section><div class="bento acct-bento">'+
   '<article class="card tile"><div class="tile-head"><h3 class="tile-title">帳號</h3></div><div class="menu-who"><span class="avatar" aria-hidden="true">劉</span><div><b>劉</b><small>'+esc(mail||(live?'已登入':'尚未登入'))+'</small></div></div>'+
   '<dl class="facts"><div><dt>登入方式</dt><dd>信箱登入連結（不用密碼）</dd></div><div><dt>使用模式</dt><dd>個人私人模式</dd></div></dl></article>'+
   '<article class="card tile"><div class="tile-head"><h3 class="tile-title">系統與 AI 團隊</h3></div><p class="muted small">失敗待重試、排隊中的工作，和幫你做事的 AI 角色。</p><div class="actions"><a class="btn btn-ghost btn-sm" href="#/system/pending">系統待處理</a><a class="btn btn-ghost btn-sm" href="#/system/team/working">AI 團隊</a></div></article>'+
   '<article class="card tile"><div class="tile-head"><h3 class="tile-title">登出</h3></div><p class="muted small">登出後資料都會保留，下次用信箱登入連結回來。</p><div class="actions">'+(live?'<button class="btn btn-ghost" type="button" data-signout="local">登出這台裝置</button>':'<button class="btn btn-primary" type="button" data-auth>用信箱登入</button>')+'</div></article>'+
   '</div></div>';
  root.querySelector('[data-signout]')?.addEventListener('click',async()=>{await A.signOut();location.hash='#/today/step';location.reload();});
}
function bindGear(){
  const btn=$('#gearBtn'),menu=$('#gearMenu'),det=$('#meMenu');if(!menu)return;
  const sys=NAV_PAGES.find(p=>p.key==='system');
  const ic=n=>'<svg class="i i-sm" aria-hidden="true"><use href="assets/w1b/icons.svg#'+n+'"/></svg>';
  const tabIcon={account:'user',pending:'settings',team:'sparkles',status:'layout-grid'};
  const paint=()=>{menu.innerHTML='<div class="menu-who"><span class="avatar" aria-hidden="true">劉</span><div><b>劉</b><small>'+esc(accountEmail()||'個人帳號')+'</small></div></div>'+
    sys.tabs.map(t=>'<a role="menuitem" href="'+navHash('system',t.key)+'" data-gear-tab="'+t.key+'">'+ic(tabIcon[t.key]||'settings')+(t.key==='pending'?'系統・待處理<span class="mcount" hidden></span>':esc(t.label))+'</a>').join('')+
    '<hr><button type="button" role="menuitem" data-gear-signout>'+ic('log-out')+(A.liveStatus==='live'?'登出':'登入')+'</button>';updateGearBadge(GEAR_COUNT);};paint();det?.addEventListener('toggle',()=>{if(det.open)paint();});
  const close=()=>{if(det)det.open=false;};
  if(btn)btn.onclick=e=>{e.preventDefault();close();navGo('system','pending');};
  menu.onclick=async e=>{
    if(e.target.closest('[data-gear-signout]')){e.preventDefault();close();if(A.liveStatus==='live'){await A.signOut();location.reload();}else loginModal();return;}
    const a=e.target.closest('[data-gear-tab]');if(!a)return;e.preventDefault();close();navGo('system',a.dataset.gearTab);};
  document.addEventListener('click',e=>{if(det?.open&&!e.target.closest('#meMenu'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
}
function bindNav5(){
  $$('.nav-item[data-page]').forEach(b=>b.onclick=()=>navGo(b.dataset.page));
  $('#pageShell')?.addEventListener('click',e=>{
    const t=e.target.closest('[data-nav-tab]'),s=e.target.closest('[data-nav-seg]');
    if(t){e.preventDefault();navGo(NAV_STATE.page,t.dataset.navTab);}
    else if(s){e.preventDefault();navGo(NAV_STATE.page,NAV_STATE.tab,s.dataset.navSeg);}
  });
  window.addEventListener('popstate',()=>routeFromHash());
  window.addEventListener('hashchange',()=>routeFromHash());
  bindGear();
}

function detectSessionLifecycleProbe(){
  const session=window.GROWTH_BRAIN_AUTH?.readSession?.();
  if(!session) return null;
  const nav=performance.getEntriesByType?.('navigation')?.[0]?.type||'navigate';
  const tabKey='growth-brain-auth-tab-seen-v1';
  const everKey='growth-brain-auth-ever-seen-v1';
  const tabSeen=sessionStorage.getItem(tabKey)==='1';
  const everSeen=localStorage.getItem(everKey)==='1';
  let kind=null;
  if(nav==='reload') kind='reload_session';
  else if(everSeen && !tabSeen) kind='reopen_session';
  sessionStorage.setItem(tabKey,'1');
  localStorage.setItem(everKey,'1');
  return kind;
}

async function sendSessionLifecycleProbe(){
  const kind=detectSessionLifecycleProbe();
  if(!kind || A.liveStatus!=='live') return;
  try{await A.probeSession(kind);}catch{}
}

function authBar(){
  $('#authBox')?.remove();const box=document.createElement('div');box.id='authBox';box.className='auth-box';box.innerHTML=A.liveStatus==='live'?'<span class="pill success">正式資料已連線</span><button class="ghost-btn small" id="signOut">登出</button>':'<button class="ghost-btn small" id="openLogin">登入</button>';($('.nav-tools')||$('.top-actions'))?.prepend(box);$('#openLogin')?.addEventListener('click',loginModal);$('#signOut')?.addEventListener('click',async()=>{await A.signOut();location.reload()});
}
function loginModal(){
  let m=$('#loginModal');
  if(!m){
    m=document.createElement('div');
    m.id='loginModal';
    m.className='modal-backdrop';
    m.innerHTML='<div class="modal-card"><button class="modal-close" id="closeLogin">×</button><span class="kicker">用信箱登入・不用密碼</span><h2>登入 第二大腦</h2><p>輸入信箱，我們寄一封登入信給你；點信裡的連結就登入了，不用記密碼。登入會保存在開啟它的瀏覽器。目前是個人私人模式，請用已開通的信箱。</p><input id="loginEmail" type="email" placeholder="your@email.com"><button class="primary-btn" id="sendLogin">寄登入連結</button><div id="loginMsg" class="muted"></div><div class="evidence-box"><b>需要在這個瀏覽器登入？</b><span>在最新、尚未點開的登入信，對登入按鈕長按或按右鍵，選「複製連結網址」，貼到下方。不要複製登入後的網址列；已點過的登入連結需重新寄送。</span></div><input id="loginLink" type="text" autocomplete="off" aria-label="登入連結" placeholder="登入信中按鈕的原始連結（尚未點開）"><button class="ghost-btn" id="verifyLoginLink">驗證原始登入連結</button><div id="verifyLoginMsg" class="muted"></div></div>';
    document.body.appendChild(m);
    $('#closeLogin').onclick=()=>m.classList.remove('show');
    $('#sendLogin').onclick=async()=>{
      const msg=$('#loginMsg');
      try{msg.textContent='寄送中…';await A.requestMagicLink($('#loginEmail').value);msg.innerHTML='<img class="login-sent-art" src="assets/w1b/mail-sent.webp" alt="" width="160" height="120">已寄出，去信箱點最新那封登入信的連結。若要貼到此處驗證，請先複製信中按鈕的連結網址。';}
      catch(e){msg.textContent=e.message||'失敗';}
    };
    $('#verifyLoginLink').onclick=async()=>{
      const msg=$('#verifyLoginMsg');
      try{
        msg.textContent='驗證中…';
        await A.consumeMagicLinkUrl($('#loginLink').value);
        msg.textContent='登入成功，正在載入正式資料…';
        setTimeout(()=>location.reload(),250);
      }catch(e){msg.textContent=e.message||'驗證失敗';}
    };
  }
  m.classList.add('show');
}

async function init(){
  const paintSideWorks=()=>{const el=$('#sideWorks');if(!el||A.liveStatus!=='live'||!window.GROWTH_BRAIN_W1P)return;A.getPersonalArtifacts().then(pa=>{el.innerHTML=window.GROWTH_BRAIN_W1P.sideWorksHtml(pa);}).catch(()=>{});};setTimeout(paintSideWorks,2000);window.addEventListener('hashchange',()=>setTimeout(paintSideWorks,800));
  setInterval(()=>window.GROWTH_BRAIN_MYJOBS?.refreshBadge(A),60000);setTimeout(()=>window.GROWTH_BRAIN_MYJOBS?.refreshBadge(A),2500);
  window.addEventListener('growth:work-skills-saved',()=>{const v=document.querySelector('#view-projects');if(v&&v.offsetParent)renderProjectsIA(v.querySelector('#projectIaPane')?'planned':'current');});
  try{
    await A.initialize();
    D=await A.getSnapshot();
    renderHome();
    await renderProjectsIA();
    await renderLearn();
    await renderSynapse();
    renderCapabilities();
    renderResearch();
    renderHistory();
    authBar();
    await sendSessionLifecycleProbe();
    bindNav5();
    routeFromHash(true);
    loadGearBadge();
    document.addEventListener('click',e=>{
      const f=e.target.closest('[data-funnel-kind]');
      if(f)window.GROWTH_BRAIN_LAB.openFunnel({kind:f.dataset.funnelKind,id:f.dataset.funnelId||null,goal:f.dataset.funnelGoal||''});
      const j=e.target.closest('[data-jump]');
      if(j)setView(j.dataset.jump);
      if(e.target.closest('[data-auth]'))loginModal();
    });
    document.addEventListener('growth-lab:navigate',e=>setView(e.detail.view,e.detail.subtab));
    document.addEventListener('growth-lab:system-research',()=>setView('research','growthbrain'));
    $('#captureBtn').onclick=()=>setView('inbox');
    $('#refreshBtn').onclick=()=>location.reload();
  }catch(e){$('.main').innerHTML=`<div class="empty">第二大腦 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
