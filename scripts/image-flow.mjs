#!/usr/bin/env node
// Private job content stays in Supabase or an operator-selected private output file.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectImage,validateRequest,validateAsset,validateQA,validateLocalQA,publicEntry,handoffPrompt,productionURL} from './image-flow-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dna=JSON.parse(await readFile(path.join(root,'assets/visual-dna.json'),'utf8'));
const [command,...args]=process.argv.slice(2);
async function rpc(action,payload={}){
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,user=process.env.GROWTH_AUTH_USER_ID;
 if(base!=='https://jygoecxkndbjmjiwgsfz.supabase.co'||!key||!user)throw new Error('Load the existing private Worker environment; credentials are never CLI arguments');
 const headers={apikey:key,'Content-Type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const r=await fetch(base+'/rest/v1/rpc/growth_image_flow_service_v1',{method:'POST',headers,body:JSON.stringify({p_auth_user_id:user,p_action:action,p_payload:payload}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`image flow RPC ${r.status}; read authoritative state before retrying`);
 return r.json();
}
const jsonFile=async p=>JSON.parse(await readFile(p,'utf8'));
async function atomicJSON(p,data){await writeFile(p+'.tmp',JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(p+'.tmp',p);}
try{
 if(command==='request'){
  const [file,key]=args;if(!key)throw new Error('request PRIVATE_BRIEF.json IDEMPOTENCY_KEY');
  const request=await jsonFile(file);validateRequest(request,dna);
  const row=await rpc('request',{request_key:key,request});console.log(JSON.stringify({id:row.id,state:row.state}));
 }else if(command==='list'){
  const data=await rpc('snapshot');console.log(JSON.stringify({mode:data.mode,requests:data.requests.map(r=>({id:r.id,state:r.state,placement:r.request.placement}))},null,2));
 }else if(command==='brief'){
  const [id,out]=args;if(!out)throw new Error('brief REQUEST_ID PRIVATE_OUTPUT.txt');
  const row=await rpc('get',{id});
  if(row.state!=='awaiting_generation')throw new Error('Not awaiting generation; inspect state before generating again');
  await writeFile(out,handoffPrompt(row.request,dna),{flag:'wx',mode:0o600});console.log('Handoff saved; no image generated.');
 }else if(command==='attach'){
  const [id,file,source,sourceRef]=args;
  const row=await rpc('get',{id}),bytes=await readFile(file),info=inspectImage(bytes);
  const asset={...info,path:`assets/generated/${info.sha256}.${info.extension}`,source,source_ref:sourceRef,placement:row.request.placement,visual_dna_id:dna.id,is_real_evidence:false};
  validateAsset(row.request,asset,dna);
  await mkdir(path.join(root,'assets/generated'),{recursive:true});
  const dest=path.join(root,asset.path);
  try{await writeFile(dest,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(inspectImage(await readFile(dest)).sha256!==info.sha256)throw new Error('existing asset mismatch');}
  // Idempotent recovery: do not invalidate prior QA on an identical attach.
  if(row.asset&&Object.keys(asset).every(k=>row.asset[k]===asset[k])){console.log('Asset already attached.');}
  else {const result=await rpc('attach',{id,expected_state:row.state,asset});console.log(JSON.stringify({id:result.id,state:result.state,path:asset.path}));}
 }else if(command==='stage'){
  const [id,qaFile]=args,row=await rpc('get',{id}),qa=await jsonFile(qaFile);
  validateAsset(row.request,row.asset,dna);validateLocalQA(row.asset,qa);
  const info=inspectImage(await readFile(path.join(root,row.asset.path)));
  if(info.sha256!==row.asset.sha256)throw new Error('local file hash mismatch');
  const entry=publicEntry({...row,qa}),manifestPath=path.join(root,'assets/image-manifest.json');
  const manifest=await jsonFile(manifestPath);
  const other=manifest.entries.find(e=>e.placement===entry.placement&&e.request_id!==entry.request_id);
  if(other)throw new Error('placement already bound; review replacement explicitly in the manifest');
  manifest.entries=[...manifest.entries.filter(e=>e.placement!==entry.placement),entry];
  await atomicJSON(manifestPath,manifest);console.log('Reference staged. Deploy and verify before completion.');
 }else if(command==='complete'){
  const [id,qaFile]=args,row=await rpc('get',{id}),qa=await jsonFile(qaFile);
  validateQA(row.asset,qa);
  const [response,m]=await Promise.all([fetch(productionURL+row.asset.path,{cache:'no-store',signal:AbortSignal.timeout(30000)}),fetch(productionURL+'assets/image-manifest.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})]);
  if(!response.ok||!m.ok)throw new Error('production asset or manifest unavailable');
  if(inspectImage(Buffer.from(await response.arrayBuffer())).sha256!==row.asset.sha256)throw new Error('production bytes mismatch');
  const manifest=await m.json();
  if(!manifest.entries.some(e=>e.request_id===id&&e.placement===row.request.placement&&e.sha256===row.asset.sha256))throw new Error('production reference missing');
  const result=await rpc('qa',{id,expected_state:row.state,qa});console.log(JSON.stringify({id:result.id,state:result.state}));
 }else if(command==='fail-qa'){
  const [id,reason]=args,row=await rpc('get',{id});if(!reason)throw new Error('reason required');
  await rpc('qa',{id,expected_state:row.state,passed:false,qa:{asset_sha256:row.asset?.sha256,visual_dna_id:dna.id,reason}});console.log('QA failed; correct asset and re-review.');
 }else throw new Error('Commands: request, list, brief, attach, stage, complete, fail-qa. See docs/image-flow.md.');
}catch(e){console.error(e.message);process.exitCode=1;}
