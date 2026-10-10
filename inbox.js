(function(){
  const A=window.GROWTH_BRAIN_ADAPTER;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const classLabel={knowledge:'知識',learning:'學習',project:'目標／作品',action:'行動'};
  const kindLabel={text:'文字',link:'連結',idea:'想法'};
  const jobLabel={pending:'等待 AI 整理',claimed:'AI 已接手',processing:'AI 正在判斷',completed:'AI 已整理',failed:'AI 整理失敗',cancelled:'已取消'};

  function triageBlock(item){
    const triage=item.ai_triage||{};
    const job=triage.job||null;
    const sug=triage.suggestion||{};
    const suggested=sug.primary_classification||null;
    const confidence=Math.round((Number(sug.confidence)||0)*100);

    if(job && ['pending','claimed','processing'].includes(job.status)){
      return '<div class="evidence-box"><b>'+esc(jobLabel[job.status])+'</b><span>系統正在判斷這筆內容最適合放到「目標／作品、學習、知識、行動」中的哪裡。你不用先分類。</span></div>';
    }
    if(job?.status==='failed'){
      return '<div class="evidence-box"><b>AI 整理暫時失敗</b><span>原始內容已安全保存，不會遺失；你仍可手動修正分類，或等執行器恢復後重新整理。</span></div>';
    }
    if(suggested){
      const auto=Boolean(sug.auto_classified);
      return '<div class="evidence-box"><b>'+(auto?'已自動整理為：':'AI 建議：')+esc(classLabel[suggested]||suggested)+(confidence?' · '+confidence+'%':'')+'</b><span>'+esc(sug.reason_zh||'依內容與目前主線判斷。')+'</span>'+
        (!auto && !item.classification?'<button class="ghost-btn small" data-accept-suggestion="'+esc(suggested)+'" data-item-id="'+esc(item.id)+'">採用這個分類</button>':'')+
        '</div>';
    }
    if(item.classification){
      return '<div class="evidence-box"><b>目前分類：'+esc(classLabel[item.classification]||item.classification)+'</b><span>這只是整理位置，不代表你已學會，也不會自動變成正式主線。</span></div>';
    }
    return '<div class="evidence-box"><b>等待整理</b><span>內容已保存；如果 AI 執行器目前沒開，這筆資料仍會留在這裡，不會消失。</span></div>';
  }

  function correctionControls(item){
    const routed=Boolean(item.routing);
    if(routed) return '';
    return '<details><summary>分類不對？手動修正</summary><div class="project-actions" style="margin-top:10px">'+
      ['knowledge','learning','project','action'].map(key=>{
        const active=item.classification===key;
        return '<button class="ghost-btn small" data-classify="'+key+'" data-item-id="'+esc(item.id)+'" '+(active?'disabled':'')+'>'+(active?'✓ ':'')+classLabel[key]+'</button>';
      }).join('')+
      '</div></details>';
  }

  function routeControls(item){
    if(item.routing){
      const labels={personal_outcome_candidate:'目標／作品候選',learning_session:'學習流程',growth_action:'可追蹤行動',synapse_ingestion_candidate:'知識連結候選'};
      return '<div class="muted">已送到：'+esc(labels[item.routing.target_kind]||item.routing.target_kind||'對應流程')+'。原始內容仍保留在資料入口。</div>';
    }
    if(!item.classification) return '<div class="muted">系統整理完成後，這裡會出現最適合的下一步。</div>';

    if(item.classification==='project'){
      const suggested=item?.ai_triage?.suggestion?.suggested_title||'';
      return '<div class="project-form" data-route-panel>'+
        '<p><b>如果要把它變成正式方向：</b>先建立候選目標，之後 GPT 會再拆成第一件可驗證作品。</p>'+
        '<label><b>候選名稱</b><input data-route-title value="'+esc(suggested)+'" placeholder="未填會使用原始內容"></label>'+
        '<label><b>你已經知道的完成方向（可留空）</b><input data-project-success placeholder="不知道沒關係，可先讓 GPT 拆解"></label>'+
        '<button class="primary-btn" data-route data-item-id="'+esc(item.id)+'">變成候選目標</button>'+
        '<small class="muted">只是候選，不會自動變成正式主線。</small></div>';
    }
    if(item.classification==='learning'){
      const goal=item?.ai_triage?.suggestion?.learning_goal||'';
      return '<div class="project-form" data-route-panel>'+
        '<p><b>這筆資料需要真的進入學習流程嗎？</b></p>'+
        '<div class="project-actions"><button class="ghost-btn" data-no-learning data-item-id="'+esc(item.id)+'">只存知識，不開學習</button></div>'+
        '<label><b>如果要學，最低做到哪裡（可選）</b><input data-learning-goal value="'+esc(goal)+'" placeholder="例如：能說出重點，或能實際用一次"></label>'+
        '<button class="primary-btn" data-route data-item-id="'+esc(item.id)+'">加入學習流程</button>'+
        '<small class="muted">沒有必要學就選「只存知識」；不會因為 AI 分成學習就強迫你學。</small></div>';
    }
    if(item.classification==='action'){
      return '<button class="primary-btn" data-route data-item-id="'+esc(item.id)+'">建立可追蹤行動</button>';
    }
    return '<button class="primary-btn" data-route data-item-id="'+esc(item.id)+'">加入知識連結候選</button>';
  }

  const ic=(n,c)=>'<svg class="'+(c||'i i-sm')+'" aria-hidden="true"><use href="assets/w1b/icons.svg#'+n+'"/></svg>';
  function isGb(item){return Boolean(item.classification)&&item.ai_triage?.job?.status==='completed';}
  function host(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}}
  function when(t){const d=new Date(t);if(isNaN(d))return '';const n=new Date();const days=Math.floor((new Date(n.toDateString())-new Date(d.toDateString()))/864e5);return days===0?'今天 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):days===1?'昨天':(d.getMonth()+1)+'/'+d.getDate();}
  function itemHtml(item){
    const triage=item.ai_triage||{},job=triage.job||null,routed=Boolean(item.routing);
    const busy=job&&['pending','claimed','processing'].includes(job.status);
    const raw=String(item.raw_content||'');const title=raw.split(/\n|。/)[0].slice(0,60)||'未命名內容';const rest=raw.slice(title.length).replace(/^[。\s]+/,'').slice(0,90);
    const src=item.source_url?host(item.source_url):'我寫的';
    const unsorted=!item.classification;
    const chip=routed?'<span class="chip te" style="align-self:flex-start">已送到對應流程</span>':busy?'<span class="chip or" style="align-self:flex-start">AI 整理中</span>':'';
    const tags=(unsorted?'<span class="ttag">未分類</span>':'<span class="ttag">'+esc(classLabel[item.classification]||item.classification)+'</span>')+(isGb(item)?'<span class="ttag gb">GB 自動</span>':'');
    return '<article class="card item '+(unsorted?'unsorted':'')+'" data-co-item data-cls="'+esc(item.classification||'none')+'" data-gb="'+(isGb(item)?1:0)+'">'+
      '<div class="src"><span class="icirc '+(item.source_url?'mute':'or')+'" style="width:28px;height:28px">'+ic(item.source_url?'external-link':'pencil')+'</span>'+esc(src)+'</div>'+chip+
      '<h3>'+esc(title)+'</h3>'+(rest?'<p>'+esc(rest)+(raw.length>title.length+90?'…':'')+'</p>':'')+
      '<div class="item-foot"><span class="meta">'+tags+'<span>'+esc(when(item.created_at))+'</span></span>'+(item.source_url?'<a class="link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener">看內容</a>':'')+'</div>'+
      '<details class="co-more"><summary>'+(unsorted?'分類':'整理方式與下一步')+'</summary><div style="margin-top:12px">'+triageBlock(item)+routeControls(item)+'<div style="margin-top:12px">'+correctionControls(item)+'</div></div></details>'+
      '</article>';
  }

  async function renderInbox(notice=''){
    const root=$('#view-inbox');
    if(!root) return;
    $('#pageTitle').textContent='快速收進第二大腦';

    if(A.liveStatus!=='live'){
      root.innerHTML='<div class="section-head"><div><h2>資料入口</h2><p>登入後，系統才能把內容保存並結合你的主線、學習與知識狀態自動整理。</p></div></div><div class="surface"><b>目前尚未登入正式資料</b><p>這裡不會用示範資料冒充你的收件內容。</p><button class="primary-btn" data-auth>登入</button></div>';
      return;
    }

    root.innerHTML='<div class="empty">正在載入資料入口…</div>';
    let snapshot;
    try{snapshot=await A.getInbox();}
    catch(e){root.innerHTML='<div class="empty">資料入口載入失敗：'+esc(e.message||e)+'</div>';return;}
    const items=snapshot?.items||[];

    const unsortedN=items.filter(x=>!x.classification).length,gbN=items.filter(isGb).length;
    const counts={};items.forEach(x=>{if(x.classification)counts[x.classification]=(counts[x.classification]||0)+1;});
    const tag=(k,l,n,cls)=>'<button type="button" class="tag '+(cls||'')+(k==='all'?' on':'')+'" role="tab" aria-selected="'+(k==='all')+'" data-co-tag="'+k+'">'+l+' <em>'+n+'</em></button>';
    const cap='<article class="card tile co-cap"><form id="inboxForm"><div class="capture"><div class="input-ic"><textarea class="input" id="inboxContent" rows="1" placeholder="貼上連結，或寫一句想法…" aria-label="收集內容"></textarea></div><button class="btn btn-primary primary-btn" type="submit">收集</button></div>'+
      '<details class="co-url"><summary class="hint">補充來源網址（通常不用填）</summary><input class="input" id="inboxUrl" type="url" placeholder="https://..."></details>'+
      '<small class="hint" id="inboxMsg">'+esc(notice||'先丟進來就好，分類之後再說。AI 的分類只是建議，不會直接改主線或宣稱你已學會。')+'</small></form></article>';
    root.innerHTML='<div class="w1p w1p-collect"><section class="head"><span class="eyebrow">'+(items.length?items.length+' 則・'+unsortedN+' 則未分類':'還沒有收集')+'</span><h1>收集</h1><p>把靈感、連結、研究候選先放進來，之後再分類。</p></section><div class="co-wrap">'+cap+
      (items.length?
        '<div class="tagbar" role="tablist" aria-label="標籤篩選">'+tag('all','全部',items.length)+tag('gb','GB 自動分類',gbN,'gb')+tag('none','未分類',unsortedN)+Object.keys(classLabel).filter(k=>counts[k]).map(k=>tag(k,classLabel[k],counts[k])).join('')+'</div>'+
        '<p class="gb-note"><span><b>GB</b> ＝ Growth Brain 自動分類：AI 依內容幫你貼好標籤的項目，卡片上會標「GB 自動」。展開「整理方式」就能改，改過就變成你的分類。</span></p>'+
        '<div class="items" id="inboxItems">'+items.map(itemHtml).join('')+'</div>'
      :'<article class="card tile empty"><img src="assets/w1b/empty-state.webp" alt="" width="800" height="600"><h2>這裡還是空的</h2><p>看到有用的東西，先丟進來。GB（Growth Brain）會自動分類看得懂的，其餘之後再一起整理。</p></article>'+
        '<div class="ways"><article class="card tile way"><span class="icirc">'+ic('external-link','i')+'</span><h3>貼一個連結</h3><p class="muted">文章、影片、別人的作品都可以。</p></article><article class="card tile way"><span class="icirc or">'+ic('pencil','i')+'</span><h3>寫一句想法</h3><p class="muted">一句話就夠，之後可以變成作品。</p></article><article class="card tile way"><span class="icirc te">'+ic('search','i')+'</span><h3>研究候選</h3><p class="muted">想深入的主題，可以到研究室交給研究員。</p></article></div><div id="inboxItems"></div>')+
      '</div></div>';
    root.querySelectorAll('[data-co-tag]').forEach(b=>b.onclick=()=>{const k=b.dataset.coTag;root.querySelectorAll('[data-co-tag]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-selected',String(x===b));});
      root.querySelectorAll('[data-co-item]').forEach(it=>{it.hidden=!(k==='all'||(k==='gb'?it.dataset.gb==='1':it.dataset.cls===k));});});

    $('#inboxForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const rawContent=$('#inboxContent').value.trim();
      let sourceUrl=$('#inboxUrl').value.trim();
      const msg=$('#inboxMsg');
      if(!rawContent){msg.textContent='請先放入一段內容、網址或想法。';return;}
      if(!sourceUrl && /^https?:\/\/\S+$/i.test(rawContent)) sourceUrl=rawContent;
      const sourceKind=sourceUrl?'link':'text';
      try{
        msg.textContent='正在保存，並交給 AI 自動整理…';
        await A.captureInbox({rawContent,sourceKind,sourceUrl});
        await renderInbox('已保存。AI 整理任務已自動建立；本機執行器開啟後會完成分類。');
      }catch(err){msg.textContent=err.message||'保存失敗';}
    });

    const classify=async(btn,classification)=>{
      btn.disabled=true;
      try{
        await A.classifyInbox({itemId:btn.dataset.itemId,classification});
        await renderInbox('分類已更新。這只是整理位置，不會直接改變你的技能或正式主線。');
      }catch(err){btn.disabled=false;const msg=$('#inboxMsg');if(msg)msg.textContent=err.message||'分類失敗';}
    };

    root.querySelectorAll('[data-classify]').forEach(btn=>btn.addEventListener('click',()=>classify(btn,btn.dataset.classify)));
    root.querySelectorAll('[data-accept-suggestion]').forEach(btn=>btn.addEventListener('click',()=>classify(btn,btn.dataset.acceptSuggestion)));
    root.querySelectorAll('[data-no-learning]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try{
        await A.classifyInbox({itemId:btn.dataset.itemId,classification:'knowledge'});
        await A.routeInbox({itemId:btn.dataset.itemId});
        await renderInbox('已改成只保存知識，不建立學習流程。');
      }catch(err){
        btn.disabled=false;
        const msg=$('#inboxMsg');
        if(msg) msg.textContent=err.message||'處理失敗';
      }
    }));

    root.querySelectorAll('[data-route]').forEach(btn=>btn.addEventListener('click',async()=>{
      const itemId=btn.dataset.itemId;
      const card=btn.closest('article');
      const item=(snapshot?.items||[]).find(x=>x.id===itemId);
      if(!item) return;
      btn.disabled=true;
      try{
        const args={itemId};
        if(item.classification==='project'){
          args.title=card?.querySelector('[data-route-title]')?.value?.trim()||null;
          args.successEvidence=card?.querySelector('[data-project-success]')?.value?.trim()||'先由 GPT 拆解第一件可驗證作品，再依作品結果決定完成標準。';
        }else if(item.classification==='learning'){
          args.goal=card?.querySelector('[data-learning-goal]')?.value?.trim()||null;
          args.sourceLanguage='unknown';
        }
        await A.routeInbox(args);
        await renderInbox('已送到對應流程；原始內容仍留在資料入口，可追溯來源。');
      }catch(err){
        btn.disabled=false;
        const msg=$('#inboxMsg');
        if(msg) msg.textContent=err.message||'送出失敗';
      }
    }));
  }

  function bind(){
    const nav=$('.nav-item[data-view="inbox"]');
    const capture=$('#captureBtn');
    nav?.addEventListener('click',()=>queueMicrotask(()=>renderInbox()));
    capture?.addEventListener('click',()=>queueMicrotask(()=>renderInbox()));
    if($('#view-inbox')?.classList.contains('active')) renderInbox();
  }

  window.GROWTH_BRAIN_INBOX={render:(...a)=>renderInbox(...a)};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();