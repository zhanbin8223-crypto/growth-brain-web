(function(){
  const C=window.GROWTH_BRAIN_CONFIG;
  const SESSION_KEY='growth-brain-single-user-auth-v1';
  const EMAIL_KEY='growth-brain-auth-email-v1';

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
    const redirectTo=location.protocol.startsWith('http') ? location.href.split('#')[0] : undefined;
    const body={email:clean,create_user:false};
    if(redirectTo) body.redirect_to=redirectTo;
    const res=await fetch(`${C.supabaseUrl}/auth/v1/otp`,{
      method:'POST',
      headers:{apikey:C.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const text=await res.text();
    if(!res.ok) throw new Error(`登入信件送出失敗（${res.status}）：${text.slice(0,160)}`);
    localStorage.setItem(EMAIL_KEY,clean);
    return true;
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

  window.GROWTH_BRAIN_AUTH={requestMagicLink,getValidSession,fetchUser,signOut,readSession};
})();
