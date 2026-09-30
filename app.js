const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const A=window.GROWTH_BRAIN_ADAPTER;
let D=null;
let SYSTEM=null;

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pct=v=>`${Math.round((Number(v)||0)*100)}%`;
const pill=s=>{const k=String(s||'unknown').toLowerCase();const cls=['completed','available','live','active','selected'].includes(k)?'success':['blocked','danger','rejected'].includes(k)?'danger':['current','planned','pending','supporting_only','candidate','candidate_only','paused'].includes(k)?'warn':'';return `<span class="pill ${cls}">${esc(statusText(s||'unknown'))}</span>`};
const human=s=>{
  const raw=String(s||'');
  const labels={remote_income:'遠端收入',synapse_graph:'知識連結圖',repeated_core_logic:'重複核心邏輯',unified_stream:'統一資訊流',spec_kit_workflow:'規格優先工作流'};
  const key=raw.replace(/^concept:/,'').replace(/^logic:/,'');
  return labels[key]||key.replaceAll('_',' ');
};
const home=()=>D?.personalHome||{};
const attempt=u=>A.latestAttempt(u.id);
const statusText=s=>({
  completed:'已完成',available:'可使用',live:'已連線',active:'進行中',
  blocked:'受阻',danger:'異常',current:'目前進行',planned:'規劃中',
  pending:'等待中',supporting_only:'支援用途',candidate:'候選',
  selected:'已選定',rejected:'已拒絕',paused:'暫停',
  candidate_only:'僅候選',unknown:'未驗證',confirmed:'使用者已確認',verified:'已驗證',
  personal_outcome_route_selected:'已選定個人主線',
  personal_outcome_candidate_available:'有候選主線待確認',
  needs_personal_outcome_route:'尚未選定個人主線'
}[String(s||'').toLowerCase()]||String(s||''));

function modeStrip(){
  const live=A.liveStatus==='live';
  return `<div class="system-strip"><div><span class="system-kicker">資料狀態</span><b>${live?'已連線正式資料':'顯示可信快取'}</b><span>私人單人模式</span></div><p>${live?'首頁正在讀取登入後的正式個人資料；系統資料只有進入系統頁才載入。':'目前顯示可信快取，不把快取冒充即時資料。'}</p></div>`;
}

