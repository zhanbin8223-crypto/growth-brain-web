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


create or replace function growth_control.personal_artifacts_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with a as (
  select pa.*,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'skill_key',s.skill_key,
        'name_zh',s.name_zh,
        'skill_kind',s.skill_kind,
        'why',s.why,
        'freshness_sensitive',s.freshness_sensitive,
        'ai_suggested_state',s.ai_suggested_state,
        'evidence_state',s.evidence_state,
        'evidence_coverage',s.evidence_coverage,
        'confidence',s.confidence,
        'evidence_refs',s.evidence_refs,
        'minimum_needed_now',s.minimum_needed_now
      ) order by s.skill_kind,s.name_zh)
      from growth_control.artifact_skill_targets s
      where s.artifact_id=pa.id
    ),'[]'::jsonb) as skills,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_kind',l.link_kind,
        'target_ref',l.target_ref,
        'relation',l.relation,
        'metadata',l.metadata
      ) order by l.created_at)
      from growth_control.artifact_context_links l
      where l.artifact_id=pa.id
    ),'[]'::jsonb) as links
  from growth_control.personal_artifacts pa
  where pa.person_id=p_person_id
    and pa.project_key=p_project_key
)
select jsonb_build_object(
  'sv','personal-artifacts-v1',
  'current',(
    select to_jsonb(x)-'person_id'-'project_key'
    from a x
    where status='current'
    order by started_at desc nulls last,created_at desc
    limit 1
  ),
  'candidate',(
    select to_jsonb(x)-'person_id'-'project_key'
    from a x
    where status='candidate'
    order by created_at desc
    limit 1
  ),
  'history',coalesce((
    select jsonb_agg(to_jsonb(x)-'person_id'-'project_key' order by sequence_no desc)
    from a x
    where status in ('completed','abandoned','rejected')
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'ai_result_creates_candidate_only',true,
    'single_current_artifact',true,
    'skill_evidence_state_not_promoted_by_ai',true,
    'evidence_coverage_requires_real_evidence',true
  )
);
$function$;

create or replace function growth_control.ai_worker_health_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control'
as $function$
with workers as (
  select
    worker_id,
    provider_key,
    status,
    last_job_id,
    metadata,
    last_seen_at,
    extract(epoch from (now()-last_seen_at))::int as seconds_since_seen,
    (last_seen_at >= now()-interval '30 seconds') as online_now
  from growth_control.ai_worker_heartbeats
  where person_id=p_person_id
    and project_key=coalesce(nullif(btrim(p_project_key),''),'growth-brain')
  order by last_seen_at desc
),
q as (
  select
    count(*) filter(where status='pending')::int as pending,
    count(*) filter(where status='claimed')::int as claimed,
    count(*) filter(where status='processing')::int as processing
  from growth_control.ai_jobs
  where person_id=p_person_id
    and project_key=coalesce(nullif(btrim(p_project_key),''),'growth-brain')
    and data_scope='real'
)
select jsonb_build_object(
  'workers',coalesce((
    select jsonb_agg(jsonb_build_object(
      'worker_id',worker_id,
      'provider_key',provider_key,
      'reported_status',status,
      'online_now',online_now,
      'seconds_since_seen',seconds_since_seen,
      'last_seen_at',last_seen_at,
      'last_job_id',last_job_id,
      'metadata',metadata
    ) order by last_seen_at desc)
    from workers
  ),'[]'::jsonb),
  'online_count',coalesce((select count(*) from workers where online_now),0),
  'queue',jsonb_build_object(
    'pending',coalesce((select pending from q),0),
    'claimed',coalesce((select claimed from q),0),
    'processing',coalesce((select processing from q),0)
  ),
  'status',case
    when exists(select 1 from workers where online_now) then 'online'
    when exists(select 1 from workers) then 'offline'
    else 'never_reported'
  end,
  'online_threshold_seconds',30
);
$function$;

create or replace function growth_control.system_cockpit_surface_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to ''
as $function$
with latest_ceo as (
  select state,reason,created_at
  from growth_control.ceo_state_snapshots
  where person_id=p_person_id
    and project_key=p_project_key
  order by created_at desc
  limit 1
)
select jsonb_build_object(
  'sv','system-cockpit-surface-v3',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'ceo_latest',coalesce((
    select jsonb_build_object(
      'current',state->'current',
      'next_action',state->'next_action',
      'runtime_truth',state->'runtime_truth',
      'reason',reason,
      'created_at',created_at
    )
    from latest_ceo
  ),'{}'::jsonb),
  'worker_health',growth_control.ai_worker_health_v1(p_person_id,p_project_key),
  'artifacts',growth_control.personal_artifacts_snapshot_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1(),
  'ui_resilience_contract',growth_control.ui_resilience_contract_v1(),
  'pre_real_usability',growth_control.pre_real_usability_surface_v1(p_person_id,p_project_key)
);
$function$;

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


-- Path-plan context relevance refresh
-- Production already applied. Route-specific source_evidence is included in the
-- Context Pack and takes precedence over unrelated general Synapse history.

create or replace function growth_control.ai_job_enqueue_path_plan_v1(
  p_person_id uuid,
  p_route_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_route growth_control.personal_outcome_routes%rowtype;
  v_job growth_control.ai_jobs%rowtype;
  v_inserted_id uuid;
  v_requeue jsonb;
  v_requeued boolean := false;
  v_context jsonb;
  v_instruction text;
  v_input text;
begin
  select * into v_route
  from growth_control.personal_outcome_routes
  where id=p_route_id
    and person_id=p_person_id
    and project_key='growth-brain'
    and status in ('candidate','selected')
  limit 1;

  if not found then
    return jsonb_build_object('accepted',false,'reason','personal_route_not_found');
  end if;

  v_context := jsonb_build_object(
    'route',jsonb_build_object(
      'id',v_route.id,
      'route_key',v_route.route_key,
      'title',v_route.title,
      'success_evidence',v_route.success_evidence,
      'why_now',v_route.why_now,
      'direction_key',v_route.direction_key,
      'status',v_route.status,
      'version',v_route.version,
      'source_evidence',v_route.source_evidence
    ),
    'context_relevance_policy',jsonb_build_object(
      'highest_priority','route.source_evidence.prior_confirmed_project_context',
      'use_general_learning_only_when_directly_relevant',true,
      'ignore_unrelated_synapse_for_route_planning',true,
      'confirmed_context_is_not_completion_evidence',true
    ),
    'recent_real_progress',growth_control.recent_real_progress_v1(p_person_id,'growth-brain',8),
    'learning_evidence',growth_control.learning_state_evidence_audit_v1(p_person_id),
    'personal_synapse',growth_control.personal_synapse_snapshot_v2(p_person_id,'growth-brain',12)
  );

  v_instruction :=
'你是 Growth Brain 的產品流程架構師、學習路徑設計員與作品規劃員共同工作。
只根據提供的資料庫 Context Pack 與使用者目標做候選規劃，不得把 AI 推測寫成已掌握能力。
請用繁體中文，輸出純 JSON，不要 Markdown code fence。
Context Pack 中 route.source_evidence.prior_confirmed_project_context 是使用者先前已確認的專案背景，優先於一般 Synapse；但它不是完成證據。
personal_synapse 與 learning_evidence 可能包含其他主題，只在與目前 route 直接相關時使用，不要為了湊技能而硬套。
規則：
1. 區分長期底層能力與容易因技術更新而替換的工具能力。
2. 技能掌握程度只能在有直接證據時估計；證據不足請標 unknown。
3. 現在只選一件最值得做、可以驗證完整流程的階段作品。
4. 下一階段只列候選分支，不提前固定整條路。
5. 完成標準必須是可觀察證據。
6. 已確認背景只用來避免重問與重做，不能當成已完成成果。
7. 需要新技術資訊時標記 needs_fresh_research=true。
JSON schema:
{"goal_interpretation":"...","core_capabilities":[],"tool_capabilities":[],"current_artifact":{"title":"...","objective":"...","deliverable":"...","done_evidence":[],"skills_tested":[],"estimated_scope":"small|medium|large"},"learning_focus":[],"possible_next_branches":[],"assumptions":[],"needs_fresh_research":false}';

  v_input := '請依照 Context Pack 產生目前階段的候選路徑與作品。'
             || E'\n\nContext Pack:\n'
             || v_context::text;

  insert into growth_control.ai_jobs(
    person_id,project_key,source_kind,source_ref,data_scope,
    task_type,task_payload,provider_key,status,provenance,idempotency_key
  ) values (
    v_route.person_id,
    v_route.project_key,
    'personal_outcome',
    'personal-outcome:'||v_route.id::text,
    'real',
    'path_plan',
    jsonb_build_object(
      'route_id',v_route.id,
      'route_version',v_route.version,
      'instruction',v_instruction,
      'input',v_input,
      'context_pack',v_context,
      'employee_plan',jsonb_build_array(
        'product-flow-architect',
        'learning-path-designer',
        'artifact-planner',
        'impeccable-review-later'
      ),
      'response_schema','path-plan-v1',
      'constraints',jsonb_build_array(
        'candidate_only',
        'traditional_chinese_first',
        'evidence_before_mastery',
        'one_current_artifact',
        'future_branches_not_committed',
        'confirmed_context_is_not_completion',
        'ignore_unrelated_general_memory'
      )
    ),
    null,
    'pending',
    jsonb_build_object(
      'source','personal_route_real_input',
      'route_id',v_route.id,
      'route_version',v_route.version,
      'context_source','supabase'
    ),
    'path-plan:'||v_route.id::text||':v'||v_route.version::text
  )
  on conflict(person_id,project_key,idempotency_key) do nothing
  returning id into v_inserted_id;

  select * into v_job
  from growth_control.ai_jobs
  where person_id=v_route.person_id
    and project_key=v_route.project_key
    and idempotency_key='path-plan:'||v_route.id::text||':v'||v_route.version::text
  order by created_at desc
  limit 1;

  if v_job.status='failed' then
    v_requeue:=growth_control.ai_job_transition_v1(
      v_job.id,'pending','failed',null,v_job.provider_key,null,'{}'::jsonb,null
    );
    if coalesce((v_requeue->>'accepted')::boolean,false) then
      v_requeued:=true;
      select * into v_job
      from growth_control.ai_jobs
      where id=v_job.id;
    end if;
  end if;

  return jsonb_build_object(
    'accepted',true,
    'created',v_inserted_id is not null,
    'requeued',v_requeued,
    'idempotent',v_inserted_id is null and not v_requeued,
    'job',jsonb_build_object(
      'id',v_job.id,
      'status',v_job.status,
      'task_type',v_job.task_type,
      'provider_key',v_job.provider_key,
      'attempt_no',v_job.attempt_no,
      'source_ref',v_job.source_ref,
      'created_at',v_job.created_at,
      'updated_at',v_job.updated_at
    )
  );
end;
$function$;


-- Artifact completion and evidence-driven replanning
-- Production applied and rollback-verified on 2026-10-02.
-- AI may suggest the next artifact, but only user-submitted evidence can complete
-- the current artifact or promote a skill to real_project evidence.

create or replace function growth_control.personal_artifacts_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with a as (
  select pa.*,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'skill_key',s.skill_key,
        'name_zh',s.name_zh,
        'skill_kind',s.skill_kind,
        'why',s.why,
        'freshness_sensitive',s.freshness_sensitive,
        'ai_suggested_state',s.ai_suggested_state,
        'evidence_state',s.evidence_state,
        'evidence_coverage',s.evidence_coverage,
        'confidence',s.confidence,
        'evidence_refs',s.evidence_refs,
        'minimum_needed_now',s.minimum_needed_now
      ) order by s.skill_kind,s.name_zh)
      from growth_control.artifact_skill_targets s
      where s.artifact_id=pa.id
    ),'[]'::jsonb) as skills,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_kind',l.link_kind,
        'target_ref',l.target_ref,
        'relation',l.relation,
        'metadata',l.metadata
      ) order by l.created_at)
      from growth_control.artifact_context_links l
      where l.artifact_id=pa.id
    ),'[]'::jsonb) as links
  from growth_control.personal_artifacts pa
  where pa.person_id=p_person_id
    and pa.project_key=p_project_key
),
next_job as (
  select j.*
  from growth_control.ai_jobs j
  where j.person_id=p_person_id
    and j.project_key=p_project_key
    and j.data_scope='real'
    and j.task_type='path_plan'
    and j.source_kind='personal_artifact'
  order by j.created_at desc
  limit 1
)
select jsonb_build_object(
  'sv','personal-artifacts-v2',
  'current',(
    select to_jsonb(x)-'person_id'-'project_key'
    from a x
    where status='current'
    order by started_at desc nulls last,created_at desc
    limit 1
  ),
  'candidate',(
    select to_jsonb(x)-'person_id'-'project_key'
    from a x
    where status='candidate'
    order by created_at desc
    limit 1
  ),
  'history',coalesce((
    select jsonb_agg(to_jsonb(x)-'person_id'-'project_key' order by sequence_no desc)
    from a x
    where status in ('completed','abandoned','rejected')
  ),'[]'::jsonb),
  'next_plan_job',(
    select jsonb_build_object(
      'id',id,
      'status',status,
      'attempt_no',attempt_no,
      'source_ref',source_ref,
      'provider_key',provider_key,
      'error',case when status='failed' then error else null end,
      'created_at',created_at,
      'updated_at',updated_at,
      'completed_at',completed_at
    )
    from next_job
  ),
  'policy',jsonb_build_object(
    'ai_result_creates_candidate_only',true,
    'single_current_artifact',true,
    'skill_evidence_state_not_promoted_by_ai',true,
    'evidence_coverage_requires_real_evidence',true,
    'artifact_completion_requires_user_evidence',true,
    'completed_artifact_enqueues_next_candidate',true
  )
);
$function$;

