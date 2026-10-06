// Synthetic only: no production IDs, personal records, or network writes.
export function projectFixture(){
  const route={id:'route-fixture',title:'測試系列',version:8,status:'selected',why_now:'測試為什麼現在做',success_evidence:'測試主線完成證據'};
  const items=Array.from({length:9},(_,i)=>({criterion_no:i+1,criterion_text:`測試步驟 ${i+1} 的完整內容與證據要求`,status:'pending',evidence:{}}));
  const current={id:'artifact-fixture',route_id:route.id,title:'測試作品名稱',sequence_no:2,status:'current',objective:'這是完整的作品目標，應只在作品詳細頁出現。',deliverable:'這是完整交付要求',done_evidence:items.map(x=>x.criterion_text),evidence_progress:items,next_evidence_item:items[0],progress_summary:{confirmed:0,total:9,remaining:9},skills:[{skill_key:'test-skill',name_zh:'測試能力',skill_kind:'core',evidence_state:'unknown',why:'完整能力說明',minimum_needed_now:'詳細學習要求'}],links:[{link_kind:'learning_session'},{link_kind:'synapse_concept'}],learning_focus:['完整學習關聯'],next_branch_candidates:[]};
  return {outcome:{selected_route:route},artifacts:{current,history:[]}};
}
