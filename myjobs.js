/* 我的提問：列出你送出、需要 AI 處理的工作（ai_jobs），清楚顯示排隊／處理／完成／失敗與原因。 */
(function(root){
  const OFFLINE_MS=10*60*1000;
  const STATUS={pending:'排隊中',claimed:'處理中',processing:'處理中',completed:'完成',failed:'失敗',cancelled:'已取消'};
  const KIND={learning_explanation:'學習・AI 解釋',event_funnel_v1:'研究室・拆解',self_exploration_v1:'研究室・今日探索',path_plan:'作品・路徑規劃',inbox_triage:'收件匣・分類',artifact_stage_unblock:'作品・卡關協助'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function statusLabel(s){return STATUS[s]||'狀態待確認';}
  function statusClass(s){return s==='completed'?'ok':s==='failed'?'bad':s==='cancelled'?'off':(s==='pending'?'wait':'run');}
  function kindLabel(t){return KIND[t]||(String(t||'').startsWith('tech_radar')?'系統・技術雷達':'系統任務');}
  function fmtTime(iso){if(!iso)return '—';const d=new Date(iso);if(isNaN(d))return '—';const p=n=>String(n).padStart(2,'0');return (d.getMonth()+1)+'/'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());}
  function dur(sec){sec=Math.max(0,Math.round(sec||0));if(sec<60)return sec+' 秒';const m=Math.round(sec/60);if(m<60)return m+' 分鐘';const h=Math.floor(m/60);if(h<48)return h+' 小時'+(m%60?' '+(m%60)+' 分':'');return Math.floor(h/24)+' 天 '+(h%24)+' 小時';}
  function workerState(lastSeen,now=Date.now()){
    const t=lastSeen?new Date(lastSeen).getTime():NaN;
    if(!Number.isFinite(t))return {online:false,text:'處理程式從未上線，AI 工作會一直排隊。'};
    if(now-t<=OFFLINE_MS)return {online:true,text:'處理程式在線，會依序處理。'};
    return {online:false,text:'處理程式離線，最後上線 '+fmtTime(lastSeen)+'。工作已存好，它上線後才會處理。'};
  }
  function waitText(j,now=Date.now()){
    const c=new Date(j.created_at).getTime();
    if(['pending','claimed','processing'].includes(j.status))return '已等 '+dur((now-c)/1000);
    if(j.status==='completed'&&j.completed_at)return '花了 '+dur((new Date(j.completed_at).getTime()-c)/1000);
    return '';
  }
  function resultLink(j){
    if(j.status!=='completed')return null;
    if(j.task_type==='learning_explanation')return '#/learn/practice';
    if(j.task_type==='event_funnel_v1'||j.task_type==='self_exploration_v1')return '#/lab/today';
    if(j.task_type==='path_plan'||j.task_type==='artifact_stage_unblock')return '#/works/active';
    if(j.task_type==='inbox_triage')return '#/collect/inbox';
    return null;
  }
  function retryAction(j){
    if(j.status!=='failed')return null;
    if(j.task_type==='learning_explanation'&&j.session_id)return {kind:'learning',id:j.session_id};
    if(j.task_type==='event_funnel_v1'||j.task_type==='self_exploration_v1')return {kind:'lab',id:j.id};
    return null;
  }
  function whyWaiting(j,w){if(!['pending','claimed','processing'].includes(j.status))return '';return w.online?(j.status==='pending'?'等前面的工作處理完。':'AI 正在處理。'):w.text;}
  function newCompleted(jobs,seenIso){const s=seenIso?new Date(seenIso).getTime():0;return (Array.isArray(jobs)?jobs:[]).filter(j=>j.status==='completed'&&j.scope!=='system'&&j.completed_at&&new Date(j.completed_at).getTime()>s).length;}
  function rowHtml(j,w,now){
    const link=resultLink(j),retry=retryAction(j);
    const why=whyWaiting(j,w);
    return '<li class="mq-row" data-job="'+esc(j.id)+'"><div class="mq-main"><span class="mq-kind">'+esc(kindLabel(j.task_type))+(j.scope==='system'?'・系統':'')+'</span><b class="mq-title">'+esc(j.title||j.task_type)+'</b>'+
      '<span class="mq-meta">送出 '+esc(fmtTime(j.created_at))+(waitText(j,now)?'・'+esc(waitText(j,now)):'')+'</span>'+
      (why?'<span class="mq-why">'+esc(why)+'</span>':'')+(j.status==='failed'&&j.error_message?'<span class="mq-why bad">原因：'+esc(j.error_message)+'</span>':'')+
      (j.status==='completed'&&j.result_summary?'<span class="mq-sum">'+esc(j.result_summary)+'</span>':'')+'</div>'+
      '<div class="mq-side"><span class="mq-st '+statusClass(j.status)+'">'+esc(statusLabel(j.status))+'</span>'+
      (link?'<a class="mq-btn mq-primary" href="'+link+'">看結果</a>':'')+
      (retry?'<button class="mq-btn" type="button" data-mq-retry="'+esc(retry.kind+'|'+retry.id)+'">重試</button>':'')+
      (j.cancellable?'<button class="mq-btn mq-ghost" type="button" data-mq-cancel="'+esc(j.id)+'">取消</button>':'')+'</div></li>';
  }
  function pageHtml(snap,filter='mine',now=Date.now()){
    const w=workerState(snap?.worker?.last_seen_at,now);
    const all=Array.isArray(snap?.jobs)?snap.jobs:[];
    const list=filter==='all'?all:all.filter(j=>j.scope!=='system');
    const active=list.filter(j=>['pending','claimed','processing'].includes(j.status)).length;
    return '<div class="mq-w1b"><header class="mq-head"><h2>我的提問</h2><p>你送出、需要 AI 處理的事都在這裡：排到哪、等多久、做完沒有。</p></header>'+
      '<div class="mq-worker '+(w.online?'on':'off')+'" role="status"><span class="mq-dot"></span><span>'+esc(w.text)+'</span></div>'+
      '<div class="mq-filter" role="tablist"><button type="button" role="tab" data-mq-filter="mine" aria-selected="'+(filter!=='all')+'" class="'+(filter!=='all'?'on':'')+'">我送出的</button><button type="button" role="tab" data-mq-filter="all" aria-selected="'+(filter==='all')+'" class="'+(filter==='all'?'on':'')+'">含系統任務</button><span class="mq-count">'+active+' 件等待中</span></div>'+
      (list.length?'<ul class="mq-list">'+list.map(j=>rowHtml(j,w,now)).join('')+'</ul>':'<div class="mq-empty">還沒有送出過需要 AI 處理的事。</div>')+'<p class="mq-msg" role="status" data-mq-msg></p></div>';
  }
  // ---------- browser ----------
  const SEEN_KEY='gb-myjobs-seen-v1';
  let cache=null;
  async function load(A,force){if(!force&&cache&&Date.now()-cache.t<30000)return cache.d;const d=await A.getMyJobs();cache={t:Date.now(),d};return d;}
  async function refreshBadge(A){
    if(!A||A.liveStatus!=='live')return 0;
    try{const d=await load(A,true);const n=newCompleted(d?.jobs,localStorage.getItem(SEEN_KEY));
      const nav=document.querySelector('.nav-item[data-page="collect"]');
      if(nav){let b=nav.querySelector('.mq-badge');if(n&&!b){b=document.createElement('i');b.className='mq-badge';nav.appendChild(b);}if(b){if(n){b.textContent=n;b.setAttribute('aria-label',n+' 件提問已完成');}else b.remove();}}
      const host=document.querySelector('#view-home');if(host){host.querySelector('.mq-today')?.remove();if(n)host.insertAdjacentHTML('afterbegin','<a class="mq-today" href="#/collect/questions">✓ 你有 '+n+' 件提問已完成，點這裡看結果</a>');}
      return n;}catch(e){return 0;}
  }
  async function render(rootEl,A,filter='mine'){
    if(A.liveStatus!=='live'){rootEl.innerHTML='<div class="mq-w1b"><div class="mq-empty">登入後才能看你的提問。<button class="mq-btn mq-primary" data-auth>登入</button></div></div>';return;}
    rootEl.innerHTML='<div class="mq-w1b"><div class="mq-empty">正在讀取你的提問…</div></div>';
    let snap;try{snap=await load(A,true);}catch(e){rootEl.innerHTML='<div class="mq-w1b"><div class="mq-empty">讀取失敗：'+esc(e.message||e)+'</div></div>';return;}
    rootEl.innerHTML=pageHtml(snap,filter);
    try{localStorage.setItem(SEEN_KEY,new Date().toISOString());}catch(e){}
    refreshBadge(A);
    const msg=rootEl.querySelector('[data-mq-msg]');
    rootEl.querySelectorAll('[data-mq-filter]').forEach(b=>b.onclick=()=>render(rootEl,A,b.dataset.mqFilter));
    rootEl.querySelectorAll('[data-mq-cancel]').forEach(b=>b.onclick=async()=>{
      if(!confirm('確定取消這件提問？取消後不會再處理。'))return;
      b.disabled=true;try{await A.cancelMyJob(b.dataset.mqCancel);await render(rootEl,A,filter);}catch(e){b.disabled=false;msg.textContent='取消失敗：'+(e.message||e);}});
    rootEl.querySelectorAll('[data-mq-retry]').forEach(b=>b.onclick=async()=>{
      const [k,id]=b.dataset.mqRetry.split('|');b.disabled=true;
      try{if(k==='learning')await A.enqueueLearningAi(id);else await A.actEventLab('retry',{job_id:id});await render(rootEl,A,filter);}
      catch(e){b.disabled=false;msg.textContent='重試失敗：'+(e.message||e);}});
  }
  async function workerBannerText(A){try{const d=await load(A,false);return workerState(d?.worker?.last_seen_at).text;}catch(e){return null;}}
  root.GROWTH_BRAIN_MYJOBS={statusLabel,kindLabel,workerState,waitText,resultLink,retryAction,newCompleted,pageHtml,render,refreshBadge,workerBannerText,fmtTime,dur,OFFLINE_MS};
})(typeof window!=='undefined'?window:globalThis);
