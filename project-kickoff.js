(function(){
  if(typeof renderProjectTeamDraft!=='function'||typeof projectTeamCatalog!=='function')return;

  const baseRenderProjectTeamDraft=renderProjectTeamDraft;
  let currentMeeting=null;
  let currentSignature='';

  const KICKOFF_META={
    'goal-closure-operator':{
      question:'這一輪最少要證明什麼，才值得繼續投入？',
      risk:'把帳號、角色設定、內容產量、流量與變現同時展開，會讓第一輪無法判斷哪個環節有效。',
      dependency:'先定義第一輪可觀察的成功／停止條件。',
      milestone:'完成第一輪最小內容測試，取得真實觸及、觀看或互動證據。'
    },
    'logic-reality-analyst':{
      question:'哪些指標能證明內容真的有需求，而不是偶然曝光？',
      risk:'把單支高流量、主觀喜好或平台推論直接當成可重複成效。',
      dependency:'先定義樣本數、觀察期與要記錄的真實指標。',
      milestone:'建立第一輪流量驗證基準，能判斷繼續、調整或停止。'
    },
    'ceo-orchestrator':{
      question:'哪些角色現在必須參與，哪些等出現證據後再加入？',
      risk:'角色太多造成重複決策，讓作品主線失焦。',
      dependency:'明確指定本輪唯一成果與每個角色的邊界。',
      milestone:'形成單一可執行主線，所有角色都只服務同一個驗收結果。'
    },
    'supabase-engineer':{
      question:'這一輪真的需要新增正式資料結構嗎？',
      risk:'太早改資料模型，把仍在驗證的流程固定成長期架構。',
      dependency:'只有需要跨工作階段保存的資料才進正式資料庫。',
      milestone:'只保存本輪必要狀態，且不污染既有個人資料與作品證據。'
    },
    'github-operator':{
      question:'本輪最小需要改哪些檔案才能完成驗收？',
      risk:'順手修改無關檔案或重構，增加部署與回歸風險。',
      dependency:'先鎖定修改範圍與原驗收。',
      milestone:'只提交與本輪功能直接相關的最小變更並保留可追溯版本。'
    },
    'work-web-operator':{
      question:'使用者在目前畫面上必須看見並完成哪一個動作？',
      risk:'把後續功能提前塞進同一畫面，造成資訊過多。',
      dependency:'沿用現有介面結構與元件，不另開無關設計。',
      milestone:'目前切片可以在既有作品流程中直接操作與看見結果。'
    },
    'work-browser-qa':{
      question:'哪一條真實互動路徑最能證明這一輪沒有壞掉？',
      risk:'只驗靜態字串，沒有驗證實際點擊與狀態切換。',
      dependency:'要有固定案例與可重跑的互動驗收。',
      milestone:'固定案例的主要互動與回歸檢查全部通過。'
    }
  };

  const escText=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const uniq=list=>[...new Set((list||[]).filter(Boolean))];

  function contribution(item){
    const meta=KICKOFF_META[item.key]||{};
    const scope=typeof projectTeamScope==='function'?projectTeamScope(item):'只負責與本作品直接相關的專業範圍。';
    return {
      key:item.key,
      name:item.name,
      scope,
      question:meta.question||'在「'+scope+'」範圍內，現在最需要先確認的未知是什麼？',
      risk:meta.risk||'如果沒有先確認「'+scope+'」的必要條件，可能造成返工或錯誤判斷。',
      dependency:meta.dependency||'需要目前作品目標、已知限制與可驗收證據。',
      milestone:meta.milestone||'完成一個只屬於「'+scope+'」的最小可驗證結果。'
    };
  }

  function consensus(goal){
    const tags=typeof projectGoalTags==='function'?projectGoalTags(goal):new Set();
    const out=['作品主線不變；先用最小測試取得真實證據，再決定是否擴大。'];
    if(tags.has('traffic'))out.push('第一輪先驗證內容能否取得可重複的真實流量，不把單次曝光當成功。');
    if(tags.has('business')||tags.has('revenue'))out.push('變現先保留為後續驗證；沒有受眾與流量證據前，不先擴張商業模型。');
    return out.slice(0,3);
  }

  function buildMeeting(system){
    const catalog=projectTeamCatalog(system),byKey=new Map(catalog.map(x=>[x.key,x]));
    const selected=(PROJECT_TEAM_DRAFT?.selectedKeys||[]).map(k=>byKey.get(k)).filter(Boolean);
    const participants=selected.filter(x=>x.kind==='employee'&&x.autoEligible);
    const participantKeys=new Set(participants.map(x=>x.key));
    const support=selected.filter(x=>!participantKeys.has(x.key));
    const contributions=participants.map(contribution);
    return {
      version:'project-kickoff-v1',
      goal:PROJECT_TEAM_DRAFT?.goal||'',
      team_keys:[...(PROJECT_TEAM_DRAFT?.selectedKeys||[])],
      participant_keys:participants.map(x=>x.key),
      support_resources:support.map(x=>({
        key:x.key,
        name:x.name,
        kind:typeof projectTeamKindLabel==='function'?projectTeamKindLabel(x):'支援資源'
      })),
      contributions,
      summary:{
        consensus:consensus(PROJECT_TEAM_DRAFT?.goal||''),
        risks:uniq(contributions.map(x=>x.risk)).slice(0,4),
        pending:uniq(contributions.map(x=>x.question)).slice(0,4),
        milestone_suggestions:uniq(contributions.map(x=>x.milestone)).slice(0,4)
      }
    };
  }

  function summaryBlock(title,items){
    return '<div class="project-kickoff-summary-block"><b>'+escText(title)+'</b><ul>'+
      (((items||[]).map(x=>'<li>'+escText(x)+'</li>').join(''))||'<li>目前沒有額外項目。</li>')+
      '</ul></div>';
  }

  function panelHtml(selected){
    const canRun=selected.some(x=>x.kind==='employee'&&x.autoEligible);
    if(!currentMeeting){
      return '<section class="project-kickoff">'+
        '<div class="project-kickoff-head"><div><span class="kicker">作品組隊器 · 第二步</span><h4>啟動會議</h4><p>只讓目前可執行員工在自己的專業範圍內提出關鍵問題、風險、依賴與建議里程碑；工具與資料來源只當支援資源，不冒充員工發言。</p></div>'+
        '<button class="primary-btn" type="button" data-project-team-kickoff '+(canRun?'':'disabled')+'>啟動會議</button></div>'+
        '<div class="project-team-empty">'+(canRun?'組隊完成後再開會；這一步不會改變作品主線，也不會提前展開完整計畫。':'目前小隊沒有可執行員工，請先重新配隊或手動加入現有員工。')+'</div>'+
      '</section>';
    }

    const contributions=Array.isArray(currentMeeting.contributions)?currentMeeting.contributions:[];
    const summary=currentMeeting.summary||{};
    const support=(currentMeeting.support_resources||[]).map(x=>x.name).filter(Boolean);
    return '<section class="project-kickoff is-ready">'+
      '<div class="project-kickoff-head"><div><span class="kicker">作品組隊器 · 第二步</span><h4>啟動會議摘要</h4><p>已收斂成同一條作品主線；這裡只保留開工前必要判斷，不展開完整執行計畫。</p></div><button class="ghost-btn small" type="button" data-project-team-kickoff>重新開會</button></div>'+
      '<div class="project-kickoff-speakers">'+contributions.map(c=>
        '<article class="project-kickoff-speaker" data-kickoff-speaker="'+escText(c.key)+'"><div><span>員工</span><b>'+escText(c.name)+'</b></div>'+
        '<p><strong>關鍵問題</strong>'+escText(c.question)+'</p>'+
        '<p><strong>主要風險</strong>'+escText(c.risk)+'</p>'+
        '<p><strong>必要依賴</strong>'+escText(c.dependency)+'</p>'+
        '<p><strong>建議里程碑</strong>'+escText(c.milestone)+'</p></article>'
      ).join('')+'</div>'+
      (support.length?'<div class="project-kickoff-support"><b>支援資源</b><span>'+escText(support.join('、'))+'</span><small>只提供工具、資料或方法，不作為員工發言。</small></div>':'')+
      '<div class="project-kickoff-summary">'+
        summaryBlock('共識',summary.consensus)+
        summaryBlock('風險',summary.risks)+
        summaryBlock('待確認',summary.pending)+
        summaryBlock('建議里程碑',summary.milestone_suggestions)+
      '</div>'+
    '</section>';
  }

  renderProjectTeamDraft=function(container,system){
    baseRenderProjectTeamDraft(container,system);
    if(!container||!PROJECT_TEAM_DRAFT?.generated){
      currentMeeting=null;
      currentSignature='';
      return;
    }

    const signature=(PROJECT_TEAM_DRAFT.goal||'')+'|'+(PROJECT_TEAM_DRAFT.selectedKeys||[]).join('|');
    if(signature!==currentSignature){
      currentMeeting=null;
      currentSignature=signature;
    }

    const catalog=projectTeamCatalog(system),byKey=new Map(catalog.map(x=>[x.key,x]));
    const selected=(PROJECT_TEAM_DRAFT.selectedKeys||[]).map(k=>byKey.get(k)).filter(Boolean);
    container.insertAdjacentHTML('beforeend',panelHtml(selected));

    const button=container.querySelector('[data-project-team-kickoff]');
    if(button&&!button.disabled){
      button.addEventListener('click',()=>{
        currentMeeting=buildMeeting(system);
        renderProjectTeamDraft(container,system);
      });
    }
  };

  window.GROWTH_BRAIN_PROJECT_KICKOFF={
    current:()=>clone(currentMeeting),
    reset:()=>{currentMeeting=null;currentSignature='';}
  };

  queueMicrotask(()=>{
    const box=document.querySelector('#projectTeamBuilderResult');
    if(box&&PROJECT_TEAM_DRAFT?.generated)renderProjectTeamDraft(box,SYSTEM);
  });
})();
