-- Growth Brain live migration mirror
-- Generated from supabase_migrations.schema_migrations.
-- Purpose: reproducible source mirror for growth_control history.
-- Do not edit this bundle by hand; regenerate from live migration history.
-- Migration count: 66
-- First: 20260926002315 require_verified_auth_person_mapping
-- Last: 20261003080229 add_skill_lifecycle_metrics_view

-- ============================================================================
-- 20260926002315 require_verified_auth_person_mapping
-- ============================================================================
create or replace function growth_control.home_snapshot_for_auth_user_v1(
      p_auth_user_id uuid,
      p_project_key text default 'growth-brain'::text,
      p_center_ref text default 'concept:synapse_graph'::text
    )
    returns jsonb
    language plpgsql
    set search_path to 'growth_control', 'public', 'auth'
    as $function$
    declare
      v_person_id uuid;
    begin
      select m.person_id
      into v_person_id
      from growth_control.auth_person_map m
      join auth.users u on u.id=m.auth_user_id
      where m.auth_user_id=p_auth_user_id
        and m.status='active'
        and m.verified_at is not null
      limit 1;

      if v_person_id is null then
        return jsonb_build_object(
          'authorized',false,
          'reason','no_active_verified_auth_person_mapping'
        );
      end if;

      return jsonb_build_object(
        'authorized',true,
        'snapshot',growth_control.growth_home_snapshot_v1(
          v_person_id,p_project_key,p_center_ref
        )
      );
    end;
    $function$;

    create or replace function public.growth_submit_learning_candidate_service_v1(
      p_auth_user_id uuid,
      p_unit_id uuid,
      p_response_text text
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path to 'public', 'growth_control', 'auth'
    as $function$
    declare
      v_person_id uuid;
      v_unit_person_id uuid;
      v_requested_evidence_type text;
      v_submission_id uuid;
    begin
      select m.person_id
      into v_person_id
      from growth_control.auth_person_map m
      join auth.users u on u.id=m.auth_user_id
      where m.auth_user_id=p_auth_user_id
        and m.status='active'
        and m.verified_at is not null
      limit 1;

      if v_person_id is null then
        return jsonb_build_object(
          'accepted',false,
          'reason','no_active_verified_auth_person_mapping'
        );
      end if;

      select s.person_id, u.expected_evidence_type
      into v_unit_person_id, v_requested_evidence_type
      from growth_control.learning_companion_units u
      join growth_control.learning_companion_sessions s on s.id=u.session_id
      where u.id=p_unit_id;

      if v_unit_person_id is null then
        return jsonb_build_object('accepted',false,'reason','unit_not_found');
      end if;

      if v_unit_person_id <> v_person_id then
        return jsonb_build_object('accepted',false,'reason','unit_not_owned_by_person');
      end if;

      if length(trim(coalesce(p_response_text,''))) < 6 then
        return jsonb_build_object('accepted',false,'reason','response_too_short');
      end if;

      insert into growth_control.learning_companion_submissions(
        person_id,auth_user_id,unit_id,response_text,requested_evidence_type,status
      ) values (
        v_person_id,p_auth_user_id,p_unit_id,trim(p_response_text),v_requested_evidence_type,'pending'
      )
      returning id into v_submission_id;

      return jsonb_build_object(
        'accepted',true,
        'submission_id',v_submission_id,
        'status','pending_review',
        'requested_evidence_type',v_requested_evidence_type
      );
    end;
    $function$;


-- ============================================================================
-- 20260926132819 add_learning_progress_ui_projection
-- ============================================================================
create or replace function growth_control.learning_progress_ui_projection_v1(p_person_id uuid)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with audit as (
  select growth_control.learning_state_evidence_audit_v1(p_person_id) as j
),
concepts as (
  select
    c->>'concept_key' as concept_key,
    coalesce((c->>'level')::int,0) as level,
    c->>'level_name' as level_name,
    coalesce((c->>'evidence_count')::bigint,0) as evidence_count,
    nullif(c->>'last_evidence_at','')::timestamptz as last_evidence_at,
    c->'latest_evidence' as latest_evidence,
    case
      when coalesce((c->>'evidence_count')::bigint,0)=0 then 'unverified'
      when coalesce((c->>'level')::int,0) <= 2 then 'forming'
      when coalesce((c->>'level')::int,0) <= 4 then 'can_explain'
      else 'can_apply'
    end as bucket
  from audit a
  cross join lateral jsonb_array_elements(coalesce(a.j->'concepts','[]'::jsonb)) c
),
card_spec as (
  select * from (values
    (1,'unverified','未驗證','還沒有你的學習證據','完成一次回答、測驗或實作，先留下第一筆可驗證證據'),
    (2,'forming','正在形成證據','已有互動，但證據尚不足以證明理解','補一筆較強的 paraphrase、quiz 或實作 evidence'),
    (3,'can_explain','能解釋','已有足以支持解釋或測驗層級的證據','把理解帶進一個實際任務，確認能否應用'),
    (4,'can_apply','能應用','已有 guided apply 或更高層級的實作證據','用獨立實作、真實作品或延遲回想持續驗證')
  ) as v(sort_no,key,label,description,next_action)
),
agg as (
  select
    bucket,
    count(*)::int as concept_count,
    sum(evidence_count)::bigint as evidence_count,
    max(last_evidence_at) as latest_evidence_at,
    jsonb_agg(
      jsonb_build_object(
        'concept_key',concept_key,
        'level',level,
        'level_name',level_name,
        'evidence_count',evidence_count,
        'last_evidence_at',last_evidence_at,
        'latest_evidence',latest_evidence
      )
      order by level desc, last_evidence_at desc nulls last, concept_key
    ) as concepts
  from concepts
  group by bucket
),
cards as (
  select jsonb_build_object(
    'key',s.key,
    'label',s.label,
    'description',s.description,
    'concept_count',coalesce(a.concept_count,0),
    'evidence_count',coalesce(a.evidence_count,0),
    'latest_evidence_at',a.latest_evidence_at,
    'concepts',coalesce(a.concepts,'[]'::jsonb),
    'next_action',s.next_action
  ) as card,
  s.sort_no,
  coalesce(a.concept_count,0) as concept_count
  from card_spec s
  left join agg a on a.bucket=s.key
),
summary as (
  select
    count(*)::int as concept_count,
    count(*) filter (where bucket='unverified')::int as unverified_count,
    count(*) filter (where bucket='forming')::int as forming_count,
    count(*) filter (where bucket='can_explain')::int as can_explain_count,
    count(*) filter (where bucket='can_apply')::int as can_apply_count
  from concepts
)
select jsonb_build_object(
  'sv','learning-progress-ui-projection-v1',
  'person_id',p_person_id,
  'policy',jsonb_build_object(
    'source','learning_state_evidence_audit_v1',
    'ai_explanation_counts_as_learning',false,
    'user_evidence_required',true,
    'ui_must_not_infer_beyond_evidence',true
  ),
  'summary',jsonb_build_object(
    'concept_count',(select concept_count from summary),
    'unverified_count',(select unverified_count from summary),
    'forming_count',(select forming_count from summary),
    'can_explain_count',(select can_explain_count from summary),
    'can_apply_count',(select can_apply_count from summary)
  ),
  'cards',(select jsonb_agg(card order by sort_no) from cards),
  'primary_card',(select card from cards where concept_count>0 order by sort_no limit 1),
  'next_action',
    case
      when (select unverified_count from summary)>0 then jsonb_build_object(
        'type','answer_one_learning_unit',
        'label','先留下第一筆真實學習證據',
        'success_evidence','一筆由使用者回答、測驗或操作產生並通過 review gate 的 evidence'
      )
      when (select forming_count from summary)>0 then jsonb_build_object(
        'type','strengthen_evidence',
        'label','補一筆更強的理解或測驗證據',
        'success_evidence','concept 升到 can_paraphrase 或 quiz_supported'
      )
      when (select can_explain_count from summary)>0 then jsonb_build_object(
        'type','apply_in_task',
        'label','把已能解釋的概念用到實際任務',
        'success_evidence','guided_apply 或 independent_apply evidence'
      )
      else jsonb_build_object(
        'type','retain_and_ship',
        'label','用真實作品與延遲回想繼續驗證',
        'success_evidence','retained、real_project 或 commercial_result evidence'
      )
    end,
  'generated_at',now()
);
$function$;

create or replace function growth_control.growth_home_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain',
  p_center_ref text default 'concept:synapse_graph'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with outcome as (
  select growth_control.outcome_snapshot_v1(p_person_id,p_project_key) as j
),
graph as (
  select growth_control.synapse_graph_payload_v1(p_person_id,p_center_ref,8) as j
),
learning_audit as (
  select growth_control.learning_state_evidence_audit_v1(p_person_id) as j
),
learning_ui as (
  select growth_control.learning_progress_ui_projection_v1(p_person_id) as j
),
last_completed_ceo as (
  select jsonb_build_object(
    'task_ref',task_ref,
    'task_summary',task_summary,
    'escalation_required',escalation_required,
    'review_required',review_required,
    'result',result,
    'updated_at',updated_at
  ) as j
  from growth_control.ceo_runs
  where person_id=p_person_id and project_key=p_project_key and status='completed'
  order by updated_at desc limit 1
),
active_or_blocked_ceo as (
  select jsonb_build_object(
    'task_ref',task_ref,'task_summary',task_summary,'status',status,
    'selected_skills',selected_skills,'selected_resources',selected_resources,
    'skill_gaps',skill_gaps,'capability_gaps',capability_gaps,
    'escalation_required',escalation_required,'review_required',review_required,
    'plan',plan,'result',result
  ) as j
  from growth_control.ceo_runs
  where person_id=p_person_id and project_key=p_project_key and status in ('running','blocked')
  order by updated_at desc limit 1
),
current_step as (
  select (o.j->'current_step') as j from outcome o
),
access_state as (
  select exists(
    select 1 from growth_control.auth_person_map m
    where m.person_id=p_person_id and m.status='active' and m.verified_at is not null
  ) as browser_ready
)
select jsonb_build_object(
  'sv','growth-home-snapshot-v1',
  'project',p_project_key,
  'direction',jsonb_build_object(
    'title',(select j->'route'->>'target_title' from outcome),
    'description',(select j->'route'->>'target_description' from outcome),
    'status',(select j->'route'->>'target_status' from outcome),
    'confidence',(select (j->'route'->>'target_confidence')::numeric from outcome)
  ),
  'current',jsonb_build_object(
    'stage',(select j->>'stage' from current_step),
    'status',(select j->>'status' from current_step),
    'title',(select j->>'title' from current_step),
    'objective',(select j->>'objective' from current_step),
    'why_now',(select j->>'why_now' from current_step),
    'capability_focus',(select j->'capability_focus' from current_step),
    'friction_policy',(select j->'friction_policy' from current_step),
    'evidence',(select j->'evidence' from current_step)
  ),
  'next_action',jsonb_build_object(
    'type',case when (select j->>'status' from current_step)='blocked' then 'resolve_blocker' else 'complete_current_artifact' end,
    'title',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'code' from current_step),'blocked')
      else (select j->>'title' from current_step) end,
    'action',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'next_action' from current_step),(select j->>'objective' from current_step))
      else (select j->>'objective' from current_step) end,
    'why',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'reason' from current_step),(select j->>'why_now' from current_step))
      else (select j->>'why_now' from current_step) end
  ),
  'ladder',(select j->'ladder' from outcome),
  'synapse',(select j from graph),
  'learning',coalesce((select j from learning_audit),'{}'::jsonb)
    || jsonb_build_object('progress_ui',(select j from learning_ui)),
  'ceo',jsonb_build_object(
    'active_or_blocked',(select j from active_or_blocked_ceo),
    'last_completed',(select j from last_completed_ceo)
  ),
  'access',jsonb_build_object(
    'scope','private_control_plane',
    'browser_ready',(select browser_ready from access_state),
    'reason',case when (select browser_ready from access_state)
      then 'active_verified_auth_person_mapping_present'
      else 'no_active_verified_auth_person_mapping' end
  )
);
$function$;


-- ============================================================================
-- 20260926133026 prefer_current_outcome_step_status
-- ============================================================================
create or replace function growth_control.outcome_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with r as (
  select *
  from growth_control.outcome_routes
  where person_id=p_person_id
    and project_key=p_project_key
    and status='active'
  order by updated_at desc
  limit 1
),
steps as (
  select s.*
  from growth_control.outcome_steps s
  join r on r.id=s.route_id
),
current_step as (
  select s.*
  from steps s
  order by
    case
      when s.status='current' then 0
      when s.step_key=(select current_step_key from r) then 1
      else 2
    end,
    s.sequence_no desc,
    s.updated_at desc
  limit 1
)
select jsonb_build_object(
  'sv','growth-outcome-snapshot-v1',
  'route',(
    select jsonb_build_object(
      'route_key',route_key,
      'target_title',target_title,
      'target_description',target_description,
      'target_status',target_status,
      'target_confidence',target_confidence,
      'selection_policy',selection_policy,
      'version',version
    ) from r
  ),
  'current_step',(
    select jsonb_build_object(
      'step_key',step_key,
      'stage',stage_code,
      'title',title,
      'objective',objective,
      'why_now',why_now,
      'completion_criteria',completion_criteria,
      'capability_focus',capability_focus,
      'friction_policy',friction_policy,
      'role_plan',role_plan,
      'score',score,
      'status',status,
      'evidence',evidence
    ) from current_step
  ),
  'ladder',coalesce((
    select jsonb_agg(jsonb_build_object(
      'step_key',step_key,
      'stage',stage_code,
      'title',title,
      'status',status
    ) order by sequence_no)
    from steps
  ),'[]'::jsonb)
);
$function$;


-- ============================================================================
-- 20260926133642 create_learning_next_evidence_action
-- ============================================================================
create or replace function growth_control.learning_next_evidence_action_v1(p_person_id uuid)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with evidence as (
  select concept_key, count(*)::int as evidence_count, max(created_at) as last_evidence_at
  from public.growth_learning_evidence
  where person_id=p_person_id
  group by concept_key
),
submission_state as (
  select
    unit_id,
    count(*)::int as submission_count,
    count(*) filter (where status in ('pending','accepted','promoted'))::int as open_or_passed_count,
    (array_agg(status order by created_at desc))[1] as latest_submission_status
  from growth_control.learning_companion_submissions
  where person_id=p_person_id
  group by unit_id
),
candidates as (
  select
    u.id as unit_id,
    u.concept_key,
    u.teaching_mode,
    u.relevance_now::numeric as relevance_now,
    u.interaction_prompt,
    u.expected_evidence_type,
    u.presentation,
    u.transcript_provenance,
    u.source_confidence::numeric as source_confidence,
    u.sequence_no,
    coalesce(e.evidence_count,0) as evidence_count,
    coalesce(ss.submission_count,0) as submission_count,
    coalesce(ss.open_or_passed_count,0) as open_or_passed_count,
    ss.latest_submission_status,
    case u.expected_evidence_type
      when 'independent_apply' then 0
      when 'guided_apply' then 1
      when 'quiz' then 2
      when 'paraphrase' then 3
      when 'acknowledged' then 4
      when 'exposure' then 5
      else 6
    end as evidence_strength_rank
  from growth_control.learning_companion_units u
  join growth_control.learning_companion_sessions s on s.id=u.session_id
  left join evidence e on e.concept_key=u.concept_key
  left join submission_state ss on ss.unit_id=u.id
  where s.person_id=p_person_id
    and u.status='ready'
    and u.need_state='now'
),
picked as (
  select *
  from candidates
  order by
    case when evidence_count=0 then 0 else 1 end,
    case when open_or_passed_count=0 then 0 else 1 end,
    case when submission_count=0 then 0 else 1 end,
    evidence_strength_rank,
    relevance_now desc,
    sequence_no
  limit 1
)
select coalesce((
  select jsonb_build_object(
    'sv','learning-next-evidence-action-v1',
    'unit_id',unit_id,
    'concept_key',concept_key,
    'title',coalesce(presentation->>'title', concept_key),
    'prompt',interaction_prompt,
    'teaching_mode',teaching_mode,
    'expected_evidence_type',expected_evidence_type,
    'relevance_now',relevance_now,
    'current_evidence_count',evidence_count,
    'prior_submission_count',submission_count,
    'latest_submission_status',latest_submission_status,
    'provenance',jsonb_build_object(
      'transcript_provenance',transcript_provenance,
      'source_confidence',source_confidence
    ),
    'review_gate_required',true,
    'ai_explanation_counts_as_learning',false,
    'success_criterion',
      case expected_evidence_type
        when 'guided_apply' then '使用者把概念套到一個具體情境並提供可檢查的理由或驗收證據，且通過 review gate。'
        when 'independent_apply' then '使用者獨立完成實作並留下可重現或可檢查的結果，且通過 review gate。'
        when 'quiz' then '使用者自行作答並達到 review gate 的正確性門檻。'
        when 'paraphrase' then '使用者用自己的話解釋核心概念，不照抄來源，且通過 review gate。'
        else '使用者產生可驗證的互動證據並通過 review gate。'
      end
  )
  from picked
), jsonb_build_object(
  'sv','learning-next-evidence-action-v1',
  'status','no_ready_action',
  'reason','no_ready_now_learning_unit'
));
$function$;


