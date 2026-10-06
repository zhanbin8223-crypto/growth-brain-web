const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const A=window.GROWTH_BRAIN_ADAPTER;
let D=null;
let SYSTEM=null;

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

function renderHome(){
  const H=home(),dir=H.primary_direction||{},action=H.primary_action||{},learn=H.learning_support||{},nodes=(H.synapse_highlights?.nodes||[]).slice(0,4),progress=(H.recent_real_progress?.items||[]).slice(0,6),sys=H.system_health||{};
  const currentArtifact=H.artifact_summary?.current||null;
  const artifactProgress=currentArtifact?.progress_summary||null;
  const currentSkills=Array.isArray(currentArtifact?.skills)?currentArtifact.skills:[];
  const skillPreview=currentSkills.slice(0,3);
  const hour=new Date().getHours();
  const greeting=hour<11?'早安':hour<17?'午安':'晚安';
  const confirmed=Number(artifactProgress?.confirmed||0);
  const total=Number(artifactProgress?.total||0);
  const progressPct=total?Math.max(0,Math.min(100,Math.round(confirmed/total*100))):0;
  const currentTitle=currentArtifact?.title||dir.goal||dir.title||'尚未選定目前作品';
  const currentSummary=currentArtifact?.objective||dir.goal||'登入後會顯示目前作品、完成條件與下一步。';
  const currentPhase=currentArtifact?.status==='current'?'MVP 驗證階段':currentArtifact?.status?statusText(currentArtifact.status):'等待同步';

  let cta='';
  if(A.liveStatus==='signed_out') cta='<button class="primary-btn today-primary-action" data-auth>登入同步我的資料</button>';
  else if(action.status==='needs_personal_outcome_route') cta='<button class="primary-btn today-primary-action" data-jump="projects">建立候選主線</button>';
  else if(action.status==='personal_outcome_candidate_available') cta='<button class="primary-btn today-primary-action" data-jump="projects">確認候選主線</button>';
  else if(action.status==='personal_artifact_candidate_available') cta='<button class="primary-btn today-primary-action" data-jump="projects">確認並開始這件作品</button>';
  else if(action.status==='personal_artifact_current'||action.status==='personal_artifact_current_step') cta='<button class="primary-btn today-primary-action" data-jump="projects">開始執行 →</button>';
  else if(action.status==='personal_artifact_ready_to_complete') cta='<button class="primary-btn today-primary-action" data-jump="projects">完成這件作品</button>';
  else if(action.status==='personal_artifact_replanning') cta='<button class="primary-btn today-primary-action" data-jump="projects">查看重新規劃進度</button>';
  else cta='<button class="primary-btn today-primary-action" data-jump="projects">查看我的主線</button>';

  const skillCards=skillPreview.length
    ?skillPreview.map((s,i)=>'<button class="today-skill-mini" data-jump="capabilities"><span class="today-skill-icon">'+['▣','◇','✦'][i%3]+'</span><b>'+esc(s.name_zh||s.name||human(s.skill_key||'能力'))+'</b><small>'+esc(String(s.evidence_state||'unknown').toLowerCase()==='unknown'?'待驗證':statusText(s.evidence_state))+'</small></button>').join('')
    :'<div class="today-empty-mini"><span class="today-skill-icon">◇</span><b>尚未連結能力</b><small>登入後依目前作品顯示</small></div>';

  const evidenceItems=[];
  if(action.success_evidence) evidenceItems.push(action.success_evidence);
  if(total) evidenceItems.push('完成條件已有 '+confirmed+' / '+total+' 項留下正式證據');
  if(progress.length) evidenceItems.push('最近已有 '+progress.length+' 筆可追溯進展');
  if(!evidenceItems.length) evidenceItems.push('登入後顯示這一步需要留下的完成證據');

  const systemState=sys.current_blocked?'有阻塞需要處理':sys.build_in_progress?'系統持續建置中':'系統穩定';

  $('#view-home').innerHTML=`
    <section class="today-hero">
      <div class="today-hero-copy">
        <span class="today-overline">Growth Brain · 今天</span>
        <h2>${esc(greeting)}，<br>今天我們繼續推進主線 <span aria-hidden="true">💡</span></h2>
        <p>把輸入、研究、能力、AI 員工、作品與證據串起來；今天只推進最值得做的那一步。</p>
      </div>
      <div class="today-hero-art" aria-hidden="true">
        <img src="assets/ui/home-hero-workspace.webp" alt="">
      </div>
    </section>

    <section class="today-core-grid" aria-label="今天的主線與下一步">
      <article class="today-mainline-card">
        <header class="today-card-head">
          <div><span class="today-card-icon">▣</span><b>目前主線</b>${currentArtifact?'<span class="today-version-pill">B+'+esc(currentArtifact.sequence_no||'')+'</span>':''}</div>
          <button class="today-arrow" data-jump="projects" aria-label="打開目前作品">→</button>
        </header>
        <div class="today-mainline-body">
          <img class="today-project-thumb" src="assets/ui/home-project-cover.webp" alt="" aria-hidden="true">
          <div class="today-mainline-copy">
            <h3>${esc(currentTitle)}</h3>
            <p>${esc(currentSummary)}</p>
            <span>目前階段：${esc(currentPhase)}</span>
          </div>
        </div>
        <div class="today-progress-row">
          <div class="today-progress-track"><i style="width:${progressPct}%"></i></div>
          <strong>${total?progressPct+'%':'待同步'}</strong>
        </div>
      </article>

      <article class="today-next-card">
        <header class="today-card-head"><div><span class="today-card-icon accent">✓</span><b>今天唯一下一步</b></div></header>
        <div class="today-next-content">
          <span class="today-check-orb">✓</span>
          <div>
            <h3>${esc(action.title||'先選一個真實下一步')}</h3>
            <p>${esc(action.why||'目前還沒有足夠證據替你自動選唯一主線。')}</p>
          </div>
        </div>
        <div class="today-proof-hint">
          <b>為什麼現在先做？</b>
          <span>${esc(action.success_evidence||'完成後要留下可追溯的作品或行動證據。')}</span>
        </div>
        <div class="today-next-actions">${cta}${A.liveStatus==='live'&&action.title?`<button class="ghost-btn" data-funnel-kind="${currentArtifact?'current_artifact':'user_event'}" data-funnel-id="${esc(currentArtifact?.id||'')}" data-funnel-goal="${esc(currentArtifact?.next_evidence_item?.criterion_text||action.title)}">拆解這一步</button>`:''}</div>
      </article>
    </section>

    <section class="today-support-cards" aria-label="今天的必要關聯">
      <article class="today-support-card">
        <header><span>♧</span><b>相關角色</b></header>
        <div class="today-role-row">
          <div><span class="today-role-avatar">產</span><b>產品規劃</b></div>
          <div><span class="today-role-avatar">工</span><b>執行／工程</b></div>
          <div><span class="today-role-avatar">驗</span><b>驗收</b></div>
        </div>
        <small>角色只代表系統可用分工；正式任務關聯請到「團隊」查看。</small>
      </article>

      <article class="today-support-card">
        <header><span>✎</span><b>相關能力</b></header>
        <div class="today-skill-mini-grid">${skillCards}</div>
      </article>

      <article class="today-support-card">
        <header><span>✣</span><b>預期證據</b></header>
        <div class="today-evidence-list">${evidenceItems.slice(0,3).map((item,i)=>'<div><span>'+['✓','○','○'][i]+'</span><p>'+esc(item)+'</p></div>').join('')}</div>
        <small>${esc(systemState)} · ${esc(learn.primary_card?.next_action||'需要時再補學習，不先展開支線。')}</small>
      </article>
    </section>

    <details class="surface today-secondary">
      <summary><b>最近進展與其他資訊</b><span class="muted">需要時再展開</span></summary>
      <div class="today-secondary-body">
        ${modeStrip()}
        <section class="today-progress">
          <div class="section-head"><div><h2>最近真實進展</h2><p>只記錄你真的完成、確認或留下證據的事情；系統自己建置不算。</p></div></div>
          <div class="today-progress-list">${progress.length?progress.map(p=>`<article class="today-progress-item"><div class="row-between"><b>${esc(p.title||'真實進展')}</b>${pill(p.evidence_level||'confirmed')}</div><p>${esc(p.summary||'')}</p><small class="muted">${esc(p.occurred_at?new Date(p.occurred_at).toLocaleString('zh-TW'):'時間未記錄')} · ${esc(p.source_type||'未記錄')}</small></article>`).join(''):'<div class="empty">目前還沒有可追溯的真實進展。</div>'}</div>
        </section>
        <div class="today-support-grid">
          <div><b>學習</b><p>${esc(learn.primary_card?.description||'目前沒有需要先處理的學習。')}</p><small class="muted">${esc(learn.primary_card?.next_action||'只有卡到知識缺口時才需要先學。')}</small></div>
          <div><b>知識連結</b><p>${nodes.length?nodes.map(n=>esc(human(n.label||n.k))).join('、'):'目前沒有需要優先查看的知識節點。'}</p><button class="ghost-btn small" data-jump="synapse">查看知識連結</button></div>
          <div><b>系統</b><p>${esc(systemState)}</p><button class="ghost-btn small" data-jump="ceo">查看系統</button></div>
        </div>
      </div>
    </details>`;
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
    if(!skills.length) return '<div class="empty">這件作品還沒有技能驗證目標。</div>';
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
        <span>${aiText?esc(aiText):aiError?esc(aiError):ai?'你的 Mac 上 AI 執行器處理完成後，GPT 的整理結果會顯示在這裡。':'尚未建立 AI 解釋任務；你仍可先自己閱讀與作答。'}</span>
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
  const tabs=[['cells','能力細胞'],['playbooks','作戰手冊'],['skills','我的技能'],['relations','知識關係']];
  root.innerHTML=iaTabs(tabs,active)+'<div id="capabilityPane" class="tab-pane"><div class="empty">正在讀取能力庫…</div></div>';
  const pane=$('#capabilityPane');
  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderCapabilities(b.dataset.iaTab));

  if(active==='relations'){
    pane.innerHTML='<div class="section-head"><div><h2>知識關係</h2><p>來源、概念與作品怎麼連起來；關係本身不代表已學會。</p></div></div>'+
      '<article class="surface"><b>查看正式知識關係</b><p>知識圖仍使用正式資料，不會把能力庫參考內容當成個人掌握。</p><button class="ghost-btn" data-jump="synapse">開啟知識關係</button></article>';
    return;
  }
  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="empty">登入後才會顯示正式能力庫與個人技能證據。</div>';
    return;
  }

  try{
    const library=await A.getCapabilities({force:true});
    const cells=Array.isArray(library?.cells)?library.cells:[];
    const playbooks=Array.isArray(library?.playbooks)?library.playbooks:[];
    const personalSkills=Array.isArray(library?.personal_skills)?library.personal_skills:[];

    const nameOf=x=>x?.title||x?.name||human(x?.key||'能力');
    const resourceHtml=x=>{
      const rs=Array.isArray(x?.resources)?x.resources:[];
      const keys=Array.isArray(x?.resource_keys)?x.resource_keys:[];
      const labels=rs.length?rs.map(r=>r.name||r.key):keys;
      return labels.length?'<div class="cap-detail"><b>可用資源</b><span>'+labels.map(esc).join('、')+'</span></div>':'';
    };
    const listHtml=(title,items,ordered=false)=>Array.isArray(items)&&items.length
      ?'<div class="cap-detail"><b>'+esc(title)+'</b><'+(ordered?'ol':'ul')+'>'+items.map(s=>'<li>'+esc(typeof s==='string'?s:(s.title||s.step||String(s)))+'</li>').join('')+'</'+(ordered?'ol':'ul')+'></div>'
      :'';
    const detailHtml=x=>
      (x.when_to_use?'<div class="cap-detail"><b>什麼時候用</b><span>'+esc(x.when_to_use)+'</span></div>':'')+
      listHtml('快速使用',x.quick_use,true)+
      listHtml('常見失敗',x.failure_points)+
      listHtml('成功證據',x.required_evidence)+
      resourceHtml(x)+
      (x.practice?'<div class="cap-detail"><b>實作</b><span>'+esc(x.practice)+'</span></div>':'');
    const referenceState=x=>x.personal_mastery?'已有個人證據':'參考方法';

    if(active==='cells'){
      const cellCard=x=>'<button type="button" class="capability-cell" data-capability-key="'+esc(x.key||'')+'">'+
        '<span class="capability-node"></span><small>'+esc(referenceState(x))+'</small><b>'+esc(nameOf(x))+'</b>'+
        '<p>'+esc(x.principle||x.summary||x.when_to_use||'需要時直接拿來用，再由真實作品決定是否掌握。')+'</p></button>';
      pane.innerHTML='<div class="page-intro"><span class="kicker">能力地圖</span><h2>能力細胞</h2><p>資料庫目前有 '+cells.length+' 個可重用方法。Hover 看焦點、點擊看使用方式；存在不代表你已經學會。</p></div>'+
        '<div class="capability-layout"><div class="capability-map">'+
          (cells.length?cells.map(cellCard).join(''):'<div class="empty">目前沒有能力細胞資料。</div>')+
        '</div><aside class="capability-detail" id="capabilityDetail"><span class="kicker">能力詳細</span><h3>選一個能力細胞</h3><p>這裡會顯示怎麼用、常見失敗與要留下什麼證據。</p><small class="muted">能力細胞是參考資源，不會自動變成你的個人能力。</small></aside></div>';

      const detail=$('#capabilityDetail',pane);
      const cards=$$('.capability-cell',pane);
      const focus=key=>cards.forEach(c=>{
        c.classList.toggle('is-focus',c.dataset.capabilityKey===key);
        c.classList.toggle('is-dim',c.dataset.capabilityKey!==key);
      });
      const clear=()=>cards.forEach(c=>c.classList.remove('is-focus','is-dim'));
      cards.forEach(c=>{
        c.addEventListener('mouseenter',()=>focus(c.dataset.capabilityKey));
        c.addEventListener('mouseleave',clear);
        c.addEventListener('focus',()=>focus(c.dataset.capabilityKey));
        c.addEventListener('blur',clear);
        c.addEventListener('click',()=>{
          const x=cells.find(v=>String(v.key||'')===c.dataset.capabilityKey);
          if(!x)return;
          detail.innerHTML='<span class="kicker">'+esc(referenceState(x))+'</span><h3>'+esc(nameOf(x))+'</h3>'+
            '<p>'+esc(x.principle||x.summary||'這是一個可重用的方法單元。')+'</p>'+
            detailHtml(x)+
            '<div class="cap-detail"><b>作品／員工／研究關聯</b><span>只有資料庫已有正式映射時才顯示；目前不使用推測補關聯。</span></div>';
        });
      });
    }else if(active==='playbooks'){
      const card=x=>'<details class="surface playbook-card"><summary><span><small>'+esc(x.when_to_use||'需要時使用')+'</small><b>'+esc(nameOf(x))+'</b></span><span class="pill">'+esc(referenceState(x))+'</span></summary>'+
        '<p>'+esc(x.principle||x.summary||'把多個能力細胞組成可直接執行的方法。')+'</p>'+detailHtml(x)+'</details>';
      pane.innerHTML='<div class="page-intro"><span class="kicker">組合方法</span><h2>作戰手冊</h2><p>資料庫目前有 '+playbooks.length+' 本。先照步驟做，實際結果再決定要不要升成正式方法。</p></div>'+
        (playbooks.length?'<div class="playbook-grid">'+playbooks.map(card).join('')+'</div>':'<div class="empty">目前沒有作戰手冊資料。</div>');
    }else{
      const stateLabel=s=>({
        unknown:'尚未驗證',exposure:'接觸過',acknowledged:'知道是什麼',understood:'已理解',
        can_explain:'能解釋',apply_with_help:'可在協助下應用',apply_independently:'可獨立應用',
        retained:'可保留使用',real_project:'真實作品驗證',commercialized:'已商業化'
      }[String(s||'').toLowerCase()]||statusText(s||'unknown'));
      pane.innerHTML='<div class="page-intro"><span class="kicker">證據導向</span><h2>我的技能</h2><p>這裡跟參考能力庫分開；只有個人作品、回答或操作證據才能改變狀態。</p></div>'+
        (personalSkills.length?'<div class="personal-skill-list">'+personalSkills.map(s=>'<article class="personal-skill-item"><div><small>'+esc(s.artifact_title||'尚無關聯作品')+'</small><b>'+esc(s.name_zh||s.name||human(s.skill_key||s.key))+'</b><p>'+esc(s.why||s.summary||'')+'</p></div><span class="pill '+(s.evidence_state&&s.evidence_state!=='unknown'?'success':'')+'">'+esc(stateLabel(s.evidence_state||s.status))+'</span></article>').join('')+'</div>':'<div class="empty">目前還沒有可展示的個人技能證據。</div>');
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
  const tabs=[['system','版本檔案館'],['personal','我的歷程'],['skills','能力變化'],['research','研究歷程']];
  root.innerHTML=iaTabs(tabs,active)+'<div id="historyPane" class="tab-pane"><div class="empty">正在讀取正式歷程…</div></div>';
  const pane=$('#historyPane');

  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="history-signed-out"><div class="page-intro"><span class="kicker">成長檔案館</span><h2>登入後看見 Growth Brain 怎麼長出來</h2><p>歷程不使用快取或示範資料補空白；登入後才顯示你的正式紀錄與系統更新。</p></div><button class="primary-btn" data-auth>登入查看歷程</button></div>';
  }else{
    try{
      const H=await A.getHistory({force:true});
      const groups={
        personal:Array.isArray(H?.personal)?H.personal:[],
        skills:Array.isArray(H?.skills)?H.skills:[],
        research:Array.isArray(H?.research)?H.research:[],
        system:Array.isArray(H?.system)?H.system:[]
      };
      const eventHtml=e=>'<article class="timeline-item">'+
        '<time>'+esc(e.occurred_at?new Date(e.occurred_at).toLocaleString('zh-TW'):'時間未記錄')+'</time>'+
        '<b>'+esc(e.title||'歷程事件')+'</b>'+
        (e.summary?'<p>'+esc(e.summary)+'</p>':'')+
        '<small class="muted">'+esc(e.source_type||'正式資料')+
        (e.status?' · '+esc(statusText(e.status)):'')+
        (e.evidence_level?' · 證據：'+esc(statusText(e.evidence_level)):'')+
        '</small></article>';

      if(active==='system'){
        const list=groups.system;
        const stages=[
          {version:'V3',title:'互動式 Growth Brain 網站',state:'now',summary:'把今天、作品、能力、研究、AI 團隊與歷程做成可以探索、彼此有關聯的個人第二大腦。',points:['六區一致 Visual DNA','角色／作品／能力關聯','作品入口與詳細頁分層']},
          {version:'V2',title:'Worker / 事件漏斗',state:'past',summary:'把任務送進固定 GPT 對話、回寫結果與證據，並讓研究候選不污染正式真相。',points:['Worker 閉環','事件漏斗','候選與正式資料分離']},
          {version:'V1.5',title:'作品、能力、員工',state:'past',summary:'從只有資料，走到可以看作品、能力證據與 AI 員工分工。',points:['作品序列','能力證據','AI 員工／角色']},
          {version:'V1',title:'資料庫與基本網站',state:'past',summary:'建立 Supabase 與基本網站，讓資料有正式來源，而不是只存在聊天裡。',points:['正式資料來源','基本網站','資料與聊天記憶分離']}
        ];
        const stageHtml=stages.map((s,i)=>'<article class="version-stage '+esc(s.state)+'">'+
          '<div class="version-marker"><span>'+esc(s.version)+'</span></div>'+
          '<div class="version-stage-copy">'+
            '<div class="version-stage-head"><div><small>'+(s.state==='now'?'目前階段':'較早階段')+'</small><h3>'+esc(s.title)+'</h3></div>'+(s.state==='now'?'<span class="pill warn">進行中</span>':'')+'</div>'+
            '<p>'+esc(s.summary)+'</p>'+
            '<div class="version-points">'+s.points.map(p=>'<span>'+esc(p)+'</span>').join('')+'</div>'+
          '</div>'+
        '</article>').join('');
        pane.innerHTML='<div class="page-intro history-intro"><span class="kicker">成長檔案館</span><h2>不是 Git log，而是看第二大腦怎麼一階段一階段長出來</h2><p>版本區只描述產品階段；下方「正式更新紀錄」才直接讀取資料庫事件。兩者分開，避免把敘事當成證據。</p></div>'+
          '<div class="version-archive">'+stageHtml+'</div>'+
          '<section class="history-evidence-log">'+
            '<div class="section-head"><div><h2>正式更新紀錄</h2><p>只列資料庫已保存的系統執行／部署紀錄；沒有的歷史不補造。</p></div><span>'+list.length+' 筆</span></div>'+
            (list.length?'<div class="timeline history-archive">'+list.slice(0,30).map(eventHtml).join('')+'</div>':'<div class="empty">目前沒有可讀取的正式系統更新紀錄。</div>')+
          '</section>';
      }else{
        const meta={
          personal:['真實成長','我的歷程','只收真實選擇、完成與有證據的個人事件。'],
          skills:['能力證據','能力變化','只顯示真的讓能力狀態改變的證據，不把 AI 建議當成學會。'],
          research:['探索紀錄','研究歷程','候選、試驗、採用與拒絕保留自己的生命週期，不直接升級能力。']
        };
        const list=groups[active]||[];
        const [kicker,title,desc]=meta[active]||meta.personal;
        pane.innerHTML='<div class="page-intro"><span class="kicker">'+kicker+'</span><h2>'+title+'</h2><p>'+desc+'</p></div>'+
          (list.length?'<div class="timeline history-archive">'+list.slice(0,40).map(eventHtml).join('')+'</div>':
          '<div class="timeline"><article class="timeline-item"><time>目前</time><b>還沒有符合條件的正式紀錄</b><p>這裡不會用目前狀態或示範資料補成假的歷史。</p></article></div>');
      }
    }catch(e){
      pane.innerHTML='<div class="empty">歷程資料載入失敗：'+esc(e.message||e)+'</div>';
    }
  }
  $$('[data-ia-tab]',root).forEach(b=>b.onclick=()=>renderHistory(b.dataset.iaTab));
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

  root.innerHTML=`
    <div class="section-head"><div><h2>系統建置與 AI 團隊</h2><p>這裡只看第二大腦本身怎麼運作、誰在做什麼、哪裡卡住；不會混進你的個人成長成果。</p></div>${pill(cur.status||'current')}</div>

    <article class="surface">
      <span class="kicker">目前系統主線</span>
      <h2 style="margin:8px 0">${esc(cur.title||'正在整理最新系統狀態')}</h2>
      <p>${esc(cur.objective||latest.reason||'')}</p>
      ${latest.next_action?.action?`<div class="evidence-box"><b>下一個系統動作</b><span>${esc(latest.next_action.action)}</span></div>`:''}
    </article>

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

async function renderProjectsIA(active='gateway',notice=''){
  const root=$('#view-projects');
  if(!root)return;
  const tabs=[['gateway','作品入口'],['path','作品路徑'],['done','已完成']];

  if(active==='current'){
    await renderProjects(notice);
    root.insertAdjacentHTML('afterbegin','<div class="project-detail-back"><button class="ghost-btn small" type="button" data-project-gateway>← 回作品入口</button><span>作品詳細</span></div>');
    $('[data-project-gateway]',root)?.addEventListener('click',()=>renderProjectsIA('gateway'));
    return;
  }else if(active==='gateway'){
    root.innerHTML=iaTabs(tabs,active)+'<div id="projectIaPane" class="tab-pane"><div class="empty">正在整理作品入口…</div></div>';
    const pane=$('#projectIaPane');
    if(A.liveStatus!=='live'){
      pane.innerHTML='<div class="empty">登入後才會顯示你已選定的作品路徑。</div>';
    }else{
      try{
        const [outcome,artifacts]=await Promise.all([A.getPersonalOutcome(),A.getPersonalArtifacts({force:true})]);
        const selected=outcome?.selected_route||null;
        const current=artifacts?.current||null;
        const cards=[];
        if(current){
          const p=current.progress_summary||{};
          const items=Array.isArray(current.evidence_progress)?current.evidence_progress:[];
          const total=p.total??items.length;
          const confirmed=p.confirmed??items.filter(x=>x.status==='confirmed').length;
          // 第一層是「選作品」而不是作品摘要。完整 title/objective 留在第二層。
          // 系列名優先由使用者已確認的專案背景推導；route revision 不能當作品版本。
          const projectGoal=selected?.source_evidence?.prior_confirmed_project_context?.goal||'';
          const goalFamilyMatch=String(projectGoal).match(/^建立\s*(.+?)(?:自動化|工作流|網站|導流|，|。)/);
          const fallbackFamily=selected?.title?String(selected.title).replace(/(?:系統|路線|方案)$/,'').trim():'作品';
          const family=(goalFamilyMatch?.[1]||fallbackFamily||'作品').trim();
          const workName=family.endsWith('工作')?family:family+'工作';
          const version=current.sequence_no?('V'+current.sequence_no):'版本未提供';
          const versionTitle=family+' '+version;
          const status=current.status==='current'?'進行中':statusText(current.status||'unknown');
          cards.push('<button class="project-gateway-card is-current" type="button" data-open-project-detail data-artifact-id="'+esc(current.id)+'" aria-label="進入作品：'+esc(workName)+'">'+
            '<span class="project-cover" role="img" aria-label="作品縮圖尚未提供"><svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><rect x="5" y="5" width="54" height="38" rx="4"/><circle cx="22" cy="18" r="4"/><path d="m8 38 16-13 11 9 9-7 12 11"/></svg></span>'+
            '<span class="project-gateway-copy">'+
              '<span class="project-family-row"><b class="project-name">'+esc(workName)+'</b><span class="project-goal-link">看作品目標</span></span>'+
              '<span class="project-version-kicker">系列＋版本</span>'+
              '<b class="project-version-title">'+esc(versionTitle)+'</b>'+
              '<span class="project-status">'+esc(status)+'</span>'+
              '<span class="project-progress">'+esc(confirmed)+' / '+esc(total)+' 個目標完成</span>'+
            '</span>'+
            '<span class="project-enter">進入作品 →</span></button>');
        }else if(selected){
          cards.push('<button class="project-gateway-card" type="button" data-open-project-detail>'+
            '<span class="project-cover" role="img" aria-label="作品縮圖尚未提供"><svg viewBox="0 0 64 48" aria-hidden="true" focusable="false"><rect x="5" y="5" width="54" height="38" rx="4"/><circle cx="22" cy="18" r="4"/><path d="m8 38 16-13 11 9 9-7 12 11"/></svg></span>'+
            '<span class="project-gateway-copy"><b class="project-name">'+esc(selected.title||'已選定作品路徑')+'</b><span class="project-status">等待第一件作品</span></span>'+
            '<span class="project-enter">查看路徑 →</span></button>');
        }
        pane.innerHTML='<div class="page-intro"><h2>選一件作品，繼續前進</h2><p>進入作品查看目標、步驟與證據。</p></div>'+
          '<div class="project-gateway-grid">'+(cards.length?cards.join(''):'<div class="empty">目前還沒有已選定的作品路徑。</div>')+'</div>';
        $('[data-open-project-detail]',pane)?.addEventListener('click',()=>renderProjectsIA('current'));
      }catch(e){
        pane.innerHTML='<div class="empty">作品入口載入失敗：'+esc(e.message||e)+'</div>';
      }
    }
  }else{
    root.innerHTML=iaTabs(tabs,active)+'<div id="projectIaPane" class="tab-pane"><div class="empty">正在整理作品資料…</div></div>';
    const pane=$('#projectIaPane');

    if(A.liveStatus!=='live'){
      pane.innerHTML='<div class="empty">登入後才會顯示正式作品資料。</div>';
    }else{
      try{
        const artifacts=await A.getPersonalArtifacts({force:true});
        const current=artifacts?.current||null;
        const history=Array.isArray(artifacts?.history)?artifacts.history:[];

        if(active==='path'){
          if(!current){
            pane.innerHTML='<div class="empty">目前沒有進行中的作品路徑。</div>';
          }else{
            const items=Array.isArray(current.evidence_progress)?current.evidence_progress:[];
            const nextNo=Number(current?.next_evidence_item?.criterion_no||0);
            const nodes=items.map(item=>{
              const n=Number(item.criterion_no||0);
              const state=item.status==='confirmed'?'done':n===nextNo?'current':'future';
              const mark=state==='done'?'✓':String(n||'○');
              const label=state==='done'?'已完成':state==='current'?'現在':'後續';
              return '<div class="path-node '+state+'"><div class="path-dot">'+esc(mark)+'</div><div class="path-copy"><small>'+esc(label)+'</small><b>'+esc(item.criterion_text||('第 '+n+' 步'))+'</b>'+(item.status==='confirmed'&&item.evidence?.text?'<p>'+esc(item.evidence.text)+'</p>':'')+'</div></div>';
            }).join('');
            pane.innerHTML='<div class="page-intro"><span class="kicker">作品旅程</span><h2>'+esc(current.title||'目前作品')+'</h2><p>只把正式完成證據畫成已完成節點；未來步驟仍只是後續路徑。</p></div>'+
              '<div class="journey-path">'+(nodes||'<div class="empty">這件作品還沒有正式路徑節點。</div>')+'</div>'+
              (current.next_evidence_item?'<div class="context-bar"><div><b>現在只做這一步</b><span>'+esc(current.next_evidence_item.criterion_text||'')+'</span></div><button class="primary-btn" data-project-current>回到目前作品</button></div>':'');
          }
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

  root.innerHTML=iaTabs(tabs,active)+'<div id="teamIaPane" class="tab-pane"><div class="empty">正在整理團隊工作室…</div></div>';
  const pane=$('#teamIaPane');

  if(A.liveStatus!=='live'){
    pane.innerHTML='<div class="team-signed-out"><div class="studio-empty-scene"><span>✦</span><b>登入後，AI 團隊才會回到工作室</b><p>這裡只顯示資料庫裡真的存在的角色、工作與關聯，不用示範資料冒充你的團隊。</p><button class="primary-btn" data-auth>登入查看團隊</button></div></div>';
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
      const artifacts=[
        artifactData?.current,
        artifactData?.candidate,
        ...(Array.isArray(artifactData?.history)?artifactData.history:[])
      ].filter(Boolean);
      const currentArtifact=artifactData?.current||null;
      const byKey=new Map([...roles,...planned].map(r=>[r.skill_key,r]));
      const mergeUsage=u=>({...byKey.get(u.skill_key),...u,skill_key:u.skill_key});
      const unique=list=>list.filter((r,i,a)=>r?.skill_key&&a.findIndex(x=>x?.skill_key===r.skill_key)===i);
      const allRoles=unique([...roles,...planned,...recent.map(mergeUsage)]);

      const packageText=p=>JSON.stringify(p||{});
      const relatedPackages=key=>packages.filter(p=>packageText(p).includes('"'+key+'"')).slice(0,6);
      const relatedRoles=key=>{
        const ps=relatedPackages(key);
        return allRoles.filter(r=>r.skill_key!==key&&ps.some(p=>packageText(p).includes('"'+r.skill_key+'"'))).slice(0,6);
      };
      const relatedArtifacts=key=>{
        const ps=relatedPackages(key);
        if(!ps.length)return [];
        return artifacts.filter(a=>a?.id&&ps.some(p=>packageText(p).includes('"'+a.id+'"'))).slice(0,4);
      };
      const roleTools=r=>(Array.isArray(r.runtime_skill_uris)?r.runtime_skill_uris:[])
        .map(x=>String(x).split('/').pop()).filter(Boolean);
      const roleCapability=r=>r.category?human(r.category):'尚未標記';
      const roleState=r=>{
        const catalog=String(r.catalog_state||'').toLowerCase();
        const status=String(r.status||'').toLowerCase();
        if(catalog==='trial'||status==='candidate')return {text:'試用中',cls:'trial'};
        if(catalog==='planned'||r.availability==='planned')return {text:'候選',cls:'planned'};
        if(catalog==='runtime'||['active','available','installed','builtin'].includes(status)||['builtin','installed'].includes(r.availability))return {text:'可調用',cls:'ready'};
        return {text:'待驗證',cls:'unknown'};
      };
      const roleCard=r=>{
        const name=teamRoleName(r);
        const ps=relatedPackages(r.skill_key);
        const tools=roleTools(r);
        const state=roleState(r);
        const recentlyUsed=recent.some(x=>x.skill_key===r.skill_key);
        return '<button class="studio-person" type="button" data-team-role="'+esc(r.skill_key)+'">'+
          '<span class="studio-avatar" aria-hidden="true">'+esc((name||'AI').slice(0,1))+'</span>'+
          '<span class="studio-person-copy"><small>'+esc(roleCapability(r))+'</small><b>'+esc(name)+'</b><span>'+esc(r.notes||r.trigger_summary||'依目前任務需要提供專業支援。')+'</span></span>'+
          '<span class="studio-meta"><i class="role-state-dot '+esc(state.cls)+'"></i>'+esc(state.text)+(recentlyUsed?' · 最近有使用':'')+'</span>'+
          (ps.length?'<span class="studio-work-dot">工作 '+ps.length+'</span>':'')+
          (tools.length?'<span class="studio-tool-dot" title="'+esc(tools.join('、'))+'">工具 '+tools.length+'</span>':'')+
        '</button>';
      };

      let shown=[];
      let intro='';
      if(active==='working'){
        shown=unique(recent.map(mergeUsage)).slice(0,8);
        if(!shown.length) shown=roles.slice(0,8);
        intro='<div class="page-intro team-intro"><span class="kicker">AI 團隊工作室</span><h2>現在誰在幫我</h2><p>先看正在參與工作的角色。碰到一個人，只亮起有正式資料關聯的工作與合作角色；沒有證據的關聯不補猜。</p></div>';
      }else if(active==='teachers'){
        const teacherKeys=new Set(['ceo-orchestrator','goal-closure-operator','logic-reality-analyst','product-flow-architect','impeccable','frontend-design-lead','evaluation','instructional-design-specialist']);
        shown=allRoles.filter(r=>teacherKeys.has(r.skill_key));
        intro='<div class="page-intro team-intro"><span class="kicker">陪你完成作品</span><h2>我的老師</h2><p>拆解、教學、驗證與陪跑角色集中在這裡。候選與試用角色會清楚標示，不會冒充正式已驗證員工。</p></div>';
      }else{
        const researchKeys=/scout|architect|synapse|research|impeccable|frontend|graph|instructional/i;
        shown=allRoles.filter(r=>researchKeys.test(r.skill_key||''));
        intro='<div class="page-intro team-intro"><span class="kicker">探索區</span><h2>研究員</h2><p>研究員負責把未知變成可驗證候選。研究結果先進候選／試驗，不直接改作品、能力或正式真相。</p></div>';
      }

      const activePackages=packages.filter(p=>['in_progress','active','current','ready'].includes(String(p.status||'').toLowerCase()));
      const blockedPackages=packages.filter(p=>String(p.status||'').toLowerCase().includes('block'));
      const readyCount=shown.filter(r=>roleState(r).cls==='ready').length;
      const trialCount=shown.filter(r=>['trial','planned'].includes(roleState(r).cls)).length;
      const currentArtifactHtml=currentArtifact
        ?'<button class="team-context-artifact" type="button" data-jump="projects"><span>目前作品</span><b>'+esc(currentArtifact.title||'目前作品')+'</b><small>只作為團隊工作背景，不代表每位角色都與它有正式關聯。</small></button>'
        :'<div class="team-context-artifact is-empty"><span>目前作品</span><b>尚未選定</b><small>先維持一條主線；團隊不會自行新增作品。</small></div>';

      pane.innerHTML=intro+
        '<div class="team-context-bar">'+
          '<div class="team-stat"><strong>'+shown.length+'</strong><span>這一區角色</span></div>'+
          '<div class="team-stat"><strong>'+readyCount+'</strong><span>可直接調用</span></div>'+
          '<div class="team-stat"><strong>'+trialCount+'</strong><span>候選／試用</span></div>'+
          '<div class="team-stat"><strong>'+activePackages.length+'</strong><span>進行中工作</span></div>'+
          (blockedPackages.length?'<div class="team-stat alert"><strong>'+blockedPackages.length+'</strong><span>受阻工作</span></div>':'')+
          currentArtifactHtml+
        '</div>'+
        '<div class="team-studio">'+
          '<section class="studio-floor" aria-label="AI 團隊角色">'+
            '<div class="studio-scene" aria-hidden="true">'+
              '<span class="studio-window"></span><span class="studio-shelf"><i></i><i></i><i></i></span>'+
              '<span class="studio-lamp">⌁</span><span class="studio-plant">❧</span><span class="studio-desk">Growth Brain 工作桌</span>'+
            '</div>'+
            '<div class="studio-people">'+(shown.length?shown.map(roleCard).join(''):'<div class="empty">目前沒有符合這個區域的正式角色資料。</div>')+'</div>'+
          '</section>'+
          '<aside class="studio-panel" id="studioPanel"><span class="kicker">關係面板</span><h3>選一位角色</h3><p>點擊人物後，只顯示資料庫可以支持的工作、能力、工具、合作角色與作品關聯。</p><div class="studio-panel-hint"><span>Hover</span><b>看關係高亮</b><span>Click</span><b>固定看詳細</b></div></aside>'+
        '</div>';

      const panel=$('#studioPanel',pane);
      const cards=$$('.studio-person',pane);
      function relationSet(key){return new Set(relatedRoles(key).map(r=>r.skill_key))}
      function focusRole(key){
        const related=relationSet(key);
        cards.forEach(c=>{
          const same=c.dataset.teamRole===key;
          const isRelated=related.has(c.dataset.teamRole);
          c.classList.toggle('is-focus',same);
          c.classList.toggle('is-related',!same&&isRelated);
          c.classList.toggle('is-dim',!same&&!isRelated);
        });
      }
      function clearFocus(){cards.forEach(c=>c.classList.remove('is-focus','is-related','is-dim'))}
      function openRole(key){
        const r=allRoles.find(x=>x.skill_key===key)||{};
        const ps=relatedPackages(r.skill_key);
        const rr=relatedRoles(r.skill_key);
        const tools=roleTools(r);
        const ars=relatedArtifacts(r.skill_key);
        const state=roleState(r);
        panel.innerHTML='<div class="studio-panel-head"><span class="studio-avatar large">'+esc((teamRoleName(r)||'AI').slice(0,1))+'</span><div><span class="kicker">角色詳細</span><h3>'+esc(teamRoleName(r))+'</h3><span class="role-state-label '+esc(state.cls)+'">'+esc(state.text)+'</span></div></div>'+
          '<p>'+esc(r.notes||r.trigger_summary||'目前只有角色註冊資料，尚沒有更完整的工作說明。')+'</p>'+
          '<div class="studio-rel"><b>能力領域</b><span>'+esc(roleCapability(r))+'</span></div>'+
          '<div class="studio-rel"><b>現在／近期工作</b>'+(ps.length?ps.map(p=>'<span class="relation-chip">'+esc(p.title||p.package_key)+' · '+esc(statusText(p.status||'unknown'))+'</span>').join(''):'<span class="muted">尚無正式關聯工作</span>')+'</div>'+
          '<div class="studio-rel"><b>合作角色</b>'+(rr.length?rr.map(x=>'<button type="button" class="relation-chip role-link" data-related-role="'+esc(x.skill_key)+'">'+esc(teamRoleName(x))+'</button>').join(''):'<span class="muted">尚無正式合作關聯證據</span>')+'</div>'+
          '<div class="studio-rel"><b>工具</b>'+(tools.length?tools.map(x=>'<span class="relation-chip">'+esc(x)+'</span>').join(''):'<span class="muted">未登記專用工具</span>')+'</div>'+
          '<div class="studio-rel"><b>作品關聯</b>'+(ars.length?ars.map(a=>'<button type="button" data-jump="projects" class="relation-chip">'+esc(a.title||'作品')+'</button>').join(''):'<span class="muted">目前沒有可由正式 ID 關聯確認的作品</span>')+'</div>'+
          '<small class="studio-proof-note">只顯示可追溯關聯。共同出現在同一工作包才視為合作線；作品必須有正式 ID 關聯才顯示。</small>';
        $$('[data-related-role]',panel).forEach(btn=>btn.onclick=()=>{
          const target=cards.find(c=>c.dataset.teamRole===btn.dataset.relatedRole);
          if(target){target.click();target.focus();target.scrollIntoView({block:'nearest',behavior:'smooth'});}
        });
      }

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

function setView(name,subtab){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const t={
    home:'今天只做一件最值得做的事',
    projects:'作品：現在走到哪一關',
    capabilities:'能力庫：需要時直接拿來用',
    research:'研究室：先探索，再決定要不要採用',
    ceo:'團隊：現在誰在幫我',
    history:'歷程：看見第二大腦怎麼長出來',
    inbox:'快速丟進第二大腦',
    learn:'只補目前真正需要的學習',
    synapse:'知識關係'
  };
  $('#pageTitle').textContent=t[name]||t.home;
  if(name==='projects')renderProjectsIA(subtab||'gateway');
  if(name==='capabilities')renderCapabilities(subtab||'cells');
  if(name==='research')renderResearch(subtab||'today');
  if(name==='history')renderHistory();
  if(name==='learn')renderLearn();
  if(name==='synapse')renderSynapse();
  if(name==='ceo')renderTeamIA(subtab||'working');
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
    m.innerHTML='<div class="modal-card"><button class="modal-close" id="closeLogin">×</button><span class="kicker">私人單人模式</span><h2>登入 第二大腦</h2><p>請使用既有帳號。寄信後，直接點選最新登入信的登入按鈕；登入會保存在開啟它的瀏覽器。</p><input id="loginEmail" type="email" placeholder="your@email.com"><button class="primary-btn" id="sendLogin">寄登入連結</button><div id="loginMsg" class="muted"></div><div class="evidence-box"><b>需要在這個瀏覽器登入？</b><span>在最新、尚未點開的登入信，對登入按鈕長按或按右鍵，選「複製連結網址」，貼到下方。不要複製登入後的網址列；已點過的登入連結需重新寄送。</span></div><input id="loginLink" type="text" autocomplete="off" aria-label="登入連結" placeholder="登入信中按鈕的原始連結（尚未點開）"><button class="ghost-btn" id="verifyLoginLink">驗證原始登入連結</button><div id="verifyLoginMsg" class="muted"></div></div>';
    document.body.appendChild(m);
    $('#closeLogin').onclick=()=>m.classList.remove('show');
    $('#sendLogin').onclick=async()=>{
      const msg=$('#loginMsg');
      try{msg.textContent='寄送中…';await A.requestMagicLink($('#loginEmail').value);msg.textContent='已送出。請直接點選最新登入信的登入按鈕。若要貼到此處驗證，請先複製信中按鈕的連結網址。';}
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
    $$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
    document.addEventListener('click',e=>{
      const f=e.target.closest('[data-funnel-kind]');
      if(f)window.GROWTH_BRAIN_LAB.openFunnel({kind:f.dataset.funnelKind,id:f.dataset.funnelId||null,goal:f.dataset.funnelGoal||''});
      const j=e.target.closest('[data-jump]');
      if(j)setView(j.dataset.jump);
      if(e.target.closest('[data-auth]'))loginModal();
    });
    document.addEventListener('growth-lab:navigate',e=>setView(e.detail.view,e.detail.subtab));
    document.addEventListener('growth-lab:system-research',()=>renderResearch('growthbrain'));
    $('#captureBtn').onclick=()=>setView('inbox');
    $('#refreshBtn').onclick=()=>location.reload();
  }catch(e){$('.main').innerHTML=`<div class="empty">第二大腦 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
