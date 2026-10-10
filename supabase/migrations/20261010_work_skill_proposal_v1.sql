
-- work-skill-proposal v1 (openspec/changes/work-skill-proposal)
-- 1) allow pending self-claims in the existing artifact_context_links.metadata (no level change)
alter table growth_control.artifact_context_links drop constraint if exists artifact_context_links_link_kind_check;
alter table growth_control.artifact_context_links add constraint artifact_context_links_link_kind_check
  check (link_kind = any (array['learning_session','learning_unit','synapse_concept','learning_evidence','source','artifact_evidence','skill_self_claim','skill_list_confirmation']));

-- 2) rule/template-based proposal (no server-side LLM available); read-only
create or replace function growth_control.work_skill_proposal_v1(p_person_id uuid, p_artifact_id uuid)
returns jsonb language plpgsql stable set search_path to '' as $f$
declare v_a growth_control.personal_artifacts%rowtype; v_skills jsonb; v_existing int;
begin
  select * into v_a from growth_control.personal_artifacts where id=p_artifact_id and person_id=p_person_id and project_key='growth-brain';
  if not found then return jsonb_build_object('accepted',false,'reason','artifact_not_found'); end if;
  select count(*) into v_existing from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and person_id=p_person_id;
  with crit as (
    select ordinality::int n, value c from jsonb_array_elements_text(coalesce(v_a.done_evidence,'[]'::jsonb)) with ordinality
  ), tpl(key,name_zh,kind,why,pat,ord) as (values
    ('selection','選品判斷','core','找到值得推、分潤合理、說得出優點的商品，並寫下篩選理由','商品|選品|貨源',1),
    ('affiliate-link','聯盟平台與分潤連結操作','tool','申請分潤帳號、看懂分潤規則、產生推廣連結','聯盟|分潤.*(帳號|連結|設定)|推廣連結',2),
    ('persona-planning','人設與內容企劃','core','定出是誰、對誰說話，並挑能持續產出的主題','人設|主題|定位|受眾',3),
    ('ig-account','IG 帳號設定與經營','tool','建立帳號、專業帳號設定、簡介與連結、基本互動','Instagram|IG|社群帳號',4),
    ('ai-media','AI 圖像／影片生成','tool','用 AI 做出風格一致的圖片或短影片，並注意素材版權','AI.*(圖|影片|生成)|數字人.*(圖|影片)',5),
    ('persuasive-content','寫出讓人想點的內容','core','用幾句話讓對的人想點：誰需要、解決什麼、為什麼現在','文案|推廣內容|頁面|貼文',6),
    ('publish-rules','內容發布與平台規則','tool','把內容發到平台上，固定節奏並避開違規與揭露規定','發布|公開|上線',7),
    ('data-reading','看懂成效數據','core','看懂點擊、瀏覽、互動與追蹤變化，判斷哪裡有訊號','點擊|瀏覽|數據|流量|互動|成效|觀看',8),
    ('monetization','變現模式判斷','core','比較分潤、業配、自有產品等方式，選一個最值得先試的','變現|收入|賺',9),
    ('next-step-decision','成果紀錄與下一步決策','core','把結果寫成可追溯紀錄，決定繼續、調整或停止','結果|下一步|記錄|原因',10)
  ), hits as (
    select t.key,t.name_zh,t.kind,t.why,t.ord,array_agg(c.n order by c.n) ns,min(c.c) sample
    from tpl t join crit c on c.c ~ t.pat group by t.key,t.name_zh,t.kind,t.why,t.ord
  ), uncovered as (
    select c.n,c.c from crit c where not exists(select 1 from tpl t where c.c ~ t.pat)
  )
  select coalesce(jsonb_agg(x order by o),'[]'::jsonb) into v_skills from (
    select jsonb_build_object('skill_key',key,'name_zh',name_zh,'skill_kind',kind,'why',why,'criteria',to_jsonb(ns),
      'minimum_needed_now','條件 '||array_to_string(ns,'、')) x, ord o from hits
    union all
    select jsonb_build_object('skill_key','criterion-'||n,'name_zh',left('完成「'||c||'」需要的能力',40),'skill_kind','core','why','系統找不到對應的能力範本，請改成你自己的說法','criteria',jsonb_build_array(n),'minimum_needed_now','條件 '||n), 100+n from uncovered
  ) s;
  return jsonb_build_object('accepted',true,'artifact_id',p_artifact_id,'artifact_title',v_a.title,'method','rule_template_v1','llm_used',false,
    'existing_count',v_existing,'skills',v_skills,
    'note','依完成條件的關鍵字對應能力範本產生；需要你確認或修改後才會儲存。');
end $f$;