-- ============================================================================
-- 20260926133705 expose_learning_next_action_in_growth_home
-- ============================================================================
create or replace function growth_control.growth_home_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain',
  p_center_ref text default 'concept:synapse_graph'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with outcome as (
  select growth_control.outcome_snapshot_v1(p_person_id,p_project_key) as j
),
graph as (
  select growth_control.synapse_graph_payload_v1(p_person_id,p_center_ref,8) as j
),
learning_audit as (
  select growth_control.learning_state_evidence_audit_v1(p_person_id) as j
),
learning_ui as (
  select growth_control.learning_progress_ui_projection_v1(p_person_id) as j
),
learning_next as (
  select growth_control.learning_next_evidence_action_v1(p_person_id) as j
),
last_completed_ceo as (
  select jsonb_build_object(
    'task_ref',task_ref,
    'task_summary',task_summary,
    'escalation_required',escalation_required,
    'review_required',review_required,
    'result',result,
    'updated_at',updated_at
  ) as j
  from growth_control.ceo_runs
  where person_id=p_person_id and project_key=p_project_key and status='completed'
  order by updated_at desc
  limit 1
),
active_or_blocked_ceo as (
  select jsonb_build_object(
    'task_ref',task_ref,
    'task_summary',task_summary,
    'status',status,
    'selected_skills',selected_skills,
    'selected_resources',selected_resources,
    'skill_gaps',skill_gaps,
    'capability_gaps',capability_gaps,
    'escalation_required',escalation_required,
    'review_required',review_required,
    'plan',plan,
    'result',result
  ) as j
  from growth_control.ceo_runs
  where person_id=p_person_id
    and project_key=p_project_key
    and status in ('running','blocked')
  order by updated_at desc
  limit 1
),
current_step as (
  select (o.j->'current_step') as j from outcome o
),
access_state as (
  select exists(
    select 1
    from growth_control.auth_person_map m
    where m.person_id=p_person_id
      and m.status='active'
      and m.verified_at is not null
  ) as browser_ready
)
select jsonb_build_object(
  'sv','growth-home-snapshot-v1',
  'project',p_project_key,
  'direction',jsonb_build_object(
    'title',(select j->'route'->>'target_title' from outcome),
    'description',(select j->'route'->>'target_description' from outcome),
    'status',(select j->'route'->>'target_status' from outcome),
    'confidence',(select (j->'route'->>'target_confidence')::numeric from outcome)
  ),
  'current',jsonb_build_object(
    'stage',(select j->>'stage' from current_step),
    'status',(select j->>'status' from current_step),
    'title',(select j->>'title' from current_step),
    'objective',(select j->>'objective' from current_step),
    'why_now',(select j->>'why_now' from current_step),
    'capability_focus',(select j->'capability_focus' from current_step),
    'friction_policy',(select j->'friction_policy' from current_step),
    'evidence',(select j->'evidence' from current_step)
  ),
  'next_action',jsonb_build_object(
    'type',case when (select j->>'status' from current_step)='blocked' then 'resolve_blocker' else 'complete_current_artifact' end,
    'title',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'code' from current_step),'blocked')
      else (select j->>'title' from current_step) end,
    'action',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'next_action' from current_step),(select j->>'objective' from current_step))
      else (select j->>'objective' from current_step) end,
    'why',case when (select j->>'status' from current_step)='blocked'
      then coalesce((select j->'evidence'->'blocker'->>'reason' from current_step),(select j->>'why_now' from current_step))
      else (select j->>'why_now' from current_step) end
  ),
  'ladder',(select j->'ladder' from outcome),
  'synapse',(select j from graph),
  'learning',
    coalesce((select j from learning_audit),'{}'::jsonb)
    || jsonb_build_object(
      'progress_ui',(select j from learning_ui),
      'next_evidence_action',(select j from learning_next)
    ),
  'ceo',jsonb_build_object(
    'active_or_blocked',(select j from active_or_blocked_ceo),
    'last_completed',(select j from last_completed_ceo)
  ),
  'access',jsonb_build_object(
    'scope','private_control_plane',
    'browser_ready',(select browser_ready from access_state),
    'reason',case when (select browser_ready from access_state)
      then 'active_verified_auth_person_mapping_present'
      else 'no_active_verified_auth_person_mapping' end
  )
);
$function$;


-- ============================================================================
-- 20260926162912 add_fixed_site_e2e_readiness_contract
-- ============================================================================
create or replace function growth_control.fixed_site_e2e_readiness_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public','auth'
as $$
with route as (
  select *
  from growth_control.outcome_routes
  where person_id=p_person_id
    and project_key=p_project_key
  order by (status='active') desc, updated_at desc
  limit 1
),
step as (
  select s.*
  from growth_control.outcome_steps s
  join route r on r.id=s.route_id
  where s.step_key='fixed-site-persistent-auth-e2e'
  order by s.updated_at desc
  limit 1
),
mapping as (
  select m.auth_user_id, m.verified_at
  from growth_control.auth_person_map m
  where m.person_id=p_person_id
    and m.status='active'
    and m.verified_at is not null
  order by m.verified_at desc
  limit 1
),
facts as (
  select
    exists(select 1 from mapping) as verified_mapping_exists,
    exists(
      select 1
      from mapping m
      join auth.users u on u.id=m.auth_user_id
    ) as mapped_auth_user_exists,
    to_regprocedure('growth_control.growth_home_snapshot_v1(uuid,text,text)') is not null as growth_home_contract_exists,
    to_regclass('growth_control.learning_companion_submissions') is not null as learning_submission_store_exists,
    exists(select 1 from step) as b18_exists,
    coalesce((select status='current' from step),false) as b18_is_current,
    coalesce((select evidence->'e2e' from step),'{}'::jsonb) as e2e
),
checks as (
  select * from facts
),
missing as (
  select jsonb_agg(label order by ord) as items
  from checks c
  cross join lateral (
    values
      (1,'fixed_https_origin', coalesce(c.e2e->'fixed_https_origin','false'::jsonb)='true'::jsonb),
      (2,'auth_redirect_fixed', coalesce(c.e2e->'auth_redirect_fixed','false'::jsonb)='true'::jsonb),
      (3,'reload_session_persists', coalesce(c.e2e->'reload_session_persists','false'::jsonb)='true'::jsonb),
      (4,'reopen_session_recovers', coalesce(c.e2e->'reopen_session_recovers','false'::jsonb)='true'::jsonb),
      (5,'authenticated_growth_home_get', coalesce(c.e2e->'authenticated_growth_home_get','false'::jsonb)='true'::jsonb),
      (6,'authenticated_learning_post', coalesce(c.e2e->'authenticated_learning_post','false'::jsonb)='true'::jsonb),
      (7,'frontend_secret_scan_passed', coalesce(c.e2e->'frontend_secret_scan_passed','false'::jsonb)='true'::jsonb)
  ) v(ord,label,passed)
  where not passed
)
select jsonb_build_object(
  'sv','fixed-site-e2e-readiness-v1',
  'project_key',p_project_key,
  'step_key','fixed-site-persistent-auth-e2e',
  'backend_preflight',jsonb_build_object(
    'mapped_auth_user_exists',c.mapped_auth_user_exists,
    'verified_mapping_exists',c.verified_mapping_exists,
    'growth_home_contract_exists',c.growth_home_contract_exists,
    'learning_submission_store_exists',c.learning_submission_store_exists
  ),
  'ready_for_browser_e2e',
    c.mapped_auth_user_exists
    and c.verified_mapping_exists
    and c.growth_home_contract_exists
    and c.learning_submission_store_exists
    and c.b18_exists
    and c.b18_is_current,
  'external_e2e',c.e2e,
  'acceptance_passed',
    coalesce(c.e2e->'fixed_https_origin','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'auth_redirect_fixed','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'reload_session_persists','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'reopen_session_recovers','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'authenticated_growth_home_get','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'authenticated_learning_post','false'::jsonb)='true'::jsonb
    and coalesce(c.e2e->'frontend_secret_scan_passed','false'::jsonb)='true'::jsonb,
  'missing_checks',coalesce((select items from missing),'[]'::jsonb),
  'policy',jsonb_build_object(
    'temporary_origin_counts',false,
    'relogin_counts_as_persistence',false,
    'synthetic_transport_counts_as_learning',false
  )
)
from checks c;
$$;

comment on function growth_control.fixed_site_e2e_readiness_v1(uuid,text)
is 'Machine-checkable B+18 readiness contract. Backend preflight is derived from DB truth; browser/deployment acceptance only passes when explicit external E2E evidence is recorded.';


-- ============================================================================
-- 20260926173130 add_outcome_step_evidence_patch_contract
-- ============================================================================
create or replace function growth_control.patch_outcome_step_evidence_v1(
  p_person_id uuid,
  p_project_key text,
  p_step_key text,
  p_patch jsonb
)
returns jsonb
language plpgsql
set search_path to 'growth_control','public'
as $function$
declare
  v_step growth_control.outcome_steps%rowtype;
  v_next jsonb;
begin
  select s.*
  into v_step
  from growth_control.outcome_steps s
  join growth_control.outcome_routes r on r.id=s.route_id
  where r.person_id=p_person_id
    and r.project_key=p_project_key
    and s.step_key=p_step_key
  order by (r.status='active') desc, s.updated_at desc
  limit 1;

  if v_step.id is null then
    raise exception 'outcome step not found';
  end if;

  v_next := coalesce(v_step.evidence,'{}'::jsonb) || (coalesce(p_patch,'{}'::jsonb) - 'e2e');

  if coalesce(p_patch,'{}'::jsonb) ? 'e2e' then
    v_next := jsonb_set(
      v_next,
      '{e2e}',
      coalesce(v_step.evidence->'e2e','{}'::jsonb) || coalesce(p_patch->'e2e','{}'::jsonb),
      true
    );
  end if;

  update growth_control.outcome_steps
  set evidence=v_next,
      updated_at=now()
  where id=v_step.id
  returning * into v_step;

  return jsonb_build_object(
    'sv','outcome-step-evidence-patch-v1',
    'project_key',p_project_key,
    'step_key',v_step.step_key,
    'status',v_step.status,
    'evidence',v_step.evidence,
    'updated_at',v_step.updated_at
  );
end;
$function$;


-- ============================================================================
-- 20260927231636 add_growth_brain_inbox_quick_capture_v1
-- ============================================================================
create table if not exists growth_control.inbox_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  project_key text not null default 'growth-brain',
  raw_content text not null,
  source_kind text not null default 'text' check (source_kind in ('text','link','idea')),
  source_url text,
  classification text check (classification is null or classification in ('knowledge','learning','project','action')),
  status text not null default 'inbox' check (status in ('inbox','classified','archived')),
  source_metadata jsonb not null default '{}'::jsonb,
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_items_person_project_created_idx
  on growth_control.inbox_items(person_id, project_key, created_at desc);

alter table growth_control.inbox_items enable row level security;
revoke all on growth_control.inbox_items from public, anon, authenticated;
grant select, insert, update, delete on growth_control.inbox_items to service_role;

create or replace function growth_control.inbox_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
) returns jsonb
language sql
stable
set search_path = growth_control, public
as $$
  select jsonb_build_object(
    'sv','inbox-snapshot-v1',
    'items',coalesce(jsonb_agg(
      jsonb_build_object(
        'id',id,
        'raw_content',raw_content,
        'source_kind',source_kind,
        'source_url',source_url,
        'classification',classification,
        'status',status,
        'source_metadata',source_metadata,
        'created_at',created_at,
        'updated_at',updated_at,
        'classified_at',classified_at
      ) order by created_at desc
    ) filter (where id is not null),'[]'::jsonb),
    'policy',jsonb_build_object(
      'allowed_classifications',jsonb_build_array('knowledge','learning','project','action'),
      'preserve_raw_source',true,
      'demo_is_formal_data',false
    )
  )
  from (
    select *
    from growth_control.inbox_items
    where person_id=p_person_id and project_key=p_project_key
    order by created_at desc
    limit 50
  ) s;
$$;

