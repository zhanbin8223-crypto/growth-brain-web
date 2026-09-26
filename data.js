window.GROWTH_BRAIN_DEMO = {
  meta: {
    snapshot: 'predeploy-personal-home-2026-09-27',
    home_source: 'cached Personal Home fallback',
    learning_source: 'verified private Learning snapshot',
    note: '登入後 Personal Home 與 System Cockpit 會分開讀取。'
  },
  personalHome: {
    sv: 'personal-home-surface-v1',
    surface: 'personal_growth_home',
    primary_direction: {
      key: 'remote_income',
      goal: '把累積的知識、作品與能力轉成可遠端進行的收入路徑',
      status: 'active',
      priority: 'active',
      confidence: 0.98
    },
    primary_action: {
      status: 'needs_personal_outcome_route',
      title: '選定一個真實個人成長／作品目標作為主線',
      why: '目前只有系統建置 Outcome Route，不能拿 B+18 代替你的個人下一步。',
      success_evidence: '建立至少一條 scope=personal 的 outcome route，並產生一個真實作品或行動證據。'
    },
    learning_support: {
      role: 'supporting_only',
      summary: {concept_count:5,unverified_count:5,forming_count:0,can_explain_count:0,can_apply_count:0},
      primary_card: {
        label:'未驗證',
        description:'AI 解釋不是學會；目前還沒有足夠的使用者 evidence。',
        next_action:'完成一次回答、測驗或實作，留下第一筆可驗證證據。'
      }
    },
    synapse_highlights: {
      role:'context_and_patterns',
      nodes:[
        {k:'concept:synapse_graph',label:'Synapse Graph',n:6,c:0.99},
        {k:'logic:repeated_core_logic',label:'Repeated Core Logic',n:3,c:0.99},
        {k:'logic:unified_stream',label:'Unified Stream',n:2,c:0.99},
        {k:'concept:spec_kit_workflow',label:'Spec-first Workflow',n:1,c:0.96}
      ]
    },
    system_health: {
      location:'system_cockpit',
      build_in_progress:true,
      parallel_blocker_count:3,
      show_build_details_on_personal_home:false
    }
  },
  video: {
    source: {
      url:'https://x.com/txbrraa/status/2103217445855207713/video/1?s=46',
      language:'es',
      platform:'X',
      transcript_status:'fallback_post_text',
      transcript_confidence:0.72,
      exact_timestamps:false
    },
    units:[
      {
        id:'3b2e2977-e682-4cb3-bda3-cb84867f1cc2',
        title:'先規格，再實作',
        mode:'diagram',
        relevance:0.99,
        state:'unknown',
        evidence_count:0,
        zh:'先把要做什麼、為什麼、限制與驗收條件說清楚，再碰實作，能降低 Agent 因模糊需求亂改架構的機率。',
        original:'Spec Kit obliga a la IA a crear una especificación estructurada ANTES de tocar código.',
        prompt:'用你自己的話說：為什麼 AI coding 先寫規格會比直接叫 Agent 開始寫程式更穩定？',
        expected_evidence_type:'paraphrase',
        flow:['想法','規格','計畫','任務','實作','驗證']
      },
      {
        id:'b2847b52-90b4-45bd-89ac-d9ffa2c320cd',
        title:'記住控制邏輯，不死背指令',
        mode:'card',
        relevance:0.95,
        state:'unknown',
        evidence_count:0,
        zh:'先固定原則與需求，再澄清、規劃、拆任務，最後才實作。',
        original:'/constitution → /specify → /clarify → /plan → /tasks → /implement',
        prompt:'如果今天不是寫程式，而是做 Growth Brain，你會把 specify → clarify → plan → tasks 對應到哪些動作？',
        expected_evidence_type:'guided_apply',
        front:'最值得記住的是什麼？',
        back:'先固定原則與需求 → 澄清不確定 → 規劃 → 拆任務 → 實作 → 驗證。'
      },
      {
        id:'b43ab09c-f326-479e-90e8-59a170802389',
        title:'Intent + Evidence 要在實作前面',
        mode:'application',
        relevance:0.99,
        state:'unknown',
        evidence_count:0,
        zh:'不能因為 AI 覺得某方向好就直接做；要先有訊號、理由、驗收與可回退。',
        original:'Keep intent and evidence ahead of implementation.',
        prompt:'現在 Growth Brain 哪一個功能最適合套這個規則？說出目的與一個驗收證據。',
        expected_evidence_type:'guided_apply'
      }
    ]
  },
  synapse: {
    nodes:[
      {id:'concept:synapse_graph',label:'Synapse',center:true,x:50,y:48},
      {id:'sys.outcome_ladder',label:'Outcome Ladder',x:20,y:23},
      {id:'logic:repeated_core_logic',label:'Repeated Core',x:79,y:25},
      {id:'logic:unified_stream',label:'Unified Stream',x:74,y:75}
    ],
    edges:[
      {source:'sys.outcome_ladder',target:'concept:synapse_graph',relation:'current_artifact'},
      {source:'concept:synapse_graph',target:'logic:repeated_core_logic',relation:'detects'},
      {source:'concept:synapse_graph',target:'logic:unified_stream',relation:'implemented_by'}
    ]
  },
  systemCockpit: {
    surface:'system_cockpit',
    ceo:{
      current:{stage:'B+18',step_key:'fixed-site-persistent-auth-e2e',title:'固定正式網站來源與持久登入 E2E',status:'current',objective:'建立固定 HTTPS origin，完成 Auth redirect、session persistence 與 authenticated GET/POST E2E。'},
      parallel_blockers:[]
    },
    work_queue:{packages:[]},
    skill_team:{executable_roles:[]}
  }
};