create or replace function growth_control.ai_job_enqueue_artifact_replan_v1(
  p_person_id uuid,
  p_artifact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_artifact growth_control.personal_artifacts%rowtype;
  v_route growth_control.personal_outcome_routes%rowtype;
  v_context jsonb;
  v_instruction text;
  v_input text;
  v_job growth_control.ai_jobs%rowtype;
  v_inserted_id uuid;
begin
  select * into v_artifact
  from growth_control.personal_artifacts
  where id=p_artifact_id
    and person_id=p_person_id
    and project_key='growth-brain'
    and status='completed'
  limit 1;

  if not found then
    return jsonb_build_object('accepted',false,'reason','completed_artifact_required');
  end if;

  select * into v_route
  from growth_control.personal_outcome_routes
  where id=v_artifact.route_id
    and person_id=p_person_id
    and project_key='growth-brain'
    and status='selected'
  limit 1;

  if not found then
    return jsonb_build_object('accepted',false,'reason','selected_route_required');
  end if;

  v_context := jsonb_build_object(
    'context_version','artifact-replan-context-v1',
    'route',jsonb_build_object(
      'id',v_route.id,
      'route_key',v_route.route_key,
      'title',v_route.title,
      'success_evidence',v_route.success_evidence,
      'why_now',v_route.why_now,
      'direction_key',v_route.direction_key,
      'status',v_route.status,
      'version',v_route.version,
      'source_evidence',v_route.source_evidence
    ),
    'artifact_history',growth_control.personal_artifacts_snapshot_v1(p_person_id,'growth-brain'),
    'completed_artifact',jsonb_build_object(
      'id',v_artifact.id,
      'sequence_no',v_artifact.sequence_no,
      'title',v_artifact.title,
      'objective',v_artifact.objective,
      'deliverable',v_artifact.deliverable,
      'result',v_artifact.result,
      'result_evidence',v_artifact.result_evidence,
      'completed_at',v_artifact.completed_at
    ),
    'recent_real_progress',growth_control.recent_real_progress_v1(p_person_id,'growth-brain',5),
    'learning_evidence',growth_control.learning_state_evidence_audit_v1(p_person_id),
    'personal_synapse',growth_control.personal_synapse_snapshot_v2(p_person_id,'growth-brain',12),
    'selection_rule',jsonb_build_object(
      'previous_artifact_result_first',true,
      'prior_confirmed_context_is_constraint_not_completion',true,
      'unrelated_memory_may_be_ignored',true,
      'next_artifact_must_be_one_stage_only',true
    )
  );

  v_instruction :=
'你是 Growth Brain 的產品流程架構師、學習路徑設計員與作品規劃員共同工作。
這次不是第一次規劃；上一件作品已完成。請優先使用 completed_artifact 的結果與證據，重新判斷下一件最值得做的作品。
route.source_evidence.prior_confirmed_project_context 是使用者已確認的需求與限制，但不是完成證據。
不要因為上一件作品完成就假設所有技能都掌握；只把已驗證證據當能力基線。
請用繁體中文，輸出純 JSON，不要 Markdown code fence。
規則：
1. 只產生一件下一階段候選作品。
2. 下一件作品必須由上一件作品結果、目前技能證據與主線目標推導。
3. 若上一件作品暴露新缺口，learning_focus 只列現在需要補的部分。
4. 未來分支只列候選條件，不寫成正式路線。
5. 完成標準必須可觀察。
6. 需要最新工具／技術資料時標記 needs_fresh_research=true。
JSON schema:
{"goal_interpretation":"...","core_capabilities":[],"tool_capabilities":[],"current_artifact":{"title":"...","objective":"...","deliverable":"...","done_evidence":[],"skills_tested":[],"estimated_scope":"small|medium|large"},"learning_focus":[],"possible_next_branches":[],"assumptions":[],"needs_fresh_research":false}';

  v_input := '請依照上一件已完成作品與 Context Pack，產生下一件候選作品。'
             || E'\n\nContext Pack:\n'
             || v_context::text;

  insert into growth_control.ai_jobs(
    person_id,project_key,source_kind,source_ref,data_scope,
    task_type,task_payload,provider_key,status,provenance,idempotency_key
  ) values (
    p_person_id,
    'growth-brain',
    'personal_artifact',
    'artifact:'||v_artifact.id::text,
    'real',
    'path_plan',
    jsonb_build_object(
      'route_id',v_route.id,
      'route_version',v_route.version,
      'source_artifact_id',v_artifact.id,
      'instruction',v_instruction,
      'input',v_input,
      'context_pack',v_context,
      'employee_plan',jsonb_build_array(
        'product-flow-architect',
        'learning-path-designer',
        'artifact-planner',
        'impeccable-review-later'
      ),
      'response_schema','path-plan-v1',
      'constraints',jsonb_build_array(
        'candidate_only',
        'traditional_chinese_first',
        'evidence_before_mastery',
        'one_current_artifact',
        'future_branches_not_committed',
        'based_on_completed_artifact'
      )
    ),
    null,
    'pending',
    jsonb_build_object(
      'source','completed_personal_artifact',
      'route_id',v_route.id,
      'artifact_id',v_artifact.id,
      'context_source','supabase'
    ),
    'artifact-replan:'||v_artifact.id::text
  )
  on conflict(person_id,project_key,idempotency_key) do nothing
  returning id into v_inserted_id;

  select * into v_job
  from growth_control.ai_jobs
  where person_id=p_person_id
    and project_key='growth-brain'
    and idempotency_key='artifact-replan:'||v_artifact.id::text
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'accepted',true,
    'created',v_inserted_id is not null,
    'idempotent',v_inserted_id is null,
    'job',jsonb_build_object(
      'id',v_job.id,
      'status',v_job.status,
      'task_type',v_job.task_type,
      'source_ref',v_job.source_ref,
      'created_at',v_job.created_at
    )
  );
