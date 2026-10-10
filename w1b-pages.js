/* W1b 版面：沿用設計稿 prototype 的 markup（.w1p 範圍內的 bento／tile／chip／btn），資料全部來自既有快照。 */
(function(root){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=(n,cls='i i-sm')=>'<svg class="'+cls+'" aria-hidden="true"><use href="assets/w1b/icons.svg#'+n+'"/></svg>';
  const tone=a=>/數字人|Instagram|\bIG\b/i.test(String(a?.title||''))?'vi':'or';
  const cover=(a,big)=>'assets/w1b/'+(tone(a)==='vi'?'cover-digital-human-ig':'cover-single-product')+(big?'':'-600')+'.webp';
  function criteria(a){
    const ep=Array.isArray(a?.evidence_progress)?a.evidence_progress.slice().sort((x,y)=>(x.criterion_no||0)-(y.criterion_no||0)):[];
    const base=ep.length?ep.map(e=>({n:e.criterion_no,text:e.criterion_text,status:String(e.status||'pending'),at:e.confirmed_at||e.updated_at})):(Array.isArray(a?.done_evidence)?a.done_evidence:[]).map((t,i)=>({n:i+1,text:t,status:'pending'}));
    let nowSet=false;
    return base.map(c=>{let st='todo';if(c.status==='confirmed')st='done';else if(!nowSet){st='now';nowSet=true;}return {...c,st};});
  }
  function counts(cs){return {done:cs.filter(c=>c.st==='done').length,now:cs.filter(c=>c.st==='now').length,todo:cs.filter(c=>c.st==='todo').length,total:cs.length};}
  function ring(k){const p=k.total?Math.round(k.done/k.total*1000)/10:0;return '<div class="ring" style="--p:'+p+'"><div class="ring-label"><b>'+k.done+'<small>／'+k.total+'</small></b><span>完成條件</span></div></div>';}
  function seg(cs){return '<div class="seg" style="--n:'+Math.max(cs.length,1)+'" aria-label="完成條件 '+counts(cs).done+'／'+cs.length+'">'+cs.map(c=>'<i class="'+(c.st==='done'?'done':c.st==='now'?'now':'')+'"></i>').join('')+'</div>';}
  function cells(cs,max=4){
    if(cs.length<=max+1)max=cs.length;const shown=cs.slice(0,max),rest=cs.length-shown.length;
    const lab={done:'已完成',now:'進行中',todo:'未開始'},ic={done:'circle-check-big',now:'circle-dashed',todo:'circle'};
    return '<ol class="cells">'+shown.map(c=>'<li class="cell '+(c.st==='todo'?'':c.st)+'"><span class="cell-n num">'+c.n+'</span>'+icon(ic[c.st])+'<span class="cell-t">'+esc(c.text)+'</span><span class="cell-s">'+lab[c.st]+'</span></li>').join('')+
      (rest>0?'<li class="cell more"><span class="cell-n num">'+(max+1)+'–'+cs.length+'</span>'+icon('ellipsis')+'<span class="cell-t">還有 '+rest+' 個條件</span><span class="cell-s">到作品頁看全部</span></li>':'')+'</ol>';
  }
  function dateLabel(d=new Date()){return '星期'+'日一二三四五六'[d.getDay()]+'・'+(d.getMonth()+1)+' 月 '+d.getDate()+' 日';}
  /* 今天：目前作品已選定 */
  function todayHtml(o){
    const a=o.current,cs=criteria(a),k=counts(cs),now=cs.find(c=>c.st==='now');
    const t=tone(a);
    const waiting=(o.waiting||[]).slice(0,1);
    return '<div class="w1p w1p-today"><section class="head"><span class="eyebrow">'+icon('sun')+esc(dateLabel())+'</span><h1>現在只做這一步</h1><p>其他事情都先退後，直到它真的能幫你完成這一步。</p></section>'+
    '<div class="bento today-bento">'+
     '<article class="card-current tile b-next tone-'+t+'"><div class="tile-head"><span class="chip '+t+'"><span class="dot"></span>唯一下一步'+(now?'・第 '+now.n+' 步':'')+'</span><span class="muted small">'+esc(a.title)+'</span></div>'+
      '<h2>'+esc(o.stepTitle)+'</h2><p class="lead">'+esc(o.stepWhy)+'</p>'+
      '<dl class="facts"><div><dt>'+icon('paperclip')+'完成後要留下</dt><dd>'+esc(o.stepEvidence||'對應的證據')+'</dd></div><div><dt>'+icon('target')+'對應條件</dt><dd>'+(now?'第 '+now.n+' 個，共 '+k.total+' 個':'—')+'</dd></div></dl>'+
      '<div class="actions">'+o.ctaHtml+(o.funnelHtml||'')+'</div></article>'+
     '<article class="card tile b-prog"><div class="tile-head"><span class="label">目前作品</span><span class="chip '+t+'">進行中</span></div>'+
      '<div class="prog-row">'+ring(k)+'<ul class="kv"><li><i class="sw done"></i>已完成<b class="num">'+k.done+'</b></li><li><i class="sw now"></i>進行中<b class="num">'+k.now+'</b></li><li><i class="sw"></i>未開始<b class="num">'+k.todo+'</b></li></ul></div>'+
      '<a class="prog-work" href="#/works/active"><img src="'+cover(a)+'" alt="" width="96" height="54"><h3>'+esc(a.title)+'</h3></a></article>'+
     (waiting.length?waiting.map(w=>'<article class="card tile b-wait"><div class="tile-head"><span class="label">等待中</span><span class="chip '+tone(w)+'">'+icon('lock')+'先不做</span></div><div class="wait-row"><img src="'+cover(w)+'" alt="" width="96" height="54"><div><h3>'+esc(w.title)+'</h3><p class="muted small">會安全地等你；需要時可以切換。</p></div></div><div class="wait-foot"><span class="muted small">'+((w.done_evidence||[]).length?'共 '+w.done_evidence.length+' 個完成條件':'完成條件待產生')+'</span><a class="btn btn-ghost btn-sm" href="#/works/waiting">'+icon('repeat-2')+'切換</a></div></article>').join('')
       :'<article class="card tile b-wait"><div class="tile-head"><span class="label">等待中</span></div><p class="muted small">沒有等待中的作品。</p></article>')+
     '<article class="card tile b-steps"><div class="tile-head"><h3 class="tile-title">'+k.total+' 個完成條件</h3><span class="muted small">已完成 '+k.done+'・進行中 '+k.now+'・未開始 '+k.todo+'</span></div>'+seg(cs)+cells(cs)+'</article>'+
     '<article class="card-quiet tile b-learn"><div class="tile-head"><span class="chip te">卡住時才出現</span></div>'+(o.learnHtml||'')+'</article>'+
    '</div>'+(o.extraHtml||'')+'</div>';
  }
  /* 作品：總覽 bento（放在作品 › 進行中上方） */
  function worksHtml(pa){
    const cur=pa?.current||null;const cands=(Array.isArray(pa?.candidates)?pa.candidates:(pa?.candidate?[pa.candidate]:[])).filter(x=>x&&x.status==='candidate');
    const done=(Array.isArray(pa?.history)?pa.history:[]).filter(x=>x.status==='completed');
    const all=[cur,...cands].filter(Boolean);
    const feat=cur||cands[0]||null;
    if(!feat)return '';
    const cs=criteria(feat),k=counts(cs),now=cs.find(c=>c.st==='now'),t=tone(feat);
    const ev=cs.filter(c=>c.st==='done');
    const others=all.filter(x=>x!==feat);
    const md=iso=>{const d=new Date(iso);return isNaN(d)?'':(d.getMonth()+1)+' 月 '+d.getDate()+' 日';};
    const last=ev[ev.length-1];
    return '<div class="w1p w1p-works"><section class="head"><span class="eyebrow">'+icon('layers-3')+all.length+' 件作品・'+(cur?'1 件進行中':'還沒開始')+'</span><h1>作品</h1><p>看每件作品走到哪裡；做完一個條件，就交出證據。</p></section>'+
    '<div class="bento works-bento">'+
     '<article class="card-current tile w-feat tone-'+t+'"><div class="cover"><img src="'+cover(feat,true)+'" alt="" width="1200" height="675"></div><div class="feat-body">'+
      '<div class="tile-head"><span class="chip '+t+'"><span class="dot"></span>'+(cur?'目前作品・進行中':'等待中・還沒開始')+'</span></div><h2>'+esc(feat.title)+'</h2><p class="muted">'+esc(feat.objective||'')+'</p>'+
      '<div class="prog"><div class="prog-head"><b class="num">'+k.done+'／'+k.total+'</b>'+(now?'<span class="st-now">下一個：'+esc(now.text)+'</span>':'')+'</div>'+seg(cs)+'</div>'+
      '<div class="actions">'+(cur?'<button class="btn btn-primary" type="button" data-open-current>'+icon('upload','i')+'交出證據</button><a class="btn btn-text" href="#/works/review">看完整歷程'+icon('arrow-right','i i-sm go')+'</a>':'<a class="btn btn-primary" href="#/today/step">'+icon('play','i')+'到今天選它開始</a>')+'</div></div></article>'+
     '<div class="card tile kpi k1"><span class="label">完成條件</span><b class="num">'+k.done+'<small>／'+k.total+'</small></b><span class="muted small">'+(k.total?Math.round(k.done/k.total*100):0)+'%</span></div>'+
     '<div class="card tile kpi k2"><span class="label">已交證據</span><b class="num">'+ev.length+'<small> 份</small></b><span class="muted small">只算已確認的</span></div>'+
     '<div class="card tile kpi k3"><span class="label">最近證據</span><b class="num">'+(last&&last.at?(new Date(last.at).getMonth()+1)+'/'+new Date(last.at).getDate():'—')+'</b><span class="muted small">'+(last?esc(String(last.text).slice(0,12)):'還沒有')+'</span></div>'+
     '<div class="card tile kpi k4"><span class="label">下一步</span><b class="num">'+(now?now.n:'—')+'<small>'+(now?' ／'+k.total:'')+'</small></b><span class="muted small">'+(now?'第 '+now.n+' 個條件':'全部完成')+'</span></div>'+
     '<article class="card tile w-checks"><div class="tile-head"><h3 class="tile-title">完成條件</h3><span class="muted small">已完成 '+k.done+'・進行中 '+k.now+'・未開始 '+k.todo+'</span></div><ul class="checks">'+
       cs.slice(0,4).map(c=>'<li class="st-'+c.st+'">'+icon(c.st==='done'?'circle-check-big':c.st==='now'?'circle-dashed':'circle')+'<span>'+esc(c.text)+'</span>'+(c.st==='done'&&c.at?'<small class="muted">'+md(c.at)+'</small>':'')+'</li>').join('')+
       (cs.length>4?'<li class="more">'+icon('ellipsis')+'<span>還有 '+(cs.length-4)+' 個條件</span>'+icon('chevron-right')+'</li>':'')+'</ul></article>'+
     '<article class="card tile w-evid"><div class="tile-head"><h3 class="tile-title">已交的證據 <span class="num">'+ev.length+'</span></h3></div>'+(ev.length?'<div class="evid">'+ev.map(c=>'<div class="evid-item"><span class="ibox sm te">'+icon('check')+'</span><span class="ev-t"><b>'+esc(c.text)+'</b><small>'+md(c.at)+'</small></span></div>').join('')+'</div>':'<p class="muted small">還沒有已確認的證據。完成一個條件後，在作品詳情交出證據。</p>')+'</article>'+
     (others.length?others.slice(0,1).map(w=>'<article class="card tile w-wait"><div class="tile-head"><span class="label">等待中</span></div><div class="wait-row lg"><img src="'+cover(w)+'" alt="" width="600" height="338"><div><h3>'+esc(w.title)+'</h3><p class="muted small">'+esc(w.objective||'')+'</p></div></div><div class="wait-foot"><span class="muted small">'+((w.done_evidence||[]).length?'共 '+w.done_evidence.length+' 個完成條件':'完成條件會在開始後產生')+'</span><a class="btn btn-ghost btn-sm" href="#/today/step">'+icon('repeat-2')+'設為目前作品</a></div></article>').join(''):'<article class="card tile w-wait"><span class="label">等待中</span><p class="muted small">沒有等待中的作品。</p></article>')+
     '<article class="card-quiet tile w-empty"><img src="assets/w1b/empty-state.webp" alt="" width="120" height="96"><div><span class="label">已完成</span><h3>'+(done.length?done.length+' 件已完成':'還沒有完成的作品')+'</h3><p class="muted small">'+(done.length?'到「已完成」看它們的證據與能力變化。':'第一件完成後會出現在這裡，連同它的證據與能力變化。')+'</p><a class="link" href="#/'+(done.length?'works/done':'today/step')+'">'+(done.length?'看已完成':'回到今天的一步')+icon('chevron-right')+'</a></div></article>'+
    '</div></div>';
  }
  /* 側欄：我的作品 */
  function sideWorksHtml(pa){
    const cur=pa?.current||null;const cands=(Array.isArray(pa?.candidates)?pa.candidates:(pa?.candidate?[pa.candidate]:[])).filter(x=>x&&x.status==='candidate');
    const rows=[cur,...cands].filter(Boolean);if(!rows.length)return '';
    return '<div class="label">我的作品</div>'+rows.map(w=>{const k=counts(criteria(w));return '<a class="mini '+(w===cur?'cur':'')+' tone-'+tone(w)+'" href="#/works/'+(w===cur?'active':'waiting')+'"><span class="dot"></span><span class="mini-t">'+esc(w.title)+'</span><span class="mini-n">'+(w===cur?k.done+'/'+k.total:'等待')+'</span></a>';}).join('');
  }
  root.GROWTH_BRAIN_W1P={icon,tone,cover,criteria,counts,todayHtml,worksHtml,sideWorksHtml,dateLabel};
})(typeof window!=='undefined'?window:globalThis);