function renderHome(){
  const H=home(),dir=H.primary_direction||{},action=H.primary_action||{},learn=H.learning_support||{},summary=learn.summary||{},nodes=(H.synapse_highlights?.nodes||[]).slice(0,4),progress=(H.recent_real_progress?.items||[]).slice(0,6),sys=H.system_health||{};
  let cta='';
  if(A.liveStatus==='signed_out') cta='<button class="primary-btn" data-auth>登入同步我的資料</button>';
  else if(action.status==='needs_personal_outcome_route') cta='<button class="primary-btn" data-jump="projects">建立候選主線</button>';
  else if(action.status==='personal_outcome_candidate_available') cta='<button class="primary-btn" data-jump="projects">確認候選主線</button>';
  else cta='<button class="primary-btn" data-jump="projects">查看我的主線</button>';

  $('#view-home').innerHTML=`${modeStrip()}
  <div class="hero-grid">
    <article class="hero-card"><span class="kicker">現在最重要</span><h2>${esc(action.title||'先選一個真實下一步')}</h2><p>${esc(action.why||'目前還沒有足夠證據替你自動選唯一主線。')}</p><div class="evidence-box"><b>做到什麼算完成</b><span>${esc(action.success_evidence||'產生一個真實作品或行動證據。')}</span></div>${cta}</article>
    <article class="direction-card"><span class="kicker">方向</span><h3>${esc(dir.key?human(dir.key):'尚未同步')}</h3><p>${esc(dir.goal||'登入後同步目前方向。')}</p><div class="row-between"><span>信心 ${pct(dir.confidence)}</span>${pill(dir.status)}</div></article>
  </div>
  <div class="metrics"><div><strong>${esc(summary.unverified_count??0)}</strong><span>未驗證概念</span></div><div><strong>${esc(summary.forming_count??0)}</strong><span>形成證據中</span></div><div><strong>${A.candidateEvidenceCount()}</strong><span>候選作答</span></div></div>
  <section><div class="section-head"><div><h2>最近真實進展</h2><p>只記錄你真的完成、確認或留下證據的事情；系統自己建置不算。</p></div></div>
    <div class="stack">${progress.length?progress.map(p=>`<div class="surface"><div class="row-between"><b>${esc(p.title||'真實進展')}</b>${pill(p.evidence_level||'confirmed')}</div><p>${esc(p.summary||'')}</p><small class="muted">時間：${esc(p.occurred_at?new Date(p.occurred_at).toLocaleString('zh-TW'):'未記錄')} · 主線：${esc(p.route_key||p.route_id||'未連結')} · 來源：${esc(p.source_type||'未記錄')} / ${esc(p.source_ref||'未記錄')} · 證據：${esc(statusText(p.evidence_level||'unknown'))}</small></div>`).join(''):'<div class="empty">目前還沒有可追溯到正式來源、個人主線與確認／驗證證據的真實進展。完成一個真實行動、作品、主線決定或通過的學習證據後才會出現在這裡。</div>'}</div>
  </section>
  <section><div class="section-head"><div><h2>學習支援</h2><p>學習是支援，不會搶走你的個人主線。</p></div>${pill(learn.role||'supporting_only')}</div><div class="surface"><b>${esc(learn.primary_card?.label||'未驗證')}</b><p>${esc(learn.primary_card?.description||'先留下可驗證證據。')}</p><small>${esc(learn.primary_card?.next_action||'完成一次回答或實作')}</small></div></section>
  <section><div class="section-head"><div><h2>知識連結重點</h2><p>首頁只看重點；完整關係在「知識連結」頁。</p></div></div><div class="highlight-grid">${nodes.map(n=>`<div class="highlight"><b>${esc(n.label||human(n.k))}</b><span>${esc(n.n??0)} 個訊號 · ${pct(n.c)}</span></div>`).join('')||'<div class="empty">目前沒有重點節點。</div>'}</div></section>
  <section><div class="section-head"><div><h2>系統狀態</h2><p>只顯示摘要，不把系統建置任務冒充成你的個人下一步。</p></div></div><div class="surface row-between"><div><b>${sys.build_in_progress?'系統仍在建置':'系統穩定'}</b><p>${esc(sys.parallel_blocker_count??0)} 個待處理阻塞</p></div><button class="ghost-btn" data-jump="ceo">查看系統</button></div></section>`;
}

