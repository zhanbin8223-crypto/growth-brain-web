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

function renderLearn(){
  const units=D.video?.units||[],src=D.video?.source||{};
  $('#view-learn').innerHTML=`<div class="section-head"><div><h2>學習陪伴</h2><p>把內容轉成可理解、可作答、可留下 evidence 的單元。</p></div><div>${pill(src.transcript_status)} ${pill(src.language)}</div></div><div class="provenance">${src.exact_timestamps?'已有可定位 transcript。':'目前只有可追溯 fallback，沒有精確時間軸。'}</div><div class="lesson-layout"><div class="lesson-list">${units.map((u,i)=>`<button class="lesson-item ${i===0?'active':''}" data-unit="${esc(u.id)}"><span>${esc(u.mode)}</span><b>${esc(u.title)}</b><small>${attempt(u)?'已作答':'未作答'}</small></button>`).join('')}</div><article class="lesson-detail" id="lessonDetail"></article></div>`;
  let active=units[0];
  const draw=()=>{const u=active;if(!u){$('#lessonDetail').innerHTML='<div class="empty">沒有 Learning Unit。</div>';return;}const at=attempt(u);$('#lessonDetail').innerHTML=`<span class="kicker">${esc(u.mode)}</span><h2>${esc(u.title)}</h2><p class="teach">${esc(u.zh)}</p>${u.flow?`<div class="flow">${u.flow.map(x=>`<span>${esc(x)}</span>`).join('<i>→</i>')}</div>`:''}<details><summary>看原文</summary><p>${esc(u.original)}</p></details><div class="answer"><b>你的驗證題</b><p>${esc(u.prompt)}</p><textarea id="answerInput">${esc(at?.response||'')}</textarea><button class="primary-btn" id="submitAnswer">${A.mode==='live'?'送出候選證據':'先存候選證據'}</button><div id="answerMsg" class="muted"></div></div>`;$('#submitAnswer')?.addEventListener('click',async()=>{const m=$('#answerMsg');try{m.textContent='處理中…';await A.submitAttempt({unitId:u.id,response:$('#answerInput').value,evidenceType:u.expected_evidence_type});m.textContent=A.mode==='live'?'已送出，等待審核。':'已存此瀏覽器。';draw();renderHome();}catch(e){m.textContent=e.message||'失敗';}})};
  $$('.lesson-item').forEach(el=>el.addEventListener('click',()=>{$$('.lesson-item').forEach(x=>x.classList.remove('active'));el.classList.add('active');active=units.find(x=>x.id===el.dataset.unit);draw();}));draw();
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
  root.innerHTML=`<div class="section-head"><div><h2>系統控制台</h2><p>系統建置、Work、技能員工與 blocker 都留在這裡。</p></div>${pill(cur.status)}</div><div class="hero-grid"><article class="surface"><span class="kicker">目前建置</span><h3>${esc(cur.stage||'')} · ${esc(cur.title||'')}</h3><p>${esc(cur.objective||'')}</p></article><article class="surface"><span class="kicker">執行狀態</span><div class="metrics compact"><div><strong>${pkgs.length}</strong><span>Work</span></div><div><strong>${roles.length}</strong><span>角色</span></div><div><strong>${blockers.length}</strong><span>阻塞項目</span></div></div></article></div><div class="section-head"><div><h2>阻塞項目</h2><p>只處理系統問題，不污染 Personal Home。</p></div></div><div class="stack">${blockers.map(b=>`<div class="surface"><b>${esc(b.stage)} · ${esc(b.title)}</b><p>${esc(b.blocker?.reason||b.blocker||'')}</p></div>`).join('')||'<div class="empty">目前沒有平行 blocker。</div>'}</div>`;
}

function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const t={home:'今天只做一件最值得做的事',projects:'把候選方向變成可驗證的個人主線',learn:'把複雜內容變成可以理解的東西',synapse:'看見知識與經驗如何連起來',ceo:'系統建置與 AI 團隊狀態'};$('#pageTitle').textContent=t[name]||t.home;if(name==='projects')renderProjects();if(name==='ceo')renderSystem();
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
  try{await A.initialize();D=await A.getSnapshot();renderHome();await renderProjects();renderLearn();renderSynapse();authBar();await sendSessionLifecycleProbe();$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j)setView(j.dataset.jump);if(e.target.closest('[data-auth]'))loginModal()});$('#refreshBtn').onclick=()=>location.reload();}
  catch(e){$('.main').innerHTML=`<div class="empty">第二大腦 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
