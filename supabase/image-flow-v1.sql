
-- Isolated fallback queue: never dispatch binary generation to the text Worker.
create table growth_control.image_policy (
 policy_key text primary key,
 visual_dna jsonb not null,
 auto_generation_verified boolean not null default false check (auto_generation_verified=false)
);
alter table growth_control.image_policy enable row level security;
insert into growth_control.image_policy values ('web-v1', '{"id": "growth-brain-warm-studio-v1", "style": "Warm editorial story illustration; gentle hand-painted texture and restrained detail", "palette": ["#f6f0e5", "#fffdf8", "#29251f", "#c98533", "#5f8064"], "lighting": "Soft warm daylight, low contrast", "composition": "One clear subject; quiet space around UI copy; never replace navigation or data", "reference_assets": ["assets/ui/home-hero-workspace.webp", "assets/ui/home-project-cover.webp"], "avoid": ["fake screenshots", "fake results or revenue", "mastery badges", "embedded UI text", "unnecessary decoration", "new unrelated visual style"], "truth_rule": "Illustration only; never evidence of completed work, learned skills, customers or revenue"}'::jsonb, false);
create table growth_control.image_requests (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.growth_people(id),
 project_key text not null default 'growth-brain' check(project_key='growth-brain'),
 request_key text not null check(length(btrim(request_key)) between 1 and 200),
 source_job_id uuid unique references growth_control.ai_jobs(id),
 data_scope text not null default 'system' check(data_scope in ('system','validation')),
 request jsonb not null,
 state text not null check(state in ('skipped','awaiting_generation','asset_ready','qa_failed','completed')),
 asset jsonb,
 qa jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,project_key,request_key),
 check(state not in ('asset_ready','qa_failed','completed') or asset is not null),
 check(state<>'completed' or qa is not null)
);
alter table growth_control.image_requests enable row level security;
revoke all on growth_control.image_requests, growth_control.image_policy from public,anon,authenticated;

