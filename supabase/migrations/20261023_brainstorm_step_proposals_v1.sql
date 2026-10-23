-- 腦力激盪 → 作品：AI 只能「提議」步驟；只有登入的本人能接受。接受時寫進作品既有的關聯表 artifact_context_links（link_kind='work_step'），不改作品完成條件。
create table if not exists growth_control.artifact_context_links_backup_20261023_bsp as select * from growth_control.artifact_context_links;
alter table growth_control.artifact_context_links_backup_20261023_bsp enable row level security;
revoke all on growth_control.artifact_context_links_backup_20261023_bsp from public, anon, authenticated;

alter table growth_control.artifact_context_links drop constraint artifact_context_links_link_kind_check;
alter table growth_control.artifact_context_links add constraint artifact_context_links_link_kind_check check (link_kind = any (array['learning_session','learning_unit','synapse_concept','learning_evidence','source','artifact_evidence','skill_self_claim','skill_list_confirmation','work_step']));

create table if not exists growth_control.brainstorm_step_proposals(
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  topic_id uuid not null references growth_control.brainstorm_topics(id) on delete cascade,
  message_id uuid references growth_control.brainstorm_messages(id) on delete set null,
  artifact_id uuid not null references growth_control.personal_artifacts(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  done_condition text not null check (length(btrim(done_condition)) between 1 and 300),
  proposed_by text not null check (proposed_by ~ '^[a-z0-9][a-z0-9-]{0,39}$' and proposed_by <> 'user'),
  run_id text,
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected')),
  decided_at timestamptz,
  work_link_id uuid references growth_control.artifact_context_links(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bsp_person_status on growth_control.brainstorm_step_proposals(person_id, status, created_at desc);
create index if not exists bsp_topic on growth_control.brainstorm_step_proposals(topic_id);
create index if not exists bsp_artifact on growth_control.brainstorm_step_proposals(artifact_id);
create index if not exists bsp_message on growth_control.brainstorm_step_proposals(message_id);
create index if not exists bsp_link on growth_control.brainstorm_step_proposals(work_link_id);
alter table growth_control.brainstorm_step_proposals enable row level security;
drop policy if exists bsp_owner_read on growth_control.brainstorm_step_proposals;
create policy bsp_owner_read on growth_control.brainstorm_step_proposals for select to authenticated using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
revoke all on growth_control.brainstorm_step_proposals from public, anon, authenticated;
grant select on growth_control.brainstorm_step_proposals to authenticated;

create or replace function growth_control._brainstorm_propose_step_impl_v1(p_person_id uuid, p_agent text, p_topic_id uuid, p_message_id uuid, p_artifact_id uuid, p_title text, p_done_condition text, p_run_id text default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_id uuid;
begin
  if p_artifact_id is null then select related_artifact_id into p_artifact_id from brainstorm_topics where id=p_topic_id and person_id=p_person_id; end if;
  if p_person_id is null then return jsonb_build_object('ok',false,'reason','not_owner'); end if;
  if coalesce(p_agent,'') !~ '^[a-z0-9][a-z0-9-]{0,39}$' or p_agent='user' then return jsonb_build_object('ok',false,'reason','bad_author_agent'); end if;
  if not exists (select 1 from brainstorm_topics where id=p_topic_id and person_id=p_person_id and status='open') then return jsonb_build_object('ok',false,'reason','topic_not_found'); end if;
  if p_message_id is not null and not exists (select 1 from brainstorm_messages where id=p_message_id and topic_id=p_topic_id) then return jsonb_build_object('ok',false,'reason','message_not_in_topic'); end if;
  if not exists (select 1 from personal_artifacts where id=p_artifact_id and person_id=p_person_id and status <> 'abandoned') then return jsonb_build_object('ok',false,'reason','artifact_not_open'); end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 120 or length(btrim(coalesce(p_done_condition,''))) not between 1 and 300 then return jsonb_build_object('ok',false,'reason','bad_length'); end if;
  if (select count(*) from brainstorm_step_proposals where topic_id=p_topic_id and proposed_by=p_agent and status='proposed') >= 3 then return jsonb_build_object('ok',false,'reason','too_many_pending','limit',3); end if;
  if exists (select 1 from brainstorm_step_proposals where artifact_id=p_artifact_id and status in ('proposed','accepted') and lower(btrim(title))=lower(btrim(p_title))) then return jsonb_build_object('ok',false,'reason','duplicate'); end if;
  insert into brainstorm_step_proposals(person_id,topic_id,message_id,artifact_id,title,done_condition,proposed_by,run_id)
  values(p_person_id,p_topic_id,p_message_id,p_artifact_id,btrim(p_title),btrim(p_done_condition),p_agent,left(p_run_id,80)) returning id into v_id;
  return jsonb_build_object('ok',true,'proposal_id',v_id,'status','proposed');
end $f$;
revoke all on function growth_control._brainstorm_propose_step_impl_v1(uuid,text,uuid,uuid,uuid,text,text,text) from public, anon, authenticated, service_role;

-- 連接器／service role 入口（Grok Bot 例行）；登入使用者不提議（使用者直接接受或不要）
create or replace function growth_control.brainstorm_propose_step_v1(p_topic_id uuid, p_artifact_id uuid, p_title text, p_done_condition text, p_author_agent text, p_message_id uuid default null, p_person_id uuid default null, p_run_id text default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
begin
  if auth.uid() is not null then return jsonb_build_object('ok',false,'reason','owner_decides_not_proposes'); end if;
  return growth_control._brainstorm_propose_step_impl_v1(p_person_id,p_author_agent,p_topic_id,p_message_id,p_artifact_id,p_title,p_done_condition,p_run_id);
end $f$;
revoke all on function growth_control.brainstorm_propose_step_v1(uuid,uuid,text,text,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function growth_control.brainstorm_propose_step_v1(uuid,uuid,text,text,text,uuid,uuid,text) to service_role;

-- 只有本人（edge 驗證 JWT 後）能接受／不要
create or replace function public.growth_brainstorm_step_decide_service_v1(p_auth_user_id uuid, p_proposal_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control' as $f$
declare v uuid; pr growth_control.brainstorm_step_proposals; v_link uuid;
begin
  v := growth_control.resolve_single_user_v1(p_auth_user_id);
  if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
  if p_decision not in ('accepted','rejected') then return jsonb_build_object('ok',false,'reason','bad_decision'); end if;
  select * into pr from growth_control.brainstorm_step_proposals where id=p_proposal_id and person_id=v for update;
  if not found then return jsonb_build_object('ok',false,'reason','proposal_not_found'); end if;
  if pr.status<>'proposed' then return jsonb_build_object('ok',false,'reason','already_decided','status',pr.status); end if;
  if p_decision='accepted' then
    insert into growth_control.artifact_context_links(person_id,project_key,artifact_id,link_kind,target_ref,relation,metadata)
    select v, a.project_key, pr.artifact_id, 'work_step', 'brainstorm_proposal:'||pr.id, 'accepted_from_brainstorm',
      jsonb_build_object('title',pr.title,'done_condition',pr.done_condition,'status','todo','proposed_by',pr.proposed_by,'topic_id',pr.topic_id,'message_id',pr.message_id,'accepted_at',now())
    from growth_control.personal_artifacts a where a.id=pr.artifact_id and a.person_id=v
    returning id into v_link;
    if v_link is null then return jsonb_build_object('ok',false,'reason','artifact_not_found'); end if;
  end if;
  update growth_control.brainstorm_step_proposals set status=p_decision, decided_at=now(), work_link_id=v_link where id=pr.id;
  return jsonb_build_object('ok',true,'proposal_id',pr.id,'status',p_decision,'work_link_id',v_link);
end $f$;
revoke all on function public.growth_brainstorm_step_decide_service_v1(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.growth_brainstorm_step_decide_service_v1(uuid,uuid,text) to service_role;

-- 快照加上提議（網站用）
create or replace function growth_control.brainstorm_snapshot_v1(p_person_id uuid)
returns jsonb language sql stable security definer set search_path to 'growth_control','public' as $q$
  select jsonb_build_object('sv','brainstorm-v2','generated_at',now(),'turn_limit_per_agent_per_day',6,
    'topics',coalesce((select jsonb_agg(x order by (x->>'status')='closed', x->>'updated_at' desc) from (
      select to_jsonb(t)-'person_id' || jsonb_build_object(
        'related_title',(select a.title from personal_artifacts a where a.id=t.related_artifact_id),
        'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id) from (select * from brainstorm_messages where topic_id=t.id order by created_at desc limit 200) m),'[]'::jsonb),
        'summary',(select to_jsonb(m) from brainstorm_messages m where m.topic_id=t.id and m.role='summary' order by created_at desc limit 1)) x
      from brainstorm_topics t where t.person_id=p_person_id order by t.updated_at desc limit 50) s),'[]'::jsonb),
    'proposals',coalesce((select jsonb_agg(to_jsonb(p)-'person_id' || jsonb_build_object('artifact_title',a.title) order by p.status<>'proposed', p.created_at desc)
      from (select * from brainstorm_step_proposals where person_id=p_person_id order by created_at desc limit 100) p left join personal_artifacts a on a.id=p.artifact_id),'[]'::jsonb))
$q$;

create or replace function public.growth_brainstorm_agent_service_v1(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control' as $f$
declare k growth_control.brainstorm_agent_tokens; a jsonb := coalesce(p_args,'{}'::jsonb); need text; r jsonb; v_run text; v_ch text;
begin
  if p_token is null or p_token !~ '^gbat_[A-Za-z0-9_-]{32,}$' then return jsonb_build_object('ok',false,'reason','invalid_token'); end if;
  select * into k from growth_control.brainstorm_agent_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null;
  if not found then return jsonb_build_object('ok',false,'reason','invalid_token'); end if;
  need := case p_action when 'read' then 'brainstorm.read' when 'post' then 'brainstorm.post' when 'open_topic' then 'brainstorm.open' when 'research' then 'research.read' when 'propose_step' then 'brainstorm.post' end;
  if need is null then return jsonb_build_object('ok',false,'reason','unsupported_action'); end if;
  if not need = any(k.scopes) then return jsonb_build_object('ok',false,'reason','scope_denied'); end if;
  update growth_control.brainstorm_agent_tokens set last_used_at=now() where id=k.id;
  if p_action='read' then
    return growth_control.brainstorm_read_v1(nullif(a->>'topic_id','')::uuid, nullif(a->>'since','')::timestamptz, k.agent, k.person_id, coalesce((a->>'limit')::int,50));
  elsif p_action='post' then
    v_run := nullif(btrim(coalesce(a->>'run_id','')),''); v_ch := coalesce(nullif(a->>'channel',''),'agent-api');
    if v_run is not null and length(v_run)>80 then return jsonb_build_object('ok',false,'reason','bad_run_id'); end if;
    if v_run is not null and exists (select 1 from growth_control.brainstorm_messages m where m.topic_id=(a->>'topic_id')::uuid and m.author_agent=k.agent and m.meta->>'run_id'=v_run) then
      return jsonb_build_object('ok',false,'reason','run_turn_used'); end if;
    r := growth_control._brainstorm_post_impl_v1((a->>'topic_id')::uuid, a->>'role', a->>'body', coalesce(a->'sources','[]'::jsonb), nullif(a->>'reply_to','')::uuid, k.agent, nullif(a->>'seen_last_message_id','')::uuid, k.person_id);
    if coalesce((r->>'ok')::boolean,false) then
      update growth_control.brainstorm_messages set meta = jsonb_strip_nulls(jsonb_build_object('run_id',v_run,'run_note',left(nullif(a->>'run_note',''),500),'channel',left(v_ch,40),'token_id',k.id)) where id=(r->>'message_id')::uuid;
    end if;
    return r;
  elsif p_action='propose_step' then
    return growth_control._brainstorm_propose_step_impl_v1(k.person_id, k.agent, (a->>'topic_id')::uuid, nullif(a->>'message_id','')::uuid, nullif(a->>'artifact_id','')::uuid, a->>'title', a->>'done_condition', nullif(a->>'run_id',''));
  elsif p_action='open_topic' then
    return growth_control._brainstorm_open_topic_impl_v1(a->>'title', a->>'goal', null, k.agent, a->'opening', k.person_id);
  else
    return jsonb_build_object('ok',true,'agent',k.agent,'researcher_log',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'occurred_at',l.occurred_at,'kind',l.kind,'title',l.title,'summary',l.summary,'link',l.link) order by l.occurred_at desc)
      from (select * from growth_control.researcher_log where person_id=k.person_id and (a->>'since' is null or occurred_at > (a->>'since')::timestamptz) order by occurred_at desc limit least(greatest(coalesce((a->>'limit')::int,30),1),100)) l),'[]'::jsonb));
  end if;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation then
  return jsonb_build_object('ok',false,'reason','bad_args');
end $f$;
revoke all on function public.growth_brainstorm_agent_service_v1(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.growth_brainstorm_agent_service_v1(text,text,jsonb) to service_role;
