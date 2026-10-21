import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const src=app.slice(app.indexOf('const BS_AGENTS'),app.indexOf('async function renderBrainstorm'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=new Function('esc','window',src+';return brainstormHtml;')(esc,{});
const d={topics:[{id:'t1',title:'數字人 IG：第一支 Reel 怎麼做',goal:'g',status:'open',related_title:'數字人 AI 的 Instagram 帳號',summary:null,messages:[
 {id:'m1',author_agent:'grok-bot',role:'idea',body:'開頭',sources:[{type:'researcher_log',id:'x',title:'HeyGen'}],created_at:'2026-10-20T19:00:00Z'},
 {id:'m2',author_agent:'gpt',role:'critique',body:'挑毛病<script>',sources:[{title:'bad',link:'javascript:1'}],created_at:'2026-10-20T19:05:00Z'},
 {id:'m3',author_agent:'user',role:'nudge',body:'插一句',sources:[],created_at:'2026-10-20T19:06:00Z'}]}]};
test('串列顯示誰說了什麼與角色',()=>{const h=f(d);for(const k of ['Grok Bot','GPT','你','點子','挑毛病','插一句','依據 1 筆','研究紀錄','還沒有人整理','data-bs-nudge="t1"','data-bs-open'])assert.ok(h.includes(k),k);});
test('跳脫內容與擋掉不安全連結',()=>{const h=f(d);assert.ok(!h.includes('<script>'));assert.ok(!h.includes('javascript:'));});
test('整理卡顯示最新 summary',()=>{const h=f({topics:[{...d.topics[0],summary:{author_agent:'gpt',body:'結論 A',created_at:'2026-10-20T20:00:00Z'}}]});assert.ok(h.includes('結論 A'));});
test('空狀態與已結束主題不顯示輸入框',()=>{assert.ok(f({topics:[]}).includes('還沒有主題'));assert.ok(!f({topics:[{...d.topics[0],status:'closed'}]}).includes('data-bs-nudge'));});
test('腦力激盪是研究室第二個分頁；資料庫守則存在',()=>{assert.match(app,/\{key:'researcher'[^\n]*\n\s+\{key:'brainstorm',label:'腦力激盪'/);
 const m=fs.readFileSync(new URL('../supabase/migrations/20261021_ai_brainstorm_v1.sql',import.meta.url),'utf8')+fs.readFileSync(new URL('../supabase/migrations/20261021_ai_brainstorm_read_v1.sql',import.meta.url),'utf8');
 for(const k of ['stale_read','daily_turn_limit','enable row level security','brainstorm_read_v1','stable security definer'])assert.ok(m.includes(k),k);
 assert.match(fs.readFileSync(new URL('../supabase/functions/growth-home/index.ts',import.meta.url),'utf8'),/"brainstorm_post"/);});
test('代理憑證：雜湊、範圍、不得自稱 user、端點不洩漏',()=>{
 const m=fs.readFileSync(new URL('../supabase/migrations/20261021_brainstorm_agent_tokens_v1.sql',import.meta.url),'utf8');
 for(const k of ['token_hash','sha256','scope_denied','user_author_reserved',"agent <> 'user'",'revoked_at is null','from public, anon, authenticated, service_role'])assert.ok(m.includes(k),k);
 const e=fs.readFileSync(new URL('../supabase/functions/brainstorm-agent/index.ts',import.meta.url),'utf8');
 assert.match(e,/growth_brainstorm_agent_service_v1/);assert.ok(!/author_agent/.test(e));assert.match(e,/\["read", "post", "open_topic", "research"\]/);
 const all=fs.readdirSync(new URL('..',import.meta.url),{recursive:true}).filter(f=>!String(f).includes('node_modules')&&!String(f).startsWith('.git'));
 for(const f of all){const p=new URL('../'+f,import.meta.url);try{if(fs.statSync(p).isFile()&&fs.statSync(p).size<2e6)assert.ok(!/gbat_[A-Za-z0-9_-]{40,}/.test(fs.readFileSync(p,'utf8')),'secret in '+f);}catch(err){if(err.code!=='EISDIR')throw err;}}
});
test('MCP 伺服器：工具、規則、OAuth、稽核',()=>{
 const e=fs.readFileSync(new URL('../supabase/functions/brainstorm-mcp/index.ts',import.meta.url),'utf8');
 for(const k of ['"brainstorm_read"','"research_read"','"brainstorm_post"','"brainstorm_open_topic"','readOnlyHint: true','run_id_required','≤300','unanswered_by_me','code_challenge_methods_supported','WWW-Authenticate','invalid_client','chatgpt.com','和使用者的個人成長進度分開'])assert.ok(e.includes(k),k);
 assert.ok(!/author_agent:/.test(e.slice(e.indexOf('async function callTool'))),'MCP 不可傳作者');
 const m=fs.readFileSync(new URL('../supabase/migrations/20261021_brainstorm_run_meta_v1.sql',import.meta.url),'utf8');for(const k of ['run_turn_used','meta jsonb','token_id'])assert.ok(m.includes(k),k);
 assert.ok(app.includes('執行紀錄'));
});
