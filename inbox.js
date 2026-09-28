(function(){
  const A=window.GROWTH_BRAIN_ADAPTER;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const classLabel={knowledge:'知識',learning:'學習',project:'專案',action:'行動'};
  const kindLabel={text:'文字',link:'連結',idea:'想法'};

  function classificationButtons(item){
    return ['knowledge','learning','project','action'].map(key=>{
      const active=item.classification===key;
      return `<button class="ghost-btn small" data-classify="${key}" data-item-id="${esc(item.id)}" ${active?'disabled':''}>${active?'✓ ':''}${classLabel[key]}</button>`;
    }).join('');
  }

  function itemHtml(item){
    const source=item.source_url?`<a href="${esc(item.source_url)}" target="_blank" rel="noopener">查看原始來源</a>`:'未提供外部網址';
    const status=item.classification?`已分類：${classLabel[item.classification]||esc(item.classification)}`:'尚未分類';
    return `<article class="surface">
      <div class="row-between"><div><span class="kicker">${esc(kindLabel[item.source_kind]||item.source_kind||'文字')}</span><b>${esc(status)}</b></div><small class="muted">${esc(item.created_at?new Date(item.created_at).toLocaleString('zh-TW'):'')}</small></div>
      <p>${esc(item.raw_content||'')}</p>
      <div class="row-between"><small class="muted">${source}</small><div class="project-actions">${classificationButtons(item)}</div></div>
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
      <div class="section-head"><div><h2>收件匣</h2><p>先保留原始內容與來源，再決定要變成知識、學習、專案或行動。</p></div><span class="pill success">正式資料</span></div>
      <form class="surface project-form" id="inboxForm">
        <label><b>內容</b><textarea id="inboxContent" placeholder="貼上文字、連結，或直接寫下一個想法"></textarea></label>
        <div class="hero-grid">
          <label><b>來源類型</b><select id="inboxKind"><option value="text">文字</option><option value="link">連結</option><option value="idea">想法</option></select></label>
          <label><b>原始網址（可選）</b><input id="inboxUrl" type="url" placeholder="https://..."></label>
        </div>
        <div class="row-between"><div id="inboxMsg" class="muted">${esc(notice||'保存後會先進收件匣，不會自動替你決定分類。')}</div><button class="primary-btn" type="submit">收進來</button></div>
      </form>
      <div class="section-head"><div><h2>待整理內容</h2><p>每一筆都保留原始內容；分類只改狀態，不覆蓋來源。</p></div><span>${items.length} 筆</span></div>
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
        await renderInbox('分類已更新，原始內容與來源仍保留。');
      }catch(err){btn.disabled=false;const msg=$('#inboxMsg');if(msg)msg.textContent=err.message||'分類失敗';}
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