begin;
do $$
declare
  a uuid; p uuid; route uuid; selected_id uuid; r jsonb; s jsonb; v integer;
  before_protected jsonb; after_protected jsonb;
  g text := '建立一個數字人 AI 的 Instagram 帳號，測試內容流量與未來變現可能性。';
begin
  select m.auth_user_id,m.person_id into a,p from growth_control.auth_person_map m
    join public.growth_people gp on gp.id=m.person_id where gp.slug='primary-user' and m.status='active' and m.verified_at is not null;
  select id into selected_id from growth_control.personal_outcome_routes where person_id=p and status='selected';
  select jsonb_build_object('selected',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.personal_outcome_routes t where status='selected'),
    'artifacts',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.personal_artifacts t),
    'evidence',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.artifact_evidence_progress t)) into before_protected;
  s:=jsonb_build_object('version','artifact-team-builder-v1','goal',g,'team',jsonb_build_object('selectedKeys',jsonb_build_array('goal-closure-operator'),'generated',true),'kickoff',null,'brief',null,'milestones',null);
  r:=public.growth_artifact_team_builder_save_service_v1(gen_random_uuid(),g,'測試保存',null,null,s);
  assert r->>'reason'='not_verified_primary_user','reject unmapped user';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,null);
  assert r->>'reason'='invalid_builder_state','reject null document';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s,selected_id,3);
  assert r->>'reason'='candidate_route_not_found','reject selected route update';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s,gen_random_uuid(),1);
  assert r->>'reason'='candidate_route_not_found','reject unknown id';
  -- No existing candidate is overwritten. This test is for the clean candidate slot.
  assert not exists(select 1 from growth_control.personal_outcome_routes where person_id=p and status='candidate'),'candidate slot must be empty for rollback fixture';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s);
  assert r->>'accepted'='true','create candidate';
  route:=(r#>>'{snapshot,candidate_route,id}')::uuid;
  v:=(r#>>'{snapshot,candidate_route,version}')::integer;
  assert (select source_evidence->'artifact_team_builder'=s from growth_control.personal_outcome_routes where id=route),'independent persisted read-back';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s);
  assert r->>'accepted'='true' and (r#>>'{snapshot,candidate_route,version}')::integer=v,'idempotent retry';
  s:=jsonb_set(s,'{team,selectedKeys}','[]');
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s,route,v-1);
  assert r->>'reason'='candidate_version_conflict','stale update rejected';
  r:=public.growth_artifact_team_builder_save_service_v1(a,g,'測試保存',null,null,s,route,v);
  assert r->>'accepted'='true' and (r#>>'{snapshot,candidate_route,version}')::integer=v+1,'update same candidate';
  assert (r#>'{snapshot,candidate_route,source_evidence,artifact_team_builder}')=s,'null stages clear rather than merge';
  select jsonb_build_object('selected',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.personal_outcome_routes t where status='selected'),
    'artifacts',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.personal_artifacts t),
    'evidence',(select jsonb_agg(to_jsonb(t) order by id) from growth_control.artifact_evidence_progress t)) into after_protected;
  assert before_protected=after_protected,'protected data unchanged';
  assert not has_function_privilege('anon','public.growth_artifact_team_builder_save_service_v1(uuid,text,text,text,text,jsonb,uuid,integer)','EXECUTE'),'anon denied';
  assert not has_function_privilege('authenticated','public.growth_artifact_team_builder_save_service_v1(uuid,text,text,text,text,jsonb,uuid,integer)','EXECUTE'),'client denied';
  assert has_function_privilege('service_role','public.growth_artifact_team_builder_save_service_v1(uuid,text,text,text,text,jsonb,uuid,integer)','EXECUTE'),'service enabled';
end;
$$;
rollback;
select 'passed: rollback candidate persistence, auth, version, idempotency and protected data' as result;
