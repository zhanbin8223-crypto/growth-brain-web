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

  function itemHtml(item){
    const source=item.source_url?'<a href="'+esc(item.source_url)+'" target="_blank" rel="noopener">查看原始來源</a>':'直接輸入';
    const kind=kindLabel[item.source_kind]||item.source_kind||'內容';
    const triage=item.ai_triage||{};
    const job=triage.job||null;
    const routed=Boolean(item.routing);
    const state=routed
      ?'已送到對應流程'
      :job&&['pending','claimed','processing'].includes(job.status)
        ?'AI 整理中'
        :item.classification
          ?(classLabel[item.classification]||item.classification)
          :'待整理';
    const stateClass=routed?'success':job&&['pending','claimed','processing'].includes(job.status)?'warn':'';
    return '<article class="surface">'+
      '<div class="row-between"><div><span class="kicker">'+esc(kind)+'</span><b>'+esc((item.raw_content||'').slice(0,80)||'未命名內容')+(String(item.raw_content||'').length>80?'…':'')+'</b></div><span class="pill '+stateClass+'">'+esc(state)+'</span></div>'+
      '<p class="muted">'+source+' · '+esc(item.created_at?new Date(item.created_at).toLocaleString('zh-TW'):'')+'</p>'+
      '<details><summary><b>查看整理方式與下一步</b></summary><div style="margin-top:12px">'+
        triageBlock(item)+
        routeControls(item)+
        '<div style="margin-top:12px">'+correctionControls(item)+'</div>'+
      '</div></details>'+
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

    root.innerHTML=
      '<div class="section-head"><div><h2>先收進來，不用先分類</h2><p>貼網址、文字或想法就好。AI 會在背景判斷用途；分類與送去哪裡放在每筆資料的「整理方式與下一步」裡。</p></div><span class="pill success">正式資料</span></div>'+
      '<form class="surface project-form" id="inboxForm">'+
        '<label><b>貼網址、文字或想法</b><textarea id="inboxContent" placeholder="先收進來就好，不用先想它屬於知識、學習、作品還是行動"></textarea></label>'+
        '<details><summary>補充來源網址（通常不用填）</summary><input id="inboxUrl" type="url" placeholder="https://..."></details>'+
        '<div class="row-between"><div id="inboxMsg" class="muted">'+esc(notice||'收進來後再整理；AI 的分類只是建議，不會直接改主線或宣稱你已學會。')+'</div><button class="primary-btn" type="submit">收進去</button></div>'+
      '</form>'+
      '<div class="section-head"><div><h2>最近收進來</h2><p>先看狀態；只有要處理時才展開分類與下一步。</p></div><span>'+items.length+' 筆</span></div>'+
      '<div class="stack" id="inboxItems">'+(items.length?items.map(itemHtml).join(''):'<div class="empty">目前沒有待整理內容。</div>')+'</div>';

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

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();