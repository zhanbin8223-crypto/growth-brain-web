-- Artifact team builder slice 1: expose the existing resource registry through the authenticated system cockpit.
-- No new tables or employee records are created.
create or replace function growth_control.system_cockpit_surface_v1(
  p_person_id uuid,
  p_project_key text default 'growth-brain'::text
)
returns jsonb
language sql
stable
set search_path to ''
as $function$
select jsonb_build_object(
  'sv','system-cockpit-surface-v1',
  'surface','system_cockpit',
  'generated_at',now(),
  'ceo',growth_control.ceo_project_state_v1(p_person_id,p_project_key),
  'work_queue',growth_control.web_work_queue_surface_v1(p_person_id,p_project_key),
  'skill_team',growth_control.skill_team_status_v1(p_person_id,p_project_key),
  'resource_catalog',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'resource_key',r.resource_key,
        'resource_type',r.resource_type,
        'name',r.name,
        'capabilities',to_jsonb(r.capabilities),
        'availability',r.availability,
        'status',r.status,
        'priority',r.priority,
        'conditions',r.conditions,
        'catalog_state',r.catalog_state
      )
      order by r.priority desc,r.resource_key
    )
    from growth_control.resource_registry r
    where r.person_id=p_person_id
      and r.project_key=p_project_key
      and r.status <> 'retired'
  ),'[]'::jsonb),
  'website_logic_audit',growth_control.website_logic_audit_v1(p_person_id,p_project_key),
  'capabilities',growth_control.logic_capability_surface_v1(p_person_id,p_project_key),
  'path_trial_contract',growth_control.path_artifact_trial_contract_v1(),
  'language_contract',growth_control.ui_language_contract_v1(),
  'ui_resilience_contract',growth_control.ui_resilience_contract_v1(),
  'pre_real_usability_contract',growth_control.pre_real_usability_contract_v1()
);
$function$;
