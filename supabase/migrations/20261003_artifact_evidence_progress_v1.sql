create table if not exists growth_control.artifact_evidence_progress (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  project_key text not null default 'growth-brain',
  artifact_id uuid not null references growth_control.personal_artifacts(id) on delete cascade,
  criterion_no integer not null check (criterion_no > 0),
  criterion_text text not null,
  status text not null default 'pending' check (status in ('pending','confirmed')),
  evidence jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artifact_id, criterion_no)
);

create index if not exists artifact_evidence_progress_person_artifact_idx
  on growth_control.artifact_evidence_progress(person_id, artifact_id, criterion_no);

alter table growth_control.artifact_context_links
  drop constraint if exists artifact_context_links_link_kind_check;

alter table growth_control.artifact_context_links
  add constraint artifact_context_links_link_kind_check
  check (
    link_kind = any (
      array[
        'learning_session'::text,
        'learning_unit'::text,
        'synapse_concept'::text,
        'learning_evidence'::text,
        'source'::text,
        'artifact_evidence'::text
      ]
    )
  );

alter table growth_control.artifact_evidence_progress enable row level security;
revoke all on table growth_control.artifact_evidence_progress from public, anon, authenticated;

create or replace function growth_control.artifact_evidence_progress_ensure_v1(
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
  v_total integer;
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

  if jsonb_typeof(v_artifact.done_evidence) <> 'array' then
    return jsonb_build_object('accepted',false,'reason','artifact_done_evidence_not_array');
  end if;

  insert into growth_control.artifact_evidence_progress(
    person_id, project_key, artifact_id, criterion_no, criterion_text
  )
  select
    p_person_id,
    v_artifact.project_key,
    p_artifact_id,
    ordinality::integer,
    btrim(value)
  from jsonb_array_elements_text(v_artifact.done_evidence) with ordinality as e(value, ordinality)
  where btrim(value) <> ''
  on conflict (artifact_id, criterion_no) do update
  set criterion_text=excluded.criterion_text,
      updated_at=case
        when growth_control.artifact_evidence_progress.criterion_text is distinct from excluded.criterion_text
          then now()
        else growth_control.artifact_evidence_progress.updated_at
      end;

  select count(*) into v_total
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id;

  return jsonb_build_object(
    'accepted',true,
    'artifact_id',p_artifact_id,
    'criterion_count',v_total
  );
end;
$function$;

revoke execute on function growth_control.artifact_evidence_progress_ensure_v1(uuid,uuid) from public, anon, authenticated;

create or replace function growth_control.artifact_evidence_record_v1(
  p_person_id uuid,
  p_artifact_id uuid,
  p_criterion_no integer,
  p_evidence_text text,
  p_evidence_refs jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_artifact growth_control.personal_artifacts%rowtype;
  v_progress growth_control.artifact_evidence_progress%rowtype;
  v_refs jsonb := case when jsonb_typeof(coalesce(p_evidence_refs,'[]'::jsonb))='array'
                       then coalesce(p_evidence_refs,'[]'::jsonb)
                       else '[]'::jsonb end;
  v_metadata jsonb := case when jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))='object'
                           then coalesce(p_metadata,'{}'::jsonb)
                           else '{}'::jsonb end;
  v_evidence jsonb;
  v_target_ref text;
  v_now timestamptz := now();
  v_total integer;
  v_confirmed integer;
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

  if p_criterion_no is null or p_criterion_no < 1 then
    return jsonb_build_object('accepted',false,'reason','criterion_no_required');
  end if;

  if length(btrim(coalesce(p_evidence_text,''))) < 3 then
    return jsonb_build_object('accepted',false,'reason','evidence_text_required');
  end if;

  perform growth_control.artifact_evidence_progress_ensure_v1(p_person_id,p_artifact_id);

  select * into v_progress
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id
    and person_id=p_person_id
    and criterion_no=p_criterion_no
  for update;

  if not found then
    return jsonb_build_object('accepted',false,'reason','criterion_not_found');
  end if;

  v_evidence := jsonb_build_object(
    'text',btrim(p_evidence_text),
    'refs',v_refs,
    'metadata',v_metadata,
    'source','growth_brain_web',
    'recorded_at',v_now
  );

  update growth_control.artifact_evidence_progress
  set status='confirmed',
      evidence=v_evidence,
      confirmed_at=v_now,
      updated_at=v_now
  where id=v_progress.id;

  v_target_ref := 'artifact:'||p_artifact_id::text||':criterion:'||p_criterion_no::text;

  update growth_control.artifact_context_links
  set relation='supports_completion',
      metadata=jsonb_build_object(
        'criterion_no',p_criterion_no,
        'criterion_text',v_progress.criterion_text,
        'evidence',v_evidence
      )
  where artifact_id=p_artifact_id
    and person_id=p_person_id
    and link_kind='artifact_evidence'
    and target_ref=v_target_ref;

  if not found then
    insert into growth_control.artifact_context_links(
      person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata
    ) values (
      p_person_id,
      v_artifact.project_key,
      p_artifact_id,
      'artifact_evidence',
      v_target_ref,
      'supports_completion',
      jsonb_build_object(
        'criterion_no',p_criterion_no,
        'criterion_text',v_progress.criterion_text,
        'evidence',v_evidence
      )
    );
  end if;

  select count(*), count(*) filter (where status='confirmed')
  into v_total,v_confirmed
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id
    and person_id=p_person_id;

  return jsonb_build_object(
    'accepted',true,
    'artifact_id',p_artifact_id,
    'criterion_no',p_criterion_no,
    'status','confirmed',
    'progress',jsonb_build_object(
      'total',v_total,
      'confirmed',v_confirmed,
      'remaining',greatest(v_total-v_confirmed,0)
    )
  );