async function renderProjects(notice=''){
  const root=$('#view-projects');
  const H=home(),dir=H.primary_direction||{};
  if(A.liveStatus!=='live'){
    root.innerHTML=`<div class="section-head"><div><h2>個人主線與專案</h2><p>登入後才能把候選主線正式保存到第二大腦。</p></div></div><div class="surface"><b>目前尚未連線正式資料</b><p>可以先查看首頁方向，但建立或確認個人主線前需要登入。</p><button class="primary-btn" data-auth>登入</button></div>`;
    return;
  }

  root.innerHTML='<div class="empty">正在載入個人主線…</div>';
  let outcome;
  try{outcome=await A.getPersonalOutcome();}
  catch(e){root.innerHTML=`<div class="empty">個人主線載入失敗：${esc(e.message||e)}</div>`;return;}

  const selected=outcome?.selected_route||null;
  const candidate=outcome?.candidate_route||null;
  root.innerHTML=`
    <div class="section-head"><div><h2>個人主線與專案</h2><p>AI 可以整理候選，但只有你能把它設成正式主線。</p></div>${pill(selected?'selected':candidate?'candidate':'unknown')}</div>
    <div class="hero-grid">
      <article class="surface">
        <span class="kicker">目前方向</span>
        <h3>${esc(dir.key?human(dir.key):'尚無方向')}</h3>
        <p>${esc(dir.goal||'目前沒有足夠證據形成方向。')}</p>
        <small class="muted">方向是長期傾向；主線是你現在明確選定要完成的成果，兩者不等同。</small>
      </article>
      <article class="surface">
        <span class="kicker">目前主線</span>
        <h3>${esc(selected?.title||'尚未選定')}</h3>
        <p>${esc(selected?.success_evidence||'先建立一條候選主線，再由你確認。')}</p>
        ${selected?pill('selected'):''}
      </article>
    </div>

    ${candidate?`
    <div class="section-head"><div><h2>待確認候選</h2><p>這筆已經保存到資料庫，但還不是正式主線。</p></div></div>
    <article class="surface">
      <h3>${esc(candidate.title)}</h3>
      <p><b>完成證據：</b>${esc(candidate.success_evidence)}</p>
      ${candidate.why_now?`<p><b>為什麼現在做：</b>${esc(candidate.why_now)}</p>`:''}
      <div class="project-actions">
        <button class="primary-btn" id="selectCandidate">設為正式主線</button>
        <button class="ghost-btn" id="rejectCandidate">拒絕這個候選</button>
      </div>
    </article>`:''}

    <div class="section-head"><div><h2>${candidate?'修改候選主線':'建立候選主線'}</h2><p>只先定義「想完成什麼」與「怎樣才算完成」，不一次塞入大量規劃。</p></div></div>
    <form class="surface project-form" id="projectForm">
      <label><b>我想完成什麼</b><input id="projectTitle" value="${esc(candidate?.title||'')}" placeholder="例如：完成一個自己會持續使用的第二大腦核心流程"></label>
      <label><b>什麼證據代表完成</b><textarea id="projectEvidence" placeholder="例如：我能從輸入一個想法，一路走到可執行下一步，而且結果會被記錄">${esc(candidate?.success_evidence||'')}</textarea></label>
      <label><b>為什麼現在做</b><textarea id="projectWhy" placeholder="可選填">${esc(candidate?.why_now||'')}</textarea></label>
      <div class="row-between">
        <div id="projectMsg" class="muted">${esc(notice||'儲存後只是候選，不會自動變成你的正式目標。')}</div>
        <button type="submit" class="primary-btn">保存候選主線</button>
      </div>
    </form>`;

  $('#projectForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const title=$('#projectTitle').value.trim();
    const successEvidence=$('#projectEvidence').value.trim();
    const whyNow=$('#projectWhy').value.trim();
    const msg=$('#projectMsg');
    if(title.length<3||successEvidence.length<3){msg.textContent='請至少填入「想完成什麼」與「完成證據」。';return;}
    try{
      msg.textContent='正在保存到第二大腦…';
      await A.savePersonalOutcomeCandidate({title,successEvidence,whyNow,directionKey:dir.key||null});
      D=await A.getSnapshot();
      renderHome();
      await renderProjects('候選主線已正式保存，現在可以確認是否設為主線。');
    }catch(e){msg.textContent=e.message||'保存失敗';}
  });

  $('#selectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#selectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'select'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjects('已設為正式個人主線；首頁已同步更新。');
    }catch(e){btn.disabled=false;$('#projectMsg').textContent=e.message||'設定失敗';}
  });

  $('#rejectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#rejectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'reject'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjects('候選已拒絕，不會成為你的主線。');
    }catch(e){btn.disabled=false;$('#projectMsg').textContent=e.message||'拒絕失敗';}
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
  let learning;
  try{learning=await A.getLearning();}
  catch(e){root.innerHTML=`<div class="empty">學習資料載入失敗：${esc(e.message||e)}</div>`;return;}

  const sessions=learning?.sessions||[];
  const units=sessions.flatMap(s=>(s.units||[]).map(u=>({...u,session:s})));

  root.innerHTML=`
    <div class="section-head">
      <div><h2>學習陪伴</h2><p>貼入真實文字後，系統先保留原文，再讓你用自己的話回答；AI 尚未接上時不會假裝已產生解釋。</p></div>
      <span class="pill success">正式資料</span>
    </div>

    <form class="surface project-form" id="learningInputForm">
      <label><b>學習內容</b><textarea id="learningText" placeholder="貼入你真的想理解的一段文字"></textarea></label>
      <div class="hero-grid">
        <label><b>標題（可選）</b><input id="learningTitle" placeholder="例如：文章中的核心概念"></label>
        <label><b>學習目標（可選）</b><input id="learningGoal" placeholder="例如：能用自己的話說明並應用"></label>
      </div>
      <div class="row-between">
        <div id="learningInputMsg" class="muted">${esc(notice||'建立後會進正式 Learning；目前不會把 AI 生成內容當成你已學會。')}</div>
        <button class="primary-btn" type="submit">建立學習單元</button>
      </div>
    </form>

    <div class="section-head">
      <div><h2>我的正式學習</h2><p>只顯示 data_scope=real 的個人學習資料。</p></div>
      <span>${sessions.length} 個來源 · ${units.length} 個單元</span>
    </div>

    <div class="lesson-layout">
      <div class="lesson-list" id="liveLessonList">
        ${units.length?units.map((u,i)=>`<button class="lesson-item ${i===0?'active':''}" data-live-unit="${esc(u.id)}"><span>${esc(u.session?.title||'學習來源')}</span><b>${esc(u.presentation?.title||u.session?.title||'學習單元')}</b><small>${esc(u.latest_submission?.status?statusText(u.latest_submission.status):'未作答')}</small></button>`).join(''):'<div class="empty">目前還沒有正式學習單元。把一段真實文字貼進上方即可開始。</div>'}
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
      await renderLearn('已建立正式學習單元；原文已保留，AI 解釋目前仍標示為尚未產生。');
    }catch(err){msg.textContent=err.message||'建立失敗';}
  });

  let active=units[0]||null;
  const draw=()=>{
    const detail=$('#liveLessonDetail');
    if(!detail) return;
    if(!active){
      detail.innerHTML='<div class="empty">目前沒有正式 Learning Unit。</div>';
      return;
    }
    const sub=active.latest_submission||null;
    const pending=sub?.status==='pending';
    const promoted=sub?.status==='promoted'&&sub?.promoted_learning_evidence_id;
    detail.innerHTML=`
      <span class="kicker">正式來源</span>
      <h2>${esc(active.presentation?.title||active.session?.title||'學習單元')}</h2>
      <p class="teach">${esc(active.zh_explanation||'尚未產生 AI 解釋。')}</p>
      <details open><summary>原始內容</summary><p>${esc(active.original_text||'')}</p></details>
      <div class="provenance">來源：${esc(active.session?.source_ref||'未記錄')} · 範圍：real</div>
      <div class="answer">
        <b>你的驗證題</b>
        <p>${esc(active.interaction_prompt||'請用自己的話說明你理解到的重點。')}</p>
        <textarea id="answerInput">${esc(sub?.response_text||'')}</textarea>
        <button class="primary-btn" id="submitAnswer" ${pending?'disabled':''}>${pending?'等待審核':'送出可審核回答'}</button>
        <div id="answerMsg" class="muted">${promoted?'這筆回答已通過審核並形成學習證據。':sub?.status==='rejected'?'上一筆回答未通過審核，可修改後再提交。':sub?.status==='reviewed'?'上一筆只完成審核，沒有升成個人學習證據。':'回答送出後只會先進待審核，不會直接算已學會。'}</div>
      </div>`;
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

function renderSynapse(){
  const nodes=D.synapse?.nodes||[],edges=D.synapse?.edges||[];
  $('#view-synapse').innerHTML=`<div class="section-head"><div><h2>Synapse</h2><p>完整圖只顯示已有 明確關係類型 的連結。</p></div>${pill('有證據支持')}</div><div class="graph" id="graph"></div>`;
  const g=$('#graph');
  edges.forEach(e=>{const a=nodes.find(n=>n.id===e.source),b=nodes.find(n=>n.id===e.target);if(!a||!b)return;const line=document.createElement('div');line.className='edge';const dx=b.x-a.x,dy=b.y-a.y;line.style.left=a.x+'%';line.style.top=a.y+'%';line.style.width=Math.hypot(dx,dy)+'%';line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;g.appendChild(line)});
  nodes.forEach(n=>{const b=document.createElement('button');b.className='node '+(n.center?'center':'');b.style.left=n.x+'%';b.style.top=n.y+'%';b.textContent=n.label;g.appendChild(b)});
}

async function renderSystem(){
  const root=$('#view-ceo');root.innerHTML='<div class="empty">載入 系統控制台…</div>';
  if(!SYSTEM){try{SYSTEM=await A.getSystemCockpit();}catch(e){SYSTEM={error:e.code||e.message}}}
  if(SYSTEM?.error){root.innerHTML=`<div class="empty">系統控制台 無法讀取：${esc(SYSTEM.error)}</div>`;return}
  const ceo=SYSTEM?.ceo||{},cur=ceo.current||{},blockers=ceo.parallel_blockers||[],pkgs=SYSTEM?.work_queue?.packages||[],roles=SYSTEM?.skill_team?.executable_roles||[];
  const logic=pkgs.find(p=>p.package_key==='logic-core-loop-v1')||{};
  const steps=Array.isArray(logic.steps)?logic.steps:[];
  const byKey=Object.fromEntries(steps.map(s=>[s.key,s]));
  const capabilityDefs=[
    ['personal-outcome-live-loop','主線候選與確認','建立候選主線，由你明確確認或拒絕；AI 不會自己把候選升成正式目標。'],
    ['inbox-quick-capture','收件匣','保存文字、連結或想法，保留原始來源，再進行分類。'],
    ['routing-from-inbox','四類路由','把收件內容導向主線／專案、學習、行動或知識候選，並保留來源鏈。'],
    ['learning-input-live','真實文字學習','真實文字可建立學習單元、保留原文並提交回答；回答需審核才形成證據。'],
    ['real-progress-ledger','真實進展','只顯示使用者確認或已驗證的真實行動／成果；系統建置與測試資料不算。'],
    ['synapse-real-data-only','個人知識連結','只用可追溯的真實個人資料形成知識連結；目前仍在完善。'],
    ['ai-execution-queue','AI 任務執行層','把需要推理的工作交給正式 AI 任務層，而不是前端假裝會思考。'],
    ['core-loop-acceptance','完整核心閉環','以一筆真實輸入走完收件、路由、行動／學習、證據、進展與知識更新。']
  ];
  const capStatus=s=>{
    const st=String(s?.status||'planned');
    const pending=String(s?.evidence?.real_world_acceptance||'').startsWith('pending')||st.includes('pending');
    if(st==='completed'&&pending)return {label:'已實作，待真實驗收',cls:'warn'};
    if(st==='completed')return {label:'已實作',cls:'success'};
    if(st==='current')return {label:'正在完善',cls:'warn'};
    if(st.startsWith('implemented'))return {label:'已實作，待真實驗收',cls:'warn'};
    if(st==='blocked')return {label:'受阻但不阻塞其他工作',cls:'danger'};
    return {label:'尚未完成',cls:''};
  };
  const caps=capabilityDefs.map(([key,title,desc])=>{
    const s=byKey[key]||{},x=capStatus(s);
    return `<article class="surface"><div class="row-between"><b>${esc(title)}</b><span class="pill ${x.cls}">${esc(x.label)}</span></div><p>${esc(desc)}</p><small class="muted">來源：logic-core-loop-v1 / ${esc(key)}</small></article>`;
  }).join('');

  root.innerHTML=`
    <div class="section-head"><div><h2>系統控制台</h2><p>系統建置、技能員工與阻塞項目留在這裡，不污染個人首頁。</p></div>${pill(cur.status)}</div>
    <div class="hero-grid">
      <article class="surface"><span class="kicker">目前建置</span><h3>${esc(cur.stage||'')} · ${esc(cur.title||'')}</h3><p>${esc(cur.objective||'')}</p></article>
      <article class="surface"><span class="kicker">執行狀態</span><div class="metrics compact"><div><strong>${pkgs.length}</strong><span>工作包</span></div><div><strong>${roles.length}</strong><span>可用角色</span></div><div><strong>${blockers.length}</strong><span>阻塞項目</span></div></div></article>
    </div>

    <div class="section-head"><div><h2>目前能做到什麼</h2><p>狀態直接依目前核心工作包顯示；「已實作」和「真實使用已驗收」分開，不把測試成功冒充正式完成。</p></div></div>
    <div class="stack">${caps||'<div class="empty">目前還讀不到核心能力狀態。</div>'}</div>

    <div class="section-head"><div><h2>路徑／作品試跑</h2><p>先試看一個方向會長成什麼作品，再決定要不要投入。這裡不會把假設結果寫成你的正式目標或個人資料。</p></div><span class="pill warn">試跑，不算正式驗收</span></div>
    <article class="surface project-form">
      <label><b>你看到的內容、想法，或已經有的目標</b><textarea id="simulationInput" placeholder="例如：我看到一個 AI Agent 專案，想知道值不值得深入；或：我想做一個會自己整理知識的第二大腦。"></textarea></label>
      <div class="project-actions">
        <button class="ghost-btn" type="button" data-path-mode="curiosity">看到一個東西，試看值得往哪裡走</button>
        <button class="ghost-btn" type="button" data-path-mode="goal">我已有目標，試看怎麼做成作品</button>
      </div>
      <div id="simulationResult" class="empty">尚未試跑。系統會先給「階段目標 → 作品 → 下一階段」，而不是一次把整條路線寫死。</div>
    </article>

    <div class="section-head"><div><h2>阻塞項目</h2><p>同一問題有限次診斷後仍受阻，就保存恢復點並去完善其他不衝突部分；有新證據再回來。</p></div></div>
    <div class="stack">${blockers.map(b=>`<div class="surface"><b>${esc(b.stage)} · ${esc(b.title)}</b><p>${esc(b.blocker?.reason||b.blocker||'')}</p></div>`).join('')||'<div class="empty">目前沒有平行 blocker。</div>'}</div>`;

  const trialTemplates={
    curiosity:[
      {
        goal:'先找出這個主題最值得追的問題',
        artifact:'一張「問題／價值地圖」：它是什麼、可能有什麼用、你目前最不懂哪一段、值得驗證什麼。',
        next:'從地圖中只挑一個最有價值的問題，做最小實作。'
      },
      {
        goal:'把一個問題變成可碰得到的東西',
        artifact:'一個最小作品：小原型、比較表、流程、短實驗或可重複操作的範例。',
        next:'看作品結果與你的反應：有價值就深入，沒價值就轉向或停止。'
      },
      {
        goal:'驗證這條方向是否值得成為正式路徑',
        artifact:'一份短驗證紀錄：作品結果、你實際會不會再用、遇到的缺口、下一個值得做的作品。',
        next:'只有有真實結果與你的確認，才升成個人正式路徑。'
      }
    ],
    goal:[
      {
        goal:'把目標縮成第一個可交付成果',
        artifact:'一個最小可用作品，不要求完整，但要能看、能操作或能被驗證。',
        next:'用作品找真正問題，不先補齊所有功能。'
      },
      {
        goal:'用真實使用或明確測試找出下一個缺口',
        artifact:'一次測試結果＋修正版作品，保留「哪裡有效／哪裡卡住」的證據。',
        next:'只針對真正暴露出的缺口決定下一階段。'
      },
      {
        goal:'把已證明有價值的部分做成可持續使用',
        artifact:'較完整作品＋使用紀錄／成果證據，足以判斷要繼續擴大、轉向或停止。',
        next:'下一階段由真實資料決定，不預先固定。'
      }
    ]
  };
  root.querySelectorAll('[data-path-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    const raw=$('#simulationInput')?.value.trim()||'（尚未提供內容，先看通用路徑骨架）';
    const mode=btn.dataset.pathMode==='goal'?'goal':'curiosity';
    const stages=trialTemplates[mode];
    const modeLabel=mode==='goal'?'已有目標':'看到內容／主題';
    $('#simulationResult').innerHTML=`
      <b>試跑路徑：${esc(modeLabel)} · 不會儲存</b>
      <p>${esc(raw)}</p>
      <div class="stack">${stages.map((s,i)=>`
        <div class="surface">
          <span class="kicker">第 ${i+1} 階段</span>
          <p><b>目標：</b>${esc(s.goal)}</p>
          <p><b>要產出的作品：</b>${esc(s.artifact)}</p>
          <small class="muted">完成後：${esc(s.next)}</small>
        </div>`).join('')}</div>
      <div class="provenance">目前這是通用作品骨架，不靠關鍵字替你下結論。未來 AI 任務層接上後，會用你的真實 Inbox、作品、行動與回饋，把每一階段改成更貼近你的候選方向；仍需真實結果才能升成正式路徑。</div>`;
  }));
}

function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const t={home:'今天只做一件最值得做的事',projects:'把候選方向變成可驗證的個人主線',learn:'把複雜內容變成可以理解的東西',synapse:'看見知識與經驗如何連起來',ceo:'系統建置與 AI 團隊狀態'};$('#pageTitle').textContent=t[name]||t.home;if(name==='projects')renderProjects();if(name==='learn')renderLearn();if(name==='ceo')renderSystem();
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
  $('#authBox')?.remove();const box=document.createElement('div');box.id='authBox';box.className='auth-box';box.innerHTML=A.liveStatus==='live'?'<span class="pill success">Live</span><button class="ghost-btn small" id="signOut">登出</button>':'<button class="ghost-btn small" id="openLogin">登入</button>';$('.top-actions').prepend(box);$('#openLogin')?.addEventListener('click',loginModal);$('#signOut')?.addEventListener('click',async()=>{await A.signOut();location.reload()});
}
function loginModal(){
  let m=$('#loginModal');
  if(!m){
    m=document.createElement('div');
    m.id='loginModal';
    m.className='modal-backdrop';
    m.innerHTML='<div class="modal-card"><button class="modal-close" id="closeLogin">×</button><span class="kicker">私人單人模式</span><h2>登入 第二大腦</h2><p>只允許既有帳號登入，不建立新帳號。</p><input id="loginEmail" type="email" placeholder="your@email.com"><button class="primary-btn" id="sendLogin">寄登入連結</button><div id="loginMsg" class="muted"></div><div class="evidence-box"><b>如果登入信點開後跑到錯的網址</b><span>不要再點舊連結。從最新、尚未使用的登入信複製完整連結，貼在下面；第二大腦 會直接驗證 token，不經過 redirect。</span></div><input id="loginLink" type="text" autocomplete="off" placeholder="貼上最新登入信的完整連結"><button class="ghost-btn" id="verifyLoginLink">直接驗證登入連結</button><div id="verifyLoginMsg" class="muted"></div></div>';
    document.body.appendChild(m);
    $('#closeLogin').onclick=()=>m.classList.remove('show');
    $('#sendLogin').onclick=async()=>{
      const msg=$('#loginMsg');
      try{msg.textContent='寄送中…';await A.requestMagicLink($('#loginEmail').value);msg.textContent='已送出。請只使用最新一封登入信；若點開仍回錯位置，可改用下方直接驗證。';}
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
  try{await A.initialize();D=await A.getSnapshot();renderHome();await renderProjects();await renderLearn();renderSynapse();authBar();await sendSessionLifecycleProbe();$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j)setView(j.dataset.jump);if(e.target.closest('[data-auth]'))loginModal()});$('#refreshBtn').onclick=()=>location.reload();}
  catch(e){$('.main').innerHTML=`<div class="empty">第二大腦 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
