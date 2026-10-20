-- 任何代理先讀再回：最新訊息、last_message_id（貼文時要帶回）、是否有人在我上次發言後說話、今天剩幾次
create or replace function growth_control.brainstorm_read_v1(p_topic_id uuid default null, p_since timestamptz default null, p_agent text default null, p_person_id uuid default null, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path to 'growth_control','public' as $f$
declare v_person uuid; v_uid uuid := auth.uid(); v_agent text;
begin
  if v_uid is not null then v_person := growth_control.resolve_single_user_v1(v_uid); v_agent := 'user';
  else v_person := p_person_id; v_agent := coalesce(p_agent,''); end if;
  if v_person is null then return jsonb_build_object('ok',false,'reason','not_owner'); end if;
  return jsonb_build_object('ok',true,'agent',v_agent,'turn_limit_per_day',6,'topics',coalesce((
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
end $f$;
revoke all on function growth_control.brainstorm_read_v1(uuid,timestamptz,text,uuid,int) from public, anon;
grant execute on function growth_control.brainstorm_read_v1(uuid,timestamptz,text,uuid,int) to authenticated, service_role;