end;
$function$;

revoke execute on function growth_control.artifact_evidence_record_v1(uuid,uuid,integer,text,jsonb,jsonb) from public, anon, authenticated;

create or replace function public.growth_personal_artifact_evidence_service_v1(
  p_auth_user_id uuid,
  p_artifact_id uuid,
  p_criterion_no integer,
  p_evidence_text text,
  p_evidence_refs jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_person_id uuid;
begin
  v_person_id:=growth_control.resolve_single_user_v1(p_auth_user_id);

  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  return growth_control.artifact_evidence_record_v1(
    v_person_id,
    p_artifact_id,
    p_criterion_no,
    p_evidence_text,
    p_evidence_refs,
    p_metadata
  );
end;
$function$;

revoke execute on function public.growth_personal_artifact_evidence_service_v1(uuid,uuid,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.growth_personal_artifact_evidence_service_v1(uuid,uuid,integer,text,jsonb,jsonb) to service_role;

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
  v_progress jsonb;
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

  select status into v_route_status
  from growth_control.personal_outcome_routes
  where id=v_artifact.route_id
    and person_id=p_person_id
    and project_key='growth-brain';

  if v_decision='start' then
    if v_artifact.status <> 'candidate' then
      return jsonb_build_object('accepted',false,'reason','artifact_not_candidate');
    end if;
    if v_route_status <> 'selected' then
      return jsonb_build_object('accepted',false,'reason','route_must_be_selected_before_starting_artifact');
    end if;
    if exists(
      select 1 from growth_control.personal_artifacts
      where person_id=p_person_id
        and project_key='growth-brain'
        and status='current'
        and id<>p_artifact_id
    ) then
      return jsonb_build_object('accepted',false,'reason','current_artifact_exists');
    end if;

    update growth_control.personal_artifacts
    set status='current',started_at=coalesce(started_at,now()),updated_at=now()
    where id=p_artifact_id;

    v_progress:=growth_control.artifact_evidence_progress_ensure_v1(
      p_person_id,
      p_artifact_id
    );
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

  return jsonb_build_object(
    'accepted',true,
    'artifact_id',p_artifact_id,
    'decision',v_decision,
    'evidence_progress',v_progress
  );
end;
$function$;

create or replace function growth_control.personal_artifacts_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
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
    ),'[]'::jsonb) as links,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'criterion_no',p.criterion_no,
        'criterion_text',p.criterion_text,
        'status',p.status,
        'evidence',p.evidence,
        'confirmed_at',p.confirmed_at
      ) order by p.criterion_no)
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
    ),'[]'::jsonb) as evidence_progress,
    (
      select jsonb_build_object(
        'total',count(*),
        'confirmed',count(*) filter (where p.status='confirmed'),
        'remaining',count(*) filter (where p.status<>'confirmed')
      )
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
    ) as progress_summary,
    (
      select jsonb_build_object(
        'criterion_no',p.criterion_no,
        'criterion_text',p.criterion_text,
        'status',p.status
      )
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
        and p.status='pending'
      order by p.criterion_no
      limit 1
    ) as next_evidence_item
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
  'sv','personal-artifacts-v3',
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
    'artifact_completion_requires_all_checklist_items',true,
    'completed_artifact_enqueues_next_candidate',true
  )
);
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
  v_total integer := 0;
  v_confirmed integer := 0;
  v_next jsonb;
  v_progress_items jsonb := '[]'::jsonb;
  v_submitted_items jsonb := '[]'::jsonb;
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

  perform growth_control.artifact_evidence_progress_ensure_v1(
    p_person_id,
    p_artifact_id
  );

  select
    count(*),
    count(*) filter (where status='confirmed'),
    coalesce(jsonb_agg(
      coalesce(nullif(evidence->>'text',''),criterion_text)
      order by criterion_no
    ) filter (where status='confirmed'),'[]'::jsonb)
  into v_total,v_confirmed,v_progress_items
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id
    and person_id=p_person_id;

  if v_total > 0 and v_confirmed < v_total then
    select jsonb_build_object(
      'criterion_no',criterion_no,
      'criterion_text',criterion_text,
      'status',status
    )
    into v_next
    from growth_control.artifact_evidence_progress
    where artifact_id=p_artifact_id
      and person_id=p_person_id
      and status='pending'
    order by criterion_no
    limit 1;

    return jsonb_build_object(
      'accepted',false,
      'reason','artifact_evidence_progress_incomplete',
      'progress',jsonb_build_object(
        'total',v_total,
        'confirmed',v_confirmed,
        'remaining',greatest(v_total-v_confirmed,0)
      ),
      'next_evidence_item',v_next
    );
  end if;

  if jsonb_typeof(v_evidence)='object'
     and jsonb_typeof(v_evidence->'items')='array' then
    v_submitted_items:=v_evidence->'items';
  end if;

  if v_total=0 and jsonb_array_length(v_submitted_items)=0 then
    return jsonb_build_object('accepted',false,'reason','nonempty_evidence_items_required');
  end if;

  v_evidence := case
    when jsonb_typeof(v_evidence)='object' then v_evidence
    else '{}'::jsonb
  end;

  v_evidence := jsonb_set(
    v_evidence,
    '{items}',
    v_progress_items || v_submitted_items,
    true
  ) || jsonb_build_object(
    'checklist_total',v_total,
    'checklist_confirmed',v_confirmed
  );

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
    'progress',jsonb_build_object(
      'total',v_total,
      'confirmed',v_confirmed,
      'remaining',0
    ),
    'demonstrated_skill_keys',to_jsonb(coalesce(p_demonstrated_skill_keys,'{}'::text[])),
    'next_plan_job',v_next_job
  );
