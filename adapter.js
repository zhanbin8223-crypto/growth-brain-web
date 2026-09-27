(function(){
  const STORAGE_KEY='growth-brain-demo-evidence-v3';
  const D=window.GROWTH_BRAIN_DEMO;
  const C=window.GROWTH_BRAIN_CONFIG;
  const Auth=window.GROWTH_BRAIN_AUTH;

  const clone=x=>JSON.parse(JSON.stringify(x));
  function readStore(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"attempts":[]}');}catch{return {attempts:[]};}}
  function writeStore(store){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}
  function listLocalAttempts(){return readStore().attempts||[];}
  function latestAttempt(unitId){return listLocalAttempts().filter(x=>x.unitId===unitId).sort((a,b)=>b.createdAt-a.createdAt)[0]||null;}
  function candidateEvidenceCount(){return new Set(listLocalAttempts().map(x=>x.unitId)).size;}

  async function liveRequest(method='GET',body,surface){
    const session=await Auth.getValidSession();
    if(!session) throw Object.assign(new Error('not_signed_in'),{code:'not_signed_in'});
    const url=new URL(C.edgeFunctionUrl);
    if(method==='GET' && surface) url.searchParams.set('surface',surface);
    const res=await fetch(url.toString(),{
      method,
      headers:{
        apikey:C.publishableKey,
        Authorization:`Bearer ${session.access_token}`,
        'Content-Type':'application/json'
      },
      body:body?JSON.stringify(body):undefined
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error(data.reason||`http_${res.status}`),{
      code:data.reason||`http_${res.status}`,
      status:res.status,
      data
    });
    return data;
  }

  function extractSurface(response){
    return response?.data?.snapshot || response?.data || response?.snapshot || response || null;
  }

  const adapter={
    mode:'cached-private',
    liveStatus:'signed_out',
    liveUser:null,
    personalHome:null,
    systemCockpit:null,
    lastLiveError:null,
    async initialize(){
      const user=await Auth.fetchUser().catch(()=>null);
      this.liveUser=user;
      this.liveStatus=user?'signed_in_unchecked':'signed_out';
      if(user){
        try{
          const result=await liveRequest('GET',undefined,'personal_home');
          this.personalHome=extractSurface(result);
          this.liveStatus='live';
          this.mode='live';
          this.lastLiveError=null;
        }catch(e){
          this.lastLiveError={code:e.code||'unknown',status:e.status||null};
          this.liveStatus=e.code==='no_active_verified_auth_person_mapping'?'signed_in_unmapped':'signed_in_blocked';
          this.mode='cached-private';
        }
      }
      return this;
    },
    async getSnapshot(){
      const out=clone(D);
      if(this.personalHome) out.personalHome=clone(this.personalHome);
      out.meta={
        ...(out.meta||{}),
        home_source:this.personalHome?'live authenticated Personal Home':'cached Personal Home fallback',
        home_live:Boolean(this.personalHome)
      };
      return out;
    },
    async getSystemCockpit(){
      if(this.systemCockpit) return clone(this.systemCockpit);
      if(this.mode!=='live') return clone(D.systemCockpit||null);
      const result=await liveRequest('GET',undefined,'system_cockpit');
      this.systemCockpit=extractSurface(result);
      return clone(this.systemCockpit);
    },
    async listAttempts(){return listLocalAttempts();},
    async submitAttempt({unitId,response,evidenceType}){
      const clean=(response||'').trim();
      if(clean.length<6) throw new Error('請至少寫一小句，讓系統有足夠內容判斷。');
      if(this.mode==='live'){
        const result=await liveRequest('POST',{action:'submit_attempt',unit_id:unitId,response_text:clean});
        const store=readStore();
        const attempt={
          id:'server-mirror-'+Date.now(),unitId,response:clean,evidenceType:evidenceType||'candidate',
          state:'pending_server_review',serverSubmissionId:result?.data?.submission_id||null,createdAt:Date.now()
        };
        store.attempts.push(attempt);writeStore(store);
        return {...result,localMirror:attempt};
      }
      const store=readStore();
      const attempt={id:'local-'+Date.now(),unitId,response:clean,evidenceType:evidenceType||'candidate',state:'candidate_local_only',createdAt:Date.now()};
      store.attempts.push(attempt);writeStore(store);return attempt;
    },
    async requestMagicLink(email){return Auth.requestMagicLink(email);},
    async consumeMagicLinkUrl(link){return Auth.consumeMagicLinkUrl(link);},
    async signOut(){
      Auth.signOut();
      this.mode='cached-private';this.liveStatus='signed_out';this.liveUser=null;this.personalHome=null;this.systemCockpit=null;
    },
    async resetLocalEvidence(){writeStore({attempts:[]});},
    latestAttempt,candidateEvidenceCount
  };
  window.GROWTH_BRAIN_ADAPTER=adapter;
})();