-- 3) save user-confirmed list; never raises evidence_state
create or replace function growth_control.work_skill_targets_save_v1(p_person_id uuid, p_artifact_id uuid, p_skills jsonb, p_source text default 'proposed at work creation, user-confirmed')
returns jsonb language plpgsql set search_path to '' as $f$
declare v_a growth_control.personal_artifacts%rowtype; v_item jsonb; v_key text; v_name text; v_kind text; v_keys text[]:='{}'; v_ins int:=0; v_upd int:=0; v_del int:=0; v_kept int:=0;
begin
  select * into v_a from growth_control.personal_artifacts where id=p_artifact_id and person_id=p_person_id and project_key='growth-brain' for update;
  if not found then return jsonb_build_object('accepted',false,'reason','artifact_not_found'); end if;
  if v_a.status not in ('candidate','current') then return jsonb_build_object('accepted',false,'reason','artifact_not_open'); end if;
  if jsonb_typeof(p_skills)<>'array' or jsonb_array_length(p_skills) not between 1 and 10 then return jsonb_build_object('accepted',false,'reason','skills_1_to_10_required'); end if;
  for v_item in select value from jsonb_array_elements(p_skills) loop
    v_name:=btrim(coalesce(v_item->>'name_zh',''));
    if length(v_name) not between 2 and 40 then return jsonb_build_object('accepted',false,'reason','skill_name_2_to_40_chars'); end if;
    v_kind:=case when v_item->>'skill_kind' in ('core','tool') then v_item->>'skill_kind' else 'core' end;
    v_key:=lower(regexp_replace(coalesce(nullif(btrim(v_item->>'skill_key'),''),'u-'||left(md5(v_name),12)),'[^a-zA-Z0-9-]','','g'));
    if v_key='' then v_key:='u-'||left(md5(v_name),12); end if;
    if v_key = any(v_keys) then continue; end if;
    v_keys:=v_keys||v_key;
    insert into growth_control.artifact_skill_targets(person_id,project_key,artifact_id,skill_key,name_zh,skill_kind,why,ai_suggested_state,evidence_state,confidence,evidence_refs,minimum_needed_now)
    values(p_person_id,'growth-brain',p_artifact_id,v_key,v_name,v_kind,nullif(btrim(coalesce(v_item->>'why','')),''),'unknown','unknown',0,'[]'::jsonb,nullif(btrim(coalesce(v_item->>'minimum_needed_now','')),''))
    on conflict (artifact_id,skill_key) do update set name_zh=excluded.name_zh,skill_kind=excluded.skill_kind,why=excluded.why,minimum_needed_now=excluded.minimum_needed_now,updated_at=now();
    if (select created_at=updated_at from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and skill_key=v_key) then v_ins:=v_ins+1; else v_upd:=v_upd+1; end if;
  end loop;
  -- removed rows: delete only if no evidence yet; keep (and report) rows that already carry evidence
  delete from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and person_id=p_person_id and not (skill_key = any(v_keys))
    and evidence_state='unknown' and evidence_refs='[]'::jsonb;
  get diagnostics v_del=row_count;
  select count(*) into v_kept from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and person_id=p_person_id and not (skill_key = any(v_keys));
  insert into growth_control.artifact_context_links(person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata)
  values(p_person_id,'growth-brain',p_artifact_id,'skill_list_confirmation','current','user_confirmed',jsonb_build_object('source',p_source,'confirmed_at',now(),'skill_keys',to_jsonb(v_keys)))
  on conflict (artifact_id,link_kind,target_ref) do update set metadata=excluded.metadata;
  return jsonb_build_object('accepted',true,'artifact_id',p_artifact_id,'inserted',v_ins,'updated',v_upd,'deleted',v_del,'kept_with_evidence',v_kept,'level_changed',false);
end $f$;

-- 4) pending self-claim: stored as link metadata, level untouched
create or replace function growth_control.skill_self_claim_v1(p_person_id uuid, p_artifact_id uuid, p_skill_key text, p_note text default null)
returns jsonb language plpgsql set search_path to '' as $f$
begin
  if not exists(select 1 from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and person_id=p_person_id and skill_key=p_skill_key) then
    return jsonb_build_object('accepted',false,'reason','skill_not_found'); end if;
  insert into growth_control.artifact_context_links(person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata)
  values(p_person_id,'growth-brain',p_artifact_id,'skill_self_claim',p_skill_key,'pending_claim',
    jsonb_build_object('note',left(coalesce(p_note,''),300),'claimed_at',now(),'level_unchanged',true,'requires_evidence',true))
  on conflict (artifact_id,link_kind,target_ref) do update set metadata=excluded.metadata;
  return jsonb_build_object('accepted',true,'skill_key',p_skill_key,'level_changed',false);
