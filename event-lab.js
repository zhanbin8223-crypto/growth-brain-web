(function(){
  'use strict';
  const A=window.GROWTH_BRAIN_ADAPTER;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=x=>Array.isArray(x)?x:[];
  const text=x=>typeof x==='string'?x:'';
  const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};
  const tabs=[['today','今日探索'],['ai','AI 技術'],['distribution','流量分發'],['opportunity','商業機會'],['growthbrain','Growth Brain']];
  const routes={capability:['能力庫','capabilities'],research:['研究室','research'],employee:['員工','ceo'],tool:['工具','ceo'],current_artifact:['目前作品','projects'],system_work_package:['系統工作包','ceo']};
  const errors={not_verified_primary_user:'目前帳號無法讀取這個私人專案。',active_exploration_budget_full:'已有 3 件推薦還沒看完。先收起來或略過其中一件，AI 才會再找新的。',current_artifact_target_mismatch:'目前作品已變更，請重新整理後再拆解。',retry_budget_exhausted:'已達 3 次嘗試上限，需要新證據再處理。',failed_lab_job_required:'這個任務目前不能重試，請重新整理狀態。',trial_requires_existing_review_gate:'這筆已送進試驗，後續由試驗審查決定。'};
  let recoIdx=0, recoOpen=null;
  let snapshot=null, activeTab='today', filter='active', poll=null, root=null, modal=null, target=null, jobId=null, requestId=null, lastSignature=null, returnFocus=null;
  function errorText(e){return errors[e.code||e.message]||e.message||'資料暫時無法讀取，請重試。';}
  function navigate(view,subtab){document.dispatchEvent(new CustomEvent('growth-lab:navigate',{detail:{view,subtab}}));}
  function pill(label,style=''){return '<span class="pill '+style+'">'+esc(label)+'</span>';}
  function sourceLinks(sources){return arr(sources).slice(0,6).map(s=>{
    const u=safeUrl(typeof s==='string'?s:s?.url);if(!u)return '';
    const verified=Boolean(s?.verified);
    const checked=s?.checked_at?new Date(s.checked_at).toLocaleString('zh-TW'):'';
    const note=verified?'來源已查證'+(checked?' · '+checked:''):'AI 提供・待查核';
    return '<li><a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(s?.title||new URL(u).hostname)+'</a><small class="source-check '+(verified?'verified':'pending')+'">'+esc(note)+'</small></li>';
  }).join('');}
  function list(items){return arr(items).length?'<ul>'+arr(items).slice(0,8).map(x=>'<li>'+esc(typeof x==='string'?x?.trim():x?.description||x?.title||'')+'</li>').join('')+'</ul>':'<p class="muted">尚未提供，不能當成已確認。</p>';}
  function validFunnel(o){return o&&typeof o==='object'&&['goal','key_hub','minimum_artifact','bottleneck','next_step'].every(k=>text(o[k]).trim())&&['boundaries','dependencies','unknowns','failure_points','required_evidence'].every(k=>Array.isArray(o[k]))&&arr(o.required_evidence).length>0&&routes[o.primary_route?.kind];}
  function workerNote(){const h=snapshot?.worker_health;return h?.status==='online'?'你電腦上的 AI 執行程式（Worker）有在運作，會依序處理。':'你電腦上的 AI 執行程式（Worker）現在沒開，工作已存好，等它開了就會處理。';}
  function jobs(){return arr(snapshot?.jobs);}
  function label(j){if(j.status==='completed'&&j.task_type==='event_funnel_v1'&&!validFunnel(j.output))return 'AI 回覆格式不完整';return {pending:'等待執行器',claimed:'已領取',processing:'AI 正在處理',completed:'AI 已回覆',failed:'本次失敗',cancelled:'已取消'}[j.status]||'狀態待確認';}
  function jobBanner(j){return '<div class="lab-job" role="status"><b>'+esc(label(j))+'</b><span>'+esc(j.status==='failed'?'原輸入仍保留，可在上限內重試。':workerNote())+'</span>'+(j.status==='failed'?'<button class="ghost-btn small" data-lab-retry="'+esc(j.id)+'">重試</button>':'')+'</div>';}
  function startPolling(){
    clearTimeout(poll);
    if(!jobs().some(j=>['pending','claimed','processing'].includes(j.status)))return;
    poll=setTimeout(async()=>{
      if(document.hidden||(!modal?.classList.contains('show')&&!root?.classList.contains('active'))){startPolling();return;}
      try{snapshot=await A.getEventLab();if(modal?.classList.contains('show'))renderFunnelResult();if(root?.classList.contains('active'))paintResearch();}catch{}
      startPolling();
    },6000);
  }
  async function act(action,payload={}){const result=await A.actEventLab(action,payload);snapshot=result.snapshot||snapshot;startPolling();return result;}
  function matchedRoute(o){
    const r=o.primary_route,k=text(r.key),ctx=snapshot?.context||{};
    let match;
    if(r.kind==='employee')match=arr(ctx.employees).find(x=>x.skill_key===k);
    if(r.kind==='tool')match=arr(ctx.tools).find(x=>x.key===k);
    if(r.kind==='system_work_package')match=arr(ctx.work_packages).find(x=>x.key===k);
    if(r.kind==='research')match=arr(ctx.research).find(x=>x.id===k);
    if(r.kind==='capability')match=arr(ctx.capability_cells).find(x=>x===k);
    if(r.kind==='current_artifact')match=ctx.current_artifact?.id===k?ctx.current_artifact:null;
    const name=typeof match==='string'?match:match?.name||match?.role_name||match?.title;
    let availability='候選建議，尚未執行';
    if(r.kind==='employee'&&match)availability='已登錄可調用角色，這次尚未調度';
    if(r.kind==='tool'&&match)availability=match.availability==='available'&&['active','conditional'].includes(match.status)?'目錄標為可用，執行前仍須確認':'目前只是工具候選';
    return {name:name||routes[r.kind][0],availability};
  }
  function renderFunnelResult(){
    const pane=modal?.querySelector('#funnelResult');if(!pane)return;
    const j=jobs().find(x=>x.id===jobId);
    if(!j){pane.innerHTML='<div class="empty">輸入明確目標後，先拆出卡點與一個可驗證的下一步。</div>';return;}
    if(j.status!=='completed'){pane.innerHTML=jobBanner(j);bindActions(pane);return;}
    if(!validFunnel(j.output)){pane.innerHTML='<div class="empty" role="alert">AI 回覆格式不完整，原輸入仍保留。請補充卡點，再送出新的拆解；這份回覆不會進研究或正式證據。</div>';return;}
    const o=j.output,r=matchedRoute(o),sources=sourceLinks(o.sources);
    pane.innerHTML='<article class="funnel-result"><div class="row-between"><h3>'+esc(o.goal)+'</h3>'+pill('AI 建議・待驗證','warn')+'</div><dl class="lab-summary"><div><dt>現在卡哪</dt><dd>'+esc(o.bottleneck)+'</dd></div><div><dt>建議去哪</dt><dd>'+esc(r.name)+'<small>'+esc(r.availability)+'</small><p>'+esc(o.primary_route.reason||'')+'</p></dd></div><div><dt>最小成果</dt><dd>'+esc(o.minimum_artifact)+'</dd></div></dl><div class="evidence-box"><b>唯一下一步</b><span>'+esc(o.next_step)+'</span></div><details><summary>成功要看什麼證據</summary>'+list(o.required_evidence)+'</details><details class="lab-detail"><summary>查看完整拆解</summary><b>邊界</b>'+list(o.boundaries)+'<b>關鍵樞紐（最影響結果的節點）</b><p>'+esc(o.key_hub)+'</p><b>依賴</b>'+list(o.dependencies)+'<b>未知</b>'+list(o.unknowns)+'<b>失敗點</b>'+list(o.failure_points)+(sources?'<b>參考來源</b><ul class="lab-sources">'+sources+'</ul>':'')+'</details><div class="project-actions">'+(o.primary_route.kind==='research'?'<button class="primary-btn" data-lab-send="'+esc(j.id)+'">送到研究室</button>':'<button class="primary-btn" data-lab-nav="'+esc(routes[o.primary_route.kind][1])+'">前往'+esc(routes[o.primary_route.kind][0])+'</button>')+'<small class="muted">這份拆解沒有更動作品、主線或技能證據。</small></div><div class="lab-message" role="status"></div></article>';
    bindActions(pane);
  }
  async function openFunnel(t={}){
    if(A.liveStatus!=='live'){document.querySelector('#openLogin')?.click();return;}
    returnFocus=document.activeElement;target={kind:t.kind||'user_event',id:t.id||null,goal:t.goal||''};jobId=null;requestId=crypto.randomUUID();lastSignature=null;
    if(!modal){
      modal=document.createElement('div');modal.className='modal-backdrop';modal.id='eventFunnelModal';
      modal.innerHTML='<section class="modal-card funnel-modal" role="dialog" aria-modal="true" aria-labelledby="funnelTitle"><button class="modal-close" type="button" aria-label="關閉拆解">×</button><span class="kicker">事件漏斗</span><h2 id="funnelTitle">拆解這件事</h2><form id="eventFunnelForm" class="project-form"><label>這件事要達成什麼<input id="funnelGoal" required minlength="2" maxlength="2000"></label><label>目前卡在哪，或有哪些限制？<textarea id="funnelNote" maxlength="4000" placeholder="只寫現在這一步，不需要先規劃整個領域。"></textarea></label><div class="project-actions"><button class="primary-btn" type="submit">請 AI 拆解</button><small class="muted">先給一條主路與下一步，執行由你決定。</small></div><div id="funnelMsg" class="lab-message" role="status"></div></form><div id="funnelResult"></div></section>';
      document.body.append(modal);
      modal.querySelector('.modal-close').onclick=closeFunnel;
      modal.addEventListener('click',e=>{if(e.target===modal)closeFunnel();});
      modal.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();closeFunnel();}
        if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button:not(:disabled),input,textarea,summary,a[href]')].filter(x=>x.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      });
      modal.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const msg=modal.querySelector('#funnelMsg'),btn=e.submitter;
        const goal=modal.querySelector('#funnelGoal').value.trim(),note=modal.querySelector('#funnelNote').value.trim();
        if(goal.length<2){msg.textContent='先寫一個明確目標。';return;}
        const sig=JSON.stringify({target,goal,note});if(lastSignature&&lastSignature!==sig)requestId=crypto.randomUUID();lastSignature=sig;
        btn.disabled=true;msg.textContent='正在保存拆解任務…';
        try{const r=await act('decompose',{target_kind:target.kind,target_id:target.id,goal,note,request_id:requestId});jobId=r.job_id;msg.textContent='任務已保存。'+workerNote();renderFunnelResult();}catch(err){msg.textContent=errorText(err);}finally{btn.disabled=false;}
      };
    }
    modal.querySelector('#funnelGoal').value=target.goal;modal.querySelector('#funnelNote').value='';modal.querySelector('#funnelMsg').textContent='';modal.classList.add('show');modal.querySelector('#funnelGoal').focus();
    modal.querySelector('#funnelResult').innerHTML='<div class="empty">正在讀取既有能力、員工與研究…</div>';
    try{snapshot=await A.getEventLab();const previous=jobs().find(j=>j.task_type==='event_funnel_v1'&&j.target_kind===target.kind&&String(j.target_id||'')===String(target.id||'')&&(target.kind!=='user_event'||j.goal===target.goal));jobId=previous?.id||null;renderFunnelResult();startPolling();}catch(e){modal.querySelector('#funnelResult').innerHTML='<div class="empty">'+esc(errorText(e))+'</div>';}
  }
  function closeFunnel(){modal?.classList.remove('show');returnFocus?.focus();}
  function bindActions(container){
    container.querySelectorAll('[data-lab-nav]').forEach(b=>b.onclick=()=>{closeFunnel();navigate(b.dataset.labNav,b.dataset.labNav==='ceo'?'system':undefined);});
    container.querySelectorAll('[data-lab-retry],[data-lab-send],[data-lab-decision]').forEach(b=>b.onclick=async()=>{
      const message=container.querySelector('.lab-message')||modal?.querySelector('#funnelMsg');b.disabled=true;
      try{
        if(b.dataset.labRetry)await act('retry',{job_id:b.dataset.labRetry});
        else if(b.dataset.labSend){
          const sourceId=b.dataset.labSend;
          await act('send_research',{job_id:sourceId});
          const output=jobs().find(j=>j.id===sourceId)?.output,topic=output?.topic_key||output?.goal;
          const item=arr(snapshot?.items).find(x=>x.job_id===sourceId||(topic&&(x.topic_key===topic||x.title===topic)));
          filter=item?.state||'active';closeFunnel();navigate('research');return;
        }
        else await act(b.dataset.labDecision,{item_id:b.dataset.labItem});
        if(root?.classList.contains('active'))paintResearch();if(modal?.classList.contains('show'))renderFunnelResult();
      }catch(e){if(message)message.textContent=errorText(e);}finally{b.disabled=false;}
    });
    container.querySelectorAll('[data-lab-item-funnel]').forEach(b=>b.onclick=()=>openFunnel({kind:'exploration',id:b.dataset.labItemFunnel,goal:b.dataset.labGoal}));
  }
  function candidateActions(x){return (x.state!=='trial'&&x.state!=='ignored'?'<button class="ghost-btn small" data-lab-decision="keep" data-lab-item="'+esc(x.id)+'">保留</button><button class="ghost-btn small" data-lab-decision="ignore" data-lab-item="'+esc(x.id)+'">忽略</button><button class="primary-btn small" data-lab-decision="trial" data-lab-item="'+esc(x.id)+'">送進試驗（讓 AI 小規模試做）</button>':'')+(x.state!=='ignored'?'<button class="ghost-btn small" data-lab-item-funnel="'+esc(x.id)+'" data-lab-goal="'+esc(x.question)+'">拆成小步驟</button>':'');}
  function candidateCard(x,detail=false){
    const sources=sourceLinks(x.sources);
    const sourceRows=arr(x.sources);
    const verifiedCount=sourceRows.filter(s=>s?.verified).length;
    const sourceState=!sourceRows.length?'尚無查核來源':verifiedCount===sourceRows.length?'來源已查證':verifiedCount?'部分來源已查證':'來源待查核';
    const rechecked=x.plan_provenance?.sources_rechecked_this_turn===true;
    const trial=arr(snapshot?.trials).find(t=>t.id===x.trial_id);
    const stateLabel=x.state==='trial'?(trial?.status==='running'?'試驗中':trial?.status==='passed'?'試做成功・等你決定要不要用':trial?.status==='failed'?'試驗失敗':'等待試做'):x.state==='saved'?'已保留':x.state==='ignored'?'已忽略':'待看推薦';
    const steps=arr(x.steps);
    const stepHtml=steps.length?'<div class="research-step-list">'+steps.map((s,i)=>'<article class="research-plan-step"><span>'+(i+1)+'</span><div><b>'+esc(s?.action||s?.title||'執行一步')+'</b>'+(s?.expected_output?'<p><strong>預期產出：</strong>'+esc(s.expected_output)+'</p>':'')+(s?.success_evidence?'<p><strong>成功證據：</strong>'+esc(s.success_evidence)+'</p>':'')+'</div></article>').join('')+'</div>':'<p class="muted">目前沒有可執行步驟，不能假裝已完成規劃。</p>';
    const resources=arr(x.resource_refs);
    const memoryRefs=arr(x.memory_refs);
    const executionState=x.plan_provenance?.execution_status==='not_executed'?'尚未執行':'已有執行紀錄';
    return '<article class="research-stream-item" data-exploration-id="'+esc(x.id)+'">'+
      '<aside class="research-stream-meta">'+
        '<span class="research-category">'+esc(tabs.find(t=>t[0]===x.category)?.[1]||'跨領域')+'</span>'+
        '<b>'+esc(stateLabel)+'</b>'+
        '<small>'+esc(sourceState)+'</small>'+
      '</aside>'+
      '<div class="research-stream-main">'+
        '<h3>'+esc(x.title)+'</h3>'+
        '<p class="research-stream-finding">'+esc(x.finding||x.why_now||'目前只有待驗證的問題。')+'</p>'+
        '<div class="research-stream-next"><span>唯一下一步</span><b>'+esc(x.next_step||'先補足可驗證問題')+'</b></div>'+
        '<details><summary>查看完整做法與證據</summary>'+
          '<div class="research-detail-grid">'+
            '<div><b>為什麼研究</b><p>'+esc(x.why_now||'')+'</p></div>'+
            '<div><b>要確認的問題</b><p>'+esc(x.question||'')+'</p></div>'+
            '<div><b>最小看得到的成果</b><p>'+esc(x.minimum_artifact||'尚未定義最小成果。')+'</p></div>'+
            (x.estimated_effort?'<div><b>估計投入</b><p>'+esc(x.estimated_effort)+'</p></div>':'')+
          '</div>'+
          '<b>詳細步驟</b>'+stepHtml+
          '<div class="research-detail-grid">'+
            '<div><b>前置條件</b>'+list(x.prerequisites)+'</div>'+
            '<div><b>所需工具／資源</b>'+(resources.length?list(resources):'<p class="muted">未綁定特定工具。</p>')+'</div>'+
            '<div><b>參考了你存過的資料</b>'+(memoryRefs.length?list(memoryRefs):'<p class="muted">未直接綁定特定記憶來源。</p>')+'</div>'+
            '<div><b>來源</b>'+(sources?'<ul class="lab-sources">'+sources+'</ul>':'<p>尚無本輪可查核來源。</p>')+'</div>'+
          '</div>'+
          '<b>還缺什麼</b>'+list(x.unknowns)+
          '<b>成功證據</b>'+list(x.required_evidence)+
          '<b>什麼情況就停</b><p>'+esc(x.stop_condition||'')+'</p>'+
          '<div class="research-provenance"><b>進度</b><span>'+esc(executionState)+' · '+esc(rechecked?'這次重新確認過來源':'沿用之前確認過的來源，這次沒重新確認')+'</span></div>'+
          (trial?'<small>試驗紀錄已保存；目前'+esc(stateLabel)+'，尚未正式採用。</small>':'')+
        '</details>'+
        (detail?'<div class="project-actions research-stream-actions"><button class="primary-btn" type="button" data-reco-add>加進作品的下一步</button></div><details class="reco-more"><summary>其他做法</summary><div class="project-actions">'+candidateActions(x).replace(/primary-btn/g,'ghost-btn')+'</div></details>':'<div class="project-actions research-stream-actions">'+candidateActions(x)+'</div>')+
        '<small class="research-truth-note">這是 AI 的推薦，還不是你的成果或能力。</small>'+
      '</div>'+
    '</article>';
  }
  function paintReco(pane,items,latest){
    const busy=latest&&['pending','claimed','processing'].includes(latest.status);
    const statusNote=busy?'<div class="reco-note" role="status">AI 研究員正在找新的推薦。'+esc(workerNote())+'</div>':latest?.status==='failed'?jobBanner(latest):'';
    if(recoOpen){
      const x=items.find(i=>i.id===recoOpen);
      if(x){
        pane.innerHTML='<div class="reco-detail"><button class="reco-text-btn" type="button" data-reco-back>← 回到推薦</button><div class="lab-message" role="status"></div>'+candidateCard(x,true)+'</div>';
        pane.querySelector('[data-reco-back]').onclick=()=>{recoOpen=null;paintResearch();};
        bindReco(pane,x);bindActions(pane);return;
      }
      recoOpen=null;
    }
    if(!items.length){
      pane.innerHTML='<article class="reco-card"><span class="reco-chip">✦ AI 推薦你看的一件事</span><h2>今天還沒有新的推薦</h2><p class="reco-lead">沒有值得打擾你的新發現時，這裡就保持空白。</p><div><button class="primary-btn" type="button" id="labExplore">請 AI 去找一件</button></div><div class="lab-message" role="status"></div>'+statusNote+'</article>';
    }else{
      recoIdx=recoIdx%items.length;
      const x=items[recoIdx];
      const srcRows=arr(x.sources),verified=srcRows.filter(s=>s?.verified).length;
      pane.innerHTML='<article class="reco-card" data-exploration-id="'+esc(x.id)+'"><span class="reco-chip">✦ AI 推薦你看的一件事'+(items.length>1?'（'+(recoIdx+1)+'／'+items.length+'）':'')+'</span>'+
        '<h2>'+esc(x.title)+'</h2><p class="reco-lead">'+esc(x.why_now||x.finding||'AI 覺得這件事值得你看一下。')+'</p>'+
        '<div><button class="primary-btn" type="button" data-reco-open="'+esc(x.id)+'">看這件事 →</button></div>'+
        '<div class="reco-secondary">'+(items.length>1?'<button class="reco-text-btn" type="button" data-reco-next>↻ 換一件</button>':'')+'<button class="reco-text-btn" type="button" data-lab-decision="keep" data-lab-item="'+esc(x.id)+'">先收起來（放進收集）</button></div>'+
        '<div class="reco-note">'+(srcRows.length?'AI 根據 '+srcRows.length+' 個來源整理（已確認 '+verified+' 個），還沒在你的作品上試過。':'這是 AI 的猜想，還沒有可確認的來源。')+'</div>'+
        '<div class="lab-message" role="status"></div>'+statusNote+'</article>';
      pane.querySelector('[data-reco-next]')?.addEventListener('click',()=>{recoIdx=(recoIdx+1)%items.length;paintResearch();});
      pane.querySelector('[data-reco-open]').onclick=()=>{recoOpen=x.id;paintResearch();};
    }
    pane.querySelector('#labExplore')?.addEventListener('click',async e=>{e.target.disabled=true;const msg=pane.querySelector('.lab-message');msg.textContent='正在請 AI 去找…';try{const r=await act('explore');paintResearch();const m=root.querySelector('.lab-message');if(m)m.textContent=r.created===false?'今天已經請 AI 找過了，顯示原本的工作。':'已請 AI 去找新的推薦。'+workerNote();}catch(err){msg.textContent=errorText(err);}finally{e.target.disabled=false;}});
    bindActions(pane);
  }
  function bindReco(pane,x){
    const add=pane.querySelector('[data-reco-add]');if(!add)return;
    add.onclick=()=>{
      const box=add.parentElement;
      const cur=A.personalHome?.artifact_summary?.current;
      if(!cur){if(!box.querySelector('.reco-warn'))box.insertAdjacentHTML('beforeend','<p class="reco-note reco-warn" role="alert">你還沒選目前作品。先到「今天」選一件作品，再把這件事加進去。</p>');return;}
      box.innerHTML='<div class="reco-confirm"><p><b>要把這件事加進「'+esc(cur.title)+'」的下一步嗎？</b><br><small>AI 會先把它拆成可以做的小步驟給你看；你確認後才會改作品。</small></p><div class="reco-secondary"><button class="primary-btn" type="button" data-reco-confirm>確定加進去</button><button class="reco-text-btn" type="button" data-reco-cancel>再想想</button></div></div>';
      box.querySelector('[data-reco-cancel]').onclick=()=>paintResearch();
      box.querySelector('[data-reco-confirm]').onclick=()=>openFunnel({kind:'current_artifact',id:cur.id,goal:x.next_step||x.question||x.title});
    };
  }
  function paintResearch(){
    if(!root)return;const pane=root.querySelector('#labResearchPane');if(!pane)return;
    const all=arr(snapshot?.items),filtered=all.filter(x=>(activeTab==='today'||x.category===activeTab)&&x.state===filter);
    const latest=jobs().find(j=>j.task_type==='self_exploration_v1');
    const title=tabs.find(t=>t[0]===activeTab)?.[1]||'今日探索';
    const ctx=snapshot?.context||{};
    const memory=ctx.memory||{};
    const memorySources=arr(memory.sources),memoryConcepts=arr(memory.concepts);
    const tools=arr(ctx.tools),cells=arr(ctx.capability_cells),playbooks=arr(ctx.playbooks),researchMemory=arr(ctx.research);
    const sourcePreview=memorySources.slice(0,3).map(s=>'<li>'+esc(s.title||s.label||s.source_ref||'已保存來源')+'</li>').join('');
    const stateTabs=[['active','今日探索'],['saved','靈感收藏'],['trial','實驗中'],['ignored','已忽略']];
    const contextHtml='<details class="research-context research-context-compact"><summary><span><b>AI 這次參考了哪些資料</b><small>你存過的來源、工具、方法與以前的研究</small></span><i>展開</i></summary>'+
      '<div class="research-context-grid">'+
        '<div class="research-context-stat"><strong>'+memorySources.length+'</strong><span>已保存來源</span></div>'+
        '<div class="research-context-stat"><strong>'+memoryConcepts.length+'</strong><span>已確認的概念</span></div>'+
        '<div class="research-context-stat"><strong>'+tools.length+'</strong><span>可用工具</span></div>'+
        '<div class="research-context-stat"><strong>'+cells.length+'</strong><span>可重用方法</span></div>'+
        '<div class="research-context-stat"><strong>'+playbooks.length+'</strong><span>作戰手冊（步驟筆記）</span></div>'+
        '<div class="research-context-stat"><strong>'+researchMemory.length+'</strong><span>既有研究</span></div>'+
      '</div>'+
      (sourcePreview?'<ul>'+sourcePreview+'</ul>':'<p class="muted">目前沒有已保存來源。</p>')+
      '<p class="muted">AI 的一般知識只拿來提出猜想；推薦不會自動改你的作品或能力。</p>'+
    '</details>';

    if(activeTab==='today'&&filter==='active'){paintReco(pane,all.filter(x=>x.state==='active'),latest);return;}
    pane.innerHTML='<header class="v4-page-head research-v4-head"><span class="v4-eyebrow">研究室</span><div><h2>今天值得研究什麼</h2><p>只保留能形成下一步的候選；不是文章牆，也不把猜想當成果。</p></div><button class="primary-btn" id="labExplore">＋ 新的探索</button></header>'+
      '<div class="research-state-tabs" aria-label="研究狀態">'+stateTabs.map(([k,l])=>'<button class="'+(filter===k?'active':'')+'" data-lab-filter="'+k+'" aria-pressed="'+(filter===k)+'"><b>'+l+'</b><span>'+all.filter(x=>x.state===k&&(activeTab==='today'||x.category===activeTab)).length+'</span></button>').join('')+'</div>'+
      '<div class="research-stream-head"><div><span class="kicker">'+esc(title)+'</span><h3>'+esc(filter==='active'?'先看最值得驗證的候選':'研究候選')+'</h3></div><button class="ghost-btn small" id="labRefresh">更新狀態</button></div>'+
      '<div class="lab-message" role="status"></div>'+
      (latest&&['pending','claimed','processing','failed'].includes(latest.status)?jobBanner(latest):latest?.status==='completed'&&!Array.isArray(latest.output?.candidates)?'<div class="empty" role="alert">本輪 AI 回覆格式不完整，沒有匯入任何候選。</div>':'')+
      '<div class="research-stream">'+(filtered.length?filtered.slice(0,3).map(candidateCard).join(''):'<div class="research-empty-state"><span>✦</span><b>'+(filter==='active'?'今天沒有值得打擾你的新發現。':'這個分類目前沒有紀錄。')+'</b><p>沒有新價值就保持空白，不為了填滿研究室製造候選。</p></div>')+'</div>'+
      (filtered.length>3?'<button class="ghost-btn" id="labShowMore">查看其餘 '+(filtered.length-3)+' 筆</button>':'')+
      contextHtml+
      '<details class="lab-policy v4-list-row"><summary>探索怎麼運作</summary><p>「新的探索」會建立研究任務；候選、試驗、採用與忽略各自有狀態。付款、發布、改主線與技能升級仍需確認。</p></details>';
    pane.querySelectorAll('[data-lab-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.labFilter;paintResearch();});
    pane.querySelector('#labShowMore')?.addEventListener('click',()=>{pane.querySelector('.research-stream').innerHTML=filtered.map(candidateCard).join('');pane.querySelector('#labShowMore').remove();bindActions(pane);});
    pane.querySelector('#labExplore').onclick=async e=>{e.target.disabled=true;const msg=pane.querySelector('.lab-message');msg.textContent='正在請 AI 去找…';try{const r=await act('explore');paintResearch();root.querySelector('.lab-message').textContent=r.created===false?'今天已經請 AI 找過了，顯示原本的工作。':'已請 AI 去找新的推薦。'+workerNote();}catch(err){msg.textContent=errorText(err);}finally{e.target.disabled=false;}};
    pane.querySelector('#labRefresh').onclick=async()=>{try{snapshot=await A.getEventLab();paintResearch();startPolling();}catch(e){pane.querySelector('.lab-message').textContent=errorText(e);}};
    bindActions(pane);
  }
  async function renderResearch(container,tab='today',opts={}){
    root=container;activeTab=tab;if(opts.filter)filter=opts.filter;recoOpen=null;
    root.innerHTML='<div class="subtabs" role="tablist">'+tabs.map(([k,l])=>'<button class="subtab '+(k===tab?'active':'')+'" data-lab-tab="'+k+'" role="tab" aria-selected="'+(k===tab)+'">'+l+'</button>').join('')+'</div><div id="labResearchPane" class="tab-pane"><div class="empty">正在讀取研究室…</div></div>';
    root.querySelectorAll('[data-lab-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.labTab==='growthbrain')document.dispatchEvent(new CustomEvent('growth-lab:system-research'));else renderResearch(root,b.dataset.labTab);});
    if(A.liveStatus!=='live'){
      root.querySelector('#labResearchPane').innerHTML='<header class="v4-page-head research-v4-head"><span class="v4-eyebrow">研究室</span><div><h2>今天值得研究什麼</h2><p>登入後才讀取你的研究候選與試驗紀錄。</p></div></header><div class="research-stream locked"><div class="research-empty-state"><span>✦</span><b>登入後才看得到 AI 給你的推薦</b><p>不會用示範資料假裝成你的推薦。</p><button class="primary-btn" data-auth>登入查看研究室</button></div></div>';
      return;
    }
    try{snapshot=await A.getEventLab();if(activeTab!==tab)return;paintResearch();startPolling();}catch(e){root.querySelector('#labResearchPane').innerHTML='<div class="empty" role="alert">'+esc(errorText(e))+'</div><button class="ghost-btn" id="labLoadRetry">重新讀取</button>';root.querySelector('#labLoadRetry').onclick=()=>renderResearch(root,tab);}
  }
  window.GROWTH_BRAIN_LAB={openFunnel,renderResearch,validFunnel,safeUrl};
})();
