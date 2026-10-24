create table growth_control.roadmap_nodes(
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null, project_key text not null default 'growth-brain',
  artifact_id uuid references growth_control.personal_artifacts(id) on delete cascade,
  parent_id uuid references growth_control.roadmap_nodes(id) on delete cascade,
  node_key text not null, name_zh text not null,
  sort_order numeric not null, done_condition text, criterion_no integer,
  status text not null default 'active' check (status in ('active','proposed','rejected','archived')),
  proposed_reason text, created_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(person_id, project_key, node_key));
create index on growth_control.roadmap_nodes(parent_id);
create index on growth_control.roadmap_nodes(artifact_id);
alter table growth_control.personal_artifacts add column current_node_id uuid references growth_control.roadmap_nodes(id) on delete set null;
create table growth_control.research_node_links(
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  log_id uuid not null references growth_control.researcher_log(id) on delete cascade,
  node_id uuid not null references growth_control.roadmap_nodes(id) on delete cascade,
  artifact_id uuid references growth_control.personal_artifacts(id) on delete cascade,
  relation text not null check (relation in ('supports','sub_item','proposes_new_stage')),
  rationale text not null, usable jsonb not null default '{}'::jsonb,
  confidence numeric, classified_by text,
  created_at timestamptz not null default now(), unique(log_id,node_id));
create index on growth_control.research_node_links(node_id);
create index on growth_control.research_node_links(artifact_id);
alter table growth_control.roadmap_nodes enable row level security;
alter table growth_control.research_node_links enable row level security;
revoke all on growth_control.roadmap_nodes, growth_control.research_node_links from anon, authenticated;
grant select on growth_control.roadmap_nodes, growth_control.research_node_links to authenticated;
grant all on growth_control.roadmap_nodes, growth_control.research_node_links to service_role;
create policy rn_owner_read on growth_control.roadmap_nodes for select to authenticated
  using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
create policy rnl_owner_read on growth_control.research_node_links for select to authenticated
  using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
create or replace function growth_control.roadmap_node_decide_v1(p_node_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := growth_control.resolve_single_user_v1(auth.uid()); v_row growth_control.roadmap_nodes;
begin
  if p_decision not in ('accept','reject') then raise exception 'decision must be accept|reject'; end if;
  select * into v_row from growth_control.roadmap_nodes where id = p_node_id for update;
  if not found then raise exception 'node not found'; end if;
  if v_me is null or v_row.person_id <> v_me then raise exception 'forbidden'; end if;
  if v_row.status <> 'proposed' then raise exception 'node is not proposed (status=%)', v_row.status; end if;
  update growth_control.roadmap_nodes set status = case when p_decision='accept' then 'active' else 'rejected' end, updated_at = now() where id = p_node_id;
  return jsonb_build_object('id',p_node_id,'status',case when p_decision='accept' then 'active' else 'rejected' end);
end $$;
revoke all on function growth_control.roadmap_node_decide_v1(uuid,text) from public, anon;
grant execute on function growth_control.roadmap_node_decide_v1(uuid,text) to authenticated, service_role;
