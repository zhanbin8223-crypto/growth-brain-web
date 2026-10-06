import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRequest, inspectImage, validateAsset, validateQA, publicEntry, handoffPrompt} from '../scripts/image-flow-core.mjs';
const dna=JSON.parse(readFileSync(new URL('../assets/visual-dna.json',import.meta.url)));
const req={image_required:true,reason:'Explain the workspace setting',existing_asset_review:'No suitable existing composition',prompt:'Warm illustrated workspace',placement:'today.hero',aspect_ratio:'16:9',visual_dna:dna,purpose:'illustration',is_real_evidence:false};
const bytes=readFileSync(new URL('../assets/ui/home-hero-workspace.webp',import.meta.url));
test('unnecessary images skip without prompt or generation',()=>assert.equal(validateRequest({image_required:false,reason:'Existing UI is sufficient'},dna).state,'skipped'));
test('strict need decision, rationale, placement, ratio and DNA',()=>{
  assert.equal(validateRequest(req,dna).state,'awaiting_generation');
  for(const key of ['image_required','reason','prompt','placement','aspect_ratio','visual_dna','existing_asset_review']){
    const bad={...req};delete bad[key];assert.throws(()=>validateRequest(bad,dna),key);
  }
  for(const extra of [{image_required:'true'},{placement:'user.evidence'},{aspect_ratio:'banana'},{visual_dna:{...dna,id:'other'}},{is_real_evidence:true},{purpose:'proof'}])assert.throws(()=>validateRequest({...req,...extra},dna));
});
test('brief always retains DNA and truth boundaries; no generated success',()=>{
  const text=handoffPrompt(req,dna);assert.match(text,/ChatGPT/);assert.match(text,/illustration/);assert.match(text,/today.hero/);assert.match(text,/16:9/);assert.match(text,/visual_dna/);assert.match(text,/is_real_evidence/);
});
test('real bytes inspected; text renamed image rejected',()=>{
  const img=inspectImage(bytes);assert.equal(img.mime_type,'image/webp');assert.ok(img.width>0&&img.height>0);assert.match(img.sha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>inspectImage(Buffer.from('image generated successfully')));
  assert.throws(()=>inspectImage(bytes.subarray(0,20)));
});
const image=()=>{const i=inspectImage(bytes);return {...i,path:`assets/generated/${i.sha256}.webp`,source:'existing_asset',source_ref:'assets/ui/home-hero-workspace.webp',visual_dna_id:dna.id,placement:req.placement,is_real_evidence:false};};
const qa=()=>({asset_sha256:image().sha256,visual_dna_id:dna.id,local_decode:true,style_consistent:true,no_false_evidence:true,placement_correct:true,desktop_pass:true,mobile_pass:true,reviewer:'human-or-agent-review',review_ref:'qa/image-flow',production_url:'https://zhanbin8223-crypto.github.io/growth-brain-web/',production_sha256:image().sha256,production_decode:true});
test('asset needs persisted file identity, source, placement and aspect match',()=>{
  assert.ok(validateAsset(req,image(),dna));
  for(const extra of [{path:'https://example.com/temporary.png'},{path:'assets/generated/../../auth.js'},{sha256:'fake'},{source:'claimed_generated'},{is_real_evidence:true},{placement:'team.hero'},{width:1,height:100}])assert.throws(()=>validateAsset(req,{...image(),...extra},dna));
});
test('QA cannot close on text, local-only, stale hash or failed review',()=>{
  assert.ok(validateQA(image(),qa()));
  for(const extra of [{production_url:'http://localhost:3000'},{production_sha256:'old'},{style_consistent:false},{mobile_pass:false},{production_decode:false},{review_ref:''}])assert.throws(()=>validateQA(image(),{...qa(),...extra}));
});
test('public manifest excludes private prompt and cannot publish awaiting requests',()=>{
  assert.throws(()=>publicEntry({...req,state:'awaiting_generation',asset:image()}));
  const e=publicEntry({...req,state:'asset_ready',asset:image(),qa:qa()});
  assert.equal(e.path,image().path);assert.equal(e.is_real_evidence,false);assert.equal(e.prompt,undefined);assert.equal(e.reason,undefined);
});

import vm from 'node:vm';
const ui=readFileSync(new URL('../image-assets.js',import.meta.url),'utf8');
function renderFlow(flow){
 const ctx={window:{},fetch:()=>Promise.reject(new Error('offline'))};
 vm.createContext(ctx);vm.runInContext(ui,ctx);return ctx.window.GrowthImageFlow.render(flow);
}
test('queue UI distinguishes waiting, empty, unavailable, failed and completed',()=>{
 assert.match(renderFlow(null),/尚未載入/);
 assert.match(renderFlow({requests:[]}),/沒有圖片需求/);
 for(const [state,label] of [['awaiting_generation','待 ChatGPT 生圖'],['asset_ready','待網頁驗收'],['qa_failed','驗收未過'],['completed','已套用並驗收'],['skipped','不需生圖']]){
  const html=renderFlow({requests:[{state,request:req}]});assert.match(html,new RegExp(label));
  assert.equal(html.includes('<textarea'),state==='awaiting_generation');
 }
});
test('untrusted prompts are escaped before appearing in copyable handoff',()=>{
 const html=renderFlow({requests:[{state:'awaiting_generation',request:{...req,prompt:'</textarea><script>bad()</script>',reason:'<img onerror=bad()>'}}]});
 assert.doesNotMatch(html,/<script>|<img onerror/);assert.match(html,/&lt;\/textarea&gt;/);
});