create or replace function growth_control.inbox_capture_v1(
  p_person_id uuid,
  p_project_key text,
  p_raw_content text,
  p_source_kind text default 'text',
  p_source_url text default null,
  p_source_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_item growth_control.inbox_items;
  v_kind text := coalesce(nullif(trim(p_source_kind),''),'text');
begin
  if p_person_id is null then raise exception 'person required'; end if;
  if length(trim(coalesce(p_raw_content,''))) < 1 then raise exception 'raw content required'; end if;
  if v_kind not in ('text','link','idea') then raise exception 'unsupported source kind'; end if;

  insert into growth_control.inbox_items(
    person_id,project_key,raw_content,source_kind,source_url,source_metadata
  ) values (
    p_person_id,coalesce(nullif(trim(p_project_key),''),'growth-brain'),
    trim(p_raw_content),v_kind,nullif(trim(coalesce(p_source_url,'')),''),
    coalesce(p_source_metadata,'{}'::jsonb)
  )
  returning * into v_item;

  return jsonb_build_object(
    'accepted',true,
    'item',jsonb_build_object(
      'id',v_item.id,
      'raw_content',v_item.raw_content,
      'source_kind',v_item.source_kind,
      'source_url',v_item.source_url,
      'classification',v_item.classification,
      'status',v_item.status,
      'created_at',v_item.created_at
    ),
    'snapshot',growth_control.inbox_snapshot_v1(p_person_id,coalesce(nullif(trim(p_project_key),''),'growth-brain'))
  );
end;
$$;

create or replace function growth_control.inbox_classify_v1(
  p_person_id uuid,
  p_project_key text,
  p_item_id uuid,
  p_classification text
) returns jsonb
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_class text := lower(trim(coalesce(p_classification,'')));
  v_count int;
begin
  if v_class not in ('knowledge','learning','project','action') then
    raise exception 'unsupported classification';
  end if;

  update growth_control.inbox_items
  set classification=v_class,status='classified',classified_at=now(),updated_at=now()
  where id=p_item_id
    and person_id=p_person_id
    and project_key=coalesce(nullif(trim(p_project_key),''),'growth-brain');

  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'inbox item not found'; end if;

  return jsonb_build_object(
    'accepted',true,
    'classification',v_class,
    'snapshot',growth_control.inbox_snapshot_v1(p_person_id,coalesce(nullif(trim(p_project_key),''),'growth-brain'))
  );
end;
$$;

create or replace function public.growth_inbox_snapshot_service_v1(
  p_auth_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare v_person_id uuid;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;
  return jsonb_build_object(
    'authorized',true,
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;

create or replace function public.growth_inbox_capture_service_v1(
  p_auth_user_id uuid,
  p_raw_content text,
  p_source_kind text default 'text',
  p_source_url text default null,
  p_source_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare v_person_id uuid;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;
  return growth_control.inbox_capture_v1(
    v_person_id,'growth-brain',p_raw_content,p_source_kind,p_source_url,p_source_metadata
  );
end;
$$;

create or replace function public.growth_inbox_classify_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid,
  p_classification text
) returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare v_person_id uuid;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;
  return growth_control.inbox_classify_v1(
    v_person_id,'growth-brain',p_item_id,p_classification
  );
end;
$$;

revoke all on function public.growth_inbox_snapshot_service_v1(uuid) from public, anon, authenticated;
revoke all on function public.growth_inbox_capture_service_v1(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.growth_inbox_classify_service_v1(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.growth_inbox_snapshot_service_v1(uuid) to service_role;
grant execute on function public.growth_inbox_capture_service_v1(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.growth_inbox_classify_service_v1(uuid,uuid,text) to service_role;


-- ============================================================================
-- 20260927231839 add_inbox_auth_user_id_v1
-- ============================================================================
alter table growth_control.inbox_items add column if not exists auth_user_id uuid;


-- ============================================================================
-- 20260928211511 routing_from_inbox_route_links
-- ============================================================================
create table if not exists growth_control.inbox_route_links (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  project_key text not null default 'growth-brain',
  inbox_item_id uuid not null references growth_control.inbox_items(id) on delete restrict,
  classification text not null,
  target_kind text not null,
  target_id uuid not null,
  target_ref text not null,
  provenance jsonb not null default '{}'::jsonb,
  routed_at timestamptz not null default now(),
  unique (inbox_item_id)
);


-- ============================================================================
-- 20260928211526 routing_from_inbox_route_links_constraints
-- ============================================================================
alter table growth_control.inbox_route_links
      add constraint inbox_route_links_classification_check
      check (classification in ('knowledge','learning','project','action'));
    alter table growth_control.inbox_route_links
      add constraint inbox_route_links_target_kind_check
      check (target_kind in ('personal_outcome_candidate','learning_session','growth_action','synapse_ingestion_candidate'));
    create index if not exists inbox_route_links_person_project_idx
      on growth_control.inbox_route_links(person_id, project_key, routed_at desc);
    alter table growth_control.inbox_route_links enable row level security;


-- ============================================================================
-- 20260928211536 routing_from_inbox_actions_table
-- ============================================================================
create table if not exists growth_control.growth_actions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  project_key text not null default 'growth-brain',
  title text not null,
  details text,
  status text not null default 'open',
  source_inbox_item_id uuid not null references growth_control.inbox_items(id) on delete restrict,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (source_inbox_item_id)
);


-- ============================================================================
-- 20260928211547 routing_from_inbox_actions_status_constraint
-- ============================================================================
alter table growth_control.growth_actions
  add constraint growth_actions_status_check
  check (status in ('open','completed','cancelled'));


-- ============================================================================
-- 20260928211554 routing_from_inbox_actions_index
-- ============================================================================
create index if not exists growth_actions_person_status_idx on growth_control.growth_actions(person_id, status, created_at desc);


-- ============================================================================
-- 20260928211631 routing_from_inbox_knowledge_candidates_table
-- ============================================================================
create table if not exists growth_control.knowledge_ingestion_candidates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  project_key text not null default 'growth-brain',
  raw_content text not null,
  source_kind text not null,
  source_url text,
  status text not null default 'pending_ingestion',
  source_inbox_item_id uuid not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 20260928211657 routing_from_inbox_knowledge_candidates_constraints
-- ============================================================================
alter table growth_control.knowledge_ingestion_candidates
  add constraint knowledge_ingestion_candidates_status_check
  check (status in ('pending_ingestion','ingested','rejected'));


-- ============================================================================
-- 20260928211705 routing_from_inbox_knowledge_candidates_indexes
-- ============================================================================
create unique index if not exists knowledge_ingestion_candidates_source_inbox_uidx
  on growth_control.knowledge_ingestion_candidates(source_inbox_item_id);


-- ============================================================================
-- 20260928211713 routing_from_inbox_knowledge_candidates_fk
-- ============================================================================
alter table growth_control.knowledge_ingestion_candidates
  add constraint knowledge_ingestion_candidates_source_inbox_fkey
  foreign key (source_inbox_item_id)
  references growth_control.inbox_items(id)
  on delete restrict;


-- ============================================================================
-- 20260928211734 routing_from_inbox_routes_snapshot_function
-- ============================================================================
create or replace function growth_control.inbox_routes_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path = growth_control, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'inbox_item_id',inbox_item_id,
    'classification',classification,
    'target_kind',target_kind,
    'target_id',target_id,
    'target_ref',target_ref,
    'provenance',provenance,
    'routed_at',routed_at
  ) order by routed_at desc),'[]'::jsonb)
  from growth_control.inbox_route_links
  where person_id=p_person_id and project_key=p_project_key;
$$;


-- ============================================================================
-- 20260928211908 routing_from_inbox_learning_service_wrapper
-- ============================================================================
create or replace function public.growth_learning_create_from_inbox_service_v1(
  p_auth_user_id uuid,
  p_inbox_item_id uuid,
  p_title text default null,
  p_goal text default null,
  p_source_language text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_session_id uuid;
  v_kind text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_inbox_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'learning' then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_learning');
  end if;

  v_kind := case when v_item.source_kind='link' then 'article' else 'chat' end;

  v_session_id := growth_control.learning_companion_create_v1(
    v_person_id,
    'growth-brain',
    v_kind,
    'inbox:'||v_item.id::text,
    coalesce(nullif(trim(p_source_language),''),'unknown'),
    coalesce(nullif(trim(p_title),''),left(v_item.raw_content,140)),
    nullif(trim(coalesce(p_goal,'')),''),
    case when v_item.source_url is null
      then array['inbox:'||v_item.id::text]
      else array['inbox:'||v_item.id::text,v_item.source_url]
    end,
    '[]'::jsonb
  );

  return jsonb_build_object('accepted',true,'session_id',v_session_id,'source_ref','inbox:'||v_item.id::text);
end;
$$;


-- ============================================================================
-- 20260928212148 routing_from_inbox_learning_wrapper_invoker_v2
-- ============================================================================
create or replace function public.growth_learning_create_from_inbox_service_v1(
  p_auth_user_id uuid,
  p_inbox_item_id uuid,
  p_title text default null,
  p_goal text default null,
  p_source_language text default 'unknown'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_session_id uuid;
  v_kind text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_inbox_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'learning' then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_learning');
  end if;

  v_kind := case when v_item.source_kind='link' then 'article' else 'chat' end;

  v_session_id := growth_control.learning_companion_create_v1(
    v_person_id,
    'growth-brain',
    v_kind,
    'inbox:'||v_item.id::text,
    coalesce(nullif(trim(p_source_language),''),'unknown'),
    coalesce(nullif(trim(p_title),''),left(v_item.raw_content,140)),
    nullif(trim(coalesce(p_goal,'')),''),
    case when v_item.source_url is null
      then array['inbox:'||v_item.id::text]
      else array['inbox:'||v_item.id::text,v_item.source_url]
    end,
    '[]'::jsonb
  );

  return jsonb_build_object('accepted',true,'session_id',v_session_id,'source_ref','inbox:'||v_item.id::text);
end;
$$;


-- ============================================================================
-- 20260928212336 routing_from_inbox_record_route_service
-- ============================================================================
create or replace function public.growth_record_inbox_route_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid,
  p_classification text,
  p_raw_content text,
  p_source_kind text,
  p_source_url text,
  p_source_metadata jsonb,
  p_target_kind text,
  p_target_id uuid,
  p_route_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_event_id uuid;
  v_source_type text;
  v_event_type text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  v_source_type := case p_classification
    when 'project' then 'inbox_project_route'
    when 'learning' then 'inbox_learning_route'
    when 'action' then 'inbox_action_candidate'
    when 'knowledge' then 'inbox_knowledge_candidate'
    else null
  end;
  if v_source_type is null then
    return jsonb_build_object('accepted',false,'reason','unsupported_classification');
  end if;

  v_event_type := case when p_classification='action' then 'action' else 'reference' end;

  v_event_id := public.growth_record_event_v1(
    v_person_id,
    v_event_type,
    v_source_type,
    'inbox:'||p_item_id::text,
    null,
    p_raw_content,
    array['inbox:'||p_item_id::text],
    jsonb_build_object(
      'classification',p_classification,
      'target_kind',p_target_kind,
      'target_id',p_target_id,
      'route_status',p_route_status,
      'provenance',jsonb_build_object(
        'inbox_item_id',p_item_id,
        'source_kind',p_source_kind,
        'source_url',p_source_url,
        'source_metadata',coalesce(p_source_metadata,'{}'::jsonb)
      )
    ),
    'observed',
    1.0,
    now()
  );

  return jsonb_build_object('accepted',true,'event_id',v_event_id);
end;
$$;


-- ============================================================================
-- 20260928212604 routing_from_inbox_snapshot_service_person
-- ============================================================================
create or replace function public.growth_inbox_snapshot_service_v1(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare v_person_id uuid;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;
  return jsonb_build_object(
    'authorized',true,
    'person_id',v_person_id,
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260928212838 routing_from_inbox_route_event_lookup
-- ============================================================================
create or replace function growth_control.inbox_route_event_v1(
  p_person_id uuid,
  p_item_id uuid
)
returns jsonb
language sql
stable
set search_path = public, growth_control
as $$
  select jsonb_build_object(
    'id',e.id,
    'classification',e.payload->>'classification',
    'target_kind',e.payload->>'target_kind',
    'target_id',coalesce(e.payload->>'target_id',e.id::text),
    'target_ref',coalesce(e.payload->>'target_kind','route')||':'||coalesce(e.payload->>'target_id',e.id::text),
    'provenance',coalesce(e.payload->'provenance','{}'::jsonb),
    'routed_at',e.created_at
  )
  from public.growth_events e
  where e.person_id=p_person_id
    and e.status='active'
    and e.source_ref='inbox:'||p_item_id::text
    and e.source_type in ('inbox_project_route','inbox_learning_route','inbox_action_candidate','inbox_knowledge_candidate')
  order by e.created_at desc
  limit 1;
$$;


-- ============================================================================
-- 20260928212850 routing_from_inbox_snapshot_projection
-- ============================================================================
create or replace function growth_control.inbox_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path = growth_control, public
as $$
  select jsonb_build_object(
    'sv','inbox-snapshot-v2',
    'items',coalesce(jsonb_agg(
      jsonb_build_object(
        'id',id,
        'raw_content',raw_content,
        'source_kind',source_kind,
        'source_url',source_url,
        'classification',classification,
        'status',status,
        'source_metadata',source_metadata,
        'created_at',created_at,
        'updated_at',updated_at,
        'classified_at',classified_at,
        'routing',growth_control.inbox_route_event_v1(p_person_id,id)
      ) order by created_at desc
    ) filter (where id is not null),'[]'::jsonb),
    'policy',jsonb_build_object(
      'allowed_classifications',jsonb_build_array('knowledge','learning','project','action'),
      'preserve_raw_source',true,
      'routing_is_explicit',true,
      'routing_provenance_source','growth_events',
      'classification_does_not_route',true,
      'demo_is_formal_data',false
    )
  )
  from (
    select *
    from growth_control.inbox_items
    where person_id=p_person_id and project_key=p_project_key
    order by created_at desc
    limit 50
  ) s;
$$;


-- ============================================================================
-- 20260928212900 routing_from_inbox_classification_lock_v2
-- ============================================================================
create or replace function growth_control.inbox_classify_v1(
  p_person_id uuid,
  p_project_key text,
  p_item_id uuid,
  p_classification text
)
returns jsonb
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_class text := lower(trim(coalesce(p_classification,'')));
  v_project text := coalesce(nullif(trim(p_project_key),''),'growth-brain');
  v_count int;
begin
  if v_class not in ('knowledge','learning','project','action') then
    raise exception 'unsupported classification';
  end if;

  if growth_control.inbox_route_event_v1(p_person_id,p_item_id) is not null then
    raise exception 'routed_item_classification_locked';
  end if;

  update growth_control.inbox_items
  set classification=v_class,status='classified',classified_at=now(),updated_at=now()
  where id=p_item_id
    and person_id=p_person_id
    and project_key=v_project;

  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'inbox item not found'; end if;

  return jsonb_build_object(
    'accepted',true,
    'classification',v_class,
    'snapshot',growth_control.inbox_snapshot_v1(p_person_id,v_project)
  );
end;
$$;


-- ============================================================================
-- 20260928213457 routing_from_inbox_harden_inbox_snapshot_user_call
-- ============================================================================
create or replace function public.growth_inbox_snapshot_service_v1(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_caller uuid := auth.uid();
begin
  if v_caller is not null and v_caller <> p_auth_user_id then
    return jsonb_build_object('authorized',false,'reason','auth_user_mismatch');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;

  return jsonb_build_object(
    'authorized',true,
    'person_id',v_person_id,
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260928213609 routing_from_inbox_two_stage_classify_route
-- ============================================================================
create or replace function growth_control.inbox_classify_v1(
  p_person_id uuid,
  p_project_key text,
  p_item_id uuid,
  p_classification text
)
returns jsonb
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_class text := lower(trim(coalesce(p_classification,'')));
  v_project text := coalesce(nullif(trim(p_project_key),''),'growth-brain');
  v_item growth_control.inbox_items;
  v_existing_route jsonb;
  v_target_kind text;
  v_target_id uuid;
  v_route_status text;
  v_source_type text;
  v_event_id uuid;
begin
  if v_class not in ('knowledge','learning','project','action') then
    raise exception 'unsupported classification';
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=p_person_id and project_key=v_project
  for update;

  if v_item.id is null then
    raise exception 'inbox item not found';
  end if;

  v_existing_route := growth_control.inbox_route_event_v1(p_person_id,p_item_id);
  if v_existing_route is not null then
    if v_item.classification <> v_class then
      raise exception 'routed_item_classification_locked';
    end if;
    return jsonb_build_object(
      'accepted',true,
      'already_routed',true,
      'routing',v_existing_route,
      'snapshot',growth_control.inbox_snapshot_v1(p_person_id,v_project)
    );
  end if;

  if v_item.classification = v_class and v_item.status='classified' then
    if v_class='project' then
      select id into v_target_id
      from growth_control.personal_outcome_routes
      where person_id=p_person_id
        and project_key=v_project
        and status='candidate'
      order by updated_at desc
      limit 1;

      if v_target_id is null then
        raise exception 'project_candidate_required_before_routing';
      end if;
      v_target_kind := 'personal_outcome_candidate';
      v_route_status := 'candidate';
      v_source_type := 'inbox_project_route';

    elsif v_class='learning' then
      v_target_kind := 'learning_source';
      v_route_status := 'pending_session';
      v_source_type := 'inbox_learning_route';

    elsif v_class='action' then
      v_target_kind := 'growth_action';
      v_route_status := 'open';
      v_source_type := 'inbox_action_candidate';

    else
      v_target_kind := 'synapse_ingestion_candidate';
      v_route_status := 'pending_ingestion';
      v_source_type := 'inbox_knowledge_candidate';
    end if;

    v_event_id := public.growth_record_event_v1(
      p_person_id,
      case when v_class='action' then 'action' else 'reference' end,
      v_source_type,
      'inbox:'||v_item.id::text,
      null,
      v_item.raw_content,
      array['inbox:'||v_item.id::text],
      jsonb_build_object(
        'classification',v_class,
        'target_kind',v_target_kind,
        'target_id',v_target_id,
        'route_status',v_route_status,
        'provenance',jsonb_build_object(
          'inbox_item_id',v_item.id,
          'source_kind',v_item.source_kind,
          'source_url',v_item.source_url,
          'source_metadata',v_item.source_metadata,
          'original_created_at',v_item.created_at
        )
      ),
      'observed',
      1.0,
      now()
    );

    return jsonb_build_object(
      'accepted',true,
      'routed',true,
      'route_event_id',v_event_id,
      'routing',growth_control.inbox_route_event_v1(p_person_id,p_item_id),
      'snapshot',growth_control.inbox_snapshot_v1(p_person_id,v_project)
    );
  end if;

  update growth_control.inbox_items
  set classification=v_class,status='classified',classified_at=now(),updated_at=now()
  where id=p_item_id and person_id=p_person_id and project_key=v_project;

  return jsonb_build_object(
    'accepted',true,
    'classified',true,
    'classification',v_class,
    'snapshot',growth_control.inbox_snapshot_v1(p_person_id,v_project)
  );
end;
$$;


-- ============================================================================
-- 20260928214323 routing_actions_rls_v1
-- ============================================================================
alter table growth_control.growth_actions enable row level security;


-- ============================================================================
-- 20260928214438 routing_link_projection_v1
-- ============================================================================
create or replace function growth_control.inbox_route_event_v1(
  p_person_id uuid,
  p_item_id uuid
)
returns jsonb
language sql
stable
set search_path = growth_control, public
as $$
  select jsonb_build_object(
    'id',r.id,
    'classification',r.classification,
    'target_kind',r.target_kind,
    'target_id',r.target_id,
    'target_ref',r.target_ref,
    'provenance',r.provenance,
    'routed_at',r.routed_at,
    'status','routed'
  )
  from growth_control.inbox_route_links r
  where r.person_id=p_person_id and r.inbox_item_id=p_item_id
  order by r.routed_at desc
  limit 1;
$$;


-- ============================================================================
-- 20260928214559 routing_event_projection_restore_v1
-- ============================================================================
create or replace function growth_control.inbox_route_event_v1(
  p_person_id uuid,
  p_item_id uuid
)
returns jsonb
language sql
stable
set search_path = public, growth_control
as $$
  select jsonb_build_object(
    'id',e.id,
    'classification',e.payload->>'classification',
    'target_kind',e.payload->>'target_kind',
    'target_id',coalesce(e.payload->>'target_id',e.id::text),
    'target_ref',coalesce(e.payload->>'target_kind','route')||':'||coalesce(e.payload->>'target_id',e.id::text),
    'provenance',coalesce(e.payload->'provenance','{}'::jsonb),
    'routed_at',e.created_at,
    'status','routed'
  )
  from public.growth_events e
  where e.person_id=p_person_id
    and e.status='active'
    and e.source_ref='inbox:'||p_item_id::text
    and e.source_type in ('inbox_project_route','inbox_learning_route','inbox_action_candidate','inbox_knowledge_candidate')
  order by e.created_at desc
  limit 1;
$$;


-- ============================================================================
-- 20260928214626 routing_event_status_projection_v1
-- ============================================================================
create or replace function growth_control.inbox_route_event_v1(
  p_person_id uuid,
  p_item_id uuid
)
returns jsonb
language sql
stable
set search_path = public, growth_control
as $$
  select jsonb_build_object(
    'id',e.id,
    'classification',e.payload->>'classification',
    'target_kind',e.payload->>'target_kind',
    'target_id',coalesce(e.payload->>'target_id',e.id::text),
    'target_ref',coalesce(e.payload->>'target_kind','route')||':'||coalesce(e.payload->>'target_id',e.id::text),
    'route_status',coalesce(e.payload->>'route_status','routed'),
    'provenance',coalesce(e.payload->'provenance','{}'::jsonb),
    'routed_at',e.created_at,
    'status','routed'
  )
  from public.growth_events e
  where e.person_id=p_person_id
    and e.status='active'
    and e.source_ref='inbox:'||p_item_id::text
    and e.source_type in ('inbox_project_route','inbox_learning_route','inbox_action_candidate','inbox_knowledge_candidate')
  order by e.created_at desc
  limit 1;
$$;


-- ============================================================================
-- 20260928214727 routing_simple_user_rpc_v1
-- ============================================================================
create or replace function public.growth_route_simple_inbox_user_v1(
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_existing jsonb;
  v_target_kind text;
  v_route_status text;
  v_route jsonb;
begin
  if v_auth_user_id is null then
    return jsonb_build_object('accepted',false,'reason','authentication_required');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(v_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;

  v_existing := growth_control.inbox_route_event_v1(v_person_id,p_item_id);
  if v_existing is not null then
    return jsonb_build_object(
      'accepted',true,'idempotent',true,'route',v_existing,
      'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
    );
  end if;

  if v_item.classification='action' then
    v_target_kind := 'growth_action';
    v_route_status := 'open';
  elsif v_item.classification='knowledge' then
    v_target_kind := 'synapse_ingestion_candidate';
    v_route_status := 'pending_ingestion';
  else
    return jsonb_build_object('accepted',false,'reason','simple_route_requires_action_or_knowledge');
  end if;

  v_route := public.growth_record_inbox_route_service_v1(
    v_auth_user_id,v_item.id,v_item.classification,v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    v_target_kind,null,v_route_status
  );

  return jsonb_build_object(
    'accepted',coalesce((v_route->>'accepted')::boolean,false),
    'idempotent',false,
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260928214742 routing_project_user_rpc_v1
-- ============================================================================
create or replace function public.growth_route_project_inbox_user_v1(
  p_item_id uuid,
  p_title text,
  p_success_evidence text,
  p_why_now text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_existing jsonb;
  v_outcome jsonb;
  v_created jsonb;
  v_route jsonb;
  v_target_id uuid;
  v_title text := trim(coalesce(p_title,''));
  v_success text := trim(coalesce(p_success_evidence,''));
begin
  if v_auth_user_id is null then
    return jsonb_build_object('accepted',false,'reason','authentication_required');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(v_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'project' then
    return jsonb_build_object('accepted',false,'reason','project_classification_required');
  end if;

  v_existing := growth_control.inbox_route_event_v1(v_person_id,p_item_id);
  if v_existing is not null then
    return jsonb_build_object(
      'accepted',true,'idempotent',true,'route',v_existing,
      'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
    );
  end if;

  if length(v_title) < 3 then
    v_title := left(v_item.raw_content,160);
  end if;
  if length(v_success) < 3 then
    return jsonb_build_object('accepted',false,'reason','project_success_evidence_required');
  end if;

  v_outcome := growth_control.personal_outcome_snapshot_v1(v_person_id,'growth-brain');
  if v_outcome->'candidate_route' is not null then
    return jsonb_build_object(
      'accepted',false,
      'reason','personal_candidate_already_exists',
      'existing_candidate_id',v_outcome#>>'{candidate_route,id}'
    );
  end if;

  v_created := public.growth_personal_outcome_save_candidate_service_v1(
    v_auth_user_id,v_title,v_success,p_why_now,null
  );
  if coalesce((v_created->>'accepted')::boolean,false) is false then
    return v_created;
  end if;

  v_target_id := nullif(v_created#>>'{snapshot,candidate_route,id}','')::uuid;

  v_route := public.growth_record_inbox_route_service_v1(
    v_auth_user_id,v_item.id,'project',v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    'personal_outcome_candidate',v_target_id,'created'
  );

  return jsonb_build_object(
    'accepted',true,
    'idempotent',false,
    'target_id',v_target_id,
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain'),
    'personal_outcome',v_created->'snapshot'
  );
end;
$$;


-- ============================================================================
-- 20260928214753 routing_learning_user_rpc_v1
-- ============================================================================
create or replace function public.growth_route_learning_inbox_user_v1(
  p_item_id uuid,
  p_title text default null,
  p_goal text default null,
  p_source_language text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = public, growth_control, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_existing jsonb;
  v_created jsonb;
  v_route jsonb;
  v_target_id uuid;
  v_title text;
begin
  if v_auth_user_id is null then
    return jsonb_build_object('accepted',false,'reason','authentication_required');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(v_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'learning' then
    return jsonb_build_object('accepted',false,'reason','learning_classification_required');
  end if;

  v_existing := growth_control.inbox_route_event_v1(v_person_id,p_item_id);
  if v_existing is not null then
    return jsonb_build_object(
      'accepted',true,'idempotent',true,'route',v_existing,
      'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
    );
  end if;

  v_title := coalesce(nullif(trim(coalesce(p_title,'')),''),left(v_item.raw_content,160));

  v_created := public.growth_learning_create_from_inbox_service_v1(
    v_auth_user_id,v_item.id,v_title,p_goal,coalesce(nullif(trim(p_source_language),''),'unknown')
  );
  if coalesce((v_created->>'accepted')::boolean,false) is false then
    return v_created;
  end if;

  v_target_id := nullif(v_created->>'session_id','')::uuid;

  v_route := public.growth_record_inbox_route_service_v1(
    v_auth_user_id,v_item.id,'learning',v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    'learning_session',v_target_id,'created'
  );

  return jsonb_build_object(
    'accepted',true,
    'idempotent',false,
    'target_id',v_target_id,
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain'),
    'learning',v_created
  );
end;
$$;


-- ============================================================================
-- 20260928215459 routing_simple_service_v1
-- ============================================================================
create or replace function public.growth_route_simple_inbox_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_existing jsonb;
  v_target_kind text;
  v_route_status text;
  v_route jsonb;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;

  v_existing := growth_control.inbox_route_event_v1(v_person_id,p_item_id);
  if v_existing is not null then
    return jsonb_build_object(
      'accepted',true,'idempotent',true,'route',v_existing,
      'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
    );
  end if;

  if v_item.classification='action' then
    v_target_kind := 'growth_action';
    v_route_status := 'open';
  elsif v_item.classification='knowledge' then
    v_target_kind := 'synapse_ingestion_candidate';
    v_route_status := 'pending_ingestion';
  else
    return jsonb_build_object('accepted',false,'reason','simple_route_requires_action_or_knowledge');
  end if;

  v_route := public.growth_record_inbox_route_service_v1(
    p_auth_user_id,v_item.id,v_item.classification,v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    v_target_kind,null,v_route_status
  );

  return jsonb_build_object(
    'accepted',true,
    'idempotent',false,
    'target_kind',v_target_kind,
    'target_id',v_route->>'event_id',
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260928215712 project_route_confirm_service_v1
-- ============================================================================
create or replace function public.growth_project_route_confirm_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_target_id uuid;
  v_route jsonb;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null or v_item.classification <> 'project' then
    return jsonb_build_object('accepted',false,'reason','project_inbox_item_required');
  end if;

  select id into v_target_id
  from growth_control.personal_outcome_routes
  where person_id=v_person_id and project_key='growth-brain' and status='candidate'
  order by updated_at desc
  limit 1;

  if v_target_id is null then
    return jsonb_build_object('accepted',false,'reason','project_candidate_required_before_route');
  end if;

  v_route := public.growth_record_inbox_route_service_v1(
    p_auth_user_id,v_item.id,'project',v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    'personal_outcome_candidate',v_target_id,'created'
  );

  return jsonb_build_object(
    'accepted',true,
    'target_kind','personal_outcome_candidate',
    'target_id',v_target_id,
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260928215837 materialize_learning_route_session_v1
-- ============================================================================
create or replace function growth_control.materialize_learning_route_session_v1()
returns trigger
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_item_id uuid;
  v_item growth_control.inbox_items;
  v_session_id uuid;
  v_source_kind text;
begin
  if new.source_type <> 'inbox_learning_route'
     or coalesce(new.payload->>'route_status','') <> 'pending_session' then
    return new;
  end if;

  v_item_id := nullif(new.payload#>>'{provenance,inbox_item_id}','')::uuid;

  select * into v_item
  from growth_control.inbox_items
  where id=v_item_id and person_id=new.person_id;

  if v_item.id is null then
    return new;
  end if;

  v_source_kind := case when v_item.source_kind='link' then 'article' else 'chat' end;

  v_session_id := growth_control.learning_companion_create_v1(
    new.person_id,
    v_item.project_key,
    v_source_kind,
    'inbox:'||v_item.id::text,
    'unknown',
    left(v_item.raw_content,160),
    null,
    case
      when v_item.source_url is null then array['inbox:'||v_item.id::text]
      else array['inbox:'||v_item.id::text,v_item.source_url]
    end,
    '[]'::jsonb
  );

  new.payload := coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
    'target_kind','learning_session',
    'target_id',v_session_id,
    'route_status','created'
  );

  return new;
end;
$$;

create trigger growth_events_materialize_learning_route
before insert on public.growth_events
for each row
when (new.source_type = 'inbox_learning_route')
execute function growth_control.materialize_learning_route_session_v1();


-- ============================================================================
-- 20260928220155 exclude_validation_rows_from_inbox_snapshot_v1
-- ============================================================================
create or replace function growth_control.inbox_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path = growth_control, public
as $$
  select jsonb_build_object(
    'sv','inbox-snapshot-v2',
    'items',coalesce(jsonb_agg(
      jsonb_build_object(
        'id',id,
        'raw_content',raw_content,
        'source_kind',source_kind,
        'source_url',source_url,
        'classification',classification,
        'status',status,
        'source_metadata',source_metadata,
        'created_at',created_at,
        'updated_at',updated_at,
        'classified_at',classified_at,
        'routing',growth_control.inbox_route_event_v1(p_person_id,id)
      ) order by created_at desc
    ) filter (where id is not null),'[]'::jsonb),
    'policy',jsonb_build_object(
      'allowed_classifications',jsonb_build_array('knowledge','learning','project','action'),
      'preserve_raw_source',true,
      'routing_is_explicit',true,
      'routing_provenance_source','growth_events',
      'classification_does_not_route',true,
      'validation_rows_visible',false,
      'demo_is_formal_data',false
    )
  )
  from (
    select *
    from growth_control.inbox_items
    where person_id=p_person_id
      and project_key=p_project_key
      and coalesce(source_metadata->>'validation','')=''
    order by created_at desc
    limit 50
  ) s;
$$;


-- ============================================================================
-- 20260928220243 routing_learning_validation_contract_v1
-- ============================================================================
create or replace function growth_control.validate_learning_inbox_route_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language plpgsql
set search_path = growth_control, public
as $$
declare
  v_item_id uuid;
  v_first jsonb;
  v_second jsonb;
  v_route jsonb;
  v_result jsonb;
begin
  begin
    v_item_id := (growth_control.inbox_capture_v1(
      p_person_id,p_project_key,
      'validation learning source',
      'text',
      'https://example.invalid/learning',
      jsonb_build_object('validation','routing-from-inbox')
    )#>>'{item,id}')::uuid;

    v_first := growth_control.inbox_classify_v1(
      p_person_id,p_project_key,v_item_id,'learning'
    );
    v_second := growth_control.inbox_classify_v1(
      p_person_id,p_project_key,v_item_id,'learning'
    );
    v_route := growth_control.inbox_route_event_v1(p_person_id,v_item_id);

    v_result := jsonb_build_object(
      'first_classified',coalesce((v_first->>'classified')::boolean,false),
      'second_routed',coalesce((v_second->>'routed')::boolean,false),
      'route',v_route,
      'session_exists',exists(
        select 1
        from growth_control.learning_companion_sessions s
        where s.id=nullif(v_route->>'target_id','')::uuid
          and s.source_ref='inbox:'||v_item_id::text
      )
    );

    raise exception using errcode='P0001', message='rollback_validation';
  exception when raise_exception then
    return v_result;
  end;
end;
$$;


-- ============================================================================
-- 20260929192400 routing_from_inbox_scope_contract
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='learning_companion_sessions_data_scope_check'
      and conrelid='growth_control.learning_companion_sessions'::regclass
  ) then
    alter table growth_control.learning_companion_sessions
      add constraint learning_companion_sessions_data_scope_check
      check (data_scope in ('real','validation','system','unknown'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='growth_actions_data_scope_check'
      and conrelid='growth_control.growth_actions'::regclass
  ) then
    alter table growth_control.growth_actions
      add constraint growth_actions_data_scope_check
      check (data_scope in ('real','validation','system','unknown'));
  end if;
end $$;

create or replace function public.growth_learning_create_from_inbox_service_v1(
  p_auth_user_id uuid,
  p_inbox_item_id uuid,
  p_title text default null,
  p_goal text default null,
  p_source_language text default 'unknown'
)
returns jsonb
language plpgsql
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_session_id uuid;
  v_kind text;
  v_scope text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_inbox_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'learning' then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_learning');
  end if;

  v_scope := coalesce(nullif(v_item.source_metadata->>'data_scope',''),'real');
  if v_scope not in ('real','validation','system') then
    return jsonb_build_object('accepted',false,'reason','unsupported_data_scope');
  end if;

  v_kind := case when v_item.source_kind='link' then 'article' else 'chat' end;

  v_session_id := growth_control.learning_companion_create_v1(
    v_person_id,
    'growth-brain',
    v_kind,
    'inbox:'||v_item.id::text,
    coalesce(nullif(trim(p_source_language),''),'unknown'),
    coalesce(nullif(trim(p_title),''),left(v_item.raw_content,140)),
    nullif(trim(coalesce(p_goal,'')),''),
    case when v_item.source_url is null
      then array['inbox:'||v_item.id::text]
      else array['inbox:'||v_item.id::text,v_item.source_url]
    end,
    '[]'::jsonb
  );

  update growth_control.learning_companion_sessions
  set data_scope=v_scope, updated_at=now()
  where id=v_session_id and person_id=v_person_id;

  return jsonb_build_object(
    'accepted',true,'session_id',v_session_id,
    'source_ref','inbox:'||v_item.id::text,'data_scope',v_scope
  );
end;
$function$;

create or replace function public.growth_route_action_inbox_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
set search_path = public, growth_control, auth
as $$
declare
  v_person_id uuid;
  v_item growth_control.inbox_items;
  v_existing jsonb;
  v_route jsonb;
  v_action_id uuid;
  v_scope text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  select * into v_item
  from growth_control.inbox_items
  where id=p_item_id and person_id=v_person_id and project_key='growth-brain';

  if v_item.id is null then
    return jsonb_build_object('accepted',false,'reason','inbox_item_not_found');
  end if;
  if v_item.classification <> 'action' then
    return jsonb_build_object('accepted',false,'reason','action_classification_required');
  end if;

  v_scope := coalesce(nullif(v_item.source_metadata->>'data_scope',''),'real');
  if v_scope not in ('real','validation','system') then
    return jsonb_build_object('accepted',false,'reason','unsupported_data_scope');
  end if;

  v_existing := growth_control.inbox_route_event_v1(v_person_id,p_item_id);
  if v_existing is not null then
    return jsonb_build_object(
      'accepted',true,'idempotent',true,'route',v_existing,
      'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
    );
  end if;

  select id into v_action_id
  from growth_control.growth_actions
  where person_id=v_person_id and source_inbox_item_id=p_item_id
  limit 1;

  if v_action_id is null then
    insert into growth_control.growth_actions(
      person_id,project_key,title,details,status,source_inbox_item_id,provenance,data_scope
    ) values (
      v_person_id,'growth-brain',left(v_item.raw_content,160),v_item.raw_content,'open',v_item.id,
      jsonb_build_object(
        'inbox_item_id',v_item.id,
        'source_kind',v_item.source_kind,
        'source_url',v_item.source_url,
        'data_scope',v_scope,
        'source_metadata',coalesce(v_item.source_metadata,'{}'::jsonb)
      ),
      v_scope
    )
    returning id into v_action_id;
  end if;

  v_route := public.growth_record_inbox_route_service_v1(
    p_auth_user_id,v_item.id,'action',v_item.raw_content,
    v_item.source_kind,v_item.source_url,v_item.source_metadata,
    'growth_action',v_action_id,'open'
  );

  return jsonb_build_object(
    'accepted',true,'idempotent',false,'target_id',v_action_id,'data_scope',v_scope,
    'route_event_id',v_route->>'event_id',
    'route',growth_control.inbox_route_event_v1(v_person_id,p_item_id),
    'snapshot',growth_control.inbox_snapshot_v1(v_person_id,'growth-brain')
  );
end;
$$;


-- ============================================================================
-- 20260929192431 routing_from_inbox_event_scope_function
-- ============================================================================
create or replace function public.growth_record_inbox_route_service_v1(
  p_auth_user_id uuid,
  p_item_id uuid,
  p_classification text,
  p_raw_content text,
  p_source_kind text,
  p_source_url text,
  p_source_metadata jsonb,
  p_target_kind text,
  p_target_id uuid,
  p_route_status text
)
returns jsonb
language plpgsql
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
  v_event_id uuid;
  v_source_type text;
  v_event_type text;
  v_scope text;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('accepted',false,'reason','not_verified_primary_user');
  end if;

  v_source_type := case p_classification
    when 'project' then 'inbox_project_route'
    when 'learning' then 'inbox_learning_route'
    when 'action' then 'inbox_action_candidate'
    when 'knowledge' then 'inbox_knowledge_candidate'
    else null
  end;
  if v_source_type is null then
    return jsonb_build_object('accepted',false,'reason','unsupported_classification');
  end if;

  v_scope := coalesce(nullif(coalesce(p_source_metadata,'{}'::jsonb)->>'data_scope',''),'real');
  if v_scope not in ('real','validation','system') then
    return jsonb_build_object('accepted',false,'reason','unsupported_data_scope');
  end if;

  v_event_type := case when p_classification='action' then 'action' else 'reference' end;

  v_event_id := public.growth_record_event_v1(
    v_person_id,
    v_event_type,
    v_source_type,
    'inbox:'||p_item_id::text,
    null,
    p_raw_content,
    array['inbox:'||p_item_id::text],
    jsonb_build_object(
      'classification',p_classification,
      'target_kind',p_target_kind,
      'target_id',p_target_id,
      'route_status',p_route_status,
      'data_scope',v_scope,
      'provenance',jsonb_build_object(
        'inbox_item_id',p_item_id,
        'source_kind',p_source_kind,
        'source_url',p_source_url,
        'data_scope',v_scope,
        'source_metadata',coalesce(p_source_metadata,'{}'::jsonb)
      )
    ),
    'observed',
    1.0,
    now()
  );

  return jsonb_build_object('accepted',true,'event_id',v_event_id,'data_scope',v_scope);
end;
$function$;


-- ============================================================================
-- 20260929203325 add_evidence_based_recovery_gate_and_handoff
-- ============================================================================
create or replace function growth_control.execution_recovery_gate_v1(p_report jsonb)
returns jsonb language plpgsql immutable security invoker
set search_path to 'pg_catalog','growth_control'
as $function$
declare
  r jsonb := coalesce(p_report,'{}'::jsonb);
  c jsonb;
  required_count integer := 0;
  missing_count integer := 0;
  decision text;
  reason text;
  can_close boolean := false;
  can_pause boolean := false;
begin
  if jsonb_typeof(r) <> 'object' then
    return jsonb_build_object('decision','repair_report','can_close',false,'can_pause',false,'reason','report_must_be_object');
  end if;
  if r->>'error_class' in ('safety_denial','permission_denial') then
    return jsonb_build_object('decision','respect_boundary','can_close',false,'can_pause',true,'reason','do_not_bypass_explicit_denial','next_action','preserve_checkpoint_and_do_only_independent_authorized_work');
  end if;
  if nullif(btrim(r->>'goal_ref'),'') is null or jsonb_typeof(r->'checks') is distinct from 'array' then
    return jsonb_build_object('decision','repair_report','can_close',false,'can_pause',false,'reason','goal_and_original_checks_required');
  end if;
  for c in select value from jsonb_array_elements(r->'checks') loop
    if jsonb_typeof(c) <> 'object' then
      return jsonb_build_object('decision','repair_report','can_close',false,'can_pause',false,'reason','check_must_be_object');
    end if;
    if coalesce(c->>'required','true') <> 'false' then
      required_count := required_count + 1;
      if c->>'status' is distinct from 'passed'
        or nullif(btrim(c->>'evidence_ref'),'') is null
        or nullif(btrim(c->>'key'),'') is null
        or (r->>'requires_real_verification'='true' and c->>'verification_scope' is distinct from 'real') then
        missing_count := missing_count + 1;
      end if;
    end if;
  end loop;
  if required_count=0 then decision:='define_acceptance';reason:='empty_acceptance_is_not_success';
  elsif r->>'criteria_unchanged' is distinct from 'true' then decision:='restore_acceptance';reason:='do_not_lower_or_replace_original_acceptance';
  elsif missing_count=0 then decision:='completed';reason:='all_required_checks_have_matching_evidence';can_close:=true;
  elsif r->>'has_executable_work'='true' then decision:='continue_execution';reason:='unfinished_authorized_work_remains';
  elsif r->>'error_class' in ('user_auth','quota','external_unavailable','runtime_limit')
    and nullif(btrim(r->>'boundary_evidence_ref'),'') is not null
    and r->>'alternatives_checked'='true'
    and nullif(btrim(r->>'checkpoint_ref'),'') is not null then
      decision:='waiting_resumable';reason:='documented_external_boundary_not_goal_completion';can_pause:=true;
  elsif r->>'diagnosis_complete' is distinct from 'true' then decision:='diagnose';reason:='inspect_exact_error_and_current_state_first';
  elsif nullif(btrim(r->>'specialist_review_ref'),'') is null then decision:='load_relevant_skill';reason:='consult_available_specialist_guidance_before_giving_up';
  elsif r->>'capabilities_checked' is distinct from 'true' then decision:='inspect_available_tools';reason:='verify_current_capability_do_not_assume_work_only';
  elsif r->>'alternatives_checked' is distinct from 'true' then decision:='evaluate_alternative';reason:='try_supported_authorized_route_not_a_denial_bypass';
  elsif r->>'retry_budget_exhausted'='true' and nullif(btrim(r->>'checkpoint_ref'),'') is not null then
    decision:='paused_needs_new_evidence';reason:='bounded_retries_exhausted_save_state_and_escalate';can_pause:=true;
  else decision:='repair_and_retest';reason:='failed_attempt_is_not_an_unexecutable_task';
  end if;
  return jsonb_build_object('sv','execution-recovery-gate-v1','decision',decision,'reason',reason,'can_close',can_close,'can_pause',can_pause,'required_checks',required_count,'missing_checks',missing_count,'scope','validates_submitted_report_not_external_truth','independent_evidence_review_required',true);
end;
$function$;
revoke all on function growth_control.execution_recovery_gate_v1(jsonb) from public,anon,authenticated;
grant execute on function growth_control.execution_recovery_gate_v1(jsonb) to service_role;

do $migration$
declare d text; needle text := '  ''sv'',''ai-handoff-v1'',';
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='growth_control' and p.proname='ai_handoff_v1' and pg_get_function_identity_arguments(p.oid)='p_person_id uuid, p_project_key text';
  if d is null then raise exception 'handoff_signature_not_found'; end if;
  if position('execution_recovery_policy' in d)=0 then
    if position(needle in d)=0 then raise exception 'handoff_insertion_point_changed'; end if;
    d:=replace(d,needle,needle||E'\n  ''execution_recovery_policy'',(select rules->''execution_recovery'' from growth_control.project_policy where person_id=p_person_id and project_key=p_project_key),\n  ''execution_gate_function'',''growth_control.execution_recovery_gate_v1(jsonb)'',');
    execute d;
  end if;
end;
$migration$;


-- ============================================================================
-- 20260929212352 personal_synapse_real_data_only
-- ============================================================================
create or replace function growth_control.personal_synapse_snapshot_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain',
  p_limit integer default 30
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with event_source_keys as (
  select
    'event:' || e.id::text as source_node_id,
    'event'::text as source_kind,
    e.source_type,
    e.source_ref,
    e.occurred_at as observed_at,
    k as concept_key
  from public.growth_events e
  cross join lateral unnest(coalesce(e.machine_keys,'{}'::text[])) k
  where e.person_id=p_person_id
    and e.status='active'
    and e.payload->>'data_scope'='real'
    and coalesce(e.source_type,'') not in ('growth_control','automation_validation')
    and coalesce(e.source_ref,'') !~ '^test:'
    and not exists (
      select 1
      from unnest(coalesce(e.machine_keys,'{}'::text[])) x
      where x in ('scope:validation','scope:system')
         or x like 'test:%'
         or x like 'sys.%'
    )
    and (
      k like 'concept:%'
      or k like 'logic:%'
      or k like 'topic:%'
    )
),
learning_source_keys as (
  select
    'learning:' || s.id::text as source_node_id,
    'learning'::text as source_kind,
    s.source_kind as source_type,
    s.source_ref,
    s.created_at as observed_at,
    u.concept_key
  from growth_control.learning_companion_sessions s
  join growth_control.learning_companion_units u on u.session_id=s.id
  where s.person_id=p_person_id
    and s.project_key=coalesce(nullif(trim(p_project_key),''),'growth-brain')
    and s.data_scope='real'
    and nullif(trim(coalesce(u.concept_key,'')),'') is not null
    and coalesce(u.concept_key,'') !~ '^(sys\.|scope:|test:)'
),
source_keys as (
  select * from event_source_keys
  union all
  select * from learning_source_keys
),
limited_keys as (
  select sk.*
  from source_keys sk
  join (
    select concept_key,max(observed_at) as last_seen
    from source_keys
    group by concept_key
    order by max(observed_at) desc,concept_key
    limit greatest(1,least(coalesce(p_limit,30),100))
  ) keep using(concept_key)
),
concept_stats as (
  select
    concept_key,
    count(distinct source_node_id)::int as source_count,
    count(distinct source_type)::int as source_diversity,
    max(observed_at) as last_seen,
    array_agg(distinct source_type order by source_type) as source_types
  from limited_keys
  group by concept_key
),
real_learning_evidence as (
  select
    le.concept_key,
    count(*)::int as evidence_count,
    max(le.score)::double precision as max_score,
    max(le.created_at) as last_evidence_at
  from public.growth_learning_evidence le
  where le.person_id=p_person_id
    and le.evidence->>'data_scope'='real'
  group by le.concept_key
),
source_nodes as (
  select distinct on (source_node_id)
    source_node_id,
    source_kind,
    source_type,
    source_ref,
    observed_at
  from limited_keys
  order by source_node_id, observed_at desc
),
node_payload as (
  select jsonb_build_object(
    'id',sn.source_node_id,
    'type','source',
    'label',case
      when sn.source_kind='learning' then '學習來源'
      when sn.source_type='chat:user' then '使用者對話'
      when sn.source_type='x' then 'X 來源'
      when sn.source_type='legacy_db' then '既有個人來源'
      else coalesce(nullif(sn.source_type,''),'個人來源')
    end,
    'source_kind',sn.source_kind,
    'source_type',sn.source_type,
    'source_ref',sn.source_ref,
    'data_scope','real',
    'observed_at',sn.observed_at,
    'mastery_claimed',false
  ) as node,
  0 as sort_group,
  sn.observed_at as sort_time,
  sn.source_node_id as sort_key
  from source_nodes sn

  union all

  select jsonb_build_object(
    'id',cs.concept_key,
    'type','concept',
    'label',regexp_replace(
      regexp_replace(cs.concept_key,'^(concept:|logic:|topic:)','','g'),
      '_',' ','g'
    ),
    'data_scope','real',
    'source_count',cs.source_count,
    'source_diversity',cs.source_diversity,
    'source_types',to_jsonb(cs.source_types),
    'last_seen',cs.last_seen,
    'learning_evidence_count',coalesce(rle.evidence_count,0),
    'max_learning_score',rle.max_score,
    'last_learning_evidence_at',rle.last_evidence_at,
    'mastery_claimed',coalesce(rle.evidence_count,0)>0
  ) as node,
  1 as sort_group,
  cs.last_seen as sort_time,
  cs.concept_key as sort_key
  from concept_stats cs
  left join real_learning_evidence rle using(concept_key)
),
edge_payload as (
  select jsonb_build_object(
    'id',md5(lk.source_node_id || '|' || lk.concept_key || '|source_contains_concept'),
    'source',lk.source_node_id,
    'target',lk.concept_key,
    'relation','source_contains_concept',
    'label','來源包含此概念',
    'data_scope','real',
    'provenance',jsonb_build_object(
      'source_kind',lk.source_kind,
      'source_type',lk.source_type,
      'source_ref',lk.source_ref,
      'observed_at',lk.observed_at
    ),
    'mastery_claimed',false
  ) as edge,
  lk.observed_at as sort_time,
  lk.source_node_id || '|' || lk.concept_key as sort_key
  from limited_keys lk
),
exclusion_stats as (
  select
    count(*) filter (
      where e.person_id=p_person_id
        and e.status='active'
        and (
          e.payload->>'data_scope'='system'
          or coalesce(e.source_type,'')='growth_control'
          or exists (
            select 1 from unnest(coalesce(e.machine_keys,'{}'::text[])) k
            where k='scope:system' or k like 'sys.%'
          )
        )
    )::int as system_event_count,
    count(*) filter (
      where e.person_id=p_person_id
        and e.status='active'
        and (
          e.payload->>'data_scope'='validation'
          or coalesce(e.source_type,'')='automation_validation'
          or coalesce(e.source_ref,'') ~ '^test:'
          or exists (
            select 1 from unnest(coalesce(e.machine_keys,'{}'::text[])) k
            where k='scope:validation' or k like 'test:%'
          )
        )
    )::int as validation_event_count
  from public.growth_events e
)
select jsonb_build_object(
  'sv','personal-synapse-snapshot-v1',
  'surface','personal_synapse',
  'data_scope','real',
  'generated_at',now(),
  'status',case when (select count(*) from concept_stats)=0
    then 'empty_real_personal_sources'
    else 'formed_from_real_personal_sources'
  end,
  'summary',jsonb_build_object(
    'source_count',(select count(*) from source_nodes),
    'concept_count',(select count(*) from concept_stats),
    'edge_count',(select count(*) from edge_payload),
    'learning_evidence_count',(select coalesce(sum(coalesce(rle.evidence_count,0)),0) from concept_stats cs left join real_learning_evidence rle using(concept_key)),
    'system_events_excluded',(select system_event_count from exclusion_stats),
    'validation_events_excluded',(select validation_event_count from exclusion_stats)
  ),
  'nodes',coalesce((
    select jsonb_agg(node order by sort_group,sort_time desc nulls last,sort_key)
    from node_payload
  ),'[]'::jsonb),
  'edges',coalesce((
    select jsonb_agg(edge order by sort_time desc nulls last,sort_key)
    from edge_payload
  ),'[]'::jsonb),
  'highlights',coalesce((
    select jsonb_agg(jsonb_build_object(
      'k',cs.concept_key,
      'label',regexp_replace(regexp_replace(cs.concept_key,'^(concept:|logic:|topic:)','','g'),'_',' ','g'),
      'n',cs.source_count,
      'src_n',cs.source_diversity,
      'evidence_n',coalesce(rle.evidence_count,0),
      'last',cs.last_seen,
      'c',case when cs.source_count>0 then 1.0 else 0.0 end
    ) order by cs.source_count desc,cs.source_diversity desc,cs.last_seen desc)
    from concept_stats cs
    left join real_learning_evidence rle using(concept_key)
    limit 6
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'personal_surface_real_only',true,
    'system_and_validation_excluded',true,
    'source_to_concept_edge_is_provenance_not_mastery',true,
    'ai_generated_card_is_not_learning_evidence',true,
    'semantic_concept_links_require_separate_evidence',true,
    'empty_state_is_valid',true
  )
);
$function$;

create or replace function public.growth_personal_synapse_snapshot_service_v1(
  p_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
  v_caller uuid := auth.uid();
begin
  if v_caller is not null and v_caller <> p_auth_user_id then
    return jsonb_build_object('authorized',false,'reason','auth_user_mismatch');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;

  return jsonb_build_object(
    'authorized',true,
    'person_id',v_person_id,
    'snapshot',growth_control.personal_synapse_snapshot_v1(v_person_id,'growth-brain',30)
  );
end;
$function$;

create or replace function growth_control.personal_home_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with directions as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key',state_key,
      'goal',state->>'goal',
      'priority',state->>'priority',
      'confidence',confidence,
      'status',status
    )
    order by
      case when coalesce((state->>'user_home_default')::boolean,false) then 0 else 1 end,
      confidence desc,
      updated_at desc
  ),'[]'::jsonb) as items
  from public.growth_states
  where person_id=p_person_id
    and dimension='direction'
    and status='active'
    and coalesce(state->>'surface_scope','personal_direction')='personal_direction'
),
primary_direction as (
  select jsonb_build_object(
    'key',state_key,
    'goal',state->>'goal',
    'priority',state->>'priority',
    'confidence',confidence,
    'status',status
  ) as j
  from public.growth_states
  where person_id=p_person_id
    and dimension='direction'
    and status='active'
    and coalesce(state->>'surface_scope','personal_direction')='personal_direction'
  order by
    case when coalesce((state->>'user_home_default')::boolean,false) then 0 else 1 end,
    confidence desc,
    updated_at desc
  limit 1
),
personal_route as (
  select growth_control.personal_outcome_snapshot_v1(p_person_id,p_project_key) as j
),
primary_action as (
  select case
    when nullif(j#>>'{selected_route,id}','') is not null then jsonb_build_object(
      'status','personal_outcome_route_selected',
      'route_id',j#>>'{selected_route,id}',
      'route_key',j#>>'{selected_route,route_key}',
      'title',j#>>'{selected_route,title}',
      'why',coalesce(nullif(j#>>'{selected_route,why_now}',''),'這是你明確選定的個人主線。'),
      'success_evidence',j#>>'{selected_route,success_evidence}'
    )
    when nullif(j#>>'{candidate_route,id}','') is not null then jsonb_build_object(
      'status','personal_outcome_candidate_available',
      'route_id',j#>>'{candidate_route,id}',
      'route_key',j#>>'{candidate_route,route_key}',
      'title','確認是否把「' || (j#>>'{candidate_route,title}') || '」設為個人主線',
      'why',coalesce(nullif(j#>>'{candidate_route,why_now}',''),'候選已保存，但尚未由你明確選定。'),
      'success_evidence','明確選擇、修改或拒絕這條候選主線；AI 不會自動升格。'
    )
    else jsonb_build_object(
      'status','needs_personal_outcome_route',
      'title','選定一個真實個人成長／作品目標作為首頁主線',
      'why','目前只有系統建置路線，尚不能安全代表你的個人下一步。',
      'success_evidence','建立至少一條個人候選主線，再由你明確選擇是否升格。'
    )
  end as j
  from personal_route
),
learning as (
  select growth_control.learning_progress_ui_projection_v1(p_person_id) as j
),
synapse as (
  select growth_control.personal_synapse_snapshot_v1(p_person_id,p_project_key,6) as j
),
progress as (
  select growth_control.recent_real_progress_v1(p_person_id,p_project_key,6) as j
),
system as (
  select growth_control.ceo_project_state_v1(p_person_id,p_project_key) as j
)
select jsonb_build_object(
  'sv','personal-home-surface-v2',
  'surface','personal_growth_home',
  'generated_at',now(),
  'primary_direction',(select j from primary_direction),
  'directions',(select items from directions),
  'primary_action',(select j from primary_action),
  'recent_real_progress',(select j from progress),
  'learning_support',jsonb_build_object(
    'role','supporting_only',
    'summary',(select j->'summary' from learning),
    'primary_card',(select j->'primary_card' from learning),
    'contextual_suggestion_status','withheld_until_personal_route_match',
    'rule','專案型學習內容只有和已選定的個人主線相關時，才可出現在首頁主要行動。'
  ),
  'synapse_highlights',jsonb_build_object(
    'role','context_and_patterns',
    'data_scope','real',
    'nodes',(select j->'highlights' from synapse),
    'status',(select j->>'status' from synapse),
    'rule','首頁只顯示可追溯到 real 個人來源的重點；系統建置與 validation 不進個人知識連結。'
  ),
  'learning_workspace',growth_control.learning_live_snapshot_v1(p_person_id,p_project_key),
  'system_health',jsonb_build_object(
    'location','system_cockpit',
    'show_build_details_on_personal_home',false,
    'build_in_progress',coalesce((select j->'current' is not null from system),false),
    'parallel_blocker_count',coalesce((select jsonb_array_length(j->'parallel_blockers') from system),0)
  )
);
$function$;


-- ============================================================================
-- 20260929212734 personal_home_include_personal_synapse
-- ============================================================================
create or replace function growth_control.personal_home_surface_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
  select growth_control.personal_home_surface_v1(p_person_id,p_project_key)
    || jsonb_build_object(
      'personal_synapse',
      growth_control.personal_synapse_snapshot_v1(p_person_id,p_project_key,30)
    );
$function$;

create or replace function growth_control.app_surface_for_auth_user_v1(
  p_auth_user_id uuid,
  p_surface text default 'personal_home',
  p_project_key text default 'growth-brain'
)
returns jsonb
language plpgsql
set search_path to 'growth_control','public','auth'
as $function$
declare
  v_person_id uuid;
begin
  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);

  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;

  if p_surface='personal_home' then
    return jsonb_build_object(
      'authorized',true,
      'single_user_mode',true,
      'surface','personal_home',
      'snapshot',growth_control.personal_home_surface_v2(v_person_id,p_project_key)
    );
  elsif p_surface='personal_outcome' then
    return jsonb_build_object(
      'authorized',true,
      'single_user_mode',true,
      'surface','personal_outcome',
      'snapshot',growth_control.personal_outcome_snapshot_v1(v_person_id,p_project_key)
    );
  elsif p_surface='system_cockpit' then
    return jsonb_build_object(
      'authorized',true,
      'single_user_mode',true,
      'surface','system_cockpit',
      'snapshot',growth_control.system_cockpit_surface_v1(v_person_id,p_project_key)
    );
  else
    return jsonb_build_object(
      'authorized',false,
      'reason','unsupported_surface',
      'supported',jsonb_build_array('personal_home','personal_outcome','system_cockpit')
    );
  end if;
end;
$function$;


-- ============================================================================
-- 20260929213113 personal_synapse_state_labels
-- ============================================================================
create or replace function growth_control.personal_synapse_snapshot_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain',
  p_limit integer default 30
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with base as (
  select growth_control.personal_synapse_snapshot_v1(
    p_person_id,p_project_key,p_limit
  ) as j
),
rewritten_nodes as (
  select coalesce(jsonb_agg(
    case
      when n->>'type'='concept' then
        n
        || jsonb_build_object(
          'mastery_claimed',false,
          'learning_level',coalesce(ls.level,0),
          'learning_level_name',coalesce(ls.level_name,'unknown'),
          'learning_confidence',coalesce(ls.confidence,0),
          'learning_evidence_count',coalesce(ls.evidence_count,0),
          'independent_application_verified',coalesce(ls.level,0)>=6
        )
      else n || jsonb_build_object('mastery_claimed',false)
    end
  ),'[]'::jsonb) as nodes
  from base
  cross join lateral jsonb_array_elements(base.j->'nodes') n
  left join lateral (
    select s.*
    from public.growth_learning_state_v1(
      p_person_id,
      array[n->>'id']
    ) s
    where n->>'type'='concept'
    limit 1
  ) ls on true
),
rewritten_highlights as (
  select coalesce(jsonb_agg(
    h || jsonb_build_object(
      'learning_level',coalesce(ls.level,0),
      'learning_level_name',coalesce(ls.level_name,'unknown'),
      'evidence_n',coalesce(ls.evidence_count,0)
    )
  ),'[]'::jsonb) as highlights
  from base
  cross join lateral jsonb_array_elements(base.j->'highlights') h
  left join lateral (
    select s.*
    from public.growth_learning_state_v1(
      p_person_id,
      array[h->>'k']
    ) s
    limit 1
  ) ls on true
)
select
  jsonb_set(
    jsonb_set(
      jsonb_set(
        (select j from base),
        '{nodes}',
        (select nodes from rewritten_nodes),
        true
      ),
      '{highlights}',
      (select highlights from rewritten_highlights),
      true
    ),
    '{policy}',
    coalesce((select j->'policy' from base),'{}'::jsonb)
      || jsonb_build_object(
        'learning_evidence_is_not_mastery',true,
        'independent_application_threshold',6
      ),
    true
  )
  || jsonb_build_object('sv','personal-synapse-snapshot-v2');
$function$;

create or replace function public.growth_personal_synapse_snapshot_service_v1(
  p_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','growth_control','auth'
as $function$
declare
  v_person_id uuid;
  v_caller uuid := auth.uid();
begin
  if v_caller is not null and v_caller <> p_auth_user_id then
    return jsonb_build_object('authorized',false,'reason','auth_user_mismatch');
  end if;

  v_person_id := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v_person_id is null then
    return jsonb_build_object('authorized',false,'reason','not_verified_primary_user');
  end if;

  return jsonb_build_object(
    'authorized',true,
    'person_id',v_person_id,
    'snapshot',growth_control.personal_synapse_snapshot_v2(v_person_id,'growth-brain',30)
  );
end;
$function$;

create or replace function growth_control.personal_home_surface_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain'
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
  select growth_control.personal_home_surface_v1(p_person_id,p_project_key)
    || jsonb_build_object(
      'personal_synapse',
      growth_control.personal_synapse_snapshot_v2(p_person_id,p_project_key,30)
    );
$function$;


-- ============================================================================
-- 20260930042313 growth_ai_jobs_table_v1
-- ============================================================================
create table if not exists growth_control.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id) on delete cascade,
  project_key text not null,
  source_kind text not null,
  source_ref text,
  data_scope text not null check (data_scope in ('real','validation','system')),
  task_type text not null check (length(btrim(task_type)) > 0),
  task_payload jsonb not null default '{}'::jsonb,
  provider_key text,
  status text not null default 'queued'
    check (status in ('queued','claimed','running','succeeded','failed','cancelled')),
  attempt_no integer not null default 0 check (attempt_no >= 0),
  claimed_by text,
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  result_evidence jsonb not null default '{}'::jsonb,
  error jsonb,
  provenance jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_jobs_idempotency_unique unique(person_id, project_key, idempotency_key),
  constraint ai_jobs_result_state_check check (
    status <> 'succeeded'
    or (result is not null and jsonb_typeof(result_evidence)='object' and result_evidence <> '{}'::jsonb)
  )
);

create index if not exists ai_jobs_queue_idx
  on growth_control.ai_jobs(project_key, status, created_at)
  where status='queued';

create index if not exists ai_jobs_person_idx
  on growth_control.ai_jobs(person_id, project_key, created_at desc);

drop trigger if exists ai_jobs_set_updated_at on growth_control.ai_jobs;
create trigger ai_jobs_set_updated_at
before update on growth_control.ai_jobs
for each row execute function public.set_updated_at();


-- ============================================================================
-- 20260930112002 growth_logic_capability_surface_v1
-- ============================================================================
create or replace function growth_control.logic_capability_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
with pkg as (
  select wp.steps
  from growth_control.work_packages wp
  where wp.person_id = p_person_id
    and wp.project_key = p_project_key
    and wp.package_key = 'logic-core-loop-v1'
  order by wp.updated_at desc
  limit 1
),
expanded as (
  select
    x.ordinality::int as step_order,
    x.step->>'key' as step_key,
    x.step->>'goal' as goal,
    coalesce(x.step->>'status','planned') as raw_status,
    coalesce(x.step->>'execution_mode','development') as execution_mode,
    coalesce(x.step->'evidence','{}'::jsonb) as evidence
  from pkg
  cross join lateral jsonb_array_elements(coalesce(pkg.steps,'[]'::jsonb))
    with ordinality as x(step, ordinality)
),
normalized as (
  select *,
    case
      when raw_status = 'completed' then 'implemented'
      when raw_status like 'implemented%' then 'implemented'
      when raw_status = 'deferred_real_acceptance' then 'implemented'
      when raw_status = 'current' then 'in_progress'
      when raw_status like 'blocked%' then 'blocked_external'
      else 'not_started'
    end as development_state,
    case
      when coalesce(evidence->>'real_world_acceptance','') in ('passed','accepted','verified') then 'passed'
      when execution_mode in ('real_acceptance_pending','structural_done_real_acceptance_pending','real_acceptance_required')
        or coalesce(evidence->>'real_world_acceptance','') like 'pending%'
        or raw_status like '%pending%'
        or raw_status = 'deferred_real_acceptance'
      then 'pending'
      else 'not_required'
    end as real_acceptance_state
  from expanded
)
select jsonb_build_object(
  'sv','logic-capability-surface-v1',
  'source_package','logic-core-loop-v1',
  'generated_at',now(),
  'track_rule',jsonb_build_object(
    'development','continues_without_real_data',
    'real_acceptance','pending_until_real_evidence'
  ),
  'items',coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order',step_order,
        'key',step_key,
        'goal',goal,
        'raw_status',raw_status,
        'execution_mode',execution_mode,
        'development_state',development_state,
        'real_acceptance_state',real_acceptance_state,
        'evidence',evidence
      )
      order by step_order
    ),
    '[]'::jsonb
  )
)
from normalized;
$function$;

create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.work_queue_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key)
);
$function$;


-- ============================================================================
-- 20260930112101 growth_path_artifact_trial_contract_v1
-- ============================================================================
create or replace function growth_control.path_artifact_trial_contract_v1()
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
select jsonb_build_object(
  'sv','path-artifact-trial-contract-v1',
  'persistence','none',
  'formal_personal_state_changes',false,
  'ai_dynamic_generation_connected',false,
  'stage_generation_rule','generate_only_current_stage_then_wait_for_artifact_result',
  'promotion_rule','real_user_confirmation_or_real_action_or_artifact_evidence_required',
  'modes',jsonb_build_array(
    jsonb_build_object(
      'key','curiosity',
      'label','看到一個內容／主題',
      'candidate_direction_rule','keep_multiple_candidates_when_evidence_is_insufficient',
      'stage_goal','先找出這個主題最值得知道或驗證的一件事',
      'artifact_rule','produce_one_small_visible_usable_testable_or_evidenced_artifact',
      'after_artifact','continue_turn_or_stop_then_generate_only_the_next_stage'
    ),
    jsonb_build_object(
      'key','goal',
      'label','已有一個目標',
      'candidate_direction_rule','do_not_expand_into_a_fixed_long_term_route',
      'stage_goal','把目標縮成第一個最小可交付成果',
      'artifact_rule','produce_one_small_visible_usable_testable_or_evidenced_artifact',
      'after_artifact','continue_turn_or_stop_then_generate_only_the_next_stage'
    )
  )
);
$function$;

create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to 'growth_control','public'
as $function$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.work_queue_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1()
);
$function$;


-- ============================================================================
-- 20260930122225 growth_path_trial_single_stage_and_capability_labels_v1
-- ============================================================================
create or replace function growth_control.logic_capability_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
with pkg as (
  select wp.steps
  from growth_control.work_packages wp
  where wp.person_id = p_person_id
    and wp.project_key = p_project_key
    and wp.package_key = 'logic-core-loop-v1'
  order by wp.updated_at desc
  limit 1
),
expanded as (
  select
    x.ordinality::int as step_order,
    x.step->>'key' as step_key,
    x.step->>'goal' as goal,
    coalesce(x.step->>'status','planned') as raw_status,
    coalesce(x.step->>'execution_mode','development') as execution_mode,
    coalesce(x.step->'evidence','{}'::jsonb) as evidence
  from pkg
  cross join lateral jsonb_array_elements(coalesce(pkg.steps,'[]'::jsonb))
    with ordinality as x(step, ordinality)
),
states as (
  select *,
    case
      when raw_status = 'completed' then 'implemented'
      when raw_status like 'implemented%' then 'implemented'
      when raw_status = 'deferred_real_acceptance' then 'implemented'
      when raw_status = 'current' then 'in_progress'
      when raw_status like 'blocked%' then 'blocked_external'
      else 'not_started'
    end as development_state,
    case
      when coalesce(evidence->>'real_world_acceptance','') in ('passed','accepted','verified') then 'passed'
      when execution_mode in ('real_acceptance_pending','structural_done_real_acceptance_pending','real_acceptance_required')
        or coalesce(evidence->>'real_world_acceptance','') like 'pending%'
        or raw_status like '%pending%'
        or raw_status = 'deferred_real_acceptance'
      then 'pending'
      else 'not_required'
    end as real_acceptance_state
  from expanded
),
normalized as (
  select *,
    case
      when development_state = 'blocked_external' then '外部能力受阻'
      when development_state = 'implemented' and real_acceptance_state = 'pending' then '已實作，待真實驗收'
      when development_state = 'implemented' then '已實作'
      when development_state = 'in_progress' then '正在完善'
      else '尚未完成'
    end as display_status,
    case
      when development_state = 'blocked_external' then '保留恢復點，不阻塞其他可獨立完成的開發工作。'
      when real_acceptance_state = 'pending' then '技術工作可繼續；只有真實使用者輸入、行動、作品或明確確認才能完成真實驗收。'
      when development_state = 'in_progress' then '目前仍有可直接完成的開發驗收缺口。'
      when development_state = 'implemented' then '技術實作已完成。'
      else '尚未進入實作。'
    end as display_detail
  from states
)
select jsonb_build_object(
  'sv','logic-capability-surface-v1',
  'source_package','logic-core-loop-v1',
  'generated_at',now(),
  'track_rule',jsonb_build_object(
    'development','continues_without_real_data',
    'real_acceptance','pending_until_real_evidence'
  ),
  'items',coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order',step_order,
        'key',step_key,
        'goal',goal,
        'raw_status',raw_status,
        'execution_mode',execution_mode,
        'development_state',development_state,
        'real_acceptance_state',real_acceptance_state,
        'display_status',display_status,
        'display_detail',display_detail,
        'evidence',evidence
      )
      order by step_order
    ),
    '[]'::jsonb
  )
)
from normalized;
$function$;

create or replace function growth_control.path_artifact_trial_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
select jsonb_build_object(
  'sv','path-artifact-trial-contract-v1',
  'persistence','none',
  'formal_personal_state_changes',false,
  'ai_dynamic_generation_connected',false,
  'current_stage_only',true,
  'stage_generation_rule','generate_only_current_stage_then_wait_for_artifact_result',
  'promotion_rule','real_user_confirmation_or_real_action_or_artifact_evidence_required',
  'status_note','目前 AI 任務層尚未接上，因此只提供通用單階段作品骨架，不假裝已依內容動態推理。',
  'stage_fields',jsonb_build_array('候選方向','階段目標','要產出的作品','完成後判斷'),
  'modes',jsonb_build_array(
    jsonb_build_object(
      'key','curiosity',
      'label','看到一個內容／主題',
      'candidate_direction_rule','keep_multiple_candidates_when_evidence_is_insufficient',
      'current_stage',jsonb_build_object(
        'candidate_direction','先保留多個可能方向，不先選唯一答案。',
        'goal','找出這個主題目前最值得知道或驗證的一件事。',
        'artifact','做一件能看、能用、能測或能留下證據的最小作品。',
        'after_artifact','依作品結果與真實回饋決定繼續、轉向或停止；之後才產生下一階段。'
      )
    ),
    jsonb_build_object(
      'key','goal',
      'label','已有一個目標',
      'candidate_direction_rule','do_not_expand_into_a_fixed_long_term_route',
      'current_stage',jsonb_build_object(
        'candidate_direction','沿用目前目標，但不先固定後續完整路線。',
        'goal','把目標縮成第一個最小可交付成果。',
        'artifact','做一件能看、能用、能測或能留下證據的最小作品。',
        'after_artifact','用作品結果找真正缺口，再決定下一階段；不提前把後續寫死。'
      )
    )
  )
);
$function$;

create or replace function growth_control.path_artifact_trial_stage_v1(p_mode text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
select case
  when p_mode = 'curiosity' then jsonb_build_object(
    'sv','path-artifact-trial-stage-v1',
    'mode','curiosity',
    'label','看到一個內容／主題',
    'data_scope','validation',
    'persistence','none',
    'ai_dynamic_generation_connected',false,
    'current_stage',jsonb_build_object(
      'candidate_direction','先列出至少兩個可能值得追的方向；資料不足時不硬選唯一答案。',
      'goal','找出現在最值得知道或驗證的一件事。',
      'artifact','完成一件最小可驗證作品。',
      'artifact_examples',jsonb_build_array('小原型','比較表','短實驗','流程','學習卡','驗證紀錄'),
      'after_artifact','根據作品結果與真實回饋決定繼續、轉向或停止；只在這之後產生下一階段。'
    )
  )
  when p_mode = 'goal' then jsonb_build_object(
    'sv','path-artifact-trial-stage-v1',
    'mode','goal',
    'label','已有一個目標',
    'data_scope','validation',
    'persistence','none',
    'ai_dynamic_generation_connected',false,
    'current_stage',jsonb_build_object(
      'candidate_direction','保留原目標，但不先展開整條長期路線。',
      'goal','把目標縮成第一個最小可交付成果。',
      'artifact','完成一件最小可驗證作品。',
      'artifact_examples',jsonb_build_array('小原型','比較表','短實驗','流程','可操作工具','驗證紀錄'),
      'after_artifact','用作品結果找真正缺口，再決定下一階段；每次允許繼續、轉向或停止。'
    )
  )
  else jsonb_build_object(
    'sv','path-artifact-trial-stage-v1',
    'error','unsupported_mode',
    'allowed_modes',jsonb_build_array('curiosity','goal'),
    'persistence','none'
  )
end;
$function$;


-- ============================================================================
-- 20260930122925 growth_ui_language_contract_v1
-- ============================================================================
create or replace function growth_control.ui_language_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
select jsonb_build_object(
  'sv','ui-language-contract-v1',
  'locale','zh-Hant',
  'plain_chinese_first',true,
  'unnecessary_english_not_allowed',true,
  'terms',jsonb_build_array(
    jsonb_build_object(
      'key','synapse',
      'label','知識連結',
      'technical_term','Synapse',
      'what_it_is','把不同學習、作品與經驗之間的關係連起來。',
      'what_it_does_here','用可追溯來源顯示哪些概念彼此相關。',
      'why_care','幫你找到重複出現的核心邏輯，不把系統測試資料當成你的個人知識。'
    ),
    jsonb_build_object(
      'key','live',
      'label','已連線正式資料',
      'technical_term','Live',
      'what_it_is','目前畫面正在讀取正式資料來源。',
      'what_it_does_here','區分正式資料與快取或測試資料。',
      'why_care','避免把舊快取或測試結果誤認成最新個人狀態。'
    ),
    jsonb_build_object(
      'key','learning_unit',
      'label','學習單元',
      'technical_term','Learning Unit',
      'what_it_is','由一個真實學習來源切出的可回答、可驗證的小單位。',
      'what_it_does_here','讓學習結果能留下作答與證據。',
      'why_care','只有真實回答或作品證據才能提升能力狀態。'
    ),
    jsonb_build_object(
      'key','real',
      'label','真實資料',
      'technical_term','real',
      'what_it_is','來自使用者真實輸入、行動、作品或明確確認的資料。',
      'what_it_does_here','作為個人主線、學習證據與真實進展的正式來源。',
      'why_care','測試資料與系統建置資料不能冒充個人成果。'
    ),
    jsonb_build_object(
      'key','validation',
      'label','測試驗證資料',
      'technical_term','validation',
      'what_it_is','只用來測試結構、流程與錯誤處理的資料。',
      'what_it_does_here','驗證功能能不能運作，但不計入個人進展。',
      'why_care','避免測試成功被誤當成你已完成或已學會。'
    ),
    jsonb_build_object(
      'key','system',
      'label','系統建置資料',
      'technical_term','system',
      'what_it_is','第二大腦本身的開發、部署與維運資料。',
      'what_it_does_here','記錄系統是否正常與目前建置狀態。',
      'why_care','系統做了很多事也不等於你的個人成長。'
    )
  ),
  'status_labels',jsonb_build_object(
    'implemented','已實作',
    'implemented_pending_real_acceptance','已實作，待真實驗收',
    'in_progress','正在完善',
    'blocked_external','外部能力受阻',
    'not_started','尚未完成'
  )
);
$function$;

create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.work_queue_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1()
);
$function$;


-- ============================================================================
-- 20260930123240 growth_web_work_queue_status_projection_v1
-- ============================================================================
create or replace function growth_control.web_work_queue_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
with base as (
  select growth_control.work_queue_v1(p_person_id,p_project_key) as j
),
packages as (
  select p.pkg, p.ord
  from base
  cross join lateral jsonb_array_elements(coalesce(base.j->'packages','[]'::jsonb))
    with ordinality as p(pkg,ord)
),
normalized_packages as (
  select
    ord,
    case
      when pkg->>'package_key'='logic-core-loop-v1' then
        jsonb_set(
          pkg,
          '{steps}',
          coalesce((
            select jsonb_agg(
              case
                when s.step->>'status'='blocked_external' then
                  jsonb_set(
                    jsonb_set(s.step,'{raw_status}',to_jsonb('blocked_external'::text),true),
                    '{status}',
                    to_jsonb('blocked'::text),
                    true
                  )
                else s.step
              end
              order by s.step_ord
            )
            from jsonb_array_elements(coalesce(pkg->'steps','[]'::jsonb))
              with ordinality as s(step,step_ord)
          ),'[]'::jsonb),
          true
        )
      else pkg
    end as pkg
  from packages
)
select jsonb_set(
  base.j,
  '{packages}',
  coalesce((select jsonb_agg(np.pkg order by np.ord) from normalized_packages np),'[]'::jsonb),
  true
)
from base;
$function$;

create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1()
);
$function$;


-- ============================================================================
-- 20260930124803 growth_ui_resilience_contract_v1
-- ============================================================================
create or replace function growth_control.ui_resilience_contract_v1()
returns jsonb
language sql
stable
set search_path = ''
as $$
select jsonb_build_object(
  'sv','ui-resilience-contract-v1',
  'locale','zh-Hant',
  'principles',jsonb_build_array(
    'loading_error_empty_are_explicit',
    'one_blocked_feature_does_not_freeze_other_surfaces',
    'mobile_primary_navigation_keeps_all_six_items_reachable',
    'simulation_is_memory_only_and_disappears_after_refresh',
    'technical_status_is_translated_before_display',
    'real_validation_system_scopes_never_share_personal_progress'
  ),
  'surfaces',jsonb_build_object(
    'home',jsonb_build_object(
      'loading','顯示正在同步個人資料，不把快取冒充即時資料',
      'empty','沒有真實進展時明確顯示尚無可追溯證據',
      'error','保留可重新整理／重新登入的恢復入口'
    ),
    'projects',jsonb_build_object(
      'loading','顯示正在載入個人主線',
      'empty','沒有正式主線時只提供候選建立入口',
      'error','顯示實際錯誤，不把保存失敗誤報成功'
    ),
    'inbox',jsonb_build_object(
      'loading','顯示正在載入收件內容',
      'empty','沒有內容時保留單一輸入入口',
      'error','輸入失敗保留原文，避免內容遺失'
    ),
    'learning',jsonb_build_object(
      'loading','顯示正在載入正式學習資料',
      'empty','沒有學習單元時提供真實文字輸入入口',
      'error','回答或建立失敗時保留使用者輸入'
    ),
    'synapse',jsonb_build_object(
      'loading','顯示正在載入知識連結',
      'empty','沒有真實可追溯關係時顯示尚未形成，不使用示範圖冒充',
      'error','讀取失敗時不得回退到個人假資料'
    ),
    'system',jsonb_build_object(
      'loading','顯示正在載入系統控制台',
      'empty','沒有受阻項目時明確顯示目前沒有',
      'error','系統狀態讀取失敗不影響其他核心頁',
      'path_trial','一次只顯示目前階段；AI 未接上時只顯示通用單階段作品骨架'
    )
  ),
  'mobile',jsonb_build_object(
    'primary_nav_items',6,
    'actions_wrap',true,
    'no_horizontal_primary_action_requirement',true
  ),
  'status_source','growth_control.logic_capability_surface_v1',
  'path_trial_source','growth_control.path_artifact_trial_contract_v1',
  'real_acceptance_required',false
);
$$;

create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1(),
  'ui_resilience_contract',growth_control.ui_resilience_contract_v1()
);
$$;


-- ============================================================================
-- 20260930222207 growth_pre_real_usability_contract_v1
-- ============================================================================
create or replace function growth_control.pre_real_usability_contract_v1()
returns jsonb
language sql
stable
security invoker
set search_path = growth_control, public
as $$
  select jsonb_build_object(
    'sv','pre-real-usability-contract-v1',
    'scope','system',
    'trial',jsonb_build_object(
      'entry_modes',jsonb_build_array('curiosity','goal'),
      'render_current_stage_only',true,
      'future_stages_precomputed',false,
      'persist_personal_state',false,
      'ai_dynamic_generation_required_for_personalized_output',true
    ),
    'status_labels',jsonb_build_object(
      'blocked_external','外部能力受阻，其他工作繼續',
      'live','正式資料已連線'
    ),
    'terms',jsonb_build_object(
      'synapse','知識連結',
      'learning_unit','學習單元',
      'real_scope','真實資料'
    ),
    'knowledge_surface',jsonb_build_object(
      'states',jsonb_build_array('loading','empty','error','ready'),
      'signed_out_cached_personal_graph_allowed',false,
      'demo_may_impersonate_personal_data',false
    ),
    'real_acceptance','pending_until_genuine_user_evidence'
  );
$$;

comment on function growth_control.pre_real_usability_contract_v1()
is 'System-only contract for pre-real usability hardening; does not represent personal progress or real-world acceptance.';


-- ============================================================================
-- 20260930222233 growth_system_cockpit_include_pre_real_usability_contract_v1
-- ============================================================================
create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to ''
as $$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1(),
  'ui_resilience_contract',growth_control.ui_resilience_contract_v1(),
  'pre_real_usability_contract',growth_control.pre_real_usability_contract_v1()
);
$$;


-- ============================================================================
-- 20260930222423 growth_pre_real_usability_selfcheck_v1
-- ============================================================================
create or replace function growth_control.pre_real_usability_selfcheck_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with c as (
  select growth_control.pre_real_usability_contract_v1() as v
),
p as (
  select
    has_function_privilege('anon','public.growth_personal_synapse_snapshot_service_v1(uuid)','EXECUTE') as anon_personal_synapse_service,
    has_function_privilege('authenticated','public.growth_personal_synapse_snapshot_service_v1(uuid)','EXECUTE') as auth_personal_synapse_service,
    has_function_privilege('anon','public.growth_synapse_snapshot_v1(text,integer)','EXECUTE') as anon_synapse_snapshot,
    has_function_privilege('authenticated','public.growth_synapse_snapshot_v1(text,integer)','EXECUTE') as auth_synapse_snapshot
)
select jsonb_build_object(
  'sv','pre-real-usability-selfcheck-v1',
  'contract',jsonb_build_object(
    'current_stage_only',(c.v#>>'{trial,render_current_stage_only}')::boolean,
    'future_stages_precomputed',(c.v#>>'{trial,future_stages_precomputed}')::boolean,
    'trial_persists_personal_state',(c.v#>>'{trial,persist_personal_state}')::boolean,
    'signed_out_cached_personal_graph_allowed',(c.v#>>'{knowledge_surface,signed_out_cached_personal_graph_allowed}')::boolean
  ),
  'synapse_rpc_exposure',jsonb_build_object(
    'anon_personal_synapse_service',p.anon_personal_synapse_service,
    'authenticated_personal_synapse_service',p.auth_personal_synapse_service,
    'anon_synapse_snapshot',p.anon_synapse_snapshot,
    'authenticated_synapse_snapshot',p.auth_synapse_snapshot
  ),
  'security_hardening_passed',
    not (
      p.anon_personal_synapse_service
      or p.auth_personal_synapse_service
      or p.anon_synapse_snapshot
      or p.auth_synapse_snapshot
    ),
  'real_acceptance','pending'
)
from c cross join p;
$$;

comment on function growth_control.pre_real_usability_selfcheck_v1()
is 'Read-only structural self-check for pre-real usability and Synapse RPC exposure. Does not upgrade real acceptance.';


-- ============================================================================
-- 20260930222539 growth_pre_real_usability_surface_v1
-- ============================================================================
create or replace function growth_control.pre_real_usability_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with caps as (
  select growth_control.logic_capability_surface_v1(p_person_id,p_project_key) as v
)
select jsonb_build_object(
  'sv','pre-real-usability-surface-v1',
  'scope','system',
  'contract',growth_control.pre_real_usability_contract_v1(),
  'selfcheck',growth_control.pre_real_usability_selfcheck_v1(),
  'relevant_capabilities',coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(caps.v->'items') item
    where item->>'key' in ('language-and-terms','pre-real-usability-hardening','ai-execution-queue','synapse-real-data-only')
  ),'[]'::jsonb),
  'real_acceptance','pending_until_genuine_user_evidence'
)
from caps;
$$;

comment on function growth_control.pre_real_usability_surface_v1(uuid,text)
is 'System-only projection for pre-real usability development; combines canonical contract, structural self-check, and relevant capability states.';


-- ============================================================================
-- 20260930222803 growth_system_cockpit_surface_v2
-- ============================================================================
create or replace function growth_control.system_cockpit_surface_v2(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select jsonb_build_object(
  'sv','system-cockpit-surface-v2',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1(),
  'ui_resilience_contract',growth_control.ui_resilience_contract_v1(),
  'pre_real_usability',growth_control.pre_real_usability_surface_v1(p_person_id,p_project_key)
);
$$;

comment on function growth_control.system_cockpit_surface_v2(uuid,text)
is 'System cockpit v2 including canonical pre-real usability contract and structural self-check. System scope only; does not claim real acceptance.';


-- ============================================================================
-- 20261001232310 growth_ai_job_transition_v1
-- ============================================================================
create or replace function growth_control.ai_job_transition_v1(
  p_job_id uuid,
  p_next_status text,
  p_expected_status text default null,
  p_worker_id text default null,
  p_provider_key text default null,
  p_result jsonb default null,
  p_result_evidence jsonb default '{}'::jsonb,
  p_error jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job growth_control.ai_jobs%rowtype;
  v_allowed boolean := false;
begin
  select * into v_job
  from growth_control.ai_jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'job_not_found');
  end if;

  if p_expected_status is not null and v_job.status <> p_expected_status then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'status_conflict',
      'current_status', v_job.status,
      'expected_status', p_expected_status
    );
  end if;

  if p_next_status not in ('queued','claimed','running','succeeded','failed','cancelled') then
    return jsonb_build_object('accepted', false, 'reason', 'unsupported_next_status');
  end if;

  v_allowed :=
    (v_job.status = 'queued'  and p_next_status in ('claimed','cancelled')) or
    (v_job.status = 'claimed' and p_next_status in ('running','queued','failed','cancelled')) or
    (v_job.status = 'running' and p_next_status in ('succeeded','failed','cancelled')) or
    (v_job.status = 'failed'  and p_next_status in ('queued','cancelled'));

  if not v_allowed then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'illegal_transition',
      'current_status', v_job.status,
      'next_status', p_next_status
    );
  end if;

  if p_next_status = 'claimed' and coalesce(btrim(p_worker_id),'') = '' then
    return jsonb_build_object('accepted', false, 'reason', 'worker_id_required');
  end if;

  if p_next_status = 'running'
     and coalesce(btrim(coalesce(p_worker_id, v_job.claimed_by)),'') = '' then
    return jsonb_build_object('accepted', false, 'reason', 'claimed_worker_required');
  end if;

  if p_worker_id is not null
     and v_job.claimed_by is not null
     and v_job.status in ('claimed','running')
     and p_worker_id <> v_job.claimed_by then
    return jsonb_build_object('accepted', false, 'reason', 'worker_mismatch');
  end if;

  if p_next_status = 'succeeded' then
    if p_result is null
       or jsonb_typeof(coalesce(p_result_evidence,'{}'::jsonb)) <> 'object'
       or coalesce(p_result_evidence,'{}'::jsonb) = '{}'::jsonb then
      return jsonb_build_object(
        'accepted', false,
        'reason', 'result_and_evidence_required'
      );
    end if;
  end if;

  if p_next_status = 'failed' and p_error is null then
    return jsonb_build_object('accepted', false, 'reason', 'error_required');
  end if;

  update growth_control.ai_jobs
  set
    status = p_next_status,
    provider_key = coalesce(p_provider_key, provider_key),
    attempt_no = case when p_next_status = 'claimed' then attempt_no + 1 else attempt_no end,
    claimed_by = case
      when p_next_status = 'claimed' then btrim(p_worker_id)
      when p_next_status = 'queued' then null
      else claimed_by
    end,
    claimed_at = case
      when p_next_status = 'claimed' then now()
      when p_next_status = 'queued' then null
      else claimed_at
    end,
    started_at = case
      when p_next_status = 'running' then coalesce(started_at, now())
      when p_next_status = 'queued' then null
      else started_at
    end,
    completed_at = case
      when p_next_status in ('succeeded','failed','cancelled') then now()
      when p_next_status = 'queued' then null
      else completed_at
    end,
    result = case
      when p_next_status = 'succeeded' then p_result
      when p_next_status = 'queued' then null
      else result
    end,
    result_evidence = case
      when p_next_status = 'succeeded' then p_result_evidence
      when p_next_status = 'queued' then '{}'::jsonb
      else result_evidence
    end,
    error = case
      when p_next_status = 'failed' then p_error
      when p_next_status in ('queued','succeeded') then null
      else error
    end,
    updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return jsonb_build_object(
    'accepted', true,
    'job_id', v_job.id,
    'status', v_job.status,
    'attempt_no', v_job.attempt_no,
    'claimed_by', v_job.claimed_by,
    'provider_key', v_job.provider_key,
    'completed_at', v_job.completed_at,
    'has_result', v_job.result is not null,
    'has_evidence', v_job.result_evidence <> '{}'::jsonb,
    'has_error', v_job.error is not null
  );
end;
$$;

revoke execute on function growth_control.ai_job_transition_v1(
  uuid,text,text,text,text,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function growth_control.ai_job_transition_v1(
  uuid,text,text,text,text,jsonb,jsonb,jsonb
) to service_role;


-- ============================================================================
-- 20261001232421 enable_growth_control_rls_core_tables
-- ============================================================================
alter table growth_control.work_packages enable row level security;
alter table growth_control.knowledge_ingestion_candidates enable row level security;
alter table growth_control.ai_jobs enable row level security;


-- ============================================================================
-- 20261002165803 artifact_evidence_progress_v1
-- ============================================================================
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


-- ============================================================================
-- 20261002170343 artifact_context_link_artifact_evidence_kind
-- ============================================================================
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


-- ============================================================================
-- 20261002170554 artifact_evidence_home_next_action_v1
-- ============================================================================
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
    'personal_synapse',
      growth_control.personal_synapse_snapshot_v2(p_person_id,p_project_key,30),
    'artifact_summary',
      jsonb_build_object(
        'current',(select j->'current' from artifacts),
        'candidate',(select j->'candidate' from artifacts),
        'next_plan_job',(select j->'next_plan_job' from artifacts)
      ),
    'system_health',
      jsonb_build_object(
        'location','system_cockpit',
        'show_build_details_on_personal_home',false,
        'build_in_progress',coalesce((select j->'current' is not null from system_state),false),
        'current_stage',(select j#>>'{current,stage}' from system_state),
        'current_title',(select j#>>'{current,title}' from system_state),
        'current_status',(select j#>>'{current,status}' from system_state),
        'current_blocked',coalesce((select j#>>'{current,status}' from system_state)='blocked',false),
        'parallel_blocker_count',coalesce((select jsonb_array_length(j->'parallel_blockers') from system_state),0)
      ),
    'primary_action',
      case
        when (select jsonb_typeof(j#>'{current,next_evidence_item}') from artifacts)='object' then
          jsonb_build_object(
            'status','personal_artifact_current_step',
            'artifact_id',(select j#>>'{current,id}' from artifacts),
            'route_id',(select j#>>'{current,route_id}' from artifacts),
            'criterion_no',(select j#>>'{current,next_evidence_item,criterion_no}' from artifacts),
            'title','第 '||(select j#>>'{current,next_evidence_item,criterion_no}' from artifacts)
                    ||' 步：'||(select j#>>'{current,next_evidence_item,criterion_text}' from artifacts),
            'why','目前作品：'||coalesce((select j#>>'{current,title}' from artifacts),'目前作品')
                  ||'。只先完成這一項並留下可追溯證據。',
            'success_evidence','保存這一項的真實結果／證據後，系統才前進到下一項。'
          )
        when (select jsonb_typeof(j->'current') from artifacts)='object' then
          jsonb_build_object(
            'status','personal_artifact_ready_to_complete',
            'artifact_id',(select j#>>'{current,id}' from artifacts),
            'route_id',(select j#>>'{current,route_id}' from artifacts),
            'title','完成作品並確認真正驗證到的技能',
            'why',coalesce(
              nullif((select j#>>'{current,title}' from artifacts),''),
              '目前作品'
            )||' 的完成條件都已有證據。',
            'success_evidence','提交作品結果，且只勾選這件作品真的驗證到的技能。'
          )
        when (select jsonb_typeof(j->'candidate') from artifacts)='object' then
          jsonb_build_object(
            'status','personal_artifact_candidate_available',
            'artifact_id',(select j#>>'{candidate,id}' from artifacts),
            'route_id',(select j#>>'{candidate,route_id}' from artifacts),
            'title',(select j#>>'{candidate,title}' from artifacts),
            'why',coalesce(
              nullif((select j#>>'{candidate,objective}' from artifacts),''),
              'GPT 已產生候選作品；只有你確認後才會開始。'
            ),
            'success_evidence',coalesce(
              nullif((select j#>>'{candidate,done_evidence,0}' from artifacts),''),
              nullif((select j#>>'{candidate,deliverable}' from artifacts),''),
              '先確認是否開始；候選作品不會自動升成進行中。'
            )
          )
        when coalesce((select j#>>'{next_plan_job,status}' from artifacts),'') in ('pending','claimed','processing') then
          jsonb_build_object(
            'status','personal_artifact_replanning',
            'job_id',(select j#>>'{next_plan_job,id}' from artifacts),
            'title','正在產生下一件候選作品',
            'why','上一件作品的結果與證據已進入重新規劃；AI 只會產生候選，不會自動開始。',
            'success_evidence','產生一件新的 candidate 作品，並保留技能與證據狀態。'
          )
        else
          (select j->'primary_action' from base)
      end
  );
$function$;


-- ============================================================================
-- 20261002190117 employee_dispatch_admission_gate_v2
-- ============================================================================
CREATE OR REPLACE FUNCTION growth_control.skill_preflight_v2(p_person_id uuid, p_project_key text DEFAULT 'growth-brain'::text, p_task_types text[] DEFAULT '{}'::text[], p_signals text[] DEFAULT '{}'::text[], p_module_key text DEFAULT NULL::text, p_risk text DEFAULT 'low'::text, p_max_skills integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'growth_control', 'public'
AS $function$
with pf as (
  select *
  from growth_control.preflight_v1(
    p_person_id,p_project_key,p_task_types,p_signals,p_module_key,p_risk,p_max_skills
  )
),
joined as (
  select
    pf.*,
    s.metadata,
    s.source_url,
    case
      when pf.availability in ('installed','builtin')
        and pf.status in ('active','conditional')
        and coalesce(s.metadata->>'dispatch_state','eligible') not in ('hold','merged','probation')
        and (not (s.metadata ? 'admission_version') or coalesce(s.metadata->>'admission_state','') = 'passed')
      then true
      else false
    end as runtime_available
  from pf
  join growth_control.skill_registry s
    on s.person_id=p_person_id
   and s.project_key=p_project_key
   and s.skill_key=pf.skill_key
),
exec as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'skill_key',skill_key,
      'role_name',role_name,
      'category',category,
      'required',required,
      'route_priority',route_priority,
      'rationale',rationale,
      'availability',availability,
      'source_url',source_url,
      'runtime_kind',metadata->>'runtime_kind',
      'runtime_skill_uris',coalesce(metadata->'runtime_skill_uris','[]'::jsonb),
      'execution_surface',metadata->>'execution_surface'
    )
    order by required desc, route_priority desc, skill_key
  ),'[]'::jsonb) as items
  from joined
  where runtime_available
),
gaps as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'skill_key',skill_key,
      'role_name',role_name,
      'required',required,
      'availability',availability,
      'rationale',rationale,
      'reason','Role is not admitted for default dispatch, is on hold, or lacks an installed/builtin runtime; inspect registry status and admission evidence.'
    )
    order by required desc, route_priority desc, skill_key
  ),'[]'::jsonb) as items
  from joined
  where not runtime_available
)
select jsonb_build_object(
  'sv','skill-preflight-v2',
  'project_key',p_project_key,
  'task_types',to_jsonb(p_task_types),
  'signals',to_jsonb(p_signals),
  'risk',p_risk,
  'policy',jsonb_build_object(
    'load_skill_entrypoint_before_execution',true,
    'planned_role_may_not_claim_execution',true,
    'builtin_roles_may_coordinate_or_use_declared_connector/work_surface',true,
    'record_usage_after_execution',true
  ),
  'executable_roles',(select items from exec),
  'capability_gaps',(select items from gaps)
);
$function$;

CREATE OR REPLACE FUNCTION growth_control.skill_team_status_v1(p_person_id uuid, p_project_key text DEFAULT 'growth-brain'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'growth_control', 'public'
AS $function$
with roles as (
  select *
  from growth_control.skill_registry
  where person_id=p_person_id
    and project_key=p_project_key
    and status <> 'retired'
),
recent as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_ref',task_ref,
      'skill_key',skill_key,
      'decision',decision,
      'usefulness',usefulness,
      'defects_found',defects_found,
      'rework_count',rework_count,
      'scope_violations',scope_violations,
      'notes',notes,
      'created_at',created_at
    ) order by created_at desc
  ),'[]'::jsonb) as items
  from (
    select *
    from growth_control.skill_usage
    where person_id=p_person_id and project_key=p_project_key
    order by created_at desc
    limit 12
  ) u
)
select jsonb_build_object(
  'sv','skill-team-status-v1',
  'runtime_policy',jsonb_build_object(
    'preflight_function','growth_control.skill_preflight_v2',
    'installed_or_builtin_only_may_execute',true,
    'load_skill_entrypoint_first',true,
    'usage_logging_required',true
  ),
  'executable_roles',coalesce((
    select jsonb_agg(jsonb_build_object(
      'skill_key',skill_key,
      'role_name',role_name,
      'category',category,
      'availability',availability,
      'priority',priority,
      'runtime_kind',metadata->>'runtime_kind',
      'runtime_skill_uris',coalesce(metadata->'runtime_skill_uris','[]'::jsonb),
      'execution_surface',metadata->>'execution_surface'
    ) order by priority desc,skill_key)
    from roles where availability in ('installed','builtin')
      and status in ('active','conditional')
      and coalesce(metadata->>'dispatch_state','eligible') not in ('hold','merged','probation')
      and (not (metadata ? 'admission_version') or coalesce(metadata->>'admission_state','') = 'passed')
  ),'[]'::jsonb),
  'planned_roles',coalesce((
    select jsonb_agg(jsonb_build_object(
      'skill_key',skill_key,
      'role_name',role_name,
      'category',category,
      'availability',availability,
      'trigger_summary',trigger_summary
    ) order by priority desc,skill_key)
    from roles where not (availability in ('installed','builtin')
      and status in ('active','conditional')
      and coalesce(metadata->>'dispatch_state','eligible') not in ('hold','merged','probation')
      and (not (metadata ? 'admission_version') or coalesce(metadata->>'admission_state','') = 'passed'))
  ),'[]'::jsonb),
  'recent_usage',(select items from recent)
);
$function$;


-- ============================================================================
-- 20261003075914 add_tech_radar_evaluation_harness
-- ============================================================================
alter table growth_control.skill_registry
  add column if not exists catalog_state text
  check (catalog_state in ('runtime','trial','planned','method_reference','unavailable'));

alter table growth_control.resource_registry
  add column if not exists catalog_state text
  check (catalog_state in ('runtime','trial','planned','method_reference','unavailable'));

update growth_control.skill_registry
set catalog_state = case
  when availability in ('installed','builtin') then 'runtime'
  when status='candidate' then 'trial'
  when availability='planned' and source_url like 'http%' then 'method_reference'
  when availability='planned' then 'planned'
  else 'unavailable'
end
where catalog_state is null;

update growth_control.resource_registry
set catalog_state = case
  when availability='available' then 'runtime'
  when availability='candidate' then 'trial'
  when availability='planned' and source_url like 'http%' then 'method_reference'
  when availability='planned' then 'planned'
  else 'unavailable'
end
where catalog_state is null;

create table if not exists growth_control.tech_candidates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id),
  project_key text not null default 'growth-brain',
  candidate_key text not null,
  name text not null,
  candidate_kind text not null check (candidate_kind in ('tool','library','skill','method_reference','employee_pattern')),
  source_url text,
  target_gap text not null,
  catalog_state text not null default 'candidate' check (catalog_state in ('candidate','trial','adopted','rejected','deferred')),
  provider_neutral boolean not null default true,
  local_capable boolean not null default true,
  ongoing_cost text not null default 'none',
  integration_risk text not null default 'low' check (integration_risk in ('low','medium','high')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(person_id, project_key, candidate_key)
);

create table if not exists growth_control.tech_trials (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id),
  project_key text not null default 'growth-brain',
  candidate_id uuid not null references growth_control.tech_candidates(id) on delete cascade,
  trial_key text not null,
  hypothesis text not null,
  fixture jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','deferred')),
  result jsonb not null default '{}'::jsonb,
  reviewer_decision text not null default 'pending' check (reviewer_decision in ('pending','adopt','reject','defer','more_samples')),
  personal_truth_unchanged boolean,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(person_id, project_key, trial_key)
);

create table if not exists growth_control.tech_evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.growth_people(id),
  project_key text not null default 'growth-brain',
  test_key text not null,
  category text not null,
  fixture jsonb not null default '{}'::jsonb,
  metric text not null,
  pass_threshold jsonb not null default '{}'::jsonb,
  protected_fields text[] not null default '{}',
  status text not null default 'active' check (status in ('active','retired')),
  latest_result jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(person_id, project_key, test_key)
);

alter table growth_control.tech_candidates enable row level security;
alter table growth_control.tech_trials enable row level security;
alter table growth_control.tech_evaluation_cases enable row level security;

create index if not exists tech_candidates_person_project_idx
  on growth_control.tech_candidates(person_id, project_key, catalog_state);
create index if not exists tech_trials_person_project_idx
  on growth_control.tech_trials(person_id, project_key, status);
create index if not exists tech_eval_person_project_idx
  on growth_control.tech_evaluation_cases(person_id, project_key, status);


-- ============================================================================
-- 20261003080229 add_skill_lifecycle_metrics_view
-- ============================================================================
create or replace view growth_control.skill_lifecycle_metrics_v1
with (security_invoker = true)
as
select
  r.person_id,
  r.project_key,
  r.skill_key,
  r.role_name,
  r.category,
  r.catalog_state,
  r.status,
  coalesce(u.samples,0) as samples,
  coalesce(u.used,0) as used,
  u.avg_usefulness,
  coalesce(u.rework_count,0) as rework_count,
  coalesce(u.scope_violations,0) as scope_violations,
  coalesce(u.defects_found,0) as defects_found,
  case
    when coalesce(u.samples,0) < 3 then 'insufficient_samples'
    when coalesce(u.scope_violations,0) > 0 then 'review_scope'
    when coalesce(u.used,0) = 0 then 'review_overlap_or_routing'
    when u.avg_usefulness is not null and u.avg_usefulness < 3 then 'retirement_candidate'
    else 'keep_or_compare_overlap'
  end as lifecycle_signal
from growth_control.skill_registry r
left join (
  select
    person_id,
    project_key,
    skill_key,
    count(*) as samples,
    count(*) filter (where decision='used') as used,
    round(avg(usefulness)::numeric,2) as avg_usefulness,
    sum(rework_count) as rework_count,
    sum(scope_violations) as scope_violations,
    sum(defects_found) as defects_found
  from growth_control.skill_usage
  group by person_id,project_key,skill_key
) u
  on u.person_id=r.person_id
 and u.project_key=r.project_key
 and u.skill_key=r.skill_key;
