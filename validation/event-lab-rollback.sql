-- Non-destructive five-case feature acceptance. Everything is rolled back.
begin;
do $test$
declare person uuid; auth_user uuid; before_state text; after_state text;
  r jsonb; again jsonb; result jsonb; jid uuid; item_id text; k text; n int;
begin
  select person_id,auth_user_id into person,auth_user from growth_control.auth_person_map where status='active' and verified_at is not null limit 1;
  if person is null then raise exception 'verified mapping missing'; end if;
  select md5(jsonb_build_object(
    'artifacts',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.personal_artifacts x where person_id=person),
    'skills',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.artifact_skill_targets x where person_id=person),
    'routes',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.personal_outcome_routes x where person_id=person),
    'evidence',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.artifact_evidence_progress x),
    'learning',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.learning_companion_submissions x where person_id=person)
  )::text) into before_state;

  r := public.growth_event_lab_service_v1(gen_random_uuid(),'snapshot','{}'::jsonb);
  if r->>'accepted'<>'false' then raise exception 'unmapped user accepted'; end if;
  r := public.growth_event_lab_service_v1(auth_user,'decompose',jsonb_build_object('target_kind','current_artifact','target_id',gen_random_uuid(),'goal','不可改他人作品','request_id','rollback:wrong-target'));
  if r->>'reason'<>'current_artifact_target_mismatch' then raise exception 'target isolation failed'; end if;

  for k in select unnest(array['capability','research','employee','tool','system_work_package']) loop
    r := public.growth_event_lab_service_v1(auth_user,'decompose',jsonb_build_object('target_kind','user_event','goal','合成案例：'||k,'note','validation only; no personal evidence','request_id','rollback:event:'||k));
    if r->>'accepted'<>'true' then raise exception 'enqueue % rejected %',k,r; end if;
    jid := (r->>'job_id')::uuid;
    again := public.growth_event_lab_service_v1(auth_user,'decompose',jsonb_build_object('target_kind','user_event','goal','合成案例：'||k,'request_id','rollback:event:'||k));
    if again->>'job_id'<>jid::text then raise exception 'duplicate enqueue'; end if;
    result := jsonb_build_object('goal','合成案例：'||k,'boundaries',jsonb_build_array('只測資料流'),'key_hub','先保留證據','dependencies',jsonb_build_array('既有 Worker'),'unknowns',jsonb_build_array('真實結果未驗證'),'failure_points',jsonb_build_array('把假設当真相'),'required_evidence',jsonb_build_array('可重現測試'),'minimum_artifact','一個測試','bottleneck','需要驗證','primary_route',jsonb_build_object('kind',k,'key','','reason','合成路由測試'),'next_step','跑一個最小測試','topic_key','rollback:'||k);
    r := growth_control.ai_job_transition_v1(jid,'claimed','pending','rollback-test','synthetic',null,'{}'::jsonb,null);
    if r->>'accepted'<>'true' then raise exception 'claim failed'; end if;
    r := growth_control.ai_job_transition_v1(jid,'processing','claimed','rollback-test','synthetic',null,'{}'::jsonb,null);
    r := growth_control.ai_job_transition_v1(jid,'completed','processing','rollback-test','synthetic',jsonb_build_object('text',result::text),jsonb_build_object('verification_scope','synthetic','rollback',true),null);
    if r->>'accepted'<>'true' then raise exception 'complete failed'; end if;
    r := public.growth_event_lab_service_v1(auth_user,'snapshot','{}'::jsonb);
    if not exists(select 1 from jsonb_array_elements(r->'snapshot'->'jobs') x where x->>'id'=jid::text and x->'output'->'primary_route'->>'kind'=k) then raise exception 'result readback failed'; end if;
    if k='research' then
      r := public.growth_event_lab_service_v1(auth_user,'send_research',jsonb_build_object('job_id',jid));
      if r->>'accepted'<>'true' then raise exception 'research routing failed'; end if;
      select x->>'id' into item_id from jsonb_array_elements(r->'snapshot'->'items') x where x->>'job_id'=jid::text;
      r := public.growth_event_lab_service_v1(auth_user,'keep',jsonb_build_object('item_id',item_id));
      r := public.growth_event_lab_service_v1(auth_user,'trial',jsonb_build_object('item_id',item_id));
      again := public.growth_event_lab_service_v1(auth_user,'trial',jsonb_build_object('item_id',item_id));
      select count(*) into n from growth_control.tech_trials where person_id=person and trial_key='exploration:'||item_id;
      if n<>1 then raise exception 'trial idempotency failed'; end if;
      if exists(select 1 from growth_control.tech_trials where person_id=person and trial_key='exploration:'||item_id and status<>'planned') then raise exception 'trial falsely verified'; end if;
    end if;
  end loop;

  -- Reuse queue failure transition; no timeout workaround or automatic replay.
  r := public.growth_event_lab_service_v1(auth_user,'decompose',jsonb_build_object('target_kind','user_event','goal','測試失敗後重試','request_id','rollback:retry'));
  jid := (r->>'job_id')::uuid;
  perform growth_control.ai_job_transition_v1(jid,'claimed','pending','rollback-test','synthetic',null,'{}'::jsonb,null);
  perform growth_control.ai_job_transition_v1(jid,'failed','claimed','rollback-test','synthetic',null,'{}'::jsonb,'{"code":"synthetic_failure"}'::jsonb);
  r := public.growth_event_lab_service_v1(auth_user,'retry',jsonb_build_object('job_id',jid));
  if r->>'accepted'<>'true' or r->'snapshot'->'jobs' is null then raise exception 'retry failed'; end if;
  update growth_control.ai_jobs set status='failed',attempt_no=3,error='{"code":"budget"}'::jsonb where id=jid;
  r := public.growth_event_lab_service_v1(auth_user,'retry',jsonb_build_object('job_id',jid));
  if r->>'reason'<>'retry_budget_exhausted' then raise exception 'retry cap failed'; end if;

  -- Completed exploration imports deduplicate and cap active cards to three.
  insert into growth_control.ai_jobs(person_id,project_key,source_kind,source_ref,data_scope,task_type,status,result,result_evidence,idempotency_key)
  values(person,'growth-brain','work_package','event-funnel-self-exploration-v1','system','self_exploration_v1','completed',jsonb_build_object('candidates',jsonb_build_array(
    jsonb_build_object('topic_key','rollback-topic','title','測試候選','why_now','驗證合併','question','是否查重','next_step','比較數量','stop_condition','兩輪停止'),
    jsonb_build_object('topic_key','rollback-topic','title','同題候選','why_now','重複題','question','是否合併','next_step','比較數量','stop_condition','兩輪停止'),
    jsonb_build_object('topic_key','rollback-topic-2','title','另一題','why_now','驗證上限','question','上限是否生效','next_step','數待看數量','stop_condition','兩輪停止')
  )),'{"verification_scope":"synthetic"}'::jsonb,'rollback:explore');
  perform growth_control.event_lab_sync_v1(person);
  r := public.growth_event_lab_service_v1(auth_user,'snapshot','{}'::jsonb);
  select count(*) into n from jsonb_array_elements(r->'snapshot'->'items') x where x->>'topic_key'='rollback-topic';
  if n<>1 then raise exception 'topic dedup failed'; end if;
  select count(*) into n from jsonb_array_elements(r->'snapshot'->'items') x where x->>'state'='active';
  if n>3 then raise exception 'active budget failed'; end if;
  if growth_control.event_lab_result_v1('{"text":"not json"}'::jsonb) is not null then raise exception 'malformed output accepted'; end if;

  select md5(jsonb_build_object(
    'artifacts',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.personal_artifacts x where person_id=person),
    'skills',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.artifact_skill_targets x where person_id=person),
    'routes',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.personal_outcome_routes x where person_id=person),
    'evidence',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.artifact_evidence_progress x),
    'learning',(select jsonb_agg(to_jsonb(x) order by id) from growth_control.learning_companion_submissions x where person_id=person)
  )::text) into after_state;
  if before_state<>after_state then raise exception 'protected personal truth changed'; end if;
  if has_function_privilege('anon','public.growth_event_lab_service_v1(uuid,text,jsonb)','execute') or has_function_privilege('authenticated','growth_control.event_lab_action_v1(uuid,text,jsonb)','execute') then raise exception 'direct client access granted'; end if;
end $test$;
rollback;
select jsonb_build_object('passed',true,'five_route_cases',5,'queue_result_readback',true,'trial_idempotency',true,'topic_dedup',true,'active_cap',3,'retry_cap',3,'unmapped_user_denied',true,'target_isolation',true,'malformed_output_rejected',true,'protected_truth_unchanged',true,'rolled_back',true,'verification_scope','synthetic') as validation;
