-- 稽核紀錄：每則發言記下 run_id／run_note／channel／token_id；同一 run 每主題最多 1 則（run_turn_used）
alter table growth_control.brainstorm_messages add column if not exists meta jsonb not null default '{}'::jsonb;
alter table growth_control.brainstorm_messages drop constraint if exists brainstorm_messages_meta_obj;
alter table growth_control.brainstorm_messages add constraint brainstorm_messages_meta_obj check (jsonb_typeof(meta)='object');
create index if not exists brainstorm_messages_run on growth_control.brainstorm_messages(topic_id, author_agent, (meta->>'run_id'));

create or replace function public.growth_brainstorm_agent_service_v1(p_token text, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','growth_control' as $f$
declare k growth_control.brainstorm_agent_tokens; a jsonb := coalesce(p_args,'{}'::jsonb); need text; r jsonb; v_run text; v_ch text;
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
    v_run := nullif(btrim(coalesce(a->>'run_id','')),''); v_ch := coalesce(nullif(a->>'channel',''),'agent-api');
    if v_run is not null and length(v_run)>80 then return jsonb_build_object('ok',false,'reason','bad_run_id'); end if;
    if v_run is not null and exists (select 1 from growth_control.brainstorm_messages m where m.topic_id=(a->>'topic_id')::uuid and m.author_agent=k.agent and m.meta->>'run_id'=v_run) then
      return jsonb_build_object('ok',false,'reason','run_turn_used'); end if;
    r := growth_control._brainstorm_post_impl_v1((a->>'topic_id')::uuid, a->>'role', a->>'body', coalesce(a->'sources','[]'::jsonb), nullif(a->>'reply_to','')::uuid, k.agent, nullif(a->>'seen_last_message_id','')::uuid, k.person_id);
    if coalesce((r->>'ok')::boolean,false) then
      update growth_control.brainstorm_messages set meta = jsonb_strip_nulls(jsonb_build_object('run_id',v_run,'run_note',left(nullif(a->>'run_note',''),500),'channel',left(v_ch,40),'token_id',k.id)) where id=(r->>'message_id')::uuid;
    end if;
    return r;
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
