(function(){
  const A=window.GROWTH_BRAIN_ADAPTER;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const classLabel={knowledge:'知識',learning:'學習',project:'專案',action:'行動'};
  const kindLabel={text:'文字',link:'連結',idea:'想法'};
  const targetLabel={
    personal_outcome_candidate:'主線候選',
    learning_session:'學習來源',
    growth_action:'可追蹤行動',
    synapse_ingestion_candidate:'知識候選'
  };

  function classificationButtons(item){
    if(item.routing) return '';
    return ['knowledge','learning','project','action'].map(key=>{
      const active=item.classification===key;
      return `<button class="ghost-btn small" data-classify="${key}" data-item-id="${esc(item.id)}" ${active?'disabled':''}>${active?'✓ ':''}${classLabel[key]}</button>`;
    }).join('');
  }

  function routePanel(item){
    if(item.routing){
      return `<div class="evidence-box"><b>已轉入：${esc(targetLabel[item.routing.target_kind]||item.routing.target_kind||'正式流程')}</b><span>原始收件匣內容仍保留。路由紀錄：${esc(item.routing.target_ref||item.routing.id||'已建立')}</span></div>`;
    }
    if(!item.classification) return '';

    if(item.classification==='project'){
      const defaultTitle=String(item.raw_content||'').slice(0,120);
      return `<div class="evidence-box" data-route-box="${esc(item.id)}">
        <b>建立主線候選</b>
        <span>先設定成功證據；這只會建立候選，不會自動設成你的主線。</span>
        <input data-route-title value="${esc(defaultTitle)}" placeholder="候選主線名稱">
        <input data-route-success placeholder="怎樣才算完成？例如：完成可操作 MVP 並測試 3 位使用者">
        <button class="primary-btn" data-route="${esc(item.id)}" data-route-kind="project">建立候選</button>
      </div>`;
    }

    const copy={
      learning:['建立學習來源','保留這筆原文與來源，建立正式 Learning session；現在不假裝 AI 已解釋完成。','建立學習來源'],
      action:['建立可追蹤行動','建立正式行動候選；只有之後真的完成並留下證據，才會算進展。','建立行動'],
      knowledge:['送入知識候選','保留 provenance（來源脈絡），先成為知識攝取候選；不會直接補出假節點。','建立知識候選']
    }[item.classification];

    return `<div class="evidence-box" data-route-box="${esc(item.id)}"><b>${copy[0]}</b><span>${copy[1]}</span><button class="primary-btn" data-route="${esc(item.id)}" data-route-kind="${esc(item.classification)}">${copy[2]}</button></div>`;
  }

  function itemHtml(item){
    const source=item.source_url?`<a href="${esc(item.source_url)}" target="_blank" rel="noopener">查看原始來源</a>`:'未提供外部網址';
    const status=item.routing
      ?`已轉入：${targetLabel[item.routing.target_kind]||item.routing.target_kind||'正式流程'}`
      :(item.classification?`已分類：${classLabel[item.classification]||esc(item.classification)}`:'尚未分類');
    return `<article class="surface">
      <div class="row-between"><div><span class="kicker">${esc(kindLabel[item.source_kind]||item.source_kind||'文字')}</span><b>${esc(status)}</b></div><small class="muted">${esc(item.created_at?new Date(item.created_at).toLocaleString('zh-TW'):'')}</small></div>
      <p>${esc(item.raw_content||'')}</p>
      <div class="row-between"><small class="muted">${source}</small><div class="project-actions">${classificationButtons(item)}</div></div>
      ${routePanel(item)}
    </article>`;
  }

  async function renderInbox(notice=''){
    const root=$('#view-inbox');
    if(!root) return;
    $('#pageTitle').textContent='先收進來，再決定它要去哪裡';

    if(A.liveStatus!=='live'){
      root.innerHTML=`<div class="section-head"><div><h2>收件匣</h2><p>把文字、連結或想法先放進單一入口；正式資料只在登入後顯示。</p></div></div><div class="surface"><b>目前尚未登入正式資料</b><p>這裡不會用 demo 或 localStorage 冒充你的正式收件匣。</p><button class="primary-btn" data-auth>登入</button></div>`;
      return;
    }

    root.innerHTML='<div class="empty">正在載入正式收件匣…</div>';
    let snapshot;
    try{snapshot=await A.getInbox();}
    catch(e){root.innerHTML=`<div class="empty">收件匣載入失敗：${esc(e.message||e)}</div>`;return;}
    const items=snapshot?.items||[];

    root.innerHTML=`
      <div class="section-head"><div><h2>收件匣</h2><p>先保留原始內容與來源，再明確轉入知識、學習、專案或行動流程。</p></div><span class="pill success">正式資料</span></div>
      <form class="surface project-form" id="inboxForm">
        <label><b>內容</b><textarea id="inboxContent" placeholder="貼上文字、連結，或直接寫下一個想法"></textarea></label>
        <div class="hero-grid">
          <label><b>來源類型</b><select id="inboxKind"><option value="text">文字</option><option value="link">連結</option><option value="idea">想法</option></select></label>
          <label><b>原始網址（可選）</b><input id="inboxUrl" type="url" placeholder="https://..."></label>
        </div>
        <div class="row-between"><div id="inboxMsg" class="muted">${esc(notice||'保存後先進收件匣；分類與轉入流程是兩個明確步驟。')}</div><button class="primary-btn" type="submit">收進來</button></div>
      </form>
      <div class="section-head"><div><h2>待整理內容</h2><p>原文永遠保留；轉入其他流程後仍可追溯回這筆 Inbox。</p></div><span>${items.length} 筆</span></div>
      <div class="stack" id="inboxItems">${items.length?items.map(itemHtml).join(''):'<div class="empty">目前收件匣是空的。</div>'}</div>`;

    $('#inboxForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const rawContent=$('#inboxContent').value.trim();
      const sourceKind=$('#inboxKind').value;
      let sourceUrl=$('#inboxUrl').value.trim();
      const msg=$('#inboxMsg');
      if(!rawContent){msg.textContent='請先輸入內容。';return;}
      if(sourceKind==='link'&&!sourceUrl&&/^https?:\/\//i.test(rawContent)) sourceUrl=rawContent;
      try{
        msg.textContent='正在保存正式資料…';
        await A.captureInbox({rawContent,sourceKind,sourceUrl});
        await renderInbox('已保存到正式收件匣。');
      }catch(err){msg.textContent=err.message||'保存失敗';}
    });

    root.querySelectorAll('[data-classify]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try{
        await A.classifyInbox({itemId:btn.dataset.itemId,classification:btn.dataset.classify});
        await renderInbox('分類已更新。下一步可明確轉入對應流程，原始來源不會被覆蓋。');
      }catch(err){btn.disabled=false;const msg=$('#inboxMsg');if(msg)msg.textContent=err.message||'分類失敗';}
    }));

    root.querySelectorAll('[data-route]').forEach(btn=>btn.addEventListener('click',async()=>{
      const itemId=btn.dataset.route;
      const kind=btn.dataset.routeKind;
      const box=root.querySelector(`[data-route-box="${itemId}"]`);
      const msg=$('#inboxMsg');
      btn.disabled=true;
      try{
        const payload={itemId};
        if(kind==='project'){
          payload.title=box?.querySelector('[data-route-title]')?.value?.trim()||'';
          payload.successEvidence=box?.querySelector('[data-route-success]')?.value?.trim()||'';
          if(payload.successEvidence.length<3){
            throw new Error('請先寫下可驗證的成功證據，再建立主線候選。');
          }
        }
        await A.routeInbox(payload);
        await renderInbox('已轉入正式流程，並保留原始 Inbox 與來源脈絡。');
      }catch(err){
        btn.disabled=false;
        if(msg) msg.textContent=err.message||'轉入流程失敗';
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