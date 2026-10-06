(function(){
  'use strict';
  const slots=new Set(['today.hero','projects.hero','projects.cover','team.hero','history.hero']);
  let entries=[];
  function bind(){
    document.querySelectorAll('img[data-image-placement]').forEach(img=>{
      const entry=entries.find(e=>e.placement===img.dataset.imagePlacement);
      if(!entry||img.dataset.imageSha256===entry.sha256)return;
      const original=img.getAttribute('src');
      img.addEventListener('error',()=>{img.src=original;delete img.dataset.imageRequestId;},{once:true});
      img.dataset.imageSha256=entry.sha256;img.dataset.imageRequestId=entry.request_id;
      img.dataset.imageUsage='illustration';img.src=entry.path;
      img.alt='';img.setAttribute('aria-hidden','true');
    });
  }
  fetch('assets/image-manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('manifest unavailable');return r.json();}).then(m=>{
    if(m.schema_version!==1||!Array.isArray(m.entries))throw new Error('invalid manifest');
    entries=m.entries.filter(e=>slots.has(e.placement)&&e.status==='reviewed'&&e.usage==='illustration'&&e.is_real_evidence===false&&e.visual_dna_id==='growth-brain-warm-studio-v1'&&/^[a-f0-9]{64}$/.test(e.sha256)&&['png','webp'].some(ext=>e.path===`assets/generated/${e.sha256}.${ext}`));
    bind();new MutationObserver(bind).observe(document.querySelector('main'),{childList:true,subtree:true});
  }).catch(()=>{/* Keep existing imagery; missing manifest never claims success. */});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.GrowthImageFlow={render(flow){
    if(!flow)return '<section class="surface"><h3>圖片需求</h3><p>圖片佇列尚未載入，不能判定是否有待辦。</p></section>';
    const names={'today.hero':'今天頁首','projects.hero':'作品頁首','projects.cover':'作品示意圖','team.hero':'團隊頁首','history.hero':'歷程頁首'};
    const labels={awaiting_generation:'待 ChatGPT 生圖',asset_ready:'已回填，待網頁驗收',qa_failed:'驗收未過，待修正',completed:'已套用並驗收',skipped:'不需生圖'};
    return '<section class="surface image-flow-panel"><h3>圖片需求</h3><p>先沿用合適素材；只有需要時才交給 ChatGPT 生圖。生成圖只作示意，不代表真實成果。</p><p>目前採生圖交接，尚未啟用背景自動生圖。</p>'+
      (flow.requests?.length?flow.requests.map(r=>'<details><summary>'+esc(labels[r.state]||'狀態待確認')+' · '+esc(names[r.request?.placement]||'不需圖片')+'</summary><p>'+esc(r.request?.reason)+'</p>'+
      (r.state==='awaiting_generation'?'<p>下一步：交給 ChatGPT 生圖，再回填實際圖片檔。</p><textarea rows="8" readonly aria-label="ChatGPT 生圖需求">'+esc(JSON.stringify({image_required:true,prompt:r.request.prompt,placement:r.request.placement,aspect_ratio:r.request.aspect_ratio,visual_dna:r.request.visual_dna,purpose:'illustration',is_real_evidence:false},null,2))+'</textarea>':'')+'</details>').join(''):'<p>目前沒有圖片需求，不會為了填滿畫面而生成圖片。</p>')+'</section>';
  }};
})();
