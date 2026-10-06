import {createHash} from 'node:crypto';
export const placements=['today.hero','projects.hero','projects.cover','team.hero','history.hero'];
export const productionURL='https://zhanbin8223-crypto.github.io/growth-brain-web/';
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
const text=x=>typeof x==='string'&&x.trim().length>0;
const same=(a,b)=>JSON.stringify(sort(a))===JSON.stringify(sort(b));
function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;}
export function validateRequest(r,dna){
  requireValue(r&&typeof r.image_required==='boolean','image_required must be boolean');
  requireValue(text(r.reason),'reason required');
  if(!r.image_required)return {state:'skipped'};
  for(const k of ['prompt','existing_asset_review'])requireValue(text(r[k]),`${k} required`);
  requireValue(placements.includes(r.placement),'unsupported placement');
  requireValue(['16:9','3:2','4:3','1:1','2:3','9:16'].includes(r.aspect_ratio),'unsupported aspect_ratio');
  requireValue(same(r.visual_dna,dna),'visual_dna must match versioned policy');
  requireValue(r.purpose==='illustration'&&r.is_real_evidence===false,'illustration cannot be real evidence');
  return {state:'awaiting_generation'};
}
export function handoffPrompt(r,dna){
  requireValue(validateRequest(r,dna).state!=='skipped','no image needed');
  return 'Use ChatGPT image generation. Inspect reference_assets first. Return the actual image file; text or a conversation URL is not an asset. Do not mark the image complete before asset import and webpage QA.\n'+JSON.stringify({image_required:r.image_required,prompt:r.prompt,placement:r.placement,aspect_ratio:r.aspect_ratio,visual_dna:r.visual_dna,purpose:r.purpose,is_real_evidence:false},null,2);
}
export function inspectImage(b){
  requireValue(Buffer.isBuffer(b)&&b.length>=32&&b.length<=10*1024*1024,'invalid image size');
  let width,height,mime_type,extension;
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
    requireValue(b.toString('ascii',12,16)==='IHDR'&&b.includes(Buffer.from('IEND')),'invalid PNG');
    width=b.readUInt32BE(16);height=b.readUInt32BE(20);mime_type='image/png';extension='png';
  }else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    requireValue(b.readUInt32LE(4)+8===b.length,'truncated WebP');
    const kind=b.toString('ascii',12,16);
    if(kind==='VP8X'){width=1+b.readUIntLE(24,3);height=1+b.readUIntLE(27,3);}
    else if(kind==='VP8 '){requireValue(b.subarray(23,26).equals(Buffer.from([157,1,42])),'invalid WebP');width=b.readUInt16LE(26)&16383;height=b.readUInt16LE(28)&16383;}
    else if(kind==='VP8L'){requireValue(b[20]===47,'invalid WebP');const v=b.readUInt32LE(21);width=(v&16383)+1;height=((v>>>14)&16383)+1;}
    mime_type='image/webp';extension='webp';
  }
  requireValue(width>0&&height>0&&width*height<=40000000,'expected valid PNG or WebP');
  return {width,height,mime_type,extension,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
}
export function validateAsset(r,a,dna){
  requireValue(validateRequest(r,dna).state!=='skipped','no asset needed');
  requireValue(a&&/^[a-f0-9]{64}$/.test(a.sha256),'sha256 required');
  requireValue(a.path===`assets/generated/${a.sha256}.${a.extension}`&&['png','webp'].includes(a.extension),'persisted content-addressed image required');
  requireValue(a.mime_type===`image/${a.extension}`,'MIME mismatch');
  requireValue(['chatgpt_image_generation','existing_asset'].includes(a.source)&&text(a.source_ref),'generation/source evidence required');
  requireValue(a.visual_dna_id===dna.id&&a.placement===r.placement&&a.is_real_evidence===false,'asset contract mismatch');
  const [w,h]=r.aspect_ratio.split(':').map(Number);
  requireValue(Number.isInteger(a.width)&&Number.isInteger(a.height)&&a.width>0&&a.height>0&&Math.abs(a.width/a.height/(w/h)-1)<=0.06,'image aspect ratio mismatch');
  return true;
}
export function validateLocalQA(a,q){
  requireValue(q&&q.asset_sha256===a.sha256&&q.visual_dna_id===a.visual_dna_id,'QA must target exact asset and DNA');
  for(const k of ['local_decode','style_consistent','no_false_evidence','placement_correct','desktop_pass','mobile_pass'])requireValue(q[k]===true,`QA ${k} required`);
  requireValue(text(q.reviewer)&&text(q.review_ref),'review evidence required');
  return true;
}
export function validateQA(a,q){
  validateLocalQA(a,q);
  requireValue(q.production_url===productionURL&&q.production_sha256===a.sha256&&q.production_decode===true,'production verification required');
  return true;
}
export function publicEntry(row){
  requireValue(['asset_ready','completed'].includes(row.state),'asset not ready');
  validateLocalQA(row.asset,row.qa);
  const a=row.asset;
  return {request_id:row.id,placement:a.placement,path:a.path,sha256:a.sha256,width:a.width,height:a.height,visual_dna_id:a.visual_dna_id,is_real_evidence:false,usage:'illustration',status:'reviewed'};
}
