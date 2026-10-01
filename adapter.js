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
    personalOutcome:null,
    inbox:null,
    learning:null,
    personalSynapse:null,
    systemCockpit:null,
    lastLiveError:null,
    lastSynapseError:null,
    async initialize(){
      const user=await Auth.fetchUser().catch(()=>null);
      this.liveUser=user;
      this.liveStatus=user?'signed_in_unchecked':'signed_out';
      if(user){
        try{
          const result=await liveRequest('GET',undefined,'personal_home');
          this.personalHome=extractSurface(result);
          try{
            const synapseResult=await liveRequest('GET',undefined,'personal_synapse');
            this.personalSynapse=extractSurface(synapseResult);
            this.lastSynapseError=null;
          }catch(synapseError){
            this.personalSynapse=null;
            this.lastSynapseError={code:synapseError.code||'unknown',status:synapseError.status||null};
          }
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
    async probeSession(kind){
      const session=await Auth.getValidSession();
      if(!session) throw Object.assign(new Error('not_signed_in'),{code:'not_signed_in'});
      const url=new URL(C.edgeFunctionUrl);
      url.searchParams.set('surface','personal_home');
      url.searchParams.set('probe',kind);
      const res=await fetch(url.toString(),{
        headers:{
          apikey:C.publishableKey,
          Authorization:`Bearer ${session.access_token}`
        }
      });
      if(!res.ok) throw Object.assign(new Error(`probe_http_${res.status}`),{code:`probe_http_${res.status}`,status:res.status});
      return {ok:true,kind,status:res.status};
    },
    async refreshPersonalHome(){
      if(this.mode!=='live') return null;
      const result=await liveRequest('GET',undefined,'personal_home');
      this.personalHome=extractSurface(result);
      return clone(this.personalHome);
    },
    async getPersonalOutcome(){
      if(this.personalOutcome) return clone(this.personalOutcome);
      if(this.mode!=='live') return {selected_route:null,candidate_route:null,policy:{candidate_is_commitment:false}};
      const result=await liveRequest('GET',undefined,'personal_outcome');
      this.personalOutcome=extractSurface(result);
      return clone(this.personalOutcome);
    },
    async savePersonalOutcomeCandidate({title,successEvidence,whyNow,directionKey}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入，候選主線才會正式保存。'),{code:'not_signed_in'});
      const result=await liveRequest('POST',{
        action:'save_personal_outcome_candidate',
        title,
        success_evidence:successEvidence,
        why_now:whyNow||null,
        direction_key:directionKey||null
      });
      this.personalOutcome=result?.data?.snapshot||null;
      await this.refreshPersonalHome();
      return clone(this.personalOutcome);
    },
    async decidePersonalOutcomeCandidate({routeId,decision}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入。'),{code:'not_signed_in'});
      const result=await liveRequest('POST',{
        action:'decide_personal_outcome_candidate',
        route_id:routeId,
        decision
      });
      this.personalOutcome=result?.data?.snapshot||null;
      await this.refreshPersonalHome();
      return clone(this.personalOutcome);
    },
    async getInbox(){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入，收件匣只顯示正式資料。'),{code:'not_signed_in'});
      const result=await liveRequest('GET',undefined,'inbox');
      this.inbox=extractSurface(result);
      return clone(this.inbox);
    },
    async captureInbox({rawContent,sourceKind,sourceUrl}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入。'),{code:'not_signed_in'});
      const result=await liveRequest('POST',{
        action:'capture_inbox',
        raw_content:rawContent,
        source_kind:sourceKind||'text',
        source_url:sourceUrl||null,
        source_metadata:{capture_surface:'growth_brain_web'}
      });
      this.inbox=result?.data?.snapshot||null;
      return clone(this.inbox);
    },
    async classifyInbox({itemId,classification}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入。'),{code:'not_signed_in'});
      const result=await liveRequest('POST',{
        action:'classify_inbox',
        item_id:itemId,
        classification
      });
      this.inbox=result?.data?.snapshot||null;
      return clone(this.inbox);
    },
    async routeInbox({itemId,title,successEvidence,whyNow,goal,sourceLanguage}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入。'),{code:'not_signed_in'});
      const result=await liveRequest('POST',{
        action:'route_inbox',
        item_id:itemId,
        title:title||null,
        success_evidence:successEvidence||null,
        why_now:whyNow||null,
        goal:goal||null,
        source_language:sourceLanguage||'unknown'
      });
      this.inbox=result?.data?.snapshot||null;
      if(result?.data?.personal_outcome) this.personalOutcome=result.data.personal_outcome;
      await this.refreshPersonalHome();
      return clone(result?.data||null);
    },
    async getLearning(){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入，學習頁只顯示正式資料。'),{code:'not_signed_in'});
      const result=await liveRequest('GET',undefined,'learning');
      this.learning=extractSurface(result);
      return clone(this.learning);
    },
    async createLearningText({rawContent,title,goal,sourceLanguage,clientRequestId}){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入。'),{code:'not_signed_in'});
      const requestId=clientRequestId||crypto.randomUUID();
      const result=await liveRequest('POST',{
        action:'create_learning_text',
        raw_content:rawContent,
        title:title||null,
        goal:goal||null,
        source_language:sourceLanguage||'unknown',
        client_request_id:requestId
      });
      this.learning=result?.data?.learning||null;
      await this.refreshPersonalHome();
      return clone(result?.data||null);
    },
    async getPersonalSynapse(){
      if(this.mode!=='live') throw Object.assign(new Error('請先登入，知識連結只顯示正式個人資料。'),{code:'not_signed_in'});
      const result=await liveRequest('GET',undefined,'personal_synapse');
      this.personalSynapse=extractSurface(result);
      this.lastSynapseError=null;
      return clone(this.personalSynapse);
    },
    async getSnapshot(){
      const out=clone(D);
      out.personalHome=this.personalHome?clone(this.personalHome):null;
      out.synapse=this.personalSynapse?clone(this.personalSynapse):{nodes:[],edges:[],status:this.mode==='live'?'not_loaded_or_empty':'signed_out'};
      out.meta={
        ...(out.meta||{}),
        home_source:this.personalHome?'正式登入個人首頁':'未載入正式個人首頁',
        home_live:Boolean(this.personalHome),
        synapse_live:Boolean(this.personalSynapse),
        synapse_error:this.lastSynapseError?.code||null
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
        await this.getLearning();
        await this.refreshPersonalHome();
        return result;
      }
      const store=readStore();
      const attempt={id:'local-'+Date.now(),unitId,response:clean,evidenceType:evidenceType||'candidate',state:'candidate_local_only',createdAt:Date.now()};
      store.attempts.push(attempt);writeStore(store);return attempt;
    },
    async requestMagicLink(email){return Auth.requestMagicLink(email);},
    async consumeMagicLinkUrl(link){return Auth.consumeMagicLinkUrl(link);},
    async signOut(){
      Auth.signOut();
      this.mode='cached-private';this.liveStatus='signed_out';this.liveUser=null;this.personalHome=null;this.personalOutcome=null;this.inbox=null;this.learning=null;this.personalSynapse=null;this.systemCockpit=null;this.lastLiveError=null;this.lastSynapseError=null;
    },
    async resetLocalEvidence(){writeStore({attempts:[]});},
    latestAttempt,candidateEvidenceCount
  };
  window.GROWTH_BRAIN_ADAPTER=adapter;
})();
