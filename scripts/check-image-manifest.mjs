import {readFile} from 'node:fs/promises';
import {inspectImage,placements} from './image-flow-core.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('assets/image-manifest.json',root),'utf8'));
const dna=JSON.parse(await readFile(new URL('assets/visual-dna.json',root),'utf8'));
if(manifest.schema_version!==1||!Array.isArray(manifest.entries))throw new Error('invalid manifest');
const seen=new Set();
for(const e of manifest.entries){
 if(!placements.includes(e.placement)||seen.has(e.placement))throw new Error('unknown/duplicate placement');seen.add(e.placement);
 if(e.status!=='reviewed'||e.usage!=='illustration'||e.is_real_evidence!==false||e.visual_dna_id!==dna.id)throw new Error('unreviewed illustration');
 if(!/^[a-f0-9]{64}$/.test(e.sha256)||!['png','webp'].some(ext=>e.path===`assets/generated/${e.sha256}.${ext}`))throw new Error('invalid image path');
 if(Object.keys(e).some(k=>['prompt','reason','source_ref','person_id','visual_dna'].includes(k)))throw new Error('private content in public manifest');
 const info=inspectImage(await readFile(new URL(e.path,root)));
 if(info.sha256!==e.sha256||info.width!==e.width||info.height!==e.height)throw new Error('image byte identity mismatch');
}
console.log(`Image manifest: ${manifest.entries.length} reviewed references verified.`);