end $f$;

-- 5) service wrappers (edge function only)
create or replace function public.growth_work_skill_proposal_service_v1(p_auth_user_id uuid, p_artifact_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.work_skill_proposal_v1(v,p_artifact_id); end $f$;
create or replace function public.growth_work_skill_targets_save_service_v1(p_auth_user_id uuid, p_artifact_id uuid, p_skills jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.work_skill_targets_save_v1(v,p_artifact_id,p_skills,'proposed at work creation, user-confirmed '||to_char(now() at time zone 'Asia/Taipei','YYYY-MM-DD')); end $f$;
create or replace function public.growth_skill_self_claim_service_v1(p_auth_user_id uuid, p_artifact_id uuid, p_skill_key text, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.skill_self_claim_v1(v,p_artifact_id,p_skill_key,p_note); end $f$;
revoke all on function public.growth_work_skill_proposal_service_v1(uuid,uuid) from public, anon, authenticated;
revoke all on function public.growth_work_skill_targets_save_service_v1(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.growth_skill_self_claim_service_v1(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.growth_work_skill_proposal_service_v1(uuid,uuid) to service_role;
grant execute on function public.growth_work_skill_targets_save_service_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.growth_skill_self_claim_service_v1(uuid,uuid,text,text) to service_role;
revoke all on function growth_control.work_skill_proposal_v1(uuid,uuid) from public, anon, authenticated;
revoke all on function growth_control.work_skill_targets_save_v1(uuid,uuid,jsonb,text) from public, anon, authenticated;
revoke all on function growth_control.skill_self_claim_v1(uuid,uuid,text,text) from public, anon, authenticated;

-- 6) capability snapshot: additive fields skill_kind, minimum_needed_now, self_claim
CREATE OR REPLACE FUNCTION growth_control.capability_library_snapshot_v1(p_person_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with library as (
  select coalesce(evidence->'capability_library','{}'::jsonb) j from growth_control.work_packages where person_id=p_person_id and project_key='growth-brain' and package_key='capability-cells-playbooks-v1'
), assets as (
  select 'cells' kind,value x from library cross join lateral jsonb_array_elements(coalesce(j->'cells','[]'::jsonb))
  union all select 'playbooks',value from library cross join lateral jsonb_array_elements(coalesce(j->'playbooks','[]'::jsonb))
), linked as (
  select kind,x||jsonb_build_object('resources',coalesce((select jsonb_agg(jsonb_build_object('key',r.resource_key,'name',r.name,'availability',r.availability,'status',r.status,'source_url',r.source_url)) from growth_control.resource_registry r where r.person_id=p_person_id and r.project_key='growth-brain' and x->'resource_keys' ? r.resource_key),'[]'::jsonb),'research',coalesce((select jsonb_agg(jsonb_build_object('id',i->>'id','title',i->>'title','state',i->>'state')) from growth_control.work_packages w cross join lateral jsonb_array_elements(coalesce(w.evidence->'event_lab'->'items','[]'::jsonb)) i where w.person_id=p_person_id and w.project_key='growth-brain' and w.package_key='event-funnel-self-exploration-v1' and i->>'state'<>'ignored' and x->'research_categories' ? (i->>'category')),'[]'::jsonb)) x from assets
)
select coalesce((select j from library),'{}'::jsonb)||jsonb_build_object('sv','capability-library-snapshot-v1','generated_at',now(),
  'cells',coalesce((select jsonb_agg(x) from linked where kind='cells'),'[]'::jsonb),
  'playbooks',coalesce((select jsonb_agg(x) from linked where kind='playbooks'),'[]'::jsonb),
  'personal_skills',coalesce((select jsonb_agg(jsonb_build_object('skill_key',s.skill_key,'name_zh',s.name_zh,'why',s.why,'evidence_state',s.evidence_state,'evidence_refs',s.evidence_refs,'artifact_id',a.id,'artifact_title',a.title,'artifact_status',a.status,'skill_kind',s.skill_kind,'minimum_needed_now',s.minimum_needed_now,'self_claim',exists(select 1 from growth_control.artifact_context_links l where l.artifact_id=s.artifact_id and l.person_id=s.person_id and l.link_kind='skill_self_claim' and l.target_ref=s.skill_key)) order by a.sequence_no,s.created_at) from growth_control.artifact_skill_targets s join growth_control.personal_artifacts a on a.id=s.artifact_id and a.person_id=s.person_id and a.project_key=s.project_key where s.person_id=p_person_id and s.project_key='growth-brain' and a.status in ('candidate','current','completed')),'[]'::jsonb));
$function$
;