create function growth_control.image_request_v1(p_person uuid,p_key text,p_request jsonb,p_scope text default 'system',p_job uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r growth_control.image_requests%rowtype; dna jsonb; k text; s text;
begin
 select visual_dna into dna from growth_control.image_policy where policy_key='web-v1';
 if jsonb_typeof(p_request->'image_required') is distinct from 'boolean' or coalesce(btrim(p_request->>'reason'),'')='' then
  raise exception 'image_required_boolean_and_reason_required' using errcode='23514'; end if;
 if p_request->'image_required'='true'::jsonb then
  foreach k in array array['prompt','existing_asset_review'] loop
   if jsonb_typeof(p_request->k) is distinct from 'string' or coalesce(btrim(p_request->>k),'')='' then raise exception 'missing_image_field:%',k using errcode='23514';end if;
  end loop;
  if p_request->>'placement' is null or p_request->>'placement' not in ('today.hero','projects.hero','projects.cover','team.hero','history.hero')
   or p_request->>'aspect_ratio' is null or p_request->>'aspect_ratio' not in ('16:9','3:2','4:3','1:1','2:3','9:16')
   or p_request->'visual_dna' is distinct from dna
   or p_request->>'purpose' is distinct from 'illustration'
   or p_request->'is_real_evidence' is distinct from 'false'::jsonb then
   raise exception 'invalid_image_contract_or_visual_dna' using errcode='23514';end if;
  s:='awaiting_generation';
 else s:='skipped';end if;
 insert into growth_control.image_requests(person_id,request_key,request,data_scope,source_job_id,state)
 values(p_person,p_key,p_request,p_scope,p_job,s) on conflict(person_id,project_key,request_key) do nothing;
 select * into r from growth_control.image_requests where person_id=p_person and project_key='growth-brain' and request_key=p_key;
 if r.request is distinct from p_request or r.data_scope is distinct from p_scope or r.source_job_id is distinct from p_job then
  raise exception 'image_idempotency_conflict' using errcode='23505';end if;
 return to_jsonb(r)-'person_id';
end $$;

create function public.growth_image_flow_service_v1(p_auth_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid; r growth_control.image_requests%rowtype; a jsonb; q jsonb; k text; dna jsonb; ratio numeric;
begin
 p:=growth_control.resolve_single_user_v1(p_auth_user_id);
 if p is null then raise exception 'not_verified_primary_user' using errcode='42501';end if;
 if p_action='snapshot' then
  return jsonb_build_object('mode','chatgpt_handoff','auto_generation_verified',false,'requests',coalesce((select jsonb_agg(to_jsonb(x)-'person_id') from (select * from growth_control.image_requests where person_id=p and data_scope='system' order by created_at desc limit 100) x),'[]'::jsonb));
 elsif p_action='request' then
  return growth_control.image_request_v1(p,p_payload->>'request_key',p_payload->'request',coalesce(p_payload->>'data_scope','system'));
 end if;
 select * into r from growth_control.image_requests where id=(p_payload->>'id')::uuid and person_id=p for update;
 if not found then raise exception 'image_request_not_found' using errcode='42501';end if;
 if p_action='get' then return to_jsonb(r)-'person_id';end if;
 if p_action='attach' and r.asset=p_payload->'asset' then return to_jsonb(r)-'person_id';end if;
 if p_action='qa' and r.state='completed' and r.qa=p_payload->'qa' then return to_jsonb(r)-'person_id';end if;
 if r.state is distinct from p_payload->>'expected_state' then raise exception 'image_state_conflict' using errcode='23514';end if;
 select visual_dna into dna from growth_control.image_policy where policy_key='web-v1';
 if p_action='attach' then
  if r.state not in ('awaiting_generation','qa_failed','asset_ready') then raise exception 'image_not_awaiting_asset' using errcode='23514';end if;
  a:=p_payload->'asset';
  if a->>'sha256' is null or a->>'sha256' !~ '^[a-f0-9]{64}$'
   or a->>'extension' is null or a->>'extension' not in ('webp','png')
   or a->>'path' is distinct from 'assets/generated/'||(a->>'sha256')||'.'||(a->>'extension')
   or a->>'mime_type' is distinct from 'image/'||(a->>'extension')
   or a->>'source' is null or a->>'source' not in ('chatgpt_image_generation','existing_asset')
   or coalesce(btrim(a->>'source_ref'),'')=''
   or a->>'visual_dna_id' is distinct from dna->>'id'
   or a->>'placement' is distinct from r.request->>'placement'
   or a->'is_real_evidence' is distinct from 'false'::jsonb
   or coalesce((a->>'width')::int,0)<=0 or coalesce((a->>'height')::int,0)<=0
   or coalesce((a->>'bytes')::int,0) not between 32 and 10485760 then
   raise exception 'invalid_asset_manifest' using errcode='23514';end if;
  ratio:=split_part(r.request->>'aspect_ratio',':',1)::numeric/split_part(r.request->>'aspect_ratio',':',2)::numeric;
  if abs((a->>'width')::numeric/(a->>'height')::numeric/ratio-1)>0.06 then raise exception 'asset_aspect_mismatch' using errcode='23514';end if;
  update growth_control.image_requests set asset=a,state='asset_ready',qa=null,updated_at=now() where id=r.id returning * into r;
 elsif p_action='qa' then
  if r.state not in ('asset_ready','qa_failed') then raise exception 'asset_required_before_qa' using errcode='23514';end if;
  q:=p_payload->'qa';
  if q->>'asset_sha256' is distinct from r.asset->>'sha256' or q->>'visual_dna_id' is distinct from dna->>'id' then raise exception 'qa_asset_mismatch' using errcode='23514';end if;
  if p_payload->'passed'='false'::jsonb and coalesce(btrim(q->>'reason'),'')<>'' then
   update growth_control.image_requests set qa=q,state='qa_failed',updated_at=now() where id=r.id returning * into r;
  else
   foreach k in array array['local_decode','style_consistent','no_false_evidence','placement_correct','desktop_pass','mobile_pass','production_decode'] loop
    if q->k is distinct from 'true'::jsonb then raise exception 'qa_check_required:%',k using errcode='23514';end if;
   end loop;
   if q->>'production_url' is distinct from 'https://zhanbin8223-crypto.github.io/growth-brain-web/'
    or q->>'production_sha256' is distinct from r.asset->>'sha256'
    or coalesce(btrim(q->>'reviewer'),'')='' or coalesce(btrim(q->>'review_ref'),'')='' then
    raise exception 'production_qa_evidence_required' using errcode='23514';end if;
   update growth_control.image_requests set qa=q,state='completed',updated_at=now() where id=r.id returning * into r;
  end if;
 else raise exception 'unsupported_image_action' using errcode='23514';end if;
 return to_jsonb(r)-'person_id';
end $$;
revoke all on function growth_control.image_request_v1(uuid,text,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.growth_image_flow_service_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.growth_image_flow_service_v1(uuid,text,jsonb) to service_role;

create function growth_control.image_job_contract_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare dna jsonb; body jsonb;
begin
 if new.project_key<>'growth-brain' then return new;end if;
 if new.task_type='image_generation' then raise exception 'image_generation_not_verified_use_image_request_fallback' using errcode='23514';end if;
 if tg_op='INSERT' and new.data_scope in ('system','validation') and (new.task_type ~ '(design|visual|frontend|ux_|image_need)' or new.task_payload->>'image_policy'='web-v1') then
  select visual_dna into dna from growth_control.image_policy where policy_key='web-v1';
  new.task_payload:=new.task_payload||jsonb_build_object('image_policy','web-v1','visual_dna',dna,'instruction',coalesce(new.task_payload->>'instruction','')||E'\n[Conditional images] Output JSON with image_request: {image_required:boolean,reason:string}. Prefer no image or reuse existing assets; existing_asset_review must explain why a new image is necessary. Only if needed also include prompt, placement (today.hero/projects.hero/projects.cover/team.hero/history.hero), aspect_ratio, visual_dna (copy the supplied object exactly), purpose:"illustration", is_real_evidence:false. No fake results, revenue, mastery or screenshots. This Worker produces the brief only; it cannot complete image generation. Await ChatGPT image generation, actual asset import, webpage reference and QA. Visual DNA: '||dna::text);
 end if;
 if new.status='completed' and new.task_payload->>'image_policy'='web-v1' and (tg_op='INSERT' or old.status is distinct from 'completed' or old.result is distinct from new.result) then
  body:=new.result;
  if not(body ? 'image_request') then
   begin body:=(new.result->>'text')::jsonb;exception when others then raise exception 'image_decision_json_required' using errcode='23514';end;
  end if;
  perform growth_control.image_request_v1(new.person_id,'job:'||new.id::text,body->'image_request',new.data_scope,new.id);
 end if;
 return new;
end $$;
revoke all on function growth_control.image_job_contract_v1() from public,anon,authenticated;
create trigger image_job_contract before insert or update of status,result on growth_control.ai_jobs for each row execute function growth_control.image_job_contract_v1();

-- Preserve existing authenticated surfaces; add only the image queue to the cockpit.
create or replace function public.growth_app_surface_for_service_v1(p_auth_user_id uuid,p_surface text default 'personal_home')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if p_auth_user_id is null then raise exception 'auth user required';end if;
 r:=growth_control.app_surface_for_auth_user_v1(p_auth_user_id,p_surface,'growth-brain');
 if p_surface='system_cockpit' and r->'authorized'='true'::jsonb then
  r:=jsonb_set(r,'{snapshot,image_flow}',public.growth_image_flow_service_v1(p_auth_user_id,'snapshot','{}'));
 end if;
 return r;
end $$;
revoke all on function public.growth_app_surface_for_service_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.growth_app_surface_for_service_v1(uuid,text) to service_role;
