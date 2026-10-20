-- AI 腦力激盪：多個 AI（grok-bot、gpt…）與使用者在同一主題下討論。新表，無需備份。
create table if not exists growth_control.brainstorm_topics(
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  goal text,
  status text not null default 'open' check (status in ('open','closed')),
  related_artifact_id uuid references growth_control.personal_artifacts(id) on delete set null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists growth_control.brainstorm_messages(
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references growth_control.brainstorm_topics(id) on delete cascade,
  author_agent text not null check (author_agent ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  role text not null check (role in ('idea','critique','question','summary','nudge')),
  body text not null check (length(body) between 1 and 8000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources)='array'),
  reply_to uuid references growth_control.brainstorm_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists brainstorm_topics_person on growth_control.brainstorm_topics(person_id, updated_at desc);
create index if not exists brainstorm_messages_topic on growth_control.brainstorm_messages(topic_id, created_at);
create index if not exists brainstorm_messages_reply on growth_control.brainstorm_messages(reply_to);
alter table growth_control.brainstorm_topics enable row level security;
alter table growth_control.brainstorm_messages enable row level security;
drop policy if exists bt_owner_read on growth_control.brainstorm_topics;
create policy bt_owner_read on growth_control.brainstorm_topics for select to authenticated
  using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
drop policy if exists bm_owner_read on growth_control.brainstorm_messages;
create policy bm_owner_read on growth_control.brainstorm_messages for select to authenticated
  using (exists (select 1 from growth_control.brainstorm_topics t where t.id=topic_id and t.person_id = growth_control.resolve_single_user_v1((select auth.uid()))));
revoke all on growth_control.brainstorm_topics, growth_control.brainstorm_messages from public, anon, authenticated;
grant select on growth_control.brainstorm_topics, growth_control.brainstorm_messages to authenticated;

-- 呼叫者身分：有 auth.uid() → 使用者本人（author 強制 'user'）；否則（service_role／連接器）→ 用 p_person_id 與 p_author_agent
create or replace function growth_control.brainstorm_open_topic_v1(p_title text, p_goal text default null, p_related_artifact_id uuid default null, p_author_agent text default null, p_opening jsonb default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_person uuid; v_author text; v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is not null then v_person := growth_control.resolve_single_user_v1(v_uid); v_author := 'user';
  else v_person := p_person_id; v_author := coalesce(p_author_agent,'');
  end if;
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

-- 防迴圈：①代理（非 user）必須帶 p_seen_last_message_id＝目前最新一則的 id（證明先讀過）；②同一代理同一主題每天（台北時間）最多 6 則；③主題關閉後不能再貼
create or replace function growth_control.brainstorm_post_v1(p_topic_id uuid, p_role text, p_body text, p_sources jsonb default '[]'::jsonb, p_reply_to uuid default null, p_author_agent text default null, p_seen_last_message_id uuid default null, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare v_person uuid; v_author text; t record; v_last uuid; v_today int; v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is not null then v_person := growth_control.resolve_single_user_v1(v_uid); v_author := 'user';
  else v_person := p_person_id; v_author := coalesce(p_author_agent,''); end if;
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

create or replace function growth_control.brainstorm_snapshot_v1(p_person_id uuid)
returns jsonb language sql stable security definer set search_path to 'growth_control','public' as $f$
  select jsonb_build_object('sv','brainstorm-v1','generated_at',now(),'turn_limit_per_agent_per_day',6,
    'topics',coalesce((select jsonb_agg(x order by (x->>'status')='closed', x->>'updated_at' desc) from (
      select to_jsonb(t)-'person_id' || jsonb_build_object(
        'related_title',(select a.title from growth_control.personal_artifacts a where a.id=t.related_artifact_id),
        'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id) from (select * from growth_control.brainstorm_messages where topic_id=t.id order by created_at desc limit 200) m),'[]'::jsonb),
        'summary',(select to_jsonb(m) from growth_control.brainstorm_messages m where m.topic_id=t.id and m.role='summary' order by created_at desc limit 1)) x
      from growth_control.brainstorm_topics t where t.person_id=p_person_id order by t.updated_at desc limit 50) s),'[]'::jsonb))
$f$;

-- edge function 用的 service 包裝（網站使用者經由 growth-home）
create or replace function public.growth_brainstorm_service_v1(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.brainstorm_snapshot_v1(v); end $f$;
create or replace function public.growth_brainstorm_user_post_service_v1(p_auth_user_id uuid, p_topic_id uuid, p_body text, p_title text default null, p_goal text default null, p_related_artifact_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 if p_topic_id is null then
   return growth_control.brainstorm_open_topic_v1(p_title,p_goal,p_related_artifact_id,'user',case when coalesce(p_body,'')<>'' then jsonb_build_object('role','nudge','body',p_body) end,v);
 end if;
 return growth_control.brainstorm_post_v1(p_topic_id,'nudge',p_body,'[]'::jsonb,null,'user',null,v); end $f$;

revoke all on function growth_control.brainstorm_open_topic_v1(text,text,uuid,text,jsonb,uuid) from public, anon;
revoke all on function growth_control.brainstorm_post_v1(uuid,text,text,jsonb,uuid,text,uuid,uuid) from public, anon;
revoke all on function growth_control.brainstorm_snapshot_v1(uuid) from public, anon, authenticated;
revoke all on function public.growth_brainstorm_service_v1(uuid) from public, anon, authenticated;
revoke all on function public.growth_brainstorm_user_post_service_v1(uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function growth_control.brainstorm_open_topic_v1(text,text,uuid,text,jsonb,uuid) to authenticated, service_role;
grant execute on function growth_control.brainstorm_post_v1(uuid,text,text,jsonb,uuid,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.growth_brainstorm_service_v1(uuid) to service_role;
grant execute on function public.growth_brainstorm_user_post_service_v1(uuid,uuid,text,text,text,uuid) to service_role;