end;
$function$;

create or replace function growth_control.personal_artifact_complete_v1(
  p_person_id uuid,
  p_artifact_id uuid,
  p_result_text text,
  p_result_evidence jsonb,
  p_demonstrated_skill_keys text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_artifact growth_control.personal_artifacts%rowtype;
  v_evidence jsonb := coalesce(p_result_evidence,'{}'::jsonb);
  v_completed_at timestamptz := now();
  v_next_job jsonb;
  v_key text;
begin
  select * into v_artifact
  from growth_control.personal_artifacts
  where id=p_artifact_id
    and person_id=p_person_id
    and project_key='growth-brain'
  for update;

  if not found then
    return jsonb_build_object('accepted',false,'reason','artifact_not_found');
  end if;

  if v_artifact.status <> 'current' then
    return jsonb_build_object('accepted',false,'reason','current_artifact_required');
  end if;

  if length(btrim(coalesce(p_result_text,''))) < 3 then
    return jsonb_build_object('accepted',false,'reason','result_text_required');
  end if;

  if jsonb_typeof(v_evidence) <> 'object'
     or jsonb_typeof(v_evidence->'items') <> 'array'
     or jsonb_array_length(v_evidence->'items') = 0 then
    return jsonb_build_object('accepted',false,'reason','nonempty_evidence_items_required');
  end if;

  update growth_control.personal_artifacts
  set
    status='completed',
    result=jsonb_build_object(
      'summary',btrim(p_result_text),
      'submitted_by','primary_user',
      'submitted_at',v_completed_at
    ),
    result_evidence=v_evidence || jsonb_build_object(
      'submitted_by','primary_user',
      'submitted_at',v_completed_at
    ),
    completed_at=v_completed_at,
    updated_at=v_completed_at
  where id=p_artifact_id;

  foreach v_key in array coalesce(p_demonstrated_skill_keys,'{}'::text[])
  loop
    update growth_control.artifact_skill_targets
    set
      evidence_state=case
        when evidence_state='commercialized' then evidence_state
        else 'real_project'
      end,
      evidence_refs=coalesce(evidence_refs,'[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'type','real_project',
          'artifact_id',p_artifact_id,
          'source','user_confirmed_artifact_completion',
          'completed_at',v_completed_at
        )
      ),
      updated_at=v_completed_at
    where artifact_id=p_artifact_id
      and skill_key=v_key;
  end loop;

  v_next_job:=growth_control.ai_job_enqueue_artifact_replan_v1(
    p_person_id,
    p_artifact_id
  );

  return jsonb_build_object(
    'accepted',true,
    'artifact_id',p_artifact_id,
    'status','completed',
    'completed_at',v_completed_at,
    'demonstrated_skill_keys',to_jsonb(coalesce(p_demonstrated_skill_keys,'{}'::text[])),
    'next_plan_job',v_next_job
  );
end;
$function$;

create or replace function public.growth_personal_artifact_complete_service_v1(
  p_auth_user_id uuid,
  p_artifact_id uuid,
  p_result_text text,
  p_result_evidence jsonb,
  p_demonstrated_skill_keys text[] default '{}'::text[]
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

  return growth_control.personal_artifact_complete_v1(
    v_person_id,
    p_artifact_id,
    p_result_text,
    p_result_evidence,
    p_demonstrated_skill_keys
  );
end;
$function$;

revoke all on function public.growth_personal_artifact_complete_service_v1(uuid,uuid,text,jsonb,text[])
  from public,anon,authenticated;
grant execute on function public.growth_personal_artifact_complete_service_v1(uuid,uuid,text,jsonb,text[])
  to service_role;