end;
$function$;


-- Personal Home follows the next unverified artifact evidence item.
create or replace function growth_control.personal_home_surface_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to 'growth_control', 'public'
as $function$
with base as (
  select growth_control.personal_home_surface_v1(p_person_id,p_project_key) as j
),
artifacts as (
  select growth_control.personal_artifacts_snapshot_v1(p_person_id,p_project_key) as j
),
system_state as (
  select growth_control.ceo_project_state_v1(p_person_id,p_project_key) as j
)
select
  (select j from base)
  || jsonb_build_object(
    'sv','personal-home-surface-v3',
    'personal_synapse',growth_control.personal_synapse_snapshot_v2(p_person_id,p_project_key,30),
    'artifact_summary',jsonb_build_object(
      'current',(select j->'current' from artifacts),
      'candidate',(select j->'candidate' from artifacts),
      'next_plan_job',(select j->'next_plan_job' from artifacts)
    ),
    'system_health',jsonb_build_object(
      'location','system_cockpit',
      'show_build_details_on_personal_home',false,
      'build_in_progress',coalesce((select j->'current' is not null from system_state),false),
      'current_stage',(select j#>>'{current,stage}' from system_state),
      'current_title',(select j#>>'{current,title}' from system_state),
      'current_status',(select j#>>'{current,status}' from system_state),
      'current_blocked',coalesce((select j#>>'{current,status}' from system_state)='blocked',false),
      'parallel_blocker_count',coalesce((select jsonb_array_length(j->'parallel_blockers') from system_state),0)
    ),
    'primary_action',case
      when (select jsonb_typeof(j#>'{current,next_evidence_item}') from artifacts)='object' then
        jsonb_build_object(
          'status','personal_artifact_current_step',
          'artifact_id',(select j#>>'{current,id}' from artifacts),
          'route_id',(select j#>>'{current,route_id}' from artifacts),
          'criterion_no',(select j#>>'{current,next_evidence_item,criterion_no}' from artifacts),
          'title','第 '||(select j#>>'{current,next_evidence_item,criterion_no}' from artifacts)||' 步：'||(select j#>>'{current,next_evidence_item,criterion_text}' from artifacts),
          'why','目前作品：'||coalesce((select j#>>'{current,title}' from artifacts),'目前作品')||'。只先完成這一項並留下可追溯證據。',
          'success_evidence','保存這一項的真實結果／證據後，系統才前進到下一項。'
        )
      when (select jsonb_typeof(j->'current') from artifacts)='object' then
        jsonb_build_object(
          'status','personal_artifact_ready_to_complete',
          'artifact_id',(select j#>>'{current,id}' from artifacts),
          'route_id',(select j#>>'{current,route_id}' from artifacts),
          'title','完成作品並確認真正驗證到的技能',
          'why',coalesce(nullif((select j#>>'{current,title}' from artifacts),''),'目前作品')||' 的完成條件都已有證據。',
          'success_evidence','提交作品結果，且只勾選這件作品真的驗證到的技能。'
        )
      when (select jsonb_typeof(j->'candidate') from artifacts)='object' then
        jsonb_build_object(
          'status','personal_artifact_candidate_available',
          'artifact_id',(select j#>>'{candidate,id}' from artifacts),
          'route_id',(select j#>>'{candidate,route_id}' from artifacts),
          'title',(select j#>>'{candidate,title}' from artifacts),
          'why',coalesce(nullif((select j#>>'{candidate,objective}' from artifacts),''),'GPT 已產生候選作品；只有你確認後才會開始。'),
          'success_evidence',coalesce(nullif((select j#>>'{candidate,done_evidence,0}' from artifacts),''),nullif((select j#>>'{candidate,deliverable}' from artifacts),''),'先確認是否開始；候選作品不會自動升成進行中。')
        )
      when coalesce((select j#>>'{next_plan_job,status}' from artifacts),'') in ('pending','claimed','processing') then
        jsonb_build_object(
          'status','personal_artifact_replanning',
          'job_id',(select j#>>'{next_plan_job,id}' from artifacts),
          'title','正在產生下一件候選作品',
          'why','上一件作品的結果與證據已進入重新規劃；AI 只會產生候選，不會自動開始。',
          'success_evidence','產生一件新的 candidate 作品，並保留技能與證據狀態。'
        )
      else (select j->'primary_action' from base)
    end
  );
$function$;


-- Stage-specific friction / unblock collaboration v1
create table if not exists growth_control.artifact_stage_friction (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null default 'growth-brain',
  artifact_id uuid not null references growth_control.personal_artifacts(id) on delete cascade,
  criterion_no integer not null check (criterion_no > 0),
  criterion_text text not null,
  source text not null default 'manual' check (source in ('manual','auto')),
  status text not null default 'reported'
    check (status in ('reported','diagnosing','reviewing','ready','resolved','dismissed','failed')),
  user_note text not null,
  signal_count integer not null default 1 check (signal_count > 0),
  signals jsonb not null default '[]'::jsonb,
  diagnosis_job_id uuid references growth_control.ai_jobs(id) on delete set null,
  review_job_id uuid references growth_control.ai_jobs(id) on delete set null,
  diagnosis jsonb not null default '{}'::jsonb,
  final_guidance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists artifact_stage_friction_artifact_idx
  on growth_control.artifact_stage_friction(artifact_id,criterion_no,created_at desc);

create unique index if not exists artifact_stage_friction_one_active_idx
  on growth_control.artifact_stage_friction(artifact_id,criterion_no)
  where status in ('reported','diagnosing','reviewing');

alter table growth_control.artifact_stage_friction enable row level security;
revoke all on table growth_control.artifact_stage_friction from public, anon, authenticated;

CREATE OR REPLACE FUNCTION growth_control.apply_artifact_stage_unblock_job_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_friction_id uuid;
  v_body text;
  v_json jsonb;
  v_review_job_id uuid;
  v_friction growth_control.artifact_stage_friction%rowtype;
begin
  if new.status=old.status then
    return new;
  end if;

  if new.task_type not in ('artifact_stage_unblock_diagnosis','artifact_stage_unblock_review') then
    return new;
  end if;

  begin
    v_friction_id:=nullif(new.task_payload->>'friction_id','')::uuid;
  exception when others then
    return new;
  end;

  if v_friction_id is null then
    return new;
  end if;

  if new.status='failed' then
    update growth_control.artifact_stage_friction
    set status='failed',
        updated_at=now(),
        final_guidance=jsonb_build_object(
          'error','AI 拆解任務失敗',
          'job_id',new.id
        )
    where id=v_friction_id;
    return new;
  end if;

  if new.status<>'completed' then
    return new;
  end if;

  v_body:=coalesce(new.result->>'text','');

  begin
    v_json:=v_body::jsonb;
  exception when others then
    update growth_control.artifact_stage_friction
    set status='failed',
        updated_at=now(),
        final_guidance=jsonb_build_object(
          'error','AI 回覆不是可解析 JSON',
          'job_id',new.id
        )
    where id=v_friction_id;
    return new;
  end;

  if new.task_type='artifact_stage_unblock_diagnosis' then
    update growth_control.artifact_stage_friction
    set diagnosis=v_json,
        status='reviewing',
        updated_at=now()
    where id=v_friction_id
    returning * into v_friction;

    if not found then
      return new;
    end if;

    insert into growth_control.ai_jobs(
      person_id,project_key,source_kind,source_ref,data_scope,task_type,task_payload,
      provider_key,status,provenance,idempotency_key
    ) values (
      v_friction.person_id,
      v_friction.project_key,
      'artifact_stage_friction',
      'friction:'||v_friction_id::text,
      'real',
      'artifact_stage_unblock_review',
      jsonb_build_object(
        'friction_id',v_friction_id,
        'instruction',
          '你是 Logic & Reality Analyst（邏輯／真實性分析員）。審查達案執行官對目前階段卡點的診斷。刪除沒有證據的推測，不把卡住解讀成能力下降；優先保留能讓使用者今天往前一步的最小行動。若確實需要學習，只給目前最低必要範圍；若確實需要拆階段，只拆目前階段。請輸出純 JSON：{"accepted":true,"problem_summary":"","smallest_next_action":"","micro_steps":[],"learning_needed":{"needed":false,"target":null,"minimum":null},"employee_to_use_next":null,"stage_replan":{"needed":false,"reason":null},"warnings":[]}',
        'input',jsonb_build_object(
          'artifact_id',v_friction.artifact_id,
          'criterion_no',v_friction.criterion_no,
          'criterion_text',v_friction.criterion_text,
          'user_note',v_friction.user_note,
          'signal_count',v_friction.signal_count,
          'diagnosis',v_json,
          'rules',jsonb_build_object(
            'do_not_downgrade_skill_from_friction',true,
            'do_not_replan_entire_route',true,
            'smallest_next_action_first',true,
            'only_current_stage_can_be_split',true
          )
        )
      ),
      'chatgpt_web_opencli',
      'pending',
      jsonb_build_object(
        'employee_key','logic-reality-analyst',
        'employee_role','邏輯／真實性分析員',
        'collaboration_stage','review',
        'friction_id',v_friction_id,
        'specialist_job_id',new.id
      ),
      'artifact-friction:'||v_friction_id::text||':review'
    )
    returning id into v_review_job_id;

    update growth_control.artifact_stage_friction
    set review_job_id=v_review_job_id,
        updated_at=now()
    where id=v_friction_id;

  elsif new.task_type='artifact_stage_unblock_review' then
    update growth_control.artifact_stage_friction
    set final_guidance=v_json,
        status='ready',
        updated_at=now()
    where id=v_friction_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION growth_control.artifact_stage_unblock_request_v1(p_person_id uuid, p_artifact_id uuid, p_user_note text, p_source text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_artifact growth_control.personal_artifacts%rowtype;
  v_stage growth_control.artifact_evidence_progress%rowtype;
  v_existing growth_control.artifact_stage_friction%rowtype;
  v_friction_id uuid;
  v_job_id uuid;
  v_prior_reports integer := 0;
  v_skills jsonb := '[]'::jsonb;
  v_progress jsonb := '[]'::jsonb;
  v_note text := btrim(coalesce(p_user_note,''));
  v_source text := lower(btrim(coalesce(p_source,'manual')));
begin
  if length(v_note) < 2 then
    return jsonb_build_object('accepted',false,'reason','user_note_required');
  end if;

  if v_source not in ('manual','auto') then
    v_source := 'manual';
  end if;

  select * into v_artifact
  from growth_control.personal_artifacts
  where id=p_artifact_id
    and person_id=p_person_id
    and project_key='growth-brain'
    and status='current'
  for update;

  if not found then
    return jsonb_build_object('accepted',false,'reason','current_artifact_required');
  end if;

  perform growth_control.artifact_evidence_progress_ensure_v1(p_person_id,p_artifact_id);

  select * into v_stage
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id
    and person_id=p_person_id
    and status='pending'
  order by criterion_no
  limit 1;

  if not found then
    return jsonb_build_object('accepted',false,'reason','artifact_ready_to_complete');
  end if;

  select * into v_existing
  from growth_control.artifact_stage_friction
  where artifact_id=p_artifact_id
    and criterion_no=v_stage.criterion_no
    and status in ('reported','diagnosing','reviewing')
  order by created_at desc
  limit 1
  for update;

  if found then
    update growth_control.artifact_stage_friction
    set
      signal_count=signal_count+1,
      signals=signals||jsonb_build_array(jsonb_build_object(
        'note',v_note,
        'source',v_source,
        'at',now()
      )),
      updated_at=now()
    where id=v_existing.id
    returning id into v_friction_id;

    return jsonb_build_object(
      'accepted',true,
      'friction_id',v_friction_id,
      'status',v_existing.status,
      'already_analyzing',true,
      'signal_count',v_existing.signal_count+1
    );
  end if;

  select count(*) into v_prior_reports
  from growth_control.artifact_stage_friction
  where artifact_id=p_artifact_id
    and criterion_no=v_stage.criterion_no;

  select coalesce(jsonb_agg(jsonb_build_object(
    'skill_key',skill_key,
    'name_zh',name_zh,
    'skill_kind',skill_kind,
    'evidence_state',evidence_state,
    'minimum_needed_now',minimum_needed_now
  ) order by skill_kind,name_zh),'[]'::jsonb)
  into v_skills
  from growth_control.artifact_skill_targets
  where artifact_id=p_artifact_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'criterion_no',criterion_no,
    'criterion_text',criterion_text,
    'status',status
  ) order by criterion_no),'[]'::jsonb)
  into v_progress
  from growth_control.artifact_evidence_progress
  where artifact_id=p_artifact_id
    and person_id=p_person_id;

  insert into growth_control.artifact_stage_friction(
    person_id,project_key,artifact_id,criterion_no,criterion_text,
    source,status,user_note,signal_count,signals
  ) values (
    p_person_id,v_artifact.project_key,p_artifact_id,v_stage.criterion_no,v_stage.criterion_text,
    v_source,'reported',v_note,1,
    jsonb_build_array(jsonb_build_object('note',v_note,'source',v_source,'at',now()))
  )
  returning id into v_friction_id;

  insert into growth_control.ai_jobs(
    person_id,project_key,source_kind,source_ref,data_scope,task_type,task_payload,
    provider_key,status,provenance,idempotency_key
  ) values (
    p_person_id,
    v_artifact.project_key,
    'artifact_stage_friction',
    'friction:'||v_friction_id::text,
    'real',
    'artifact_stage_unblock_diagnosis',
    jsonb_build_object(
      'friction_id',v_friction_id,
      'instruction',
        '你是 Goal Closure Operator（達案執行官）。只診斷使用者目前作品的「這一個階段」為什麼卡住，並把它縮成最小可執行下一步。不要因為卡住就判定能力下降，不要重做整條主線。若同一階段反覆卡住，才考慮把此階段拆成更小步驟。請輸出純 JSON：{"blockage_type":"knowledge_gap|goal_unclear|execution_gap|tool_problem|scope_too_large|evidence_unclear|missing_information|other","why":"","smallest_next_action":"","explain_now":[],"needs_learning":false,"learning_target":null,"recommended_specialist":null,"should_split_stage":false,"split_steps":[],"confidence":"low|medium|high"}',
      'input',jsonb_build_object(
        'artifact',jsonb_build_object(
          'id',v_artifact.id,
          'title',v_artifact.title,
          'objective',v_artifact.objective,
          'deliverable',v_artifact.deliverable
        ),
        'current_stage',jsonb_build_object(
          'criterion_no',v_stage.criterion_no,
          'criterion_text',v_stage.criterion_text
        ),
        'user_note',v_note,
        'prior_reports_same_stage',v_prior_reports,
        'progress',v_progress,
        'skills',v_skills,
        'rules',jsonb_build_object(
          'delay_alone_is_not_skill_failure',true,
          'do_not_change_mastery',true,
          'stay_on_current_stage_first',true,
          'prefer_smallest_next_action',true
        )
      )
    ),
    'chatgpt_web_opencli',
    'pending',
    jsonb_build_object(
      'employee_key','goal-closure-operator',
      'employee_role','達案執行官',
      'collaboration_stage','specialist_diagnosis',
      'friction_id',v_friction_id
    ),
    'artifact-friction:'||v_friction_id::text||':diagnosis'
  )
  returning id into v_job_id;

  update growth_control.artifact_stage_friction
  set status='diagnosing',
      diagnosis_job_id=v_job_id,
      updated_at=now()
  where id=v_friction_id;

  return jsonb_build_object(
    'accepted',true,
    'friction_id',v_friction_id,
    'status','diagnosing',
    'criterion_no',v_stage.criterion_no,
    'criterion_text',v_stage.criterion_text,
    'diagnosis_job_id',v_job_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION growth_control.personal_artifacts_snapshot_v1(p_person_id uuid, p_project_key text DEFAULT 'growth-brain'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'growth_control', 'public'
AS $function$
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
    ),'[]'::jsonb) as links,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'criterion_no',p.criterion_no,
        'criterion_text',p.criterion_text,
        'status',p.status,
        'evidence',p.evidence,
        'confirmed_at',p.confirmed_at
      ) order by p.criterion_no)
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
    ),'[]'::jsonb) as evidence_progress,
    (
      select jsonb_build_object(
        'total',count(*),
        'confirmed',count(*) filter (where p.status='confirmed'),
        'remaining',count(*) filter (where p.status<>'confirmed')
      )
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
    ) as progress_summary,
    (
      select jsonb_build_object(
        'criterion_no',p.criterion_no,
        'criterion_text',p.criterion_text,
        'status',p.status
      )
      from growth_control.artifact_evidence_progress p
      where p.artifact_id=pa.id
        and p.person_id=pa.person_id
        and p.status='pending'
      order by p.criterion_no
      limit 1
    ) as next_evidence_item,
    (
      select jsonb_build_object(
        'id',f.id,
        'criterion_no',f.criterion_no,
        'criterion_text',f.criterion_text,
        'source',f.source,
        'status',f.status,
        'user_note',f.user_note,
        'signal_count',f.signal_count,
        'diagnosis_job_id',f.diagnosis_job_id,
        'review_job_id',f.review_job_id,
        'diagnosis',f.diagnosis,
        'final_guidance',f.final_guidance,
        'created_at',f.created_at,
        'updated_at',f.updated_at,
        'resolved_at',f.resolved_at
      )
      from growth_control.artifact_stage_friction f
      where f.artifact_id=pa.id
        and f.person_id=pa.person_id
      order by f.created_at desc
      limit 1
    ) as latest_unblock
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
  'sv','personal-artifacts-v4',
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
    'artifact_completion_requires_all_checklist_items',true,
    'completed_artifact_enqueues_next_candidate',true,
    'stage_friction_does_not_downgrade_skill',true,
    'stage_unblock_stays_local_before_replanning',true
  )
);
$function$;

CREATE OR REPLACE FUNCTION public.growth_artifact_stage_unblock_request_service_v1(p_auth_user_id uuid, p_artifact_id uuid, p_user_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person_id uuid;
begin
  v_person_id:=growth_control.resolve_single_user_v1(p_auth_user_id);

  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  return growth_control.artifact_stage_unblock_request_v1(
    v_person_id,
    p_artifact_id,
    p_user_note,
    'manual'
  );
end;
$function$;

revoke execute on function growth_control.artifact_stage_unblock_request_v1(uuid,uuid,text,text)
from public, anon, authenticated;

revoke execute on function public.growth_artifact_stage_unblock_request_service_v1(uuid,uuid,text)
from public, anon, authenticated;
grant execute on function public.growth_artifact_stage_unblock_request_service_v1(uuid,uuid,text)
to service_role;

drop trigger if exists trg_apply_artifact_stage_unblock_job_v1 on growth_control.ai_jobs;
CREATE TRIGGER trg_apply_artifact_stage_unblock_job_v1 AFTER UPDATE ON growth_control.ai_jobs FOR EACH ROW EXECUTE FUNCTION growth_control.apply_artifact_stage_unblock_job_v1();
