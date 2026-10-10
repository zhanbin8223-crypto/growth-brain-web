/* 能力圖譜（capmap-ab2）＋作品能力清單建議（work-skill-proposal）。
   規則：程度只看真實證據；「我可能會」只記待確認，不改程度。 */
(function(root){
  const LEVELS=['沒試過','接觸過','協助下會做','能自己做','作品驗證'];
  const LEVEL_OF={unknown:0,exposure:1,acknowledged:1,understood:2,can_explain:2,apply_with_help:2,apply_independently:3,retained:3,real_project:4,commercialized:4};
  function levelOf(state){const v=LEVEL_OF[String(state||'unknown').toLowerCase()];return v==null?0:v;}
  function criteriaOf(text){const m=String(text||'').match(/條件\s*([0-9０-９、,，\s]+)/);if(!m)return [];return m[1].split(/[、,，\s]+/).map(x=>Number(String(x).replace(/[０-９]/g,d=>'０１２３４５６７８９'.indexOf(d))) ).filter(n=>Number.isInteger(n)&&n>0);}
  function buildModel(skills,artifacts){
    const list=(Array.isArray(skills)?skills:[]).filter(s=>s&&s.artifact_id&&s.skill_key);
    const keyWorks={};list.forEach(s=>{(keyWorks[s.skill_key]=keyWorks[s.skill_key]||new Set()).add(String(s.artifact_id));});
    const order=[];const works={};
    const meta={};(Array.isArray(artifacts)?artifacts:[]).forEach(a=>{if(a&&a.id)meta[String(a.id)]=a;});
    list.forEach(s=>{const id=String(s.artifact_id);if(!works[id]){works[id]={id,title:s.artifact_title||meta[id]?.title||'未命名作品',status:s.artifact_status||meta[id]?.status||'candidate',skills:[]};order.push(id);}
      const level=levelOf(s.evidence_state);
      works[id].skills.push({key:s.skill_key,artifactId:id,name:s.name_zh||s.skill_key,why:s.why||'',usedIn:s.minimum_needed_now||'',criteria:criteriaOf(s.minimum_needed_now),level,levelLabel:LEVELS[level],known:level>=1,both:(keyWorks[s.skill_key]?.size||0)>1,selfClaim:!!s.self_claim,evidenceCount:Array.isArray(s.evidence_refs)?s.evidence_refs.length:0});});
    // works without skills still appear (so the user can ask for a proposal)
    Object.values(meta).forEach(a=>{const id=String(a.id);if(!works[id]&&['candidate','current'].includes(a.status)){works[id]={id,title:a.title||'未命名作品',status:a.status,skills:[]};order.push(id);}});
    const c0=s=>s.criteria.length?s.criteria[0]:99;order.forEach(id=>works[id].skills.sort((a,b)=>c0(a)-c0(b)));
    order.sort((x,y)=>(works[x].status==='current'?0:1)-(works[y].status==='current'?0:1));
    const all=order.flatMap(id=>works[id].skills);
    const known=all.filter(s=>s.known).length;
    const firstWork=works[order[0]];
    const next=(firstWork?.skills||[]).find(s=>!s.known)||all.find(s=>!s.known)||null;
    return {works:order.map(id=>works[id]),total:all.length,known,unknown:all.length-known,next};
  }
  function filterSkills(skills,f){return f==='known'?skills.filter(s=>s.known):f==='unknown'?skills.filter(s=>!s.known):skills;}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rowHtml(s){return '<li class="cm-sk"><button class="cm-sk-b" type="button" data-cm-skill="'+esc(s.artifactId+'|'+s.key)+'"><span class="cm-sk-n">'+esc(s.name)+(s.both?'<span class="cm-both" title="兩件作品都用到">兩件都用到</span>':'')+'</span><span class="cm-lv l'+s.level+'">'+esc(s.levelLabel)+'</span><span class="cm-chev" aria-hidden="true">›</span></button></li>';}
  function pageHtml(model,filter){
    const f=filter||'all';
    const fbtn=(k,l,n)=>'<button type="button" role="tab" aria-selected="'+(f===k)+'" class="'+(f===k?'on':'')+'" data-cm-filter="'+k+'">'+l+' <em>'+n+'</em></button>';
    const tile=(w,i)=>{const sk=filterSkills(w.skills,f);const k=w.skills.filter(s=>s.known).length;
      return '<article class="cm-card cm-work '+(i===0?'or':'vi')+'"><header class="cm-work-h"><div><span class="cm-chip '+(w.status==='current'?'or':'')+'">'+(w.status==='current'?'目前作品':'等待中')+'</span><h3>'+esc(w.title)+'</h3></div><span class="cm-muted">會的 '+k+'／'+w.skills.length+'</span></header>'+
      (w.skills.length?(sk.length?'<ul class="cm-sks">'+sk.map(rowHtml).join('')+'</ul>':'<p class="cm-muted cm-pad">這個篩選下沒有能力。</p>'):'<div class="cm-pad"><p class="cm-muted">這件作品還沒有能力清單。</p><button class="cm-btn cm-ghost" type="button" data-work-skills="'+esc(w.id)+'" data-work-title="'+esc(w.title)+'">依完成條件產生建議清單</button></div>')+
      (w.skills.length?'<div class="cm-work-f"><button class="cm-link" type="button" data-work-skills="'+esc(w.id)+'" data-work-title="'+esc(w.title)+'">修改這件作品的能力清單</button></div>':'')+'</article>';};
    return '<div class="cm-a1"><section class="cm-head"><span class="cm-crumb">學習 › 我的能力</span><h2>這兩件作品需要的能力</h2><p>看哪些能力最重要、哪些你可能已經會。程度只看真實證據。</p>'+
      '<div class="cm-filter" role="tablist" aria-label="篩選能力">'+fbtn('all','全部',model.total)+fbtn('known','我已經會的',model.known)+fbtn('unknown','還沒會的',model.unknown)+'</div></section>'+
      '<div class="cm-bento"><article class="cm-card cm-sum"><span class="cm-label">總覽</span><div class="cm-kpis"><div><b>'+model.known+'</b><span>我已經會的</span></div><div><b>'+model.unknown+'</b><span>還沒會的</span></div><div><b>'+model.total+'</b><span>作品要用到</span></div></div>'+
      (model.next?'<p class="cm-muted">下一個最值得補：<b class="cm-ink">'+esc(model.next.name)+'</b>'+(model.next.usedIn?'（'+esc(model.next.usedIn)+'）':'')+'</p><button class="cm-btn cm-primary" type="button" data-cm-next="'+esc(model.next.artifactId+'|'+model.next.key)+'">去補這一項</button>':'<p class="cm-muted">'+(model.total?'清單上的能力都已有證據。':'還沒有能力清單；先在下方替作品產生建議。')+'</p>')+'</article>'+
      '<article class="cm-card cm-legend"><span class="cm-label">程度標籤</span><div class="cm-lgrow">'+LEVELS.map((l,i)=>'<span class="cm-lv l'+i+'">'+l+'</span>').join('')+'</div><p class="cm-muted">「已經會」＝有真實證據、程度在接觸過以上。點一項能力可以看詳情、交證據。</p></article>'+
      model.works.map(tile).join('')+'</div><div id="cmMethods"></div></div>';
  }
  function panelHtml(s,work){
    const canEvidence=work?.status==='current';
    return '<div class="cm-scrim" data-cm-close></div><aside class="cm-panel" role="dialog" aria-modal="true" aria-label="能力詳情"><div class="cm-ph"><span class="cm-label">能力詳情</span><button class="cm-btn cm-text" type="button" data-cm-close>關閉 ✕</button></div>'+
      '<h2>'+esc(s.name)+'</h2><span class="cm-lv l'+s.level+'">'+esc(s.levelLabel)+'</span>'+(s.why?'<p class="cm-lead">'+esc(s.why)+'</p>':'')+
      '<dl class="cm-facts"><div><dt>用在</dt><dd>'+esc((work?.title||'')+(s.usedIn?'・'+s.usedIn:''))+'</dd></div><div><dt>目前證據</dt><dd>'+s.evidenceCount+' 筆</dd></div></dl>'+
      (canEvidence?'<form class="cm-ev" data-cm-evidence><label>交一個證據（做了什麼、連結或截圖說明）<textarea name="t" rows="3" required minlength="3"></textarea></label>'+
        (s.criteria.length>1?'<label>對應條件<select name="c">'+s.criteria.map(n=>'<option value="'+n+'">條件 '+n+'</option>').join('')+'</select></label>':'')+
        '<button class="cm-btn cm-primary" type="submit"'+(s.criteria.length?'':' disabled')+'>交一個證據</button>'+(s.criteria.length?'':'<small class="cm-muted">這項能力沒有對應的完成條件，請先修改能力清單。</small>')+'<small class="cm-muted" data-cm-msg></small></form>'
        :'<p class="cm-note">這件作品還在等待中。到「今天」選它開始後，才能交證據。</p>')+
      '<div class="cm-claim">'+(s.selfClaim?'<span class="cm-chip">已標記：我可能會（待確認）</span>':'<button class="cm-btn cm-ghost" type="button" data-cm-claim>我可能會</button>')+'<small class="cm-muted">只會記下「待確認」，程度不會改；交了證據才會升級。</small></div></aside>';
  }
  function editorHtml(title,skills,note){
    const row=(s,i)=>'<li class="cm-ed-row" data-i="'+i+'"><input aria-label="能力名稱" data-f="name_zh" value="'+esc(s.name_zh)+'" maxlength="40"><select aria-label="類型" data-f="skill_kind"><option value="core"'+(s.skill_kind!=='tool'?' selected':'')+'>能力</option><option value="tool"'+(s.skill_kind==='tool'?' selected':'')+'>工具</option></select><input aria-label="為什麼需要" data-f="why" value="'+esc(s.why||'')+'"><input aria-label="用在哪個條件" data-f="minimum_needed_now" value="'+esc(s.minimum_needed_now||'')+'"><input type="hidden" data-f="skill_key" value="'+esc(s.skill_key||'')+'"><button class="cm-btn cm-text" type="button" data-ed-del="'+i+'" aria-label="刪除">刪除</button></li>';
    return '<div class="cm-scrim" data-cm-close></div><aside class="cm-panel cm-editor" role="dialog" aria-modal="true" aria-label="確認能力清單"><div class="cm-ph"><span class="cm-label">確認能力清單</span><button class="cm-btn cm-text" type="button" data-cm-close>關閉 ✕</button></div><h2>'+esc(title)+'</h2><p class="cm-muted">'+esc(note||'系統依完成條件建議了下面這些能力。你可以改名、刪掉或新增；按「確認儲存」才會寫入，程度一律從「沒試過」開始。')+'</p>'+
      '<ul class="cm-ed">'+skills.map(row).join('')+'</ul><button class="cm-btn cm-ghost" type="button" data-ed-add>＋ 新增一項</button><div class="cm-ed-f"><button class="cm-btn cm-primary" type="button" data-ed-save>確認儲存</button><small class="cm-muted" data-cm-msg></small></div></aside>';
  }
  function readEditor(el){return [...el.querySelectorAll('.cm-ed-row')].map(r=>{const o={};r.querySelectorAll('[data-f]').forEach(i=>o[i.dataset.f]=i.value.trim());return o;}).filter(o=>o.name_zh);}

  // ---------- browser wiring ----------
  function openSheet(html){closeSheet();const host=document.createElement('div');host.id='cmSheet';host.className='cm-a1 cm-sheet-host';host.innerHTML=html;document.body.appendChild(host);document.body.classList.add('cm-lock');host.querySelectorAll('[data-cm-close]').forEach(b=>b.onclick=closeSheet);host.querySelector('.cm-panel')?.focus?.();return host;}
  function closeSheet(){document.getElementById('cmSheet')?.remove();document.body.classList.remove('cm-lock');}
  async function openEditor(A,artifactId,title,onDone){
    const host=openSheet(editorHtml(title,[],'正在依完成條件產生建議…'));
    let skills=[];let note='';
    try{const r=await A.proposeWorkSkills({artifactId});const existing=r.existing_skills||[];
      skills=existing.length?existing:(r.skills||[]);
      note=existing.length?'這是目前已存的清單，可直接修改後儲存。':'系統依完成條件的關鍵字對應能力範本產生（沒有用 AI 模型）。請改成你的說法再確認；按「確認儲存」才會寫入，程度一律從「沒試過」開始。';
    }catch(e){note='產生建議失敗：'+(e.message||e)+'。你仍可手動新增。';}
    const render=()=>{host.innerHTML=editorHtml(title,skills,note);host.querySelectorAll('[data-cm-close]').forEach(b=>b.onclick=closeSheet);
      host.querySelectorAll('[data-ed-del]').forEach(b=>b.onclick=()=>{skills=readEditor(host);skills.splice(Number(b.dataset.edDel),1);render();});
      host.querySelector('[data-ed-add]').onclick=()=>{skills=readEditor(host);skills.push({name_zh:'',skill_kind:'core',why:'',minimum_needed_now:''});render();host.querySelector('.cm-ed-row:last-child input')?.focus();};
      host.querySelector('[data-ed-save]').onclick=async e=>{const list=readEditor(host);const msg=host.querySelector('[data-cm-msg]');
        if(!list.length){msg.textContent='至少要有一項能力。';return;}
        e.currentTarget.disabled=true;msg.textContent='儲存中…';
        try{const r=await A.saveWorkSkills({artifactId,skills:list});msg.textContent='已儲存 '+list.length+' 項'+(r.kept_with_evidence?'（'+r.kept_with_evidence+' 項已有證據的能力保留）':'')+'。';setTimeout(()=>{closeSheet();onDone&&onDone();},600);}
        catch(err){e.currentTarget.disabled=false;msg.textContent='儲存失敗：'+(err.message||err);}};};
    render();
  }
  async function render(rootEl,A,opts={}){
    const lib=await A.getCapabilities({force:true});
    let arts=[];try{const pa=await A.getPersonalArtifacts();arts=[pa?.current,...(Array.isArray(pa?.candidates)?pa.candidates:[pa?.candidate])].filter(Boolean);}catch(e){}
    const model=buildModel(lib?.personal_skills,arts);let filter=opts.filter||'all';
    const paint=()=>{rootEl.innerHTML=pageHtml(model,filter);opts.afterPaint&&opts.afterPaint(rootEl.querySelector('#cmMethods'),lib);
      rootEl.querySelectorAll('[data-cm-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.cmFilter;paint();});
      const open=ref=>{const [aid,key]=ref.split('|');const w=model.works.find(x=>x.id===aid);const s=w?.skills.find(x=>x.key===key);if(!s)return;
        const host=openSheet(panelHtml(s,w));
        host.querySelector('[data-cm-claim]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await A.claimSkill({artifactId:aid,skillKey:key});s.selfClaim=true;open(ref);}catch(err){e.currentTarget.disabled=false;alert(err.message||err);}});
        host.querySelector('[data-cm-evidence]')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const msg=f.querySelector('[data-cm-msg]');const t=f.t.value.trim();if(t.length<3){msg.textContent='請至少寫 3 個字。';return;}
          const c=f.c?Number(f.c.value):s.criteria[0];f.querySelector('button[type=submit]').disabled=true;msg.textContent='送出中…';
          try{await A.recordPersonalArtifactEvidence({artifactId:aid,criterionNo:c,evidenceText:t,evidenceRefs:[],metadata:{source:'capability_map',skill_key:key}});msg.textContent='已交出，等待審核；程度要等證據被確認後才會改。';}
          catch(err){f.querySelector('button[type=submit]').disabled=false;msg.textContent='送出失敗：'+(err.message||err);}});};
      rootEl.querySelectorAll('[data-cm-skill]').forEach(b=>b.onclick=()=>open(b.dataset.cmSkill));
      rootEl.querySelector('[data-cm-next]')?.addEventListener('click',e=>open(e.currentTarget.dataset.cmNext));
      rootEl.querySelectorAll('[data-work-skills]').forEach(b=>b.onclick=()=>openEditor(A,b.dataset.workSkills,b.dataset.workTitle,()=>render(rootEl,A,{...opts,filter})));};
    paint();return model;
  }
  if(typeof document!=='undefined'){document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});
    document.addEventListener('click',e=>{const b=e.target.closest?.('[data-work-skills-global]');if(!b||!root.GROWTH_BRAIN_ADAPTER)return;openEditor(root.GROWTH_BRAIN_ADAPTER,b.dataset.workSkillsGlobal,b.dataset.workTitle,()=>root.dispatchEvent?.(new CustomEvent('growth:work-skills-saved')));});}
  root.GROWTH_BRAIN_CAPMAP={LEVELS,levelOf,criteriaOf,buildModel,filterSkills,pageHtml,panelHtml,editorHtml,render,openEditor,closeSheet};
})(typeof window!=='undefined'?window:globalThis);
