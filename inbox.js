(function(){
  const A=window.GROWTH_BRAIN_ADAPTER;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const classLabel={knowledge:'知識',learning:'學習',project:'作品／專案',action:'行動'};
  const kindLabel={text:'文字',link:'連結',idea:'想法'};

  function classificationButtons(item){
    const routed=Boolean(item.routing);
    return ['knowledge','learning','project','action'].map(key=>{
      const active=item.classification===key;
      return `<button class="ghost-btn small" data-classify="${key}" data-item-id="${esc(item.id)}" ${(active||routed)?'disabled':''}>${active?'✓ ':''}${classLabel[key]}</button>`;
    }).join('');
  }

  function routeControls(item){
    if(item.routing){
      const labels={personal_outcome_candidate:'候選作品路徑',learning_session:'學習流程',growth_action:'可追蹤行動',synapse_ingestion_candidate:'知識連結候選'};
      return `<div class="evidence-box"><b>已進入正式流程</b><span>${esc(labels[item.routing.target_kind]||'對應流程')}；原始內容仍保留，可追溯來源。</span></div>`;
    }
    if(!item.classification){
      return `<details><summary>我想現在自己指定它要去哪裡</summary><p class="muted">這是備援操作，不代表之後每一筆都要手動整理。</p><div class="project-actions">${classificationButtons(item)}</div></details>`;
    }
    if(item.classification==='project'){
      return `<div class="project-form" data-route-panel><label><b>怎樣算完成</b><input data-project-success placeholder="不知道也可以先回作品路徑頁，讓 GPT 拆解"></label><label><b>名稱（可選）</b><input data-route-title placeholder="未填會使用原始內容"></label><button class="primary-btn" data-route data-item-id="${esc(item.id)}">建立候選作品路徑</button><small class="muted">先建立候選；仍由你決定是否成為正式主線。</small></div>`;
    }
    if(item.classification==='learning'){
      return `<div class="project-form" data-route-panel><label><b>這次想理解或做到什麼（可選）</b><input data-learning-goal></label><button class="primary-btn" data-route data-item-id="${esc(item.id)}">送到學習陪伴</button></div>`;
    }
    return `<button class="primary-btn" data-route data-item-id="${esc(item.id)}">${item.classification==='action'?'建立可追蹤行動':'送到知識連結候選'}</button>`;
  }

  function itemHtml(item){
    const source=item.source_url?`<a href="${esc(item.source_url)}" target="_blank" rel="noopener">原始來源</a>`:'直接輸入';
    const status=item.routing?'已處理':item.classification?`已判斷：${classLabel[item.classification]||esc(item.classification)}`:'等待整理';
    return `<article class="surface">
      <div class="row-between"><div><span class="kicker">${esc(kindLabel[item.source_kind]||'內容')}</span><b>${esc(status)}</b></div><small class="muted">${esc(item.created_at?new Date(item.created_at).toLocaleString('zh-TW'):'')}</small></div>
      <p>${esc(item.raw_content||'')}</p>
      <small class="muted">來源：${source}</small>
      <div style="margin-top:12px">${routeControls(item)}</div>
    </article>`;
  }

  async function renderInbox(notice=''){
    const root=$('#view-inbox');
    if(!root) return;
    $('#pageTitle').textContent='看到有用的東西，先收進第二大腦';

    if(A.liveStatus!=='live'){
      root.innerHTML=`<div class="section-head"><div><h2>收集</h2><p>這裡是所有新內容的入口，不是電子郵件收件匣。登入後才會保存成你的正式資料。</p></div></div><div class="surface"><b>目前尚未登入</b><p>登入後可以把文章、連結、想法或聊天中的重點先收進來。</p><button class="primary-btn" data-auth>登入</button></div>`;
      return;
    }

    root.innerHTML='<div class="empty">正在讀取已收集內容…</div>';
    let snapshot;
    try{snapshot=await A.getInbox();}
    catch(e){root.innerHTML=`<div class="empty">收集內容載入失敗：${esc(e.message||e)}</div>`;return;}
    const items=snapshot?.items||[];

    root.innerHTML=`
      <div class="section-head"><div><h2>收進第二大腦</h2><p>手動貼上只是目前最基本的保底入口。之後從聊天、文章、連結或其他來源自動匯入，也會先進同一層，再由系統判斷它和作品、學習或知識的關係。</p></div><span class="pill success">正式資料</span></div>

      <form class="surface project-form" id="inboxForm">
        <label><b>把你想保留的東西貼進來</b><textarea id="inboxContent" placeholder="文字、網址、突然想到的問題都可以；先收進來，不必現在分類。"></textarea></label>
        <details>
          <summary>原始來源網址（通常不用填）</summary>
          <input id="inboxUrl" type="url" placeholder="https://...">
        </details>
        <div class="row-between"><div id="inboxMsg" class="muted">${esc(notice||'先保存原始內容。你不需要每一筆都立刻決定它屬於哪一類。')}</div><button class="primary-btn" type="submit">收進第二大腦</button></div>
      </form>

      <div class="section-head"><div><h2>等待整理</h2><p>原始內容永遠保留；分類與後續路徑可以晚一點再決定。</p></div><span>${items.length} 筆</span></div>
      <div class="stack" id="inboxItems">${items.length?items.map(itemHtml).join(''):'<div class="empty">目前沒有等待整理的內容。</div>'}</div>`;

    $('#inboxForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const rawContent=$('#inboxContent').value.trim();
      let sourceUrl=$('#inboxUrl').value.trim();
      const msg=$('#inboxMsg');
      if(!rawContent){msg.textContent='請先貼入文字、網址或想法。';return;}
      const looksLikeUrl=/^https?:\/\/\S+$/i.test(rawContent);
      if(!sourceUrl&&looksLikeUrl) sourceUrl=rawContent;
      const sourceKind=sourceUrl||looksLikeUrl?'link':'text';
      try{
        msg.textContent='正在收進第二大腦…';
        await A.captureInbox({rawContent,sourceKind,sourceUrl});
        await renderInbox('已保存原始內容。現在不用急著分類；需要立刻處理時再展開手動指定。');
      }catch(err){msg.textContent=err.message||'保存失敗';}
    });

    root.querySelectorAll('[data-classify]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try{
        await A.classifyInbox({itemId:btn.dataset.itemId,classification:btn.dataset.classify});
        await renderInbox('已指定用途；接下來可以送往對應流程。');
      }catch(err){btn.disabled=false;const msg=$('#inboxMsg');if(msg)msg.textContent=err.message||'分類失敗';}
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
          args.successEvidence=card?.querySelector('[data-project-success]')?.value?.trim()||'先由 GPT 拆解第一件可驗證作品，再依作品結果決定後續。';
        }else if(item.classification==='learning'){
          args.goal=card?.querySelector('[data-learning-goal]')?.value?.trim()||null;
          args.sourceLanguage='unknown';
        }
        await A.routeInbox(args);
        await renderInbox('已送到正式流程；原始內容仍保留，可追溯它從哪裡來。');
      }catch(err){
        btn.disabled=false;
        const msg=$('#inboxMsg');
        if(msg) msg.textContent=err.message||'送往流程失敗';
      }
    }));
  }

  function bind(){
    const nav=$('.nav-item[data-view="inbox"]');
    nav?.addEventListener('click',()=>queueMicrotask(()=>renderInbox()));
    if($('#view-inbox')?.classList.contains('active')) renderInbox();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();