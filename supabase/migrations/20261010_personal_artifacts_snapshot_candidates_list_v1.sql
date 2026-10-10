-- Additive: expose all candidate artifacts as 'candidates' (existing 'candidate' key unchanged)
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
  'candidates',coalesce((
    select jsonb_agg(to_jsonb(x)-'person_id'-'project_key' order by x.created_at desc)
    from a x
    where status='candidate'
  ),'[]'::jsonb),
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
$function$
;
