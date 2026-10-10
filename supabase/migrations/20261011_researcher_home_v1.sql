-- 研究員首頁：狀態（每人一列）＋研究日誌。讀：STABLE 快照經 edge function；寫：只給 service_role／連接器（postgres）。
create table if not exists growth_control.researcher_home_state(
  person_id uuid primary key,
  project_key text not null default 'growth-brain',
  status_line text not null default '',
  today_plan jsonb not null default '[]'::jsonb,   -- [{title, note?}]
  done_today jsonb not null default '[]'::jsonb,   -- [{title, note?, link?}]
  highlight jsonb,                                 -- {title, why, link?} 或 null
  help_needed jsonb not null default '[]'::jsonb,  -- [{kind: decision|data|login|other, title, detail?, link?}]
  next_run_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  constraint rh_arrays check (jsonb_typeof(today_plan)='array' and jsonb_typeof(done_today)='array' and jsonb_typeof(help_needed)='array'),
  constraint rh_highlight check (highlight is null or jsonb_typeof(highlight)='object')
);
create table if not exists growth_control.researcher_log(
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  occurred_at timestamptz not null default now(),
  kind text not null default 'note' check (kind in ('setup','run','finding','note','blocked')),
  title text not null check (length(title) between 1 and 200),
  summary text,
  link text,
  source text not null default 'grok-bot-routine'
);
create index if not exists researcher_log_person_time on growth_control.researcher_log(person_id, occurred_at desc);
alter table growth_control.researcher_home_state enable row level security;
alter table growth_control.researcher_log enable row level security;
drop policy if exists rh_owner_read on growth_control.researcher_home_state;
create policy rh_owner_read on growth_control.researcher_home_state for select to authenticated using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
drop policy if exists rl_owner_read on growth_control.researcher_log;
create policy rl_owner_read on growth_control.researcher_log for select to authenticated using (person_id = growth_control.resolve_single_user_v1((select auth.uid())));
revoke all on growth_control.researcher_home_state, growth_control.researcher_log from public, anon, authenticated;
grant select on growth_control.researcher_home_state, growth_control.researcher_log to authenticated;

create or replace function growth_control.researcher_home_snapshot_v1(p_person_id uuid)
returns jsonb language sql stable security definer set search_path to 'growth_control','public' as $f$
  select jsonb_build_object('sv','researcher-home-v1',
    'state',(select to_jsonb(s)-'person_id' from growth_control.researcher_home_state s where s.person_id=p_person_id),
    'log',coalesce((select jsonb_agg(to_jsonb(l)-'person_id' order by l.occurred_at desc) from (select * from growth_control.researcher_log where person_id=p_person_id order by occurred_at desc limit 20) l),'[]'::jsonb),
    'generated_at',now())
$f$;

-- 例行程序寫入：p_patch 只更新有給的欄位；p_log 可為單筆物件或陣列
create or replace function growth_control.researcher_home_update_v1(p_person_id uuid, p_patch jsonb, p_log jsonb default null, p_updated_by text default 'grok-bot-routine')
returns jsonb language plpgsql security definer set search_path to 'growth_control','public' as $f$
declare e jsonb; n int:=0;
begin
  if p_person_id is null then raise exception 'person_id required'; end if;
  if p_patch is not null and jsonb_typeof(p_patch)<>'object' then raise exception 'p_patch must be object'; end if;
  insert into growth_control.researcher_home_state(person_id) values(p_person_id) on conflict do nothing;
  if p_patch is not null then
    update growth_control.researcher_home_state set
      status_line=coalesce(p_patch->>'status_line',status_line),
      today_plan=coalesce(p_patch->'today_plan',today_plan),
      done_today=coalesce(p_patch->'done_today',done_today),
      highlight=case when p_patch ? 'highlight' then nullif(p_patch->'highlight','null'::jsonb) else highlight end,
      help_needed=coalesce(p_patch->'help_needed',help_needed),
      next_run_at=coalesce((p_patch->>'next_run_at')::timestamptz,next_run_at),
      updated_at=now(), updated_by=coalesce(p_updated_by,'grok-bot-routine')
    where person_id=p_person_id;
  end if;
  if p_log is not null then
    for e in select * from jsonb_array_elements(case when jsonb_typeof(p_log)='array' then p_log else jsonb_build_array(p_log) end) loop
      insert into growth_control.researcher_log(person_id,occurred_at,kind,title,summary,link,source)
      values(p_person_id,coalesce((e->>'occurred_at')::timestamptz,now()),coalesce(e->>'kind','note'),e->>'title',e->>'summary',e->>'link',coalesce(p_updated_by,'grok-bot-routine'));
      n:=n+1;
    end loop;
  end if;
  return jsonb_build_object('ok',true,'log_added',n,'snapshot',growth_control.researcher_home_snapshot_v1(p_person_id));
end $f$;

create or replace function public.growth_researcher_home_service_v1(p_auth_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','growth_control','auth' as $f$
declare v uuid; begin v:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if v is null then return jsonb_build_object('accepted',false,'reason','not_verified_primary_user'); end if;
 return growth_control.researcher_home_snapshot_v1(v); end $f$;

revoke all on function growth_control.researcher_home_snapshot_v1(uuid) from public, anon, authenticated;
revoke all on function growth_control.researcher_home_update_v1(uuid,jsonb,jsonb,text) from public, anon, authenticated;
revoke all on function public.growth_researcher_home_service_v1(uuid) from public, anon, authenticated;
grant execute on function public.growth_researcher_home_service_v1(uuid) to service_role;
grant execute on function growth_control.researcher_home_update_v1(uuid,jsonb,jsonb,text) to service_role;
