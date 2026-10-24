create or replace function public.growth_roadmap_snapshot_service_v1(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v uuid := growth_control.resolve_single_user_v1(p_auth_user_id);
begin
  if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
  return jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'node_key',n.node_key,'name_zh',n.name_zh,'sort_order',n.sort_order,
        'parent_id',n.parent_id,'artifact_id',n.artifact_id,'done_condition',n.done_condition,'status',n.status,'proposed_reason',n.proposed_reason) order by n.sort_order)
      from growth_control.roadmap_nodes n where n.person_id=v and n.status in ('active','proposed')),'[]'::jsonb),
    'current', coalesce((select jsonb_object_agg(a.id::text, a.current_node_id) from growth_control.personal_artifacts a where a.person_id=v and a.current_node_id is not null),'{}'::jsonb),
    'findings', coalesce((select jsonb_agg(jsonb_build_object('log_id',l.log_id,'node_id',l.node_id,'artifact_id',l.artifact_id,'relation',l.relation,
        'rationale',l.rationale,'usable',l.usable,'title',r.title,'summary',r.summary,'link',r.link,'source',r.source,'occurred_at',r.occurred_at) order by r.occurred_at desc)
      from growth_control.research_node_links l join growth_control.researcher_log r on r.id=l.log_id where l.person_id=v),'[]'::jsonb));
end $$;
create or replace function public.growth_roadmap_node_decide_service_v1(p_auth_user_id uuid, p_node_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := growth_control.resolve_single_user_v1(p_auth_user_id); v_row growth_control.roadmap_nodes;
begin
  if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
  if p_decision not in ('accept','reject') then return jsonb_build_object('accepted',false,'reason','bad_decision'); end if;
  select * into v_row from growth_control.roadmap_nodes where id=p_node_id and person_id=v for update;
  if not found then return jsonb_build_object('accepted',false,'reason','node_not_found'); end if;
  if v_row.status<>'proposed' then return jsonb_build_object('accepted',false,'reason','not_proposed'); end if;
  update growth_control.roadmap_nodes set status=case when p_decision='accept' then 'active' else 'rejected' end, updated_at=now() where id=p_node_id;
  return jsonb_build_object('accepted',true,'id',p_node_id,'status',case when p_decision='accept' then 'active' else 'rejected' end);
end $$;
revoke all on function public.growth_roadmap_snapshot_service_v1(uuid) from public, anon, authenticated;
revoke all on function public.growth_roadmap_node_decide_service_v1(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.growth_roadmap_snapshot_service_v1(uuid) to service_role;
grant execute on function public.growth_roadmap_node_decide_service_v1(uuid,uuid,text) to service_role;
