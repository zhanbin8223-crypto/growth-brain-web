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
  const root=$('#view-ceo');
  root.innerHTML='<div class="empty">正在載入系統與員工狀態…</div>';
  if(!SYSTEM){
    try{SYSTEM=await A.getSystemCockpit();}
    catch(e){SYSTEM={error:e.code||e.message}}
  }
  if(SYSTEM?.error){
    root.innerHTML=`<div class="empty">系統狀態讀取失敗：${esc(SYSTEM.error)}<br>其他個人頁面仍可繼續使用。</div>`;
    return;
  }

  const legacy=SYSTEM?.ceo||{};
  const latest=SYSTEM?.ceo_latest||{};
  const cur=latest.current||legacy.current||{};
  const next=latest.next_action||legacy.next_action||{};
  const runtime=latest.runtime_truth||{};
  const pkgs=Array.isArray(SYSTEM?.work_queue?.packages)?SYSTEM.work_queue.packages:[];
  const team=SYSTEM?.skill_team||{};
  const roles=Array.isArray(team.executable_roles)?team.executable_roles:[];
  const planned=Array.isArray(team.planned_roles)?team.planned_roles:[];
  const usage=Array.isArray(team.recent_usage)?team.recent_usage:[];
  const activePkgs=[...pkgs]
    .filter(p=>['in_progress','blocked','ready'].includes(String(p.status||'')))
    .sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0));
  const packageBlockers=activePkgs.flatMap(p=>(Array.isArray(p.blockers)?p.blockers:[]).map(b=>({...b,package_title:p.title,package_key:p.package_key})));

  const statusLabel=s=>({
    in_progress:'正在執行',
    blocked:'受阻',
    ready:'待開始',
    completed:'已完成',
    cancelled:'已取消',
    candidate:'候選試用',
    active:'可調用',
    planned:'候選／尚未接入',
    installed:'已安裝',
    builtin:'內建'
  }[String(s||'').toLowerCase()]||statusText(s||'unknown'));

  const roleInfo={
    'ceo-orchestrator':['CEO／總控','CEO Orchestrator','讀取目前目標與系統狀態，選主線、分工、取捨並做最後驗收。'],
    'goal-closure-operator':['達案執行官','Goal Closure Operator','從目前狀態一路推進到驗收，不把「做完一小步」當成整個目標完成。'],
    'logic-reality-analyst':['邏輯／真實性分析員','Logic & Reality Analyst','檢查真實資料、測試資料與系統資料有沒有混在一起，避免過度擬合與假進展。'],
    'safe-sql-execution':['資料庫安全工程師','DB Safety Engineer','資料庫修改前後做安全檢查，避免權限、資料污染與高風險 SQL。'],
    'supabase-engineer':['Supabase 後端工程師','Supabase Engineer','處理資料庫、登入、雲端函式、權限與網站後端資料流。'],
    'postgres-safety-reviewer':['Postgres 安全審查員','Postgres Safety Reviewer','獨立檢查資料表、函式、權限與效能，避免後端改動留下漏洞。'],
    'work-browser-qa':['瀏覽器驗收員','Browser QA','用真實瀏覽器檢查登入、手機版、重新整理、操作流程與錯誤狀態。'],
    'github-operator':['GitHub 版本管理員','GitHub Operator','讀寫正式網站程式、提交版本、保留部署與修改證據。'],
    'work-web-operator':['網站實作工程師','Web Implementer','負責網站程式、建置、部署與需要實際執行環境的修改。'],
    'plugin-resource-scout':['工具／資源偵察員','Resource Scout','需要外部工具或服務時，先找目前可用資源與連接方式。'],
    'product-flow-architect':['產品流程架構師','Product Flow Architect','把目標、作品、證據、學習與下一步串成使用者看得懂的完整流程。'],
    'impeccable':['介面設計審查員','Impeccable Design Reviewer','檢查資訊層級、認知負擔、文案、術語、手機版與視覺一致性。'],
    'frontend-design-lead':['前端視覺設計主管','Frontend Design Lead','在產品流程穩定後建立正式視覺方向、版面規則與設計系統。'],
    'synapse-visualization-specialist':['知識連結視覺化員工','Synapse Visualization Specialist','把來源、概念、證據與作品關係做成可理解、可互動的視覺圖。'],
    'interview-me':['需求訪談官','Requirements Interviewer','只有關鍵需求真的不清楚時才補問，避免重複問已經知道的事情。'],
    'evaluation':['員工考核官','Employee Evaluator','比較同類員工的實用度、返工、越界與缺陷，協助汰換低分重複角色。']
  };
  const describeRole=r=>{
    const info=roleInfo[r.skill_key]||[r.role_name||human(r.skill_key),human(r.skill_key),r.trigger_summary||'依任務需要調用。'];
    return {zh:info[0],en:info[1],desc:info[2]};
  };

  const roleCards=roles.map(r=>{
    const d=describeRole(r);
    return `<article class="surface"><div class="row-between"><div><b>${esc(d.zh)}</b><small class="muted"> · ${esc(d.en)}</small></div><span class="pill success">可調用</span></div><p>${esc(d.desc)}</p></article>`;
  }).join('');

  const importantCandidates=['product-flow-architect','impeccable','frontend-design-lead','synapse-visualization-specialist'];
  const candidateCards=planned
    .filter(r=>importantCandidates.includes(r.skill_key))
    .sort((a,b)=>importantCandidates.indexOf(a.skill_key)-importantCandidates.indexOf(b.skill_key))
    .map(r=>{
      const d=describeRole(r);
      return `<article class="surface"><div class="row-between"><div><b>${esc(d.zh)}</b><small class="muted"> · ${esc(d.en)}</small></div><span class="pill warn">候選試用</span></div><p>${esc(d.desc)}</p><small class="muted">目前已登記在員工庫；需要對應任務時才試用，不會因為存在就每次都載入。</small></article>`;
    }).join('');

  const usageCards=usage.slice(0,6).map(u=>{
    const d=roleInfo[u.skill_key]||[human(u.skill_key),human(u.skill_key),''];
    return `<div class="surface"><div class="row-between"><b>${esc(d[0])}</b><span class="pill success">實用度 ${esc(u.usefulness??'-')}/5</span></div><p>${esc(u.notes||'')}</p><small class="muted">返工 ${esc(u.rework_count??0)} · 越界 ${esc(u.scope_violations??0)} · 找到缺陷 ${esc(u.defects_found??0)}</small></div>`;
  }).join('');

  const packageCards=activePkgs.slice(0,5).map((p,i)=>{
    const blockers=Array.isArray(p.blockers)?p.blockers:[];
    const steps=Array.isArray(p.steps)?p.steps:[];
    const currentStep=steps.find(s=>['current','in_progress','implemented_pending_real_result'].includes(String(s.status||'')))||steps.find(s=>String(s.status||'')!=='completed')||null;
    const cls=p.status==='blocked'?'danger':p.status==='in_progress'?'warn':'';
    return `<article class="surface">
      <div class="row-between"><div><span class="kicker">${i===0?'最近更新':'工作包'}</span><h3>${esc(p.title||human(p.package_key))}</h3></div><span class="pill ${cls}">${esc(statusLabel(p.status))}</span></div>
      <p>${esc(p.objective||'')}</p>
      ${currentStep?`<div class="evidence-box"><b>目前做到</b><span>${esc(currentStep.title||currentStep.goal||currentStep.action||human(currentStep.key))}</span></div>`:''}
      ${blockers.length?`<div class="evidence-box"><b>目前卡住</b><span>${esc(blockers[0].reason||blockers[0].code||'待處理')}</span></div>`:''}
      <details><summary>查看工作包細節</summary><small class="muted">內部識別：${esc(p.package_key||'')}</small></details>
    </article>`;
  }).join('');

  const blockers=packageBlockers.slice(0,6);
  const nextTitle=next.title||'目前沒有額外下一步';
  const nextAction=next.action||'依最新工作包繼續執行。';

  root.innerHTML=`
    <div class="section-head"><div><h2>系統現在在做什麼</h2><p>這裡只顯示第二大腦本身的建置與 AI 團隊，不混進你的個人成長首頁。</p></div>${pill(cur.status||'current')}</div>

    <article class="hero-card">
      <span class="kicker">${esc(cur.stage||'目前階段')}</span>
      <h2>${esc(cur.title||'正在整理最新系統狀態')}</h2>
      <p>${esc(cur.objective||latest.reason||'')}</p>
      <div class="evidence-box"><b>接下來</b><span>${esc(nextTitle)} — ${esc(nextAction)}</span></div>
    </article>

    <div class="metrics">
      <div><strong>${roles.length}</strong><span>可立即調用員工</span></div>
      <div><strong>${activePkgs.length}</strong><span>進行中工作包</span></div>
      <div><strong>${packageBlockers.length}</strong><span>目前阻塞</span></div>
    </div>

    <div class="section-head"><div><h2>AI 員工團隊</h2><p>CEO 依任務分工，不會每次把所有員工一起叫來。中文是角色名稱，英文是對應的技術／技能名稱。</p></div></div>
    <div class="stack">${roleCards||'<div class="empty">目前沒有讀到可執行員工。</div>'}</div>

    ${candidateCards?`<details class="surface"><summary><b>候選／試用員工</b></summary><p>這些已加入員工庫，但尚未視為正式可執行 Skill；有對應任務時才試用與評分。</p><div class="stack">${candidateCards}</div></details>`:''}

    <div class="section-head"><div><h2>最近的員工分工紀錄</h2><p>實際做過工作才留下評分；同類員工累積足夠樣本後才會進入淘汰比較。</p></div></div>
    <div class="stack">${usageCards||'<div class="empty">目前還沒有員工使用紀錄。</div>'}</div>

    <div class="section-head"><div><h2>工作包</h2><p>工作包是一組有明確完成條件的工作，不等於你的個人作品。最近更新的工作放最前面。</p></div></div>
    <div class="stack">${packageCards||'<div class="empty">目前沒有進行中的工作包。</div>'}</div>

    <div class="section-head"><div><h2>目前阻塞</h2><p>阻塞會留下原因與恢復點，但不會讓其他不衝突工作一起停住。</p></div></div>
    <div class="stack">${blockers.length?blockers.map(b=>`<div class="surface"><div class="row-between"><b>${esc(b.package_title||'待處理問題')}</b><span class="pill danger">受阻</span></div><p>${esc(b.reason||'目前缺少必要條件。')}</p>${b.next_action?`<div class="evidence-box"><b>恢復方式</b><span>${esc(b.next_action)}</span></div>`:''}</div>`).join(''):'<div class="empty">目前沒有已登記的阻塞。</div>'}</div>

    <details class="surface">
      <summary><b>系統技術狀態</b></summary>
      <p>正式網站：${esc(runtime.production_url||'已部署')}</p>
      <p>GPT 網頁版橋接：${esc(runtime.ai_worker_bridge==='e2e_verified_system_validation'?'已完成橋接驗證':'依最新執行狀態')}</p>
      <p>API 模式：${esc(runtime.api_mode?'已預留同一 AI 任務介面，可後續接 API／本地模型':'尚未記錄')}</p>
      <small class="muted">這些是維運資訊，不代表你的個人作品或能力進展。</small>
    </details>
  `;
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
