import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const site='https://example.test/growth-brain-web/';
const authOrigin='https://synthetic-project.supabase.co';
function setup({hash='',response={ok:true,status:200,data:{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600}}}={}){
  const storage=new Map(),requests=[],replacements=[];
  const window={GROWTH_BRAIN_CONFIG:{supabaseUrl:authOrigin,publishableKey:'synthetic-public-key'}};
  const location=new URL(site);location.hash=hash;
  vm.runInNewContext(readFileSync(new URL('../auth.js',import.meta.url),'utf8'),{
    window,location,URL,URLSearchParams,Date,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    history:{replaceState:(_state,_title,url)=>replacements.push(url)},
    fetch:async(url,options)=>{requests.push({url,options});return{ok:response.ok,status:response.status,text:async()=>JSON.stringify(response.data)};}
  });
  return {auth:window.GROWTH_BRAIN_AUTH,storage,requests,replacements};
}

test('複製登入後的首頁應說明沒有登入資訊，不送出驗證請求',async()=>{
  const {auth,requests,storage}=setup();
  await assert.rejects(auth.consumeMagicLinkUrl(site),/登入後的網址.*沒有登入資訊/);
  assert.equal(requests.length,0);assert.equal(storage.size,0);
});

test('原始未使用連結仍以原專案驗證，外部專案不可送出請求',async()=>{
  const {auth,requests,storage}=setup();
  await assert.rejects(auth.consumeMagicLinkUrl('https://another-project.supabase.co/auth/v1/verify?token=synthetic-hash&type=magiclink'));
  assert.equal(requests.length,0);
  await auth.consumeMagicLinkUrl(`${authOrigin}/auth/v1/verify?token=synthetic-unused-hash&type=magiclink`);
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,`${authOrigin}/auth/v1/verify`);
  assert.deepEqual(JSON.parse(requests[0].options.body),{token_hash:'synthetic-unused-hash',type:'magiclink'});
  assert.equal(JSON.parse(storage.get('growth-brain-single-user-auth-v1')).access_token,'synthetic-access');
});

test('已使用或過期的連結清楚要求重寄，不保存失敗 session',async()=>{
  const {auth,requests,storage}=setup({response:{ok:false,status:403,data:{code:'otp_expired',msg:'Email link is invalid or has expired'}}});
  await assert.rejects(auth.consumeMagicLinkUrl(`${authOrigin}/auth/v1/verify?token=synthetic-expired-hash&type=magiclink`),/已使用或已過期.*重寄/);
  assert.equal(requests.length,1);assert.equal(storage.size,0);
});

test('點信登入保留原有流程：session 留在當時的瀏覽器並移除網址中的登入資訊',async()=>{
  const {auth,requests,storage,replacements}=setup({hash:'#access_token=synthetic-access&refresh_token=synthetic-refresh&expires_in=3600'});
  const session=await auth.getValidSession();
  assert.equal(session.access_token,'synthetic-access');
  assert.ok(storage.has('growth-brain-single-user-auth-v1'));
  assert.deepEqual(replacements,['/growth-brain-web/']);
  assert.equal(requests.length,0);
});
