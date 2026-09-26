const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const A=window.GROWTH_BRAIN_ADAPTER;
let D=null;
let SYSTEM=null;

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pct=v=>`${Math.round((Number(v)||0)*100)}%`;
const pill=s=>{const k=String(s||'unknown').toLowerCase();const c=['completed','available','live','active'].includes(k)?'success':['blocked','danger'].includes(k)?'danger':['current','planned','pending','supporting_only'].includes(k)?'warn':'';return `<span class="pill ${c}">${esc(s||'unknown')}</span>`};
const human=s=>String(s||'').replace(/^concept:/,'').replace(/^logic:/,'').replaceAll('_',' ');
const home=()=>D?.personalHome||{};
const attempt=u=>A.latestAttempt(u.id);

function modeStrip(){
  const live=A.liveStatus==='live';
  return `<div class="system-strip"><div><span class="system-kicker">DATA MODE</span><b>${live?'Live Personal Home':'Cached Personal Home'}</b><span>single-user private</span></div><p>${live?'首頁只讀 authenticated Personal Home；系統資料按需載入。':'目前顯示可信快取，不把快取冒充即時資料。'}</p></div>`;
}

function renderHome(){
  const H=home(),dir=H.primary_direction||{},action=H.primary_action||{},learn=H.learning_support||{},summary=learn.summary||{},nodes=(H.synapse_highlights?.nodes||[]).slice(0,4),sys=H.system_health||{};
  const cta=A.liveStatus==='signed_out'?'<button class="primary-btn" data-auth>登入同步我的 Growth Brain</button>':'<button class="primary-btn" disabled>等待選定個人主線</button>';
  $('#view-home').innerHTML=`${modeStrip()}
  <div class="hero-grid">
    <article class="hero-card"><span class="kicker">NOW</span><h2>${esc(action.title||'先選一個真實下一步')}</h2><p>${esc(action.why||'目前還沒有足夠 evidence 替你自動選唯一主線。')}</p><div class="evidence-box"><b>做到什麼算完成</b><span>${esc(action.success_evidence||'產生一個真實作品或行動證據。')}</span></div>${cta}</article>
    <article class="direction-card"><span class="kicker">DIRECTION</span><h3>${esc(dir.key?human(dir.key):'尚未同步')}</h3><p>${esc(dir.goal||'登入後同步目前方向。')}</p><div class="row-between"><span>信心 ${pct(dir.confidence)}</span>${pill(dir.status)}</div></article>
  </div>
  <div class="metrics"><div><strong>${esc(summary.unverified_count??0)}</strong><span>未驗證概念</span></div><div><strong>${esc(summary.forming_count??0)}</strong><span>形成證據中</span></div><div><strong>${A.candidateEvidenceCount()}</strong><span>候選作答</span></div></div>
  <section><div class="section-head"><div><h2>Learning Support</h2><p>學習支援主線，不搶主線。</p></div>${pill(learn.role||'supporting_only')}</div><div class="surface"><b>${esc(learn.primary_card?.label||'未驗證')}</b><p>${esc(learn.primary_card?.description||'先留下可驗證 evidence。')}</p><small>${esc(learn.primary_card?.next_action||'完成一次回答或實作')}</small></div></section>
  <section><div class="section-head"><div><h2>Synapse Highlights</h2><p>首頁只看重點，完整關係圖在 Synapse。</p></div></div><div class="highlight-grid">${nodes.map(n=>`<div class="highlight"><b>${esc(n.label||human(n.k))}</b><span>${esc(n.n??0)} 個訊號 · ${pct(n.c)}</span></div>`).join('')||'<div class="empty">目前沒有重點節點。</div>'}</div></section>
  <section><div class="section-head"><div><h2>System Health</h2><p>只顯示摘要，不把系統建置當成你的個人 CTA。</p></div></div><div class="surface row-between"><div><b>${sys.build_in_progress?'系統仍在建置':'系統穩定'}</b><p>${esc(sys.parallel_blocker_count??0)} 個平行 blocker</p></div><button class="ghost-btn" data-jump="ceo">查看系統</button></div></section>`;
}

