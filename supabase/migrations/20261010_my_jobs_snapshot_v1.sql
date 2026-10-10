-- my-questions v1: read-only job list + owner-only cancel (openspec/changes/my-questions)
create or replace function growth_control.my_jobs_snapshot_v1(p_person_id uuid)
returns jsonb language sql stable set search_path to '' as $f$
with hb as (
  select max(last_seen_at) last_seen from growth_control.ai_worker_heartbeats where person_id=p_person_id and project_key='growth-brain'
), j as (
  select j.* from growth_control.ai_jobs j
  where j.person_id=p_person_id and j.project_key='growth-brain' and j.data_scope in ('real','system')
  order by j.created_at desc limit 100
)
select jsonb_build_object(
  'sv','my-jobs-snapshot-v1','generated_at',now(),
  'worker',jsonb_build_object('last_seen_at',(select last_seen from hb),
     'online',coalesce((select last_seen >= now()-interval '10 minutes' from hb),false),
     'offline_threshold_minutes',10),
  'jobs',coalesce((select jsonb_agg(jsonb_build_object(
     'id',j.id,'scope',j.data_scope,'task_type',j.task_type,'source_kind',j.source_kind,'source_ref',j.source_ref,'status',j.status,'attempt_no',j.attempt_no,
     'title',coalesce(nullif(j.task_payload->>'title',''),nullif(j.task_payload->>'goal',''),nullif(j.task_payload->>'question',''),j.task_type),
     'created_at',j.created_at,'started_at',j.started_at,'completed_at',j.completed_at,'updated_at',j.updated_at,
     'wait_seconds',extract(epoch from (coalesce(j.started_at,j.completed_at,now())-j.created_at))::int,
     'result_summary',left(coalesce(j.result->>'text',j.result->>'summary',j.result->>'title',''),280),
     'error_message',left(coalesce(j.error->>'message',j.error->>'reason',''),280),
     'cancellable',j.status in ('pending','failed') and j.task_type not in ('path_plan','inbox_triage','artifact_stage_unblock'),
     'session_id',j.task_payload->>'session_id'
   ) order by j.created_at desc) from j),'[]'::jsonb));
$f$;

create or replace function growth_control.my_job_cancel_v1(p_person_id uuid, p_job_id uuid)
returns jsonb language plpgsql set search_path to '' as $f$
declare v growth_control.ai_jobs%rowtype;
begin
  select * into v from growth_control.ai_jobs where id=p_job_id and person_id=p_person_id and project_key='growth-brain' for update;
  if not found then return jsonb_build_object('accepted',false,'reason','job_not_found'); end if;
  if v.status not in ('pending','failed') then return jsonb_build_object('accepted',false,'reason','job_not_cancellable_in_status_'||v.status); end if;
  if v.task_type in ('path_plan','inbox_triage','artifact_stage_unblock') then return jsonb_build_object('accepted',false,'reason','pipeline_job_not_user_cancellable'); end if;
  update growth_control.ai_jobs set status='cancelled',
    provenance=coalesce(provenance,'{}'::jsonb)||jsonb_build_object('cancelled_by','owner','cancelled_at',now(),'cancelled_from_status',v.status)
  where id=p_job_id;
  return jsonb_build_object('accepted',true,'job_id',p_job_id,'status','cancelled');
end $f$;

create or replace function public.growth_my_jobs_snapshot_service_v1(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.my_jobs_snapshot_v1(v); end $f$;
create or replace function public.growth_my_job_cancel_service_v1(p_auth_user_id uuid, p_job_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.my_job_cancel_v1(v,p_job_id); end $f$;
revoke all on function public.growth_my_jobs_snapshot_service_v1(uuid) from public, anon, authenticated;
revoke all on function public.growth_my_job_cancel_service_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.growth_my_jobs_snapshot_service_v1(uuid) to service_role;
grant execute on function public.growth_my_job_cancel_service_v1(uuid,uuid) to service_role;
revoke all on function growth_control.my_jobs_snapshot_v1(uuid) from public, anon, authenticated;
revoke all on function growth_control.my_job_cancel_v1(uuid,uuid) from public, anon, authenticated;
