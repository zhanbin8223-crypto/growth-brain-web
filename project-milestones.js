(function(){
  if(typeof renderProjectTeamDraft!=='function')return;
  const original=renderProjectTeamDraft;
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const signature=b=>b?JSON.stringify([b.version,b.objective,b.team_keys,b.base_prompt]):'';
  let plan=null, briefSignature='';

  function specification(b){
    const goal=b.objective||b.goal||'';
    const digital=/數字人|digital\s*(human|avatar)|avatar|虛擬人物/i.test(goal);
    const social=/instagram|ig\b|reels?|threads|tiktok|社群/i.test(goal);
    if(digital&&social){
      return [
        {title:'定位數字人與受眾',objective:'先確認誰會看、為何追蹤，以及第一輪內容要驗證什麼。',acceptance:'留下受眾假設、人物設定、第一輪內容方向與成功指標。',
          steps:[
            '選定一種目標觀眾，寫出想解決的需求與追蹤理由。',
            '查看至少 5 個相關帳號，記錄其受眾、主題、內容形式與來源。',
            '定義固定數字人的人格、外觀方向與主要內容系列。',
            '確定前三支短影音題目、觀察指標與停止／調整條件。'
          ]},
        {title:'驗證數字人影片製作',objective:'驗證固定角色、中文語音、嘴型與基本影片品質可重複製作。',acceptance:'至少一支可檢查的樣片與製作流程紀錄。',
          steps:['選定可合法使用的角色素材及工具。','用同一人物製作一支短片樣片。','檢查人物一致性、聲音、對嘴與素材權利。']},
        {title:'完成並發布第一輪內容',objective:'用相同內容定位製作小批量內容並取得真實平台數據。',acceptance:'3 支正式發布內容及發佈日期、連結、素材檢查結果。',
          steps:['依相同系列完成三支腳本與影片。','完成字幕、封面與素材權利檢查。','發布並記下作品連結與時間。']},
        {title:'回收數據並決定下一輪',objective:'根據觀看、互動、追蹤與點擊判斷是否值得擴大或調整。',acceptance:'真實指標紀錄與繼續、調整或停止的明確決策。',
          steps:['依觀察期彙整每支影片觀看、互動與追蹤相關指標。','比較不同題材與內容形式，不以單次高流量推斷穩定成效。','決定繼續、調整或停止；變現留到有足夠證據後評估。']}
      ];
    }
    return [
      {title:'確認目標與第一輪驗證',objective:'收斂受眾、可交付成果與成功證據。',acceptance:'清楚的目標假設和第一輪完成條件。',
        steps:['寫出一個最重要的使用情境或目標受眾。','列出目前已知資源、限制和未確認假設。','定義一個最小可交付成果及可觀察驗收條件。']},
      {title:'建立最小可驗證作品',objective:'沿用現有工具產出第一件可檢查的作品。',acceptance:'可展示、可核對的作品與主要品質檢查。',
        steps:['選用現有可用的員工與工具。','製作一個最小版本。','確認沒有破壞權利、資料或既有流程。']},
      {title:'實際測試與取得回饋',objective:'在真實使用情境測試作品。',acceptance:'真實執行或使用紀錄，以及失敗與成功的證據。',
        steps:['選定測試方式與觀察指標。','執行一次真實測試。','保存可追溯的結果與問題。']},
      {title:'回顧結果與下一步',objective:'依驗收證據決定擴大、修正或停止。',acceptance:'寫出決策及其依據。',
        steps:['比對原始完成條件與真實結果。','記下阻塞、可重用能力與風險。','只選下一個可驗證步驟。']}
    ];
  }

  function expandCurrent(p){
    const milestone=p.milestones[p.current_milestone];
    if(!milestone)return;
    if(!Array.isArray(p.current_steps)||p.expanded_milestone!==p.current_milestone){
      p.current_steps=(milestone.step_seed||[]).map((text,i)=>({key:'m'+(p.current_milestone+1)+'-s'+(i+1),text,evidence_note:null}));
      p.current_step=0;
      p.expanded_milestone=p.current_milestone;
    }
  }

  function build(b){
    const specs=specification(b);
    const p={
      version:'project-milestones-v1',
      goal:b.objective,
      source_brief_version:b.version,
      source_brief_signature:signature(b),
      meeting_suggestions:clone(b.milestone_seed||[]),
      milestones:specs.map((x,i)=>({key:'m'+(i+1),title:x.title,objective:x.objective,acceptance:x.acceptance,step_seed:x.steps})),
      current_milestone:0,
      current_step:0,
      expanded_milestone:null,
      current_steps:[],
      verified_personal_progress:false
    };
    expandCurrent(p);
    return p;
  }

  function panel(b){
    if(!b)return '<section class="project-milestones is-locked"><div class="project-milestones-head"><div><span class="kicker">作品組隊器 · 第四步</span><h4>作品里程碑</h4><p>先完成啟動會議及基礎提示詞。</p></div></div></section>';
    if(!plan)return '<section class="project-milestones"><div class="project-milestones-head"><div><span class="kicker">作品組隊器 · 第四步</span><h4>正式作品里程碑</h4><p>先排階段順序，只展開目前階段；下一階段等實際結果再拆細。</p></div><button class="primary-btn" type="button" data-build-project-milestones>產生里程碑</button></div></section>';
    const current=plan.milestones[plan.current_milestone];
    const steps=plan.current_steps||[];
    const currentStep=steps[plan.current_step]||null;
    return '<section class="project-milestones is-ready">'+
      '<div class="project-milestones-head"><div><span class="kicker">作品組隊器 · 第四步</span><h4>正式作品路徑</h4><p>現在只展開「'+esc(current.title)+'」，其他里程碑保留概要，不提前展開細步驟。</p></div></div>'+
      '<div class="project-milestones-list">'+plan.milestones.map((m,i)=>
        '<article class="project-milestone-card'+(i===plan.current_milestone?' is-current':'')+'">'+
        '<span>階段 '+(i+1)+(i===plan.current_milestone?' · 目前':'')+'</span><b>'+esc(m.title)+'</b>'+
        '<p>'+esc(m.objective)+'</p><small>完成條件：'+esc(m.acceptance)+'</small>'+
        (i===plan.current_milestone?
          '<div class="project-milestone-steps"><strong>目前階段的可執行步驟</strong><ol>'+steps.map((s,n)=>
            '<li class="'+(n===plan.current_step?'is-current-step':'')+'">'+(s.evidence_note?'<span>已回報 · </span>':'')+esc(s.text)+'</li>'
          ).join('')+'</ol>'+
          (currentStep?
            '<div class="project-milestone-next"><b>現在只做這一步</b><p>'+esc(currentStep.text)+'</p>'+
              '<label>完成證據（完成後再填）<input type="text" data-project-step-evidence maxlength="500" placeholder="記錄實際完成了什麼，不要用 AI 推論代替"></label>'+
              '<button class="ghost-btn small" type="button" data-project-step-report>記錄這一步並繼續</button></div>'
          :'<div class="project-milestone-next"><b>目前階段步驟已有回報</b><p>請核對實際證據後，再決定是否進到下一階段。</p>'+
             (plan.current_milestone<plan.milestones.length-1?'<button class="ghost-btn small" type="button" data-project-next-milestone>開始下一個里程碑</button>':'<small>已完成階段紀錄；不會自動宣稱真實作品完成或升級技能。</small>')+'</div>')+
          '</div>':'')+
        '</article>'
      ).join('')+'</div>'+
      '<p class="project-milestone-note">步驟紀錄只是使用者回報，尚未代表系統已驗證。請在保存候選路徑時一併保存團隊與目前規劃。</p>'+
    '</section>';
  }

  renderProjectTeamDraft=function(container,system){
    original(container,system);
    if(!container||!PROJECT_TEAM_DRAFT?.generated){plan=null;briefSignature='';return;}
    const b=window.GROWTH_BRAIN_PROJECT_BRIEF?.current?.()||null;
    const sig=signature(b);
    if(sig!==briefSignature){plan=null;briefSignature=sig;}
    container.insertAdjacentHTML('beforeend',panel(b));
    container.querySelector('[data-build-project-milestones]')?.addEventListener('click',()=>{
      const latest=window.GROWTH_BRAIN_PROJECT_BRIEF?.current?.();
      if(!latest)return;
      briefSignature=signature(latest);plan=build(latest);
      renderProjectTeamDraft(container,system);
    });
    container.querySelector('[data-project-step-report]')?.addEventListener('click',()=>{
      const note=container.querySelector('[data-project-step-evidence]')?.value?.trim()||'';
      if(note.length<3){window.alert('請先填寫至少 3 個字的實際完成證據。');return;}
      const step=plan?.current_steps?.[plan.current_step];
      if(!step)return;
      step.evidence_note=note;
      plan.current_step++;
      renderProjectTeamDraft(container,system);
    });
    container.querySelector('[data-project-next-milestone]')?.addEventListener('click',()=>{
      if(!plan||plan.current_step<plan.current_steps.length||plan.current_milestone>=plan.milestones.length-1)return;
      plan.current_milestone++;
      plan.current_step=0;
      expandCurrent(plan);
      renderProjectTeamDraft(container,system);
    });
  };

  window.GROWTH_BRAIN_PROJECT_MILESTONES={
    current:()=>clone(plan),
    restore:value=>{
      const b=window.GROWTH_BRAIN_PROJECT_BRIEF?.current?.();
      if(!b||!value||value.version!=='project-milestones-v1'||value.source_brief_signature!==signature(b))return false;
      if(!Array.isArray(value.milestones)||value.milestones.length<1||!Number.isInteger(value.current_milestone)||value.current_milestone<0||value.current_milestone>=value.milestones.length)return false;
      plan=clone(value);briefSignature=signature(b);expandCurrent(plan);
      return true;
    },
    reset:()=>{plan=null;briefSignature='';}
  };
  queueMicrotask(()=>{
    const box=document.querySelector('#projectTeamBuilderResult');
    if(box&&PROJECT_TEAM_DRAFT?.generated)renderProjectTeamDraft(box,SYSTEM);
  });
})();