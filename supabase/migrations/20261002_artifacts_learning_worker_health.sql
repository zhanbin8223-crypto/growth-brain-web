-- Growth Brain V1: formal artifact sequence + learning/synapse links + worker heartbeat
-- Applied to production on 2026-10-02. This migration mirrors the deployed schema.

create table if not exists growth_control.personal_artifacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null default 'growth-brain',
  route_id uuid not null references growth_control.personal_outcome_routes(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  title text not null check (length(btrim(title)) > 0),
  objective text not null default '',
  deliverable text not null default '',
  status text not null default 'candidate'
    check (status in ('candidate','current','completed','rejected','abandoned')),
  done_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(done_evidence)='array'),
  learning_focus jsonb not null default '[]'::jsonb
    check (jsonb_typeof(learning_focus)='array'),
  next_branch_candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(next_branch_candidates)='array'),
  assumptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(assumptions)='array'),
  result jsonb,
  result_evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_evidence)='object'),
  source_job_id uuid references growth_control.ai_jobs(id) on delete set null,
  source_kind text not null default 'ai_candidate'
    check (source_kind in ('ai_candidate','user_defined','evidence_replan')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(person_id,project_key,route_id,sequence_no),
  unique(source_job_id)
);

create unique index if not exists personal_artifacts_one_current_idx
  on growth_control.personal_artifacts(person_id,project_key)
  where status='current';

create index if not exists personal_artifacts_route_idx
  on growth_control.personal_artifacts(person_id,project_key,route_id,sequence_no);

alter table growth_control.personal_artifacts enable row level security;
revoke all on growth_control.personal_artifacts from anon, authenticated;
grant select,insert,update,delete on growth_control.personal_artifacts to service_role;

create table if not exists growth_control.artifact_skill_targets (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null default 'growth-brain',
  artifact_id uuid not null references growth_control.personal_artifacts(id) on delete cascade,
  skill_key text not null,
  name_zh text not null,
  skill_kind text not null check (skill_kind in ('core','tool')),
  why text,
  freshness_sensitive boolean not null default false,
  ai_suggested_state text,
  evidence_state text not null default 'unknown'
    check (evidence_state in (
      'unknown','exposure','acknowledged','understood','can_explain',
      'apply_with_help','apply_independently','retained','real_project','commercialized'
    )),
  evidence_coverage numeric
    check (evidence_coverage is null or (evidence_coverage >= 0 and evidence_coverage <= 1)),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  evidence_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_refs)='array'),
  minimum_needed_now text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(artifact_id,skill_key)
);

create index if not exists artifact_skill_targets_artifact_idx
  on growth_control.artifact_skill_targets(artifact_id,skill_kind,skill_key);

alter table growth_control.artifact_skill_targets enable row level security;
revoke all on growth_control.artifact_skill_targets from anon, authenticated;
grant select,insert,update,delete on growth_control.artifact_skill_targets to service_role;

create table if not exists growth_control.artifact_context_links (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null default 'growth-brain',
  artifact_id uuid not null references growth_control.personal_artifacts(id) on delete cascade,
  link_kind text not null
    check (link_kind in ('learning_session','learning_unit','synapse_concept','learning_evidence','source')),
  target_ref text not null,
  relation text not null default 'supports',
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  unique(artifact_id,link_kind,target_ref)
);

create index if not exists artifact_context_links_artifact_idx
  on growth_control.artifact_context_links(artifact_id,link_kind);

alter table growth_control.artifact_context_links enable row level security;
revoke all on growth_control.artifact_context_links from anon, authenticated;
grant select,insert,update,delete on growth_control.artifact_context_links to service_role;

create or replace function growth_control.apply_path_plan_result_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_text text;
  v_plan jsonb;
  v_route_id uuid;
  v_route_status text;
  v_artifact jsonb;
  v_artifact_id uuid;
  v_seq integer;
  v_skill jsonb;
  v_focus jsonb;
