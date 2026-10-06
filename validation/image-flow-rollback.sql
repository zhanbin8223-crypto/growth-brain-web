begin;
do $$
declare
 p uuid; auth_id uuid; r jsonb; brief jsonb; request_id uuid; dna jsonb; j uuid; a jsonb; q jsonb;
begin
 select person_id,auth_user_id into p,auth_id from growth_control.auth_person_map where status='active' and verified_at is not null limit 1;
 select visual_dna into dna from growth_control.image_policy where policy_key='web-v1';
 brief:=jsonb_build_object('image_required',true,'reason','Synthetic rollback test','existing_asset_review','No suitable existing composition','prompt','Warm workspace illustration','placement','today.hero','aspect_ratio','16:9','visual_dna',dna,'purpose','illustration','is_real_evidence',false);
 r:=public.growth_image_flow_service_v1(auth_id,'request',jsonb_build_object('request_key','rollback-image-test','request',brief,'data_scope','validation'));
 request_id:=(r->>'id')::uuid;
 assert r->>'state'='awaiting_generation','request not waiting';
 assert (public.growth_image_flow_service_v1(auth_id,'request',jsonb_build_object('request_key','rollback-image-test','request',brief,'data_scope','validation'))->>'id')::uuid=request_id,'not idempotent';
 begin
 perform public.growth_image_flow_service_v1(auth_id,'request',jsonb_build_object('request_key','rollback-image-test','request',brief||'{"prompt":"changed"}','data_scope','validation'));
 raise exception 'conflicting duplicate accepted';
 exception when unique_violation then null; end;
 begin
 perform public.growth_image_flow_service_v1(auth_id,'request',jsonb_build_object('request_key','bad-image','request',brief||'{"is_real_evidence":true}'));
 raise exception 'false evidence accepted';
 exception when check_violation then null; end;
 begin
 perform public.growth_image_flow_service_v1(auth_id,'qa',jsonb_build_object('id',request_id,'expected_state','awaiting_generation','qa','{}'::jsonb));
 raise exception 'QA without asset accepted';
 exception when check_violation then null; end;
 r:=public.growth_image_flow_service_v1(auth_id,'request',jsonb_build_object('request_key','skip-image','request','{"image_required":false,"reason":"Existing image adequate"}'::jsonb,'data_scope','validation'));
 assert r->>'state'='skipped','unneeded not skipped';
 a:=jsonb_build_object('sha256',repeat('a',64),'extension','webp','mime_type','image/webp','path','assets/generated/'||repeat('a',64)||'.webp','source','chatgpt_image_generation','source_ref','synthetic rollback fixture','width',1600,'height',900,'bytes',1000,'placement','today.hero','visual_dna_id',dna->>'id','is_real_evidence',false);
 r:=public.growth_image_flow_service_v1(auth_id,'attach',jsonb_build_object('id',request_id,'expected_state','awaiting_generation','asset',a));
 assert r->>'state'='asset_ready';
 q:=jsonb_build_object('asset_sha256',repeat('a',64),'visual_dna_id',dna->>'id','local_decode',true,'style_consistent',true,'no_false_evidence',true,'placement_correct',true,'desktop_pass',true,'mobile_pass',true,'production_decode',true,'production_url','https://zhanbin8223-crypto.github.io/growth-brain-web/','production_sha256',repeat('a',64),'reviewer','synthetic-test','review_ref','rollback-only');
 begin
 perform public.growth_image_flow_service_v1(auth_id,'qa',jsonb_build_object('id',request_id,'expected_state','asset_ready','qa',q||'{"production_decode":false}'));
 raise exception 'missing real decode accepted';
 exception when check_violation then null;end;
 r:=public.growth_image_flow_service_v1(auth_id,'qa',jsonb_build_object('id',request_id,'expected_state','asset_ready','qa',q));
 assert r->>'state'='completed';
 r:=public.growth_image_flow_service_v1(auth_id,'attach',jsonb_build_object('id',request_id,'expected_state','awaiting_generation','asset',a));
 assert r->>'state'='completed','duplicate attach invalidated QA';
 r:=public.growth_image_flow_service_v1(auth_id,'qa',jsonb_build_object('id',request_id,'expected_state','asset_ready','qa',q));
 assert r->>'state'='completed','duplicate QA not idempotent';
 assert not has_function_privilege('anon','public.growth_image_flow_service_v1(uuid,text,jsonb)','execute');
 assert not has_function_privilege('authenticated','public.growth_image_flow_service_v1(uuid,text,jsonb)','execute');
 assert not has_table_privilege('anon','growth_control.image_requests','select');
 assert not has_table_privilege('authenticated','growth_control.image_requests','update');
 begin
 perform public.growth_image_flow_service_v1(gen_random_uuid(),'snapshot','{}');
 raise exception 'foreign user accepted';
 exception when insufficient_privilege then null; end;
 insert into growth_control.ai_jobs(person_id,project_key,source_kind,source_ref,data_scope,task_type,task_payload,status,idempotency_key)
 values(p,'growth-brain','system','image-flow-test','validation','frontend_image_need',jsonb_build_object('instruction','Review UI'),'pending','rollback-image-job') returning id into j;
 assert (select task_payload->>'instruction' like '%image_required%' from growth_control.ai_jobs where id=j),'missing role contract';
 update growth_control.ai_jobs set status='completed',result=jsonb_build_object('text',jsonb_build_object('image_request',brief)::text),result_evidence='{"test":true}' where id=j;
 assert exists(select 1 from growth_control.image_requests where source_job_id=j and state='awaiting_generation'),'role result not captured';
 assert not exists(select 1 from growth_control.ai_jobs where task_type='image_generation' and idempotency_key='rollback-image-job');
end $$;
rollback;
