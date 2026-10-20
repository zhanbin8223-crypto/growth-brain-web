-- 每個 AI 一把專用憑證（只存 sha256 雜湊），身分綁在憑證上；關閉 service role 自稱 'user' 的漏洞
create table if not exists growth_control.brainstorm_agent_tokens(
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent ~ '^[a-z0-9][a-z0-9-]{0,39}$' and agent <> 'user'),
  person_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default array['brainstorm.read','brainstorm.post','brainstorm.open','research.read'],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  note text
);
alter table growth_control.brainstorm_agent_tokens enable row level security;
revoke all on growth_control.brainstorm_agent_tokens from public, anon, authenticated;

-- 內部實作：不授權給任何 API 角色，只由下面的 definer 函式呼叫
create or replace function growth_control._brainstorm_open_topic_impl_v1(p_title text, p_goal text default null, p_related_artifact_id uuid default null, p_author_agent text default null, p_opening jsonb default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_person uuid; v_author text; v_id uuid;
begin
  v_person := p_person_id; v_author := coalesce(p_author_agent,'');
  if v_person is null then return jsonb_build_object('ok',false,'reason','not_owner'); end if;
  if v_author !~ '^[a-z0-9][a-z0-9-]{0,39}$' then return jsonb_build_object('ok',false,'reason','bad_author_agent'); end if;
  if p_related_artifact_id is not null and not exists (select 1 from growth_control.personal_artifacts a where a.id=p_related_artifact_id and a.person_id=v_person) then
    return jsonb_build_object('ok',false,'reason','artifact_not_owned'); end if;
  insert into growth_control.brainstorm_topics(person_id,title,goal,related_artifact_id,created_by)
  values(v_person,btrim(p_title),nullif(btrim(coalesce(p_goal,'')),''),p_related_artifact_id,v_author) returning id into v_id;
  if p_opening is not null and coalesce(p_opening->>'body','')<>'' then
    insert into growth_control.brainstorm_messages(topic_id,author_agent,role,body,sources)
    values(v_id,v_author,coalesce(p_opening->>'role',case when v_author='user' then 'nudge' else 'idea' end),p_opening->>'body',coalesce(p_opening->'sources','[]'::jsonb));
  end if;
  return jsonb_build_object('ok',true,'topic_id',v_id);
end $f$;

create or replace function growth_control._brainstorm_post_impl_v1(p_topic_id uuid, p_role text, p_body text, p_sources jsonb default '[]'::jsonb, p_reply_to uuid default null, p_author_agent text default null, p_seen_last_message_id uuid default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_person uuid; v_author text; t record; v_last uuid; v_today int; v_id uuid;
begin
  v_person := p_person_id; v_author := coalesce(p_author_agent,'');
  if v_person is null then return jsonb_build_object('ok',false,'reason','not_owner'); end if;
  if v_author !~ '^[a-z0-9][a-z0-9-]{0,39}$' then return jsonb_build_object('ok',false,'reason','bad_author_agent'); end if;
  select * into t from growth_control.brainstorm_topics where id=p_topic_id and person_id=v_person for update;
  if not found then return jsonb_build_object('ok',false,'reason','topic_not_found'); end if;
  if t.status<>'open' then return jsonb_build_object('ok',false,'reason','topic_closed'); end if;
  if p_reply_to is not null and not exists (select 1 from growth_control.brainstorm_messages where id=p_reply_to and topic_id=p_topic_id) then
    return jsonb_build_object('ok',false,'reason','reply_to_not_in_topic'); end if;
  select id into v_last from growth_control.brainstorm_messages where topic_id=p_topic_id order by created_at desc, id desc limit 1;
  if v_author<>'user' then
    if v_last is not null and p_seen_last_message_id is distinct from v_last then
      return jsonb_build_object('ok',false,'reason','stale_read','last_message_id',v_last); end if;
    select count(*) into v_today from growth_control.brainstorm_messages where topic_id=p_topic_id and author_agent=v_author
      and (created_at at time zone 'Asia/Taipei')::date = (now() at time zone 'Asia/Taipei')::date;
    if v_today >= 6 then return jsonb_build_object('ok',false,'reason','daily_turn_limit','limit',6); end if;
  end if;
  insert into growth_control.brainstorm_messages(topic_id,author_agent,role,body,sources,reply_to)
  values(p_topic_id,v_author,coalesce(p_role,case when v_author='user' then 'nudge' else 'idea' end),p_body,coalesce(p_sources,'[]'::jsonb),p_reply_to) returning id into v_id;
  update growth_control.brainstorm_topics set updated_at=now() where id=p_topic_id;
  return jsonb_build_object('ok',true,'message_id',v_id);
end $f$;

revoke all on function growth_control._brainstorm_open_topic_impl_v1(text,text,uuid,text,jsonb,uuid) from public, anon, authenticated, service_role;
revoke all on function growth_control._brainstorm_post_impl_v1(uuid,text,text,jsonb,uuid,text,uuid,uuid) from public, anon, authenticated, service_role;

-- 公開入口：登入本人 → 作者固定 'user'；其他呼叫者不得自稱 'user'
create or replace function growth_control.brainstorm_open_topic_v1(p_title text, p_goal text default null, p_related_artifact_id uuid default null, p_author_agent text default null, p_opening jsonb default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_uid uuid := auth.uid(); begin
  if v_uid is not null then return growth_control._brainstorm_open_topic_impl_v1(p_title,p_goal,p_related_artifact_id,'user',p_opening,growth_control.resolve_single_user_v1(v_uid)); end if;
  if coalesce(p_author_agent,'')='user' then return jsonb_build_object('ok',false,'reason','user_author_reserved'); end if;
  return growth_control._brainstorm_open_topic_impl_v1(p_title,p_goal,p_related_artifact_id,p_author_agent,p_opening,p_person_id);
end $f$;
create or replace function growth_control.brainstorm_post_v1(p_topic_id uuid, p_role text, p_body text, p_sources jsonb default '[]'::jsonb, p_reply_to uuid default null, p_author_agent text default null, p_seen_last_message_id uuid default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_uid uuid := auth.uid(); begin
  if v_uid is not null then return growth_control._brainstorm_post_impl_v1(p_topic_id,p_role,p_body,p_sources,p_reply_to,'user',p_seen_last_message_id,growth_control.resolve_single_user_v1(v_uid)); end if;
  if coalesce(p_author_agent,'')='user' then return jsonb_build_object('ok',false,'reason','user_author_reserved'); end if;
  return growth_control._brainstorm_post_impl_v1(p_topic_id,p_role,p_body,p_sources,p_reply_to,p_author_agent,p_seen_last_message_id,p_person_id);
end $f$;

create or replace function public.growth_brainstorm_user_post_service_v1(p_auth_user_id uuid, p_topic_id uuid, p_body text, p_title text default null, p_goal text default null, p_related_artifact_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 if p_topic_id is null then
   return growth_control._brainstorm_open_topic_impl_v1(p_title,p_goal,p_related_artifact_id,'user',case when coalesce(p_body,'')<>'' then jsonb_build_object('role','nudge','body',p_body) end,v);
 end if;
 return growth_control._brainstorm_post_impl_v1(p_topic_id,'nudge',p_body,'[]'::jsonb,null,'user',null,v); end $f$;

-- AI 憑證入口（只給 service_role；由 edge function brainstorm-agent 呼叫）
create or replace function public.growth_brainstorm_agent_service_v1(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control' as $f$
declare k growth_control.brainstorm_agent_tokens; a jsonb := coalesce(p_args,'{}'::jsonb); need text;
begin
  if p_token is null or p_token !~ '^gbat_[A-Za-z0-9_-]{32,}$' then return jsonb_build_object('ok',false,'reason','invalid_token'); end if;
  select * into k from growth_control.brainstorm_agent_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null;
  if not found then return jsonb_build_object('ok',false,'reason','invalid_token'); end if;
  need := case p_action when 'read' then 'brainstorm.read' when 'post' then 'brainstorm.post' when 'open_topic' then 'brainstorm.open' when 'research' then 'research.read' end;
  if need is null then return jsonb_build_object('ok',false,'reason','unsupported_action'); end if;
  if not need = any(k.scopes) then return jsonb_build_object('ok',false,'reason','scope_denied'); end if;
  update growth_control.brainstorm_agent_tokens set last_used_at=now() where id=k.id;
  if p_action='read' then
    return growth_control.brainstorm_read_v1(nullif(a->>'topic_id','')::uuid, nullif(a->>'since','')::timestamptz, k.agent, k.person_id, coalesce((a->>'limit')::int,50));
  elsif p_action='post' then
    return growth_control._brainstorm_post_impl_v1((a->>'topic_id')::uuid, a->>'role', a->>'body', coalesce(a->'sources','[]'::jsonb), nullif(a->>'reply_to','')::uuid, k.agent, nullif(a->>'seen_last_message_id','')::uuid, k.person_id);
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