begin
  if new.task_type <> 'path_plan'
     or new.status <> 'completed'
     or old.status = 'completed' then
    return new;
  end if;

  begin
    v_route_id := nullif(new.task_payload->>'route_id','')::uuid;
  exception when others then
    return new;
  end;

  select status into v_route_status
  from growth_control.personal_outcome_routes
  where id=v_route_id
    and person_id=new.person_id
    and project_key=new.project_key;

  if v_route_status is null or v_route_status not in ('candidate','selected') then
    return new;
  end if;

  v_text := coalesce(new.result->>'text','');
  if btrim(v_text)='' then return new; end if;

  begin
    if left(ltrim(v_text),3)=chr(96)||chr(96)||chr(96) then
      v_text := regexp_replace(ltrim(v_text), '^.{3}(json)?[[:space:]]*', '', 'i');
      v_text := regexp_replace(v_text, '[[:space:]]*.{3}[[:space:]]*$', '');
    end if;
    v_plan := v_text::jsonb;
  exception when others then
    return new;
  end;

  v_artifact := coalesce(v_plan->'current_artifact','{}'::jsonb);
  if coalesce(btrim(v_artifact->>'title'),'')='' then return new; end if;

  select coalesce(max(sequence_no),0)+1 into v_seq
  from growth_control.personal_artifacts
  where person_id=new.person_id
    and project_key=new.project_key
    and route_id=v_route_id;

  insert into growth_control.personal_artifacts(
    person_id,project_key,route_id,sequence_no,title,objective,deliverable,status,
    done_evidence,learning_focus,next_branch_candidates,assumptions,source_job_id,source_kind
  ) values (
    new.person_id,new.project_key,v_route_id,v_seq,
    v_artifact->>'title',
    coalesce(v_artifact->>'objective',''),
    coalesce(v_artifact->>'deliverable',''),
    'candidate',
    case when jsonb_typeof(v_artifact->'done_evidence')='array' then v_artifact->'done_evidence' else '[]'::jsonb end,
    case when jsonb_typeof(v_plan->'learning_focus')='array' then v_plan->'learning_focus' else '[]'::jsonb end,
    case when jsonb_typeof(v_plan->'possible_next_branches')='array' then v_plan->'possible_next_branches' else '[]'::jsonb end,
    case when jsonb_typeof(v_plan->'assumptions')='array' then v_plan->'assumptions' else '[]'::jsonb end,
    new.id,'ai_candidate'
  )
  on conflict(source_job_id) do update set
    title=excluded.title,
    objective=excluded.objective,
    deliverable=excluded.deliverable,
    done_evidence=excluded.done_evidence,
    learning_focus=excluded.learning_focus,
    next_branch_candidates=excluded.next_branch_candidates,
    assumptions=excluded.assumptions,
    updated_at=now()
  returning id into v_artifact_id;

  delete from growth_control.artifact_skill_targets where artifact_id=v_artifact_id;

  if jsonb_typeof(v_plan->'core_capabilities')='array' then
    for v_skill in select value from jsonb_array_elements(v_plan->'core_capabilities')
    loop
      insert into growth_control.artifact_skill_targets(
        person_id,project_key,artifact_id,skill_key,name_zh,skill_kind,why,
        freshness_sensitive,ai_suggested_state,evidence_state,confidence,evidence_refs,minimum_needed_now
      ) values (
        new.person_id,new.project_key,v_artifact_id,
        coalesce(nullif(v_skill->>'key',''),md5(coalesce(v_skill->>'name_zh','core-skill'))),
        coalesce(nullif(v_skill->>'name_zh',''),'未命名能力'),
        'core',v_skill->>'why',false,v_skill->>'current_state','unknown',
        case lower(coalesce(v_skill->>'confidence','low'))
          when 'high' then 0.8
          when 'medium' then 0.5
          else 0.2
        end,
        case when jsonb_typeof(v_skill->'evidence_refs')='array' then v_skill->'evidence_refs' else '[]'::jsonb end,
        null
      );
    end loop;
  end if;

  if jsonb_typeof(v_plan->'tool_capabilities')='array' then
    for v_skill in select value from jsonb_array_elements(v_plan->'tool_capabilities')
    loop
      insert into growth_control.artifact_skill_targets(
        person_id,project_key,artifact_id,skill_key,name_zh,skill_kind,why,
        freshness_sensitive,ai_suggested_state,evidence_state,confidence,evidence_refs,minimum_needed_now
      ) values (
        new.person_id,new.project_key,v_artifact_id,
        coalesce(nullif(v_skill->>'key',''),md5(coalesce(v_skill->>'name_zh','tool-skill'))),
        coalesce(nullif(v_skill->>'name_zh',''),'未命名工具能力'),
        'tool',v_skill->>'why',
        coalesce((v_skill->>'freshness_sensitive')::boolean,true),
        null,'unknown',0.2,'[]'::jsonb,null
      );
    end loop;
  end if;

  if jsonb_typeof(v_plan->'learning_focus')='array' then
    for v_focus in select value from jsonb_array_elements(v_plan->'learning_focus')
    loop
      update growth_control.artifact_skill_targets
      set minimum_needed_now=coalesce(v_focus->>'minimum_needed_now',minimum_needed_now),
          updated_at=now()
      where artifact_id=v_artifact_id
        and skill_key=v_focus->>'skill_key';
    end loop;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_apply_path_plan_result_v1 on growth_control.ai_jobs;