function renderLearn(){
  const units=D.video?.units||[],src=D.video?.source||{};
  $('#view-learn').innerHTML=`<div class="section-head"><div><h2>Learning Companion</h2><p>把內容轉成可理解、可作答、可留下 evidence 的單元。</p></div><div>${pill(src.transcript_status)} ${pill(src.language)}</div></div><div class="provenance">${src.exact_timestamps?'已有可定位 transcript。':'目前只有可追溯 fallback，沒有精確時間軸。'}</div><div class="lesson-layout"><div class="lesson-list">${units.map((u,i)=>`<button class="lesson-item ${i===0?'active':''}" data-unit="${esc(u.id)}"><span>${esc(u.mode)}</span><b>${esc(u.title)}</b><small>${attempt(u)?'已作答':'未作答'}</small></button>`).join('')}</div><article class="lesson-detail" id="lessonDetail"></article></div>`;
  let active=units[0];
  const draw=()=>{const u=active;if(!u){$('#lessonDetail').innerHTML='<div class="empty">沒有 Learning Unit。</div>';return;}const at=attempt(u);$('#lessonDetail').innerHTML=`<span class="kicker">${esc(u.mode)}</span><h2>${esc(u.title)}</h2><p class="teach">${esc(u.zh)}</p>${u.flow?`<div class="flow">${u.flow.map(x=>`<span>${esc(x)}</span>`).join('<i>→</i>')}</div>`:''}<details><summary>看原文</summary><p>${esc(u.original)}</p></details><div class="answer"><b>你的 evidence 題</b><p>${esc(u.prompt)}</p><textarea id="answerInput">${esc(at?.response||'')}</textarea><button class="primary-btn" id="submitAnswer">${A.mode==='live'?'送出候選 evidence':'先存候選 evidence'}</button><div id="answerMsg" class="muted"></div></div>`;$('#submitAnswer')?.addEventListener('click',async()=>{const m=$('#answerMsg');try{m.textContent='處理中…';await A.submitAttempt({unitId:u.id,response:$('#answerInput').value,evidenceType:u.expected_evidence_type});m.textContent=A.mode==='live'?'已送出，等待 review。':'已存此瀏覽器。';draw();renderHome();}catch(e){m.textContent=e.message||'失敗';}})};
  $$('.lesson-item').forEach(el=>el.addEventListener('click',()=>{$$('.lesson-item').forEach(x=>x.classList.remove('active'));el.classList.add('active');active=units.find(x=>x.id===el.dataset.unit);draw();}));draw();
}

function renderSynapse(){
  const nodes=D.synapse?.nodes||[],edges=D.synapse?.edges||[];
  $('#view-synapse').innerHTML=`<div class="section-head"><div><h2>Synapse</h2><p>完整圖只顯示已有 typed relation 的連結。</p></div>${pill('evidence-aware')}</div><div class="graph" id="graph"></div>`;
  const g=$('#graph');
  edges.forEach(e=>{const a=nodes.find(n=>n.id===e.source),b=nodes.find(n=>n.id===e.target);if(!a||!b)return;const line=document.createElement('div');line.className='edge';const dx=b.x-a.x,dy=b.y-a.y;line.style.left=a.x+'%';line.style.top=a.y+'%';line.style.width=Math.hypot(dx,dy)+'%';line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;g.appendChild(line)});
  nodes.forEach(n=>{const b=document.createElement('button');b.className='node '+(n.center?'center':'');b.style.left=n.x+'%';b.style.top=n.y+'%';b.textContent=n.label;g.appendChild(b)});
}

