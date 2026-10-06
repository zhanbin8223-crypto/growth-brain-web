(function(){
  const C=window.GROWTH_BRAIN_CONFIG;
  const SESSION_KEY='growth-brain-single-user-auth-v1';
  const EMAIL_KEY='growth-brain-auth-email-v1';
  const SEND_KEY='growth-brain-auth-send-v1';
  let sendingLogin=false;

  function remainingLoginWait(email){
    try{
      const last=JSON.parse(localStorage.getItem(SEND_KEY)||'null');
      return last?.email===email ? Math.max(0,Math.ceil((last.until-Date.now())/1000)) : 0;
    }catch{return 0;}
  }
  function holdLoginSend(email,seconds){
    localStorage.setItem(SEND_KEY,JSON.stringify({email,until:Date.now()+seconds*1000}));
  }

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
  }
  function saveSession(s){
    if(s) localStorage.setItem(SESSION_KEY,JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  function parseHashSession(){
    if(!location.hash) return null;
    const p=new URLSearchParams(location.hash.slice(1));
    const access_token=p.get('access_token');
    const refresh_token=p.get('refresh_token');
    if(!access_token) return null;
    const session={
      access_token,
      refresh_token,
      expires_in:Number(p.get('expires_in')||3600),
      created_at:Date.now()
    };
    saveSession(session);
    history.replaceState(null,'',location.pathname+location.search);
    return session;
  }
  async function requestMagicLink(email){
    const clean=(email||'').trim();
    if(!/^\S+@\S+\.\S+$/.test(clean)) throw new Error('請輸入有效信箱。');
    if(sendingLogin) throw new Error('登入信正在寄送，請勿重複點擊。');
    const wait=remainingLoginWait(clean.toLowerCase());
    if(wait) throw new Error(`登入信已寄送或仍在冷卻中，請先查看最新一封；需重寄請等 ${wait} 秒。`);
    const redirectTo=location.protocol.startsWith('http') ? location.origin+location.pathname : undefined;
    const body={email:clean,create_user:false};
    const endpoint=new URL(`${C.supabaseUrl}/auth/v1/otp`);
    if(redirectTo) endpoint.searchParams.set('redirect_to',redirectTo);
    sendingLogin=true;
    try{
    const res=await fetch(endpoint.toString(),{
      method:'POST',
      headers:{apikey:C.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const text=await res.text();
    if(res.status===429){
      const seconds=Number(text.match(/after\s+(\d+)\s+seconds/i)?.[1]||res.headers?.get('Retry-After'))||60;
      holdLoginSend(clean.toLowerCase(),seconds);
      throw new Error(`寄信暫時受到限制，請等 ${seconds} 秒後再試一次，或先查看最新一封登入信。`);
    }
    if(!res.ok) throw new Error(`登入信件送出失敗（${res.status}）：${text.slice(0,160)}`);
    holdLoginSend(clean.toLowerCase(),60);
    localStorage.setItem(EMAIL_KEY,clean);
    return true;
    }finally{sendingLogin=false;}
  }
  async function consumeMagicLinkUrl(rawLink){
    const value=(rawLink||'').trim();
    if(!value) throw new Error('請從最新、尚未點開的登入信，複製登入按鈕的連結網址後貼上。');
    let url;
    try{url=new URL(value);}catch{throw new Error('無法辨識這個連結。請在登入信的登入按鈕上長按或按右鍵，選「複製連結網址」。');}
    if(url.origin===location.origin && !url.searchParams.has('token_hash') && !url.searchParams.has('token') && !new URLSearchParams(url.hash.slice(1)).has('access_token')){
      throw new Error('這是登入後的網址，沒有登入資訊。請從最新、尚未點開的登入信，複製登入按鈕的連結網址；已點過的連結請重寄。');
    }
    const expected=new URL(C.supabaseUrl);
    if(url.origin!==expected.origin || !url.pathname.endsWith('/auth/v1/verify')){
      throw new Error('這不是這個 Growth Brain 專案的 Supabase 登入連結。');
    }
    const tokenHash=url.searchParams.get('token_hash')||url.searchParams.get('token');
    const type=url.searchParams.get('type')||'email';
    const allowedTypes=new Set(['email','magiclink','signup','invite','recovery','email_change']);
    if(!tokenHash || !allowedTypes.has(type)) throw new Error('登入連結缺少可驗證 token，或登入類型不支援。');
    const res=await fetch(`${C.supabaseUrl}/auth/v1/verify`,{
      method:'POST',
      headers:{apikey:C.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify({token_hash:tokenHash,type})
    });
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch{}
    if(!res.ok){
      const message=data?.msg||data?.message||data?.error_description||'';
      if((data?.code||data?.error_code)==='otp_expired' || /email link is invalid or has expired/i.test(message)){
        throw new Error('這封登入連結已無法使用，可能已使用或已過期。請重寄最新登入信，直接點選信中的登入按鈕。');
      }
      throw new Error(message||`登入連結驗證失敗（${res.status}）`);
    }
    const s=data?.session||data;
    if(!s?.access_token || !s?.refresh_token) throw new Error('登入已驗證，但沒有取得可保存的 session。');
    const session={
      access_token:s.access_token,
      refresh_token:s.refresh_token,
      expires_in:Number(s.expires_in||3600),
      created_at:Date.now()
    };
    saveSession(session);
    if(data?.user?.email) localStorage.setItem(EMAIL_KEY,data.user.email);
    return {session,user:data?.user||null};
  }

  async function refreshSession(session){
    if(!session?.refresh_token) return null;
    const res=await fetch(`${C.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',
      headers:{apikey:C.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if(!res.ok){saveSession(null);return null;}
    const data=await res.json();
    const next={
      access_token:data.access_token,
      refresh_token:data.refresh_token||session.refresh_token,
      expires_in:data.expires_in||3600,
      created_at:Date.now()
    };
    saveSession(next);
    return next;
  }
  async function getValidSession(){
    const fromHash=parseHashSession();
    let session=fromHash||readSession();
    if(!session) return null;
    const age=(Date.now()-(session.created_at||0))/1000;
    if(age>(session.expires_in||3600)-120) session=await refreshSession(session);
    return session;
  }
  async function fetchUser(){
    const session=await getValidSession();
    if(!session) return null;
    const res=await fetch(`${C.supabaseUrl}/auth/v1/user`,{
      headers:{apikey:C.publishableKey,Authorization:`Bearer ${session.access_token}`}
    });
    if(!res.ok){saveSession(null);return null;}
    return res.json();
  }
  function signOut(){
    saveSession(null);
    localStorage.removeItem(EMAIL_KEY);
  }

  window.GROWTH_BRAIN_AUTH={requestMagicLink,consumeMagicLinkUrl,getValidSession,fetchUser,signOut,readSession};
})();
