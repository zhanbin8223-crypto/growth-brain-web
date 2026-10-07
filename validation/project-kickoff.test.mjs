import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../project-kickoff.js',import.meta.url),'utf8');

class Box {
  constructor(){this.innerHTML='';this.handlers={};}
  insertAdjacentHTML(_,html){this.innerHTML+=html;}
  querySelector(selector){
    if(selector==='[data-project-team-kickoff]'&&this.innerHTML.includes('data-project-team-kickoff')){
      return {disabled:false,addEventListener:(type,handler)=>{this.handlers[type]=handler;}};
    }
    return null;
  }
}

function harness(){
  const box=new Box();
  const context={
    window:{},
    document:{querySelector:()=>null},
    queueMicrotask:fn=>fn(),
    PROJECT_TEAM_DRAFT:{
      goal:'建立一個數字人 AI 的 Instagram 帳號，測試內容流量與未來變現可能性',
      selectedKeys:['goal-closure-operator','logic-reality-analyst','descript','web-search'],
      generated:true
    },
    SYSTEM:{},
    renderProjectTeamDraft:container=>{container.innerHTML='BASE';},
    projectTeamCatalog:()=>[
      {key:'goal-closure-operator',name:'達案執行官',kind:'employee',autoEligible:true},
      {key:'logic-reality-analyst',name:'邏輯／真實性分析員',kind:'employee',autoEligible:true},
      {key:'descript',name:'Descript',kind:'tool',autoEligible:true},
      {key:'web-search',name:'Web Search',kind:'tool',autoEligible:true}
    ],
    projectTeamScope:item=>'scope:'+item.key,
    projectTeamKindLabel:item=>item.kind==='employee'?'現有員工':'工具',
    projectGoalTags:()=>new Set(['traffic','business','revenue']),
    console
  };
  vm.createContext(context);
  vm.runInContext(source,context);
  return {box,context};
}

test('啟動會議只讓可執行員工發言，工具保留為支援資源',()=>{
  const h=harness();
  h.context.renderProjectTeamDraft(h.box,h.context.SYSTEM);
  assert.match(h.box.innerHTML,/作品組隊器 · 第二步/);
  assert.match(h.box.innerHTML,/啟動會議/);
  assert.ok(h.box.handlers.click);
  h.box.handlers.click();

  const meeting=h.context.window.GROWTH_BRAIN_PROJECT_KICKOFF.current();
  assert.deepEqual([...meeting.participant_keys],['goal-closure-operator','logic-reality-analyst']);
  assert.deepEqual([...meeting.support_resources.map(x=>x.key)],['descript','web-search']);
  assert.ok(!meeting.participant_keys.includes('descript'));
  assert.ok(!meeting.participant_keys.includes('web-search'));
});

test('啟動會議摘要保留四種必要資訊，不展開完整計畫',()=>{
  const h=harness();
  h.context.renderProjectTeamDraft(h.box,h.context.SYSTEM);
  h.box.handlers.click();
  for(const text of ['啟動會議摘要','關鍵問題','主要風險','必要依賴','建議里程碑','共識','風險','待確認','支援資源']){
    assert.ok(h.box.innerHTML.includes(text),text);
  }
  assert.match(h.box.innerHTML,/不展開完整執行計畫/);
  assert.match(h.box.innerHTML,/只提供工具、資料或方法，不作為員工發言/);
});

test('團隊變更後舊會議會失效，避免沿用錯誤討論結果',()=>{
  const h=harness();
  h.context.renderProjectTeamDraft(h.box,h.context.SYSTEM);
  h.box.handlers.click();
  assert.ok(h.context.window.GROWTH_BRAIN_PROJECT_KICKOFF.current());

  h.context.PROJECT_TEAM_DRAFT.selectedKeys=['goal-closure-operator','descript'];
  h.context.renderProjectTeamDraft(h.box,h.context.SYSTEM);
  assert.equal(h.context.window.GROWTH_BRAIN_PROJECT_KICKOFF.current(),null);
  assert.match(h.box.innerHTML,/啟動會議/);
  assert.doesNotMatch(h.box.innerHTML,/啟動會議摘要/);
});
