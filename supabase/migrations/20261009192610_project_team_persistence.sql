-- Reuse the private candidate route. No formal artifacts or progress are written.
create or replace function growth_control.save_artifact_team_builder_v1(
  p_auth_user_id uuid, p_title text, p_success_evidence text,
  p_why_now text, p_direction_key text, p_builder_state jsonb,
  p_route_id uuid default null, p_expected_version integer default null
) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare
  v_person uuid;
  v_route growth_control.personal_outcome_routes%rowtype;
  v_state jsonb := p_builder_state;
  v_team jsonb;
  v_part jsonb;
  v_title text := btrim(coalesce(p_title,''));
begin
  v_person := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;
  if length(v_title)<3 or length(btrim(coalesce(p_success_evidence,'')))<3 then
    return jsonb_build_object('accepted',false,'reason','title_and_success_evidence_required');
  end if;
  if jsonb_typeof(v_state) is distinct from 'object' or octet_length(v_state::text)>262144
     or v_state->>'version' is distinct from 'artifact-team-builder-v1'
     or v_state->>'goal' is distinct from v_title
     or jsonb_typeof(v_state#>'{team,selectedKeys}') is distinct from 'array'
     or jsonb_typeof(v_state#>'{team,generated}') is distinct from 'boolean'
     or not (v_state ?& array['kickoff','brief','milestones']) then
    return jsonb_build_object('accepted',false,'reason','invalid_builder_state');
  end if;
  v_team:=v_state#>'{team,selectedKeys}';
  if jsonb_array_length(v_team)>8 or exists(select 1 from jsonb_array_elements(v_team) t where jsonb_typeof(t)<>'string')
     or (select count(*)<>count(distinct value) from jsonb_array_elements(v_team)) then
    return jsonb_build_object('accepted',false,'reason','invalid_builder_team');
  end if;
  foreach v_part in array array[v_state->'kickoff',v_state->'brief'] loop
    if v_part <> 'null'::jsonb and (jsonb_typeof(v_part)<>'object' or v_part->>'goal' is distinct from v_title or v_part->'team_keys' is distinct from v_team) then
      return jsonb_build_object('accepted',false,'reason','builder_goal_or_team_mismatch');
    end if;
  end loop;
  if ((v_state#>>'{team,generated}')::boolean=false and (v_team<>'[]'::jsonb or v_state->'kickoff'<>'null'::jsonb))
     or (v_state->'kickoff'='null'::jsonb and v_state->'brief'<>'null'::jsonb)
     or (v_state->'brief'='null'::jsonb and v_state->'milestones'<>'null'::jsonb) then
    return jsonb_build_object('accepted',false,'reason','invalid_builder_stage_order');
  end if;
  if v_state->'milestones'<>'null'::jsonb and
     (jsonb_typeof(v_state->'milestones')<>'object' or v_state#>>'{milestones,goal}' is distinct from v_title
      or v_state#>'{milestones,verified_personal_progress}' is distinct from 'false'::jsonb) then
    return jsonb_build_object('accepted',false,'reason','invalid_builder_milestones');
  end if;
  -- Serialize candidate creation without changing the existing one-candidate contract.
  perform pg_advisory_xact_lock(hashtextextended(v_person::text||':artifact-team-builder',0));
  if p_route_id is null then
    select * into v_route from growth_control.personal_outcome_routes
      where person_id=v_person and project_key='growth-brain' and status='candidate' for update;
  else
    select * into v_route from growth_control.personal_outcome_routes
      where id=p_route_id and person_id=v_person and project_key='growth-brain' and status='candidate' for update;
    if not found then
      return jsonb_build_object('accepted',false,'reason','candidate_route_not_found');
    end if;
  end if;
  if v_route.id is not null then
    -- Lost-response retry: an identical saved document is already successful.
    if v_route.source_evidence->'artifact_team_builder'=v_state and v_route.title=v_title
       and v_route.success_evidence=btrim(p_success_evidence)
       and v_route.why_now is not distinct from nullif(btrim(coalesce(p_why_now,'')),'')
       and v_route.direction_key is not distinct from p_direction_key then
      return jsonb_build_object('accepted',true,'snapshot',growth_control.personal_outcome_snapshot_v1(v_person,'growth-brain'));
    end if;
    if p_route_id is null or p_expected_version is distinct from v_route.version then
      return jsonb_build_object('accepted',false,'reason','candidate_version_conflict');
    end if;
    update growth_control.personal_outcome_routes set
      title=v_title,success_evidence=btrim(p_success_evidence),why_now=nullif(btrim(coalesce(p_why_now,'')),''),direction_key=p_direction_key,
      source_evidence=coalesce(source_evidence,'{}'::jsonb)||jsonb_build_object('artifact_team_builder',v_state,'saved_at',now()),
      version=version+1,updated_at=now()
      where id=v_route.id;
  else
    insert into growth_control.personal_outcome_routes(person_id,project_key,route_key,title,success_evidence,why_now,direction_key,source_evidence,status)
    values(v_person,'growth-brain','personal-'||left(replace(gen_random_uuid()::text,'-',''),12),v_title,btrim(p_success_evidence),
      nullif(btrim(coalesce(p_why_now,'')),''),p_direction_key,
      jsonb_build_object('source','website_user_input','artifact_team_builder',v_state,'saved_at',now()),'candidate');
  end if;
  return jsonb_build_object('accepted',true,'snapshot',growth_control.personal_outcome_snapshot_v1(v_person,'growth-brain'));
end;
$$;
revoke all on function growth_control.save_artifact_team_builder_v1(uuid,text,text,text,text,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function growth_control.save_artifact_team_builder_v1(uuid,text,text,text,text,jsonb,uuid,integer) to service_role;

create or replace function public.growth_artifact_team_builder_save_service_v1(
  p_auth_user_id uuid,p_title text,p_success_evidence text,p_why_now text,p_direction_key text,p_builder_state jsonb,
  p_route_id uuid default null,p_expected_version integer default null
) returns jsonb language sql security invoker set search_path='' as $$
  select growth_control.save_artifact_team_builder_v1(p_auth_user_id,p_title,p_success_evidence,p_why_now,p_direction_key,p_builder_state,p_route_id,p_expected_version);
$$;
revoke all on function public.growth_artifact_team_builder_save_service_v1(uuid,text,text,text,text,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.growth_artifact_team_builder_save_service_v1(uuid,text,text,text,text,jsonb,uuid,integer) to service_role;
