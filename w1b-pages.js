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
  /* 今天最上方「需要你決定」：只用既有資料；沒有項目就不顯示 */
  function decideHtml(items){
    if(!items||!items.length)return '';
    return '<section class="card tile decide" aria-labelledby="dc-t"><div class="tile-head"><h2 class="tile-title" id="dc-t">需要你決定 <span class="ttag">'+items.length+'</span></h2><span class="muted small">不處理也不會擋住今天的一步</span></div>'+
      '<ul class="dc-list n'+Math.min(items.length,3)+'">'+items.slice(0,3).map((x,i)=>'<li class="rowi '+(i===0?'hi':'')+'"><span class="icirc '+(x.tone||'mute')+'">'+icon(x.icon||'flag','i i-sm')+'</span><div class="grow"><b>'+esc(x.title)+'</b><small>'+esc(x.sub||'')+'</small></div><a class="btn '+(i===0?'btn-primary':'btn-ghost')+' btn-sm" href="'+esc(x.href)+'">'+esc(x.cta)+'</a></li>').join('')+'</ul></section>';
  }
  function decideItems(o){
    const out=[];
    (o.waiting||[]).forEach(w=>{if(!(w.done_evidence||[]).length)out.push({title:'「'+w.title+'」還沒有完成條件',sub:'開始前要先定好「做完」的樣子',href:'#/works/waiting',cta:'去確認',tone:'or',icon:'list'});});
    if(o.unsorted>0)out.push({title:o.unsorted+' 則收集還沒分類',sub:'最早 '+(o.unsortedSince||''),href:'#/collect/inbox',cta:'去整理',tone:'mute',icon:'inbox'});
    return out;
  }
  /* 今天：目前作品已選定 */
  function todayHtml(o){
    const a=o.current,cs=criteria(a),k=counts(cs),now=cs.find(c=>c.st==='now');
    const t=tone(a);
    const waiting=(o.waiting||[]).slice(0,1);
    return '<div class="w1p w1p-today"><div class="w1p-decide">'+decideHtml(decideItems(o))+'</div><section class="head"><span class="eyebrow">'+icon('sun')+esc(dateLabel())+'</span><h1>現在只做這一步</h1><p>其他事情都先退後，直到它真的能幫你完成這一步。</p></section>'+
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
    return '<div class="w1p w1p-works"><section class="head head-row"><div><span class="eyebrow">'+icon('layers-3')+all.length+' 件作品・'+(cur?'1 件進行中':'還沒開始')+'</span><h1>作品</h1><p>看每件作品走到哪裡；做完一個條件，就交出證據。</p></div><div class="head-act"><a class="btn btn-primary" href="#/works/active" data-new-work>'+icon('plus','i')+'新增作品</a></div></section>'+
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

  /* 回顧：週／月切換＋前後期；只用既有歷程資料 */
  function periodRange(unit,offset,now=new Date()){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(unit==='month'){const s=new Date(d.getFullYear(),d.getMonth()+offset,1),e=new Date(s.getFullYear(),s.getMonth()+1,1);return {s,e};}
    const dow=(d.getDay()+6)%7;const s=new Date(d);s.setDate(d.getDate()-dow+offset*7);const e=new Date(s);e.setDate(s.getDate()+7);return {s,e};
  }
  function reviewHtml(groups,unit='week',offset=0,now=new Date()){
    const {s,e}=periodRange(unit,offset,now);const inP=x=>{const t=new Date(x?.occurred_at);return !isNaN(t)&&t>=s&&t<e;};
    const per=(groups.personal||[]).filter(inP),sk=(groups.skills||[]).filter(inP),rs=(groups.research||[]).filter(inP);
    const ev=per.filter(x=>x.type==='evidence'),dec=per.filter(x=>x.type!=='evidence');
    const fmt=d=>(d.getMonth()+1)+' 月 '+d.getDate()+' 日';const last=new Date(e);last.setDate(e.getDate()-1);
    const label=unit==='month'?(s.getFullYear()+' 年 '+(s.getMonth()+1)+' 月'):(fmt(s)+' – '+fmt(last));
    const cur=offset===0?(unit==='month'?'本月':'本週'):(unit==='month'?(offset===-1?'上個月':Math.abs(offset)+' 個月前'):(offset===-1?'上週':Math.abs(offset)+' 週前'));
    const head='<section class="head head-row"><div><span class="eyebrow">'+esc(label)+'</span><h1>回顧</h1><p>看真的發生過什麼：做了哪些步驟、交了哪些證據、學了什麼。</p></div>'+
      '<div class="head-act"><div class="period"><div class="filter" role="tablist" aria-label="期間單位"><button type="button" role="tab" data-rv-unit="week" aria-selected="'+(unit==='week')+'" class="'+(unit==='week'?'on':'')+'">週</button><button type="button" role="tab" data-rv-unit="month" aria-selected="'+(unit==='month')+'" class="'+(unit==='month'?'on':'')+'">月</button></div>'+
      '<div class="stepper"><button type="button" class="btn btn-ghost btn-sm" data-rv-step="-1" aria-label="'+(unit==='month'?'上個月':'上一週')+'">'+icon('chevron-left')+'</button><span>'+cur+'</span><button type="button" class="btn btn-ghost btn-sm" data-rv-step="1" aria-label="'+(unit==='month'?'下個月':'下一週')+'"'+(offset>=0?' disabled':'')+'>'+icon('chevron-right')+'</button></div></div></div></section>';
    const all=[...per.map(x=>({...x,k:x.type==='evidence'?'te':'or'})),...sk.map(x=>({...x,k:'vi'})),...rs.map(x=>({...x,k:'mute'}))].sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
    if(!all.length)return '<div class="w1p w1p-review">'+head+'<div class="pg-bento rv0-bento"><article class="card tile empty"><img src="assets/w1b/empty-state.webp" alt="" width="800" height="600"><h2>'+(unit==='month'?'這個月':'這週')+'還沒有紀錄</h2><p>完成第一個條件、交出第一份證據或送出第一份練習後，它們會照時間出現在這裡。這裡只記真的發生過的事。</p><a class="btn btn-primary" href="#/today/step">回到今天的一步</a></article></div></div>';
    let strip='';
    if(unit==='week'){strip='<div class="week">'+[...Array(7)].map((_,i)=>{const d=new Date(s);d.setDate(s.getDate()+i);const n=new Date(d);n.setDate(d.getDate()+1);const day=all.filter(x=>{const t=new Date(x.occurred_at);return t>=d&&t<n;});
      return '<div class="wd '+(d.toDateString()===now.toDateString()?'today':'')+'"><small>'+'一二三四五六日'[i]+'</small><b class="num">'+d.getDate()+'</b><span class="pips">'+day.slice(0,4).map(x=>'<i class="p'+(x.k==='te'?'t':x.k==='vi'?'v':'o')+'"></i>').join('')+'</span></div>';}).join('')+'</div>';}
    const tl=all.slice(0,12).map(x=>{const t=new Date(x.occurred_at);return '<li><span class="icirc '+(x.k==='mute'?'':x.k)+'">'+icon(x.k==='te'?'paperclip':x.k==='vi'?'sprout':x.k==='mute'?'search':'flag','i i-sm')+'</span><div><b>'+esc(x.title||'紀錄')+'</b>'+(x.summary?'<span class="muted">'+esc(String(x.summary).slice(0,60))+'</span>':'')+'</div><time>'+(t.getMonth()+1)+'/'+t.getDate()+'</time></li>';}).join('');
    return '<div class="w1p w1p-review">'+head+'<div class="pg-bento rv-bento">'+
      '<div class="card tile kpi r1 k1"><span class="label">做出的決定</span><b class="num">'+dec.length+'<small> 個</small></b><span class="muted small">選作品、確認條件等</span></div>'+
      '<div class="card tile kpi r2"><span class="label">交出證據</span><b class="num">'+ev.length+'<small> 份</small></b><span class="muted small">只算真實紀錄</span></div>'+
      '<div class="card tile kpi r3"><span class="label">能力變化</span><b class="num">'+sk.length+'<small> 次</small></b><span class="muted small">有證據才算</span></div>'+
      '<div class="card tile kpi r4"><span class="label">研究</span><b class="num">'+rs.length+'<small> 筆</small></b><span class="muted small">研究歷程</span></div>'+
      '<article class="card tile rv-week"><div class="tile-head"><h3 class="tile-title">'+(unit==='month'?'這個月':'這一週')+'</h3><span class="legend"><span><i style="background:var(--or)"></i>決定</span><span><i style="background:var(--te)"></i>證據</span><span><i style="background:var(--vi)"></i>能力</span></span></div>'+(strip||'<p class="muted small">'+all.length+' 筆紀錄</p>')+'</article><article class="card tile rv-tl"><div class="tile-head"><h3 class="tile-title">發生了什麼</h3><span class="muted small">新的在上面</span></div><ol class="tl">'+tl+'</ol></article>'+
      '<div class="rv-side"><article class="card tile rv-res" id="research"><div class="tile-head"><h3 class="tile-title">研究歷程</h3><a class="link" href="#/lab/notes/history">全部'+icon('chevron-right')+'</a></div>'+(rs.length?'<ul class="rows">'+rs.slice(0,3).map(x=>'<li class="rowi"><span class="icirc">'+icon('search','i i-sm')+'</span><div class="grow"><b>'+esc(String(x.title||'').replace(/^(新增探索|補上操作步驟)：/,'').slice(0,28))+'</b><small>'+esc(x.status==='active'?'進行中':x.status==='pending'?'排隊中':(x.status||''))+'</small></div></li>').join('')+'</ul>':'<p class="muted small">這段期間沒有研究紀錄。</p>')+'</article></div>'+
      '</div></div>';
  }
  /* 系統三頁：共同標題＋各頁摘要卡（資料來自 my_jobs 快照與既有工作包） */
  function sysHead(active,title,desc,failed){
    const tabs=[['pending','待處理'],['team','AI 團隊'],['status','系統狀態'],['account','帳號與設定']];
    return '<section class="head head-row"><div><a class="back" href="#/today/step">'+icon('chevron-left')+'回到今天</a><br><span class="eyebrow">系統</span><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div>'+
      '<div class="head-act"><nav class="subnav" aria-label="系統">'+tabs.map(([k,l])=>'<a href="#/system/'+k+'" class="'+(k===active?'on':'')+'"'+(k===active?' aria-current="page"':'')+'>'+l+(k==='pending'&&failed?'<em>'+failed+'</em>':'')+'</a>').join('')+'</nav></div></section>';
  }
  function jobTitle(j){return j.title||j.task_type||'工作';}
  function sysPendingHtml(snap,decisions){
    const jobs=Array.isArray(snap?.jobs)?snap.jobs:[];const failed=jobs.filter(j=>j.status==='failed'),queued=jobs.filter(j=>['pending','claimed','processing'].includes(j.status));
    const t=x=>{const d=new Date(x);return isNaN(d)?'':(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
    return '<div class="w1p w1p-sys">'+sysHead('pending','待處理','系統自己的事：失敗、排隊和決定紀錄。要你決定的事在「今天」最上方。',failed.length)+
      '<div class="pg-bento sp-bento"><article class="card tile sp-list">'+
       '<div class="grp">失敗、等你重試 <span class="ttag">'+failed.length+'</span></div>'+(failed.length?'<ul class="rows">'+failed.slice(0,6).map((j,i)=>'<li class="rowi '+(i===0?'hi':'')+'"><span class="icirc or">'+icon('flag','i i-sm')+'</span><div class="grow"><b>'+esc(jobTitle(j))+'</b><small>'+esc((j.error_message||'失敗').slice(0,60))+'・'+t(j.created_at)+'</small></div><a class="btn btn-ghost btn-sm" href="#/collect/questions">重試</a></li>').join('')+'</ul>':'<p class="muted small">沒有失敗的工作。</p>')+
       '<div class="grp">排隊中，不用處理 <span class="ttag">'+queued.length+'</span></div><ul class="rows"><li class="rowi"><span class="icirc mute">'+icon('clock','i i-sm')+'</span><div class="grow"><b>'+queued.length+' 個工作排隊中</b><small>處理程式'+(snap?.worker?.online?'上線中':'離線中，上線後會自動處理')+'</small></div><a class="link" href="#/collect/questions">看我的提問</a></li></ul>'+
       '<div class="grp">決定紀錄 <span class="ttag">只讀</span></div>'+(decisions&&decisions.length?'<ol class="tl rec">'+decisions.slice(0,6).map(d=>'<li><span class="icirc">'+icon('list','i i-sm')+'</span><div><b>'+esc(d.title)+'</b><span class="muted">'+esc(d.pkg||d.reason||'')+'</span></div><time>'+esc(d.needsLabel||'')+'</time></li>').join('')+'</ol>':'<p class="muted small">目前沒有決定紀錄。</p>')+
      '</article><article class="card tile wash sp-side"><div class="stats" style="grid-template-columns:1fr 1fr"><div><b>'+failed.length+'</b><span>失敗待重試</span></div><div><b>'+queued.length+'</b><span>排隊中</span></div><div><b>'+(decisions||[]).length+'</b><span>系統待辦紀錄</span></div><div><b>'+jobs.filter(j=>j.status==='completed').length+'</b><span>已完成</span></div></div>'+
       '<div class="note">'+icon('lightbulb','i i-sm')+'<span>系統數字只算「失敗待重試」。要你決定的事會出現在今天頁最上方，這裡只留紀錄。</span></div><a class="btn btn-ghost btn-sm" href="#/today/step">去今天處理決定</a></article></div></div>';
  }
  function sysStatusHead(snap){
    const jobs=Array.isArray(snap?.jobs)?snap.jobs:[];const w=snap?.worker||{};const last=new Date(w.last_seen_at);const on=!isNaN(last)&&Date.now()-last<10*60e3;
    const failed=jobs.filter(j=>j.status==='failed').length,queued=jobs.filter(j=>['pending','claimed','processing'].includes(j.status)).length,done=jobs.filter(j=>j.status==='completed').length;
    const rate=done+failed?Math.round(done/(done+failed)*1000)/10:0;
    return '<div class="pg-bento ss-bento ss-top"><article class="card tile wash ss-health"><div class="health"><span class="icirc lg '+(on?'te':'or')+'">'+icon(on?'check':'flag','i')+'</span><div><h2>'+(on?'運作正常':'處理程式離線')+'</h2><p class="muted">'+(isNaN(last)?'還沒有上線紀錄。':'最後上線 '+(last.getMonth()+1)+'/'+last.getDate()+' '+String(last.getHours()).padStart(2,'0')+':'+String(last.getMinutes()).padStart(2,'0')+(on?'':'；排隊的工作會等它上線後處理。'))+'</p></div></div>'+
      '<div class="stats"><div><b>'+(on?1:0)+'</b><span>處理程式上線</span></div><div><b>'+queued+'</b><span>排隊中</span></div><div><b>'+failed+'</b><span>失敗</span></div><div><b>'+rate+'%</b><span>成功率（我的提問）</span></div></div></article></div>';
  }
  /* 側欄：我的作品 */
  function sideWorksHtml(pa){
    const cur=pa?.current||null;const cands=(Array.isArray(pa?.candidates)?pa.candidates:(pa?.candidate?[pa.candidate]:[])).filter(x=>x&&x.status==='candidate');
    const rows=[cur,...cands].filter(Boolean);if(!rows.length)return '';
    return '<div class="label">我的作品</div>'+rows.map(w=>{const k=counts(criteria(w));return '<a class="mini '+(w===cur?'cur':'')+' tone-'+tone(w)+'" href="#/works/'+(w===cur?'active':'waiting')+'"><span class="dot"></span><span class="mini-t">'+esc(w.title)+'</span><span class="mini-n">'+(w===cur?k.done+'/'+k.total:'等待')+'</span></a>';}).join('')+'<a class="mini add" href="#/works/active" data-new-work>'+icon('plus')+'<span class="mini-t">新增作品</span></a>';
  }
  root.GROWTH_BRAIN_W1P={icon,tone,cover,criteria,counts,todayHtml,worksHtml,sideWorksHtml,dateLabel,periodRange,reviewHtml,decideHtml,decideItems,sysHead,sysPendingHtml,sysStatusHead};
})(typeof window!=='undefined'?window:globalThis);
