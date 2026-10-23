-- 腦力激盪每日上限單一來源：brainstorm_daily_limit_v1()=100，執行與兩個顯示共用

create or replace function growth_control.brainstorm_daily_limit_v1() returns int language sql immutable parallel safe set search_path = '' as $$ select 100 $$;

CREATE OR REPLACE FUNCTION growth_control._brainstorm_post_impl_v1(p_topic_id uuid, p_role text, p_body text, p_sources jsonb DEFAULT '[]'::jsonb, p_reply_to uuid DEFAULT NULL::uuid, p_author_agent text DEFAULT NULL::text, p_seen_last_message_id uuid DEFAULT NULL::uuid, p_person_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'growth_control', 'public'
AS $function$
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
    if v_today >= growth_control.brainstorm_daily_limit_v1() then return jsonb_build_object('ok',false,'reason','daily_turn_limit','limit',growth_control.brainstorm_daily_limit_v1()); end if;
  end if;
  insert into growth_control.brainstorm_messages(topic_id,author_agent,role,body,sources,reply_to)
  values(p_topic_id,v_author,coalesce(p_role,case when v_author='user' then 'nudge' else 'idea' end),p_body,coalesce(p_sources,'[]'::jsonb),p_reply_to) returning id into v_id;
  update growth_control.brainstorm_topics set updated_at=now() where id=p_topic_id;
  return jsonb_build_object('ok',true,'message_id',v_id);
end $function$;

CREATE OR REPLACE FUNCTION growth_control.brainstorm_read_v1(p_topic_id uuid DEFAULT NULL::uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_agent text DEFAULT NULL::text, p_person_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'growth_control', 'public'
AS $function$
declare v_person uuid; v_uid uuid := auth.uid(); v_agent text;
begin
  if v_uid is not null then v_person := growth_control.resolve_single_user_v1(v_uid); v_agent := 'user';
  else v_person := p_person_id; v_agent := coalesce(p_agent,''); end if;
  if v_person is null then return jsonb_build_object('ok',false,'reason','not_owner'); end if;
  return jsonb_build_object('ok',true,'agent',v_agent,'turn_limit_per_day',growth_control.brainstorm_daily_limit_v1(),'topics',coalesce((
    select jsonb_agg(jsonb_build_object(
      'topic_id',t.id,'title',t.title,'goal',t.goal,'status',t.status,'related_artifact_id',t.related_artifact_id,
      'last_message_id',(select m.id from brainstorm_messages m where m.topic_id=t.id order by created_at desc,id desc limit 1),
      'my_last_at',(select max(created_at) from brainstorm_messages m where m.topic_id=t.id and m.author_agent=v_agent),
      'unanswered_by_me',exists(select 1 from brainstorm_messages m where m.topic_id=t.id and m.author_agent<>v_agent
          and m.created_at > coalesce((select max(created_at) from brainstorm_messages x where x.topic_id=t.id and x.author_agent=v_agent),'-infinity')),
      'my_turns_today',(select count(*) from brainstorm_messages m where m.topic_id=t.id and m.author_agent=v_agent and (m.created_at at time zone 'Asia/Taipei')::date=(now() at time zone 'Asia/Taipei')::date),
      'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from (select * from brainstorm_messages m where m.topic_id=t.id and (p_since is null or m.created_at>p_since) order by created_at desc,id desc limit least(greatest(coalesce(p_limit,50),1),200)) m),'[]'::jsonb)
    ) order by t.updated_at desc)
    from brainstorm_topics t where t.person_id=v_person and (p_topic_id is null or t.id=p_topic_id) and (p_topic_id is not null or t.status='open')),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION growth_control.brainstorm_snapshot_v1(p_person_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'growth_control', 'public'
AS $function$
  select jsonb_build_object('sv','brainstorm-v2','generated_at',now(),'turn_limit_per_agent_per_day',growth_control.brainstorm_daily_limit_v1(),
    'topics',coalesce((select jsonb_agg(x order by (x->>'status')='closed', x->>'updated_at' desc) from (
      select to_jsonb(t)-'person_id' || jsonb_build_object(
        'related_title',(select a.title from personal_artifacts a where a.id=t.related_artifact_id),
        'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at, m.id) from (select * from brainstorm_messages where topic_id=t.id order by created_at desc limit 200) m),'[]'::jsonb),
        'summary',(select to_jsonb(m) from brainstorm_messages m where m.topic_id=t.id and m.role='summary' order by created_at desc limit 1)) x
      from brainstorm_topics t where t.person_id=p_person_id order by t.updated_at desc limit 50) s),'[]'::jsonb),
    'proposals',coalesce((select jsonb_agg(to_jsonb(p)-'person_id' || jsonb_build_object('artifact_title',a.title) order by p.status<>'proposed', p.created_at desc)
      from (select * from brainstorm_step_proposals where person_id=p_person_id order by created_at desc limit 100) p left join personal_artifacts a on a.id=p.artifact_id),'[]'::jsonb))
$function$;
