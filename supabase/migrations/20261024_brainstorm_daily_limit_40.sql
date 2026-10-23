-- 腦力激盪每代理每主題每天上限 6 -> 40（台北時間）；其他規則不變
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
    if v_today >= 40 then return jsonb_build_object('ok',false,'reason','daily_turn_limit','limit',40); end if;
  end if;
  insert into growth_control.brainstorm_messages(topic_id,author_agent,role,body,sources,reply_to)
  values(p_topic_id,v_author,coalesce(p_role,case when v_author='user' then 'nudge' else 'idea' end),p_body,coalesce(p_sources,'[]'::jsonb),p_reply_to) returning id into v_id;
  update growth_control.brainstorm_topics set updated_at=now() where id=p_topic_id;
  return jsonb_build_object('ok',true,'message_id',v_id);
end $function$;
