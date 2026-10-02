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
  blocked_external:'外部服務尚未接通',candidate_only:'僅候選',unknown:'未驗證',confirmed:'使用者已確認',verified:'已驗證',
  personal_outcome_route_selected:'已選定個人主線',
  personal_outcome_candidate_available:'有候選主線待確認',
  needs_personal_outcome_route:'尚未選定個人主線'
}[String(s||'').toLowerCase()]||String(s||''));

function modeStrip(){
  const live=A.liveStatus==='live';
  return `<div class="system-strip"><div><span class="system-kicker">資料狀態</span><b>${live?'已連線正式資料':'尚未讀取正式個人資料'}</b><span>私人單人模式</span></div><p>${live?'首頁正在讀取登入後的正式個人資料；系統資料只有進入系統頁才載入。':'登出時不顯示快取或示範個人資料；登入後才讀取正式內容。'}</p></div>`;
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
    root.innerHTML=`<div class="section-head"><div><h2>目標與作品路徑</h2><p>登入後，你輸入的方向才會交給第二大腦與 GPT 整理，並保存成可持續更新的作品路徑。</p></div></div><div class="surface"><b>目前尚未連線正式資料</b><p>登入後才能讀取你的能力證據、作品進度與學習紀錄來規劃下一步。</p><button class="primary-btn" data-auth>登入</button></div>`;
    return;
  }

  root.innerHTML='<div class="empty">正在讀取你的目標與作品路徑…</div>';
  let outcome;
  try{outcome=await A.getPersonalOutcome();}
  catch(e){root.innerHTML=`<div class="empty">目標與作品路徑載入失敗：${esc(e.message||e)}</div>`;return;}

  const selected=outcome?.selected_route||null;
  const candidate=outcome?.candidate_route||null;
  const planningRoute=candidate||selected||null;
  const planJob=planningRoute?.path_plan||null;
  const aiLabels={pending:'等待 GPT 整理',claimed:'已開始整理',processing:'正在分析你的資料',completed:'整理完成',failed:'整理失敗',cancelled:'已取消'};
  let plan=null;
  if(planJob?.status==='completed'){
    const raw=planJob?.result?.text;
    if(raw){
      try{plan=JSON.parse(String(raw).replace(/^\`\`\`json\s*/i,'').replace(/\`\`\`$/,'').trim());}catch{}
    }
  }

  const masteryLabel=s=>({
    unknown:'尚未驗證',
    exposure:'接觸過',
    understood:'已理解',
    apply_with_help:'可在協助下應用',
    apply_independently:'可獨立應用'
  }[String(s||'').toLowerCase()]||'尚未驗證');

  const planPanel=(()=>{
    if(!planningRoute){
      return `<section><div class="section-head"><div><h2>AI 路徑整理</h2><p>先輸入一個你想達成的方向，系統才會用你的資料庫狀態與 GPT 產生第一件可驗證作品。</p></div></div><div class="empty">目前還沒有可整理的目標。</div></section>`;
    }
    if(!planJob){
      return `<section><div class="section-head"><div><h2>AI 路徑整理</h2><p>保存目標後，系統會自動把相關能力、學習證據與知識連結交給 GPT 整理。</p></div></div><div class="surface"><b>尚未建立整理任務</b><p>再次保存這個目標後會自動建立，不需要另外輸入一次。</p></div></section>`;
    }
    if(['pending','claimed','processing'].includes(planJob.status)){
      return `<section><div class="section-head"><div><h2>AI 正在整理你的路徑</h2><p>第二大腦已把目前目標、技能證據、學習紀錄與知識連結交給 GPT；結果會先當候選建議，不會直接改寫你的能力。</p></div>${pill('pending')}</div><div class="surface"><b>${esc(aiLabels[planJob.status]||'處理中')}</b><p>完成後這裡會出現「現在這一件作品、要驗證的技能、完成證據與後續候選方向」。</p></div></section>`;
    }
    if(planJob.status==='failed'){
      return `<section><div class="section-head"><div><h2>AI 路徑整理</h2><p>你的目標與資料都還在資料庫，不會因 GPT 或本機執行器暫時失敗而遺失。</p></div>${pill('danger')}</div><div class="surface"><b>這次整理沒有完成</b><p>系統保留原始目標與失敗紀錄；重新保存目標或稍後重試即可，不會把失敗結果當成正式路徑。</p></div></section>`;
    }
    if(planJob.status==='completed'&&!plan){
      return `<section><div class="section-head"><div><h2>AI 路徑整理</h2><p>GPT 已經回覆，但這次格式還不能安全轉成作品路徑。</p></div>${pill('warn')}</div><div class="surface"><b>回覆已保存，尚未套用</b><p>原始結果保留在資料庫；在格式整理完成前，不會把它寫成你的技能或正式路徑。</p></div></section>`;
    }
    if(!plan) return '';
    const artifact=plan.current_artifact||{};
    const skills=Array.isArray(plan.core_capabilities)?plan.core_capabilities:[];
    const tools=Array.isArray(plan.tool_capabilities)?plan.tool_capabilities:[];
    const learning=Array.isArray(plan.learning_focus)?plan.learning_focus:[];
    const branches=Array.isArray(plan.possible_next_branches)?plan.possible_next_branches:[];
    return `<section>
      <div class="section-head"><div><h2>現在這一件作品</h2><p>先用作品驗證能力；下一階段等這件作品有結果後再重新判斷。</p></div><span class="pill success">GPT 已整理</span></div>
      <article class="surface">
        <span class="kicker">目前階段</span>
        <h2>${esc(artifact.title||'尚未命名的階段作品')}</h2>
        <p>${esc(artifact.objective||plan.goal_interpretation||'')}</p>
        ${artifact.deliverable?`<div class="evidence-box"><b>要做出什麼</b><span>${esc(artifact.deliverable)}</span></div>`:''}
        <div class="evidence-box"><b>做到什麼才算通過</b><span>${(artifact.done_evidence||[]).length?(artifact.done_evidence||[]).map(x=>`• ${esc(x)}`).join('<br>'):'等待作品完成標準'}</span></div>
      </article>

      <div class="section-head"><div><h2>這件作品正在驗證的能力</h2><p>百分比不是靠 AI 猜；沒有真實證據的能力會維持「尚未驗證」。</p></div></div>
      <div class="stack">${skills.length?skills.map(s=>`<div class="surface row-between"><div><b>${esc(s.name_zh||human(s.key))}</b><p>${esc(s.why||'')}</p></div><span class="pill">${esc(masteryLabel(s.current_state))}</span></div>`).join(''):'<div class="empty">目前還沒有足夠證據整理能力狀態。</div>'}</div>

      ${learning.length?`<div class="section-head"><div><h2>現在只需要補的學習</h2><p>只補這件作品目前真的需要的缺口，不先把整套課程學完。</p></div></div><div class="stack">${learning.map(x=>`<div class="surface"><b>${esc(human(x.skill_key)||x.skill_key||'學習重點')}</b><p>${esc(x.reason||'')}</p><small class="muted">目前最低需要：${esc(x.minimum_needed_now||'能支援現在作品')}</small></div>`).join('')}</div>`:''}

      ${tools.length?`<details class="surface"><summary><b>容易隨技術更新的工具能力</b></summary><p>這些可以換工具；底層能力沒有失效時，不會因此重建整條路徑。</p>${tools.map(t=>`<p><b>${esc(t.name_zh||human(t.key))}</b> — ${esc(t.why||'')}</p>`).join('')}</details>`:''}

      ${branches.length?`<details class="surface"><summary><b>完成這件作品後，可能的下一步</b></summary><p>以下只是候選，不會提前寫成你的正式路徑。</p>${branches.map(b=>`<p><b>${esc(b.title||'候選方向')}</b><br><small class="muted">什麼情況才走這條：${esc(b.condition||'看作品結果再決定')}</small></p>`).join('')}</details>`:''}

      ${plan.needs_fresh_research?`<div class="surface"><b>需要更新外部技術資訊</b><p>這次規劃發現部分工具選擇具有時效性。系統應先更新最新技術資料，再決定工具層，不會直接改寫底層能力。</p></div>`:''}
    </section>`;
  })();

  root.innerHTML=`
    <div class="section-head"><div><h2>目標與作品路徑</h2><p>你只要告訴系統想往哪裡走；第二大腦會結合資料庫記憶與 GPT，把它整理成現在這一件可驗證作品。</p></div>${pill(selected?'selected':candidate?'candidate':'unknown')}</div>

    <div class="hero-grid">
      <article class="surface">
        <span class="kicker">目前正式主線</span>
        <h3>${esc(selected?.title||'尚未選定')}</h3>
        <p>${esc(selected?.success_evidence||'先輸入你想達成的方向；AI 可以整理，但只有你能確認正式主線。')}</p>
        ${selected?pill('selected'):''}
      </article>
      <article class="surface">
        <span class="kicker">長期方向</span>
        <h3>${esc(dir.key?human(dir.key):'尚未形成')}</h3>
        <p>${esc(dir.goal||'方向會依真實作品與能力證據逐步修正，不會只靠一次回答定案。')}</p>
        <small class="muted">方向可以調整；目前作品才是現在真正要完成的東西。</small>
      </article>
    </div>

    ${candidate?`
    <div class="section-head"><div><h2>待你確認的新主線</h2><p>AI 可以先替它整理路徑，但在你確認前仍只是候選。</p></div></div>
    <article class="surface">
      <h3>${esc(candidate.title)}</h3>
      <p><b>你目前認為的完成方向：</b>${esc(candidate.success_evidence)}</p>
      ${candidate.why_now?`<p><b>為什麼現在做：</b>${esc(candidate.why_now)}</p>`:''}
      <div class="project-actions">
        <button class="primary-btn" id="selectCandidate">確認為目前主線</button>
        <button class="ghost-btn" id="rejectCandidate">不要走這條</button>
      </div>
    </article>`:''}

    ${planPanel}

    <div class="section-head"><div><h2>${candidate?'調整這個方向':'輸入一個想走的方向'}</h2><p>最少只要告訴我「你想達成什麼」。完成標準與技能拆解可以交給 GPT 先整理，再由作品結果驗證。</p></div></div>
    <form class="surface project-form" id="projectForm">
      <label><b>我想往哪裡走／想完成什麼</b><textarea id="projectTitle" placeholder="例如：我想把 AI 自動化學到可以接遠端工作，先從能做出實際作品開始">${esc(candidate?.title||'')}</textarea></label>
      <label><b>如果你已經知道，怎樣算達成（可選）</b><textarea id="projectEvidence" placeholder="不知道可以留空，GPT 會先拆成第一件可驗證作品">${esc(candidate?.success_evidence||'')}</textarea></label>
      <details>
        <summary>補充：為什麼現在想做</summary>
        <textarea id="projectWhy" placeholder="可選填">${esc(candidate?.why_now||'')}</textarea>
      </details>
      <div class="row-between">
        <div id="projectMsg" class="muted">${esc(notice||'保存後會自動交給 GPT 整理；AI 結果先是候選，不會直接改成你已學會。')}</div>
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
      await renderProjects('已保存。GPT 路徑整理已自動排入，完成後會直接顯示第一件作品與要驗證的技能。');
    }catch(e){msg.textContent=e.message||'保存失敗';}
  });

  $('#selectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#selectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'select'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjects('已確認為正式主線；系統會保留 GPT 整理結果，但能力仍要靠作品證據更新。');
    }catch(e){btn.disabled=false;$('#projectMsg').textContent=e.message||'設定失敗';}
  });

  $('#rejectCandidate')?.addEventListener('click',async()=>{
    const btn=$('#rejectCandidate');btn.disabled=true;
    try{
      await A.decidePersonalOutcomeCandidate({routeId:candidate.id,decision:'reject'});
      D=await A.getSnapshot();
      renderHome();
      await renderProjects('這個候選方向已拒絕，不會進入正式主線。');
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
      <div><h2>學習陪伴</h2><p>貼入真實文字後，系統先保留原文，再讓你用自己的話回答；AI 解釋會進任務佇列，本機執行器未開啟時不會假裝已完成。</p></div>
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
      <div><h2>我的正式學習</h2><p>只顯示正式個人資料（data_scope=real：代表真實使用資料，不包含測試與系統資料）。</p></div>
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
      detail.innerHTML='<div class="empty">目前沒有正式學習單元（Learning Unit：一次要理解或練習的一小段內容）。</div>';
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
    detail.innerHTML=`
      <span class="kicker">正式來源</span>
      <h2>${esc(active.presentation?.title||active.session?.title||'學習單元')}</h2>
      <p class="teach">${esc(active.zh_explanation||'尚未產生 AI 解釋。')}</p>
      <details open><summary>原始內容</summary><p>${esc(active.original_text||'')}</p></details>
      <div class="provenance">來源：${esc(active.session?.source_ref||'未記錄')} · 資料範圍：正式個人資料（real）</div>
      <div class="evidence-box">
        <b>AI 解釋任務 · ${esc(aiLabel)}</b>
        <span>${aiText?esc(aiText):aiError?esc(aiError):ai?'本機執行器（worker：在你的 Mac 取出任務並交給 ChatGPT）處理後，結果會顯示在這裡。':'尚未建立 AI 解釋任務；你仍可先自己閱讀與作答。'}</span>
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
        await renderLearn(ai?.status==='failed'?'AI 解釋任務已重新排隊。':'AI 解釋任務已排入佇列。');
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
    root.innerHTML='<div class="section-head"><div><h2>知識連結（Synapse）</h2><p>把你的來源、概念與學習證據串成可追溯的關係圖。</p></div></div><div class="empty">目前未讀取正式知識連結；不會用快取或示範資料冒充個人結果。登入後才讀取正式個人資料。</div>';
    return;
  }

  root.innerHTML='<div class="empty">正在讀取正式個人知識連結…</div>';
  let synapse=D?.synapse||null;
  if(!synapse?.nodes){
    try{synapse=await A.getPersonalSynapse();D.synapse=synapse;}
    catch(e){root.innerHTML=`<div class="empty">知識連結載入失敗：${esc(e.message||e)}</div>`;return;}
  }

  const rawNodes=Array.isArray(synapse?.nodes)?synapse.nodes:[];
  const edges=Array.isArray(synapse?.edges)?synapse.edges:[];
  if(!rawNodes.length){
    root.innerHTML='<div class="section-head"><div><h2>知識連結（Synapse）</h2><p>Synapse 是把相關來源、概念與證據串起來的知識關係圖。</p></div></div><div class="empty">目前還沒有足夠的正式個人來源形成知識連結。</div>';
    return;
  }

  const sources=rawNodes.filter(n=>n.type==='source');
  const concepts=rawNodes.filter(n=>n.type!=='source');
  const spread=(items,x)=>items.map((n,i)=>({...n,x,y:items.length===1?50:15+(70*i/Math.max(items.length-1,1))}));
  const nodes=[...spread(sources,20),...spread(concepts,75)];

  root.innerHTML=`<div class="section-head"><div><h2>知識連結（Synapse）</h2><p>Synapse 是把正式來源、概念與學習證據串成可追溯關係圖；連結只在已有來源證據時顯示。</p></div><span class="pill success">正式個人資料</span></div><div class="graph" id="graph"></div><div class="provenance">目前資料：${esc(synapse?.summary?.source_count??sources.length)} 個來源 · ${esc(synapse?.summary?.concept_count??concepts.length)} 個概念 · ${esc(synapse?.summary?.edge_count??edges.length)} 條關係。這些連結代表來源與概念的關聯，不等於你已經熟練。</div>`;
  const g=$('#graph');
  edges.forEach(e=>{const a=nodes.find(n=>n.id===e.source),b=nodes.find(n=>n.id===e.target);if(!a||!b)return;const line=document.createElement('div');line.className='edge';const dx=b.x-a.x,dy=b.y-a.y;line.style.left=a.x+'%';line.style.top=a.y+'%';line.style.width=Math.hypot(dx,dy)+'%';line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;g.appendChild(line)});
  nodes.forEach(n=>{const b=document.createElement('button');b.className='node '+(n.type==='source'?'center':'');b.style.left=n.x+'%';b.style.top=n.y+'%';b.textContent=n.label||human(n.id);b.title=n.type==='source'?'正式個人來源':'概念節點；不代表已熟練';g.appendChild(b)});
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
    if(st==='blocked'||st==='blocked_external')return {label:'外部服務尚未接通',cls:'danger'};
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
      <div id="simulationResult" class="empty">尚未試跑。系統只先顯示「目前階段目標 → 一件作品 → 完成後怎麼判斷」，並保留可能的延伸方向；真正下一階段要等作品結果再決定。</div>
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
    const current=stages[0];
    const modeLabel=mode==='goal'?'已有目標':'看到內容／主題';
    $('#simulationResult').innerHTML=`
      <b>試跑路徑：${esc(modeLabel)} · 不會儲存</b>
      <p>${esc(raw)}</p>
      <div class="surface">
        <span class="kicker">目前階段</span>
        <p><b>階段目標：</b>${esc(current.goal)}</p>
        <p><b>這一階段只做一件作品：</b>${esc(current.artifact)}</p>
        <p><b>作品完成後怎麼判斷：</b>${esc(current.next)}</p>
      </div>
      <div class="evidence-box"><b>延伸性</b><span>後面仍有可延伸方向，但現在不先把第 2、3 階段寫死。等這件作品有結果後，再依「有效／無效／卡住／產生新問題」決定下一階段。</span></div>
      <div class="provenance">目前這是通用作品骨架。AI 任務執行層已具備佇列與狀態機，但 provider（真正執行 AI 推理的服務）尚未接上，因此這裡不假裝已做個人化動態推理。</div>`;
  }));
}

function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const t={home:'今天只做一件最值得做的事',projects:'把候選方向變成可驗證的個人主線',learn:'把複雜內容變成可以理解的東西',synapse:'看見知識與經驗如何連起來',ceo:'系統建置與 AI 團隊狀態'};$('#pageTitle').textContent=t[name]||t.home;if(name==='projects')renderProjects();if(name==='learn')renderLearn();if(name==='synapse')renderSynapse();if(name==='ceo')renderSystem();
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
  $('#authBox')?.remove();const box=document.createElement('div');box.id='authBox';box.className='auth-box';box.innerHTML=A.liveStatus==='live'?'<span class="pill success">正式資料已連線（Live）</span><button class="ghost-btn small" id="signOut">登出</button>':'<button class="ghost-btn small" id="openLogin">登入</button>';$('.top-actions').prepend(box);$('#openLogin')?.addEventListener('click',loginModal);$('#signOut')?.addEventListener('click',async()=>{await A.signOut();location.reload()});
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
  try{await A.initialize();D=await A.getSnapshot();renderHome();await renderProjects();await renderLearn();await renderSynapse();authBar();await sendSessionLifecycleProbe();$$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j)setView(j.dataset.jump);if(e.target.closest('[data-auth]'))loginModal()});$('#refreshBtn').onclick=()=>location.reload();}
  catch(e){$('.main').innerHTML=`<div class="empty">第二大腦 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