async function renderSystem(){
  const root=$('#view-ceo');root.innerHTML='<div class="empty">載入 System Cockpit…</div>';
  if(!SYSTEM){try{SYSTEM=await A.getSystemCockpit();}catch(e){SYSTEM={error:e.code||e.message}}}
  if(SYSTEM?.error){root.innerHTML=`<div class="empty">System Cockpit 無法讀取：${esc(SYSTEM.error)}</div>`;return}
  const ceo=SYSTEM?.ceo||{},cur=ceo.current||{},blockers=ceo.parallel_blockers||[],pkgs=SYSTEM?.work_queue?.packages||[],roles=SYSTEM?.skill_team?.executable_roles||[];
  root.innerHTML=`<div class="section-head"><div><h2>System Cockpit</h2><p>系統建置、Work、技能員工與 blocker 都留在這裡。</p></div>${pill(cur.status)}</div><div class="hero-grid"><article class="surface"><span class="kicker">CURRENT BUILD</span><h3>${esc(cur.stage||'')} · ${esc(cur.title||'')}</h3><p>${esc(cur.objective||'')}</p></article><article class="surface"><span class="kicker">RUNTIME</span><div class="metrics compact"><div><strong>${pkgs.length}</strong><span>Work</span></div><div><strong>${roles.length}</strong><span>角色</span></div><div><strong>${blockers.length}</strong><span>Blockers</span></div></div></article></div><div class="section-head"><div><h2>Blockers</h2><p>只處理系統問題，不污染 Personal Home。</p></div></div><div class="stack">${blockers.map(b=>`<div class="surface"><b>${esc(b.stage)} · ${esc(b.title)}</b><p>${esc(b.blocker?.reason||b.blocker||'')}</p></div>`).join('')||'<div class="empty">目前沒有平行 blocker。</div>'}</div>`;
}

function setView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));
  const t={home:'今天只做一件最值得做的事',learn:'把複雜內容變成可以理解的東西',synapse:'看見知識與經驗如何連起來',ceo:'系統建置與 AI 團隊狀態'};$('#pageTitle').textContent=t[name]||t.home;if(name==='ceo')renderSystem();
}

function authBar(){
  $('#authBox')?.remove();const box=document.createElement('div');box.id='authBox';box.className='auth-box';box.innerHTML=A.liveStatus==='live'?'<span class="pill success">Live</span><button class="ghost-btn small" id="signOut">登出</button>':'<button class="ghost-btn small" id="openLogin">登入</button>';$('.top-actions').prepend(box);$('#openLogin')?.addEventListener('click',loginModal);$('#signOut')?.addEventListener('click',async()=>{await A.signOut();location.reload()});
}
function loginModal(){
  let m=$('#loginModal');if(!m){m=document.createElement('div');m.id='loginModal';m.className='modal-backdrop';m.innerHTML='<div class="modal-card"><button class="modal-close" id="closeLogin">×</button><span class="kicker">SINGLE-USER PRIVATE</span><h2>登入 Growth Brain</h2><p>只允許既有帳號登入，不建立新帳號。</p><input id="loginEmail" type="email" placeholder="your@email.com"><button class="primary-btn" id="sendLogin">寄登入連結</button><div id="loginMsg" class="muted"></div></div>';document.body.appendChild(m);$('#closeLogin').onclick=()=>m.classList.remove('show');$('#sendLogin').onclick=async()=>{const msg=$('#loginMsg');try{msg.textContent='寄送中…';await A.requestMagicLink($('#loginEmail').value);msg.textContent='已送出，請從信箱回到網站。'}catch(e){msg.textContent=e.message||'失敗'}}}m.classList.add('show');
}

async function init(){
  try{await A.initialize();D=await A.getSnapshot();renderHome();renderLearn();renderSynapse();authBar();$$('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j)setView(j.dataset.jump);if(e.target.closest('[data-auth]'))loginModal()});$('#refreshBtn').onclick=()=>location.reload();}
  catch(e){$('.main').innerHTML=`<div class="empty">Growth Brain 初始化失敗：${esc(e.message||e)}</div>`}
}
init();