create trigger trg_apply_path_plan_result_v1
after update of status,result on growth_control.ai_jobs
for each row
when (new.task_type='path_plan' and new.status='completed')
execute function growth_control.apply_path_plan_result_v1();

create or replace function growth_control.personal_artifact_decide_v1(
  p_person_id uuid,
  p_artifact_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_artifact growth_control.personal_artifacts%rowtype;
  v_route_status text;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
begin
  select * into v_artifact
  from growth_control.personal_artifacts
  where id=p_artifact_id and person_id=p_person_id and project_key='growth-brain'
  for update;

  if not found then return jsonb_build_object('accepted',false,'reason','artifact_not_found'); end if;

  select status into v_route_status
  from growth_control.personal_outcome_routes
  where id=v_artifact.route_id and person_id=p_person_id and project_key='growth-brain';

  if v_decision='start' then
    if v_artifact.status <> 'candidate' then
      return jsonb_build_object('accepted',false,'reason','artifact_not_candidate');
    end if;
    if v_route_status <> 'selected' then
      return jsonb_build_object('accepted',false,'reason','route_must_be_selected_before_starting_artifact');
    end if;
    if exists(
      select 1 from growth_control.personal_artifacts
      where person_id=p_person_id and project_key='growth-brain'
        and status='current' and id<>p_artifact_id
    ) then
      return jsonb_build_object('accepted',false,'reason','current_artifact_exists');
    end if;

    update growth_control.personal_artifacts
    set status='current',started_at=coalesce(started_at,now()),updated_at=now()
    where id=p_artifact_id;

  elsif v_decision='reject' then
    if v_artifact.status <> 'candidate' then
      return jsonb_build_object('accepted',false,'reason','artifact_not_candidate');
    end if;
    update growth_control.personal_artifacts
    set status='rejected',updated_at=now()
    where id=p_artifact_id;
  else
    return jsonb_build_object('accepted',false,'reason','unsupported_decision');
  end if;

  return jsonb_build_object('accepted',true,'artifact_id',p_artifact_id,'decision',v_decision);
end;
$function$;

create or replace function growth_control.sync_artifacts_with_route_status_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status='rejected' and old.status is distinct from new.status then
    update growth_control.personal_artifacts
    set status='rejected',updated_at=now()
    where route_id=new.id and person_id=new.person_id and project_key=new.project_key and status='candidate';
  end if;

  if new.status='paused' and old.status is distinct from new.status then
    update growth_control.personal_artifacts
    set status='abandoned',updated_at=now()
    where route_id=new.id and person_id=new.person_id and project_key=new.project_key and status='current';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_artifacts_with_route_status_v1 on growth_control.personal_outcome_routes;
create trigger trg_sync_artifacts_with_route_status_v1
after update of status on growth_control.personal_outcome_routes
for each row execute function growth_control.sync_artifacts_with_route_status_v1();

create or replace function growth_control.link_learning_session_to_current_artifact_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_artifact_id uuid;
begin
  if new.data_scope <> 'real' then return new; end if;

  select id into v_artifact_id
  from growth_control.personal_artifacts
  where person_id=new.person_id and project_key=new.project_key and status='current'
  order by started_at desc nulls last,created_at desc
  limit 1;

  if v_artifact_id is null then return new; end if;

  insert into growth_control.artifact_context_links(
    person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata
  ) values (
    new.person_id,new.project_key,v_artifact_id,'learning_session',new.id::text,'supports',
    jsonb_build_object('title',new.title,'goal',new.goal,'source_kind',new.source_kind,'source_ref',new.source_ref,'linked_at',now())
  )
  on conflict(artifact_id,link_kind,target_ref) do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_link_learning_session_to_current_artifact_v1 on growth_control.learning_companion_sessions;
create trigger trg_link_learning_session_to_current_artifact_v1
after insert or update of data_scope on growth_control.learning_companion_sessions
for each row
when (new.data_scope='real')
execute function growth_control.link_learning_session_to_current_artifact_v1();

create or replace function growth_control.link_learning_unit_to_artifact_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_session growth_control.learning_companion_sessions%rowtype;
  v_artifact_id uuid;
begin
  select * into v_session from growth_control.learning_companion_sessions where id=new.session_id;
  if not found or v_session.data_scope <> 'real' then return new; end if;

  select artifact_id into v_artifact_id
  from growth_control.artifact_context_links
  where person_id=v_session.person_id and project_key=v_session.project_key
    and link_kind='learning_session' and target_ref=v_session.id::text
  order by created_at desc
  limit 1;

  if v_artifact_id is null then return new; end if;

  insert into growth_control.artifact_context_links(
    person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata
  ) values (
    v_session.person_id,v_session.project_key,v_artifact_id,'learning_unit',new.id::text,'supports',
    jsonb_build_object('concept_key',new.concept_key,'sequence_no',new.sequence_no,'status',new.status,'linked_at',now())
  )
  on conflict(artifact_id,link_kind,target_ref) do nothing;

  insert into growth_control.artifact_context_links(
    person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata
  ) values (
    v_session.person_id,v_session.project_key,v_artifact_id,'synapse_concept',new.concept_key,'tests_or_supports',
    jsonb_build_object('learning_unit_id',new.id,'session_id',v_session.id,'linked_at',now())
  )
  on conflict(artifact_id,link_kind,target_ref) do update
  set metadata=growth_control.artifact_context_links.metadata || excluded.metadata;

  return new;
end;
$function$;

drop trigger if exists trg_link_learning_unit_to_artifact_v1 on growth_control.learning_companion_units;
create trigger trg_link_learning_unit_to_artifact_v1
after insert on growth_control.learning_companion_units
for each row execute function growth_control.link_learning_unit_to_artifact_v1();

create or replace function growth_control.link_learning_evidence_to_artifact_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_link record;
begin
  for v_link in
    select distinct l.artifact_id,a.project_key
    from growth_control.artifact_context_links l
    join growth_control.personal_artifacts a on a.id=l.artifact_id
    where l.person_id=new.person_id
      and l.link_kind='synapse_concept'
      and l.target_ref=new.concept_key
      and a.status in ('current','completed')
  loop
    insert into growth_control.artifact_context_links(
      person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata
    ) values (
      new.person_id,v_link.project_key,v_link.artifact_id,'learning_evidence',new.id::text,'supports',
      jsonb_build_object('concept_key',new.concept_key,'evidence_type',new.evidence_type,'score',new.score,'created_at',new.created_at)
    )
    on conflict(artifact_id,link_kind,target_ref) do nothing;
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_link_learning_evidence_to_artifact_v1 on public.growth_learning_evidence;
create trigger trg_link_learning_evidence_to_artifact_v1
after insert on public.growth_learning_evidence
for each row execute function growth_control.link_learning_evidence_to_artifact_v1();

create table if not exists growth_control.ai_worker_heartbeats (
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null default 'growth-brain',
  worker_id text not null,
  provider_key text not null,
  status text not null default 'online'
    check (status in ('online','idle','busy','stopping','error')),
  last_job_id uuid references growth_control.ai_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object'),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key(person_id,project_key,worker_id)
);

alter table growth_control.ai_worker_heartbeats enable row level security;
revoke all on growth_control.ai_worker_heartbeats from anon,authenticated;
grant select,insert,update,delete on growth_control.ai_worker_heartbeats to service_role;

create or replace function growth_control.ai_worker_heartbeat_v1(
  p_person_id uuid,
  p_project_key text,
  p_worker_id text,
  p_provider_key text,
  p_status text default 'online',
  p_last_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_project text := coalesce(nullif(btrim(p_project_key),''),'growth-brain');
  v_worker text := btrim(coalesce(p_worker_id,''));
  v_provider text := btrim(coalesce(p_provider_key,''));
  v_status text := lower(btrim(coalesce(p_status,'online')));
begin
  if v_worker='' then return jsonb_build_object('accepted',false,'reason','worker_id_required'); end if;
  if v_provider='' then return jsonb_build_object('accepted',false,'reason','provider_key_required'); end if;
  if v_status not in ('online','idle','busy','stopping','error') then
    return jsonb_build_object('accepted',false,'reason','unsupported_status');
  end if;

  insert into growth_control.ai_worker_heartbeats(
    person_id,project_key,worker_id,provider_key,status,last_job_id,metadata,last_seen_at
  ) values (
    p_person_id,v_project,v_worker,v_provider,v_status,p_last_job_id,coalesce(p_metadata,'{}'::jsonb),now()
  )
  on conflict(person_id,project_key,worker_id) do update set
    provider_key=excluded.provider_key,
    status=excluded.status,
    last_job_id=coalesce(excluded.last_job_id,growth_control.ai_worker_heartbeats.last_job_id),
    metadata=growth_control.ai_worker_heartbeats.metadata || excluded.metadata,
    last_seen_at=now();

  return jsonb_build_object('accepted',true,'worker_id',v_worker,'status',v_status,'last_seen_at',now());
end;
$function$;

create or replace function public.growth_ai_worker_heartbeat_service_v1(
  p_auth_user_id uuid,
  p_worker_id text,
  p_provider_key text,
  p_status text default 'online',
  p_last_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
begin
  v_person_id:=growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;
  return growth_control.ai_worker_heartbeat_v1(
    v_person_id,'growth-brain',p_worker_id,p_provider_key,p_status,p_last_job_id,p_metadata
  );
end;
$function$;

revoke all on function public.growth_ai_worker_heartbeat_service_v1(uuid,text,text,text,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.growth_ai_worker_heartbeat_service_v1(uuid,text,text,text,uuid,jsonb)
  to service_role;

-- Public artifact service wrappers
create or replace function public.growth_personal_artifacts_snapshot_service_v1(
  p_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
begin
  v_person_id:=growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;
  return jsonb_build_object(
    'authorized',true,
    'snapshot',growth_control.personal_artifacts_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$function$;

create or replace function public.growth_personal_artifact_decide_service_v1(
  p_auth_user_id uuid,
  p_artifact_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
begin
  v_person_id:=growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;
  return growth_control.personal_artifact_decide_v1(v_person_id,p_artifact_id,p_decision);
end;
$function$;

revoke all on function public.growth_personal_artifacts_snapshot_service_v1(uuid) from public,anon,authenticated;
revoke all on function public.growth_personal_artifact_decide_service_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.growth_personal_artifacts_snapshot_service_v1(uuid) to service_role;
grant execute on function public.growth_personal_artifact_decide_service_v1(uuid,uuid,text) to service_role;
