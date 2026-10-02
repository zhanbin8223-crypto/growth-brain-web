#!/usr/bin/env node

import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync=promisify(execFile);

const required=["SUPABASE_URL","SUPABASE_SECRET_KEY","GROWTH_AUTH_USER_ID"];
for(const key of required){
  if(!process.env[key]){
    console.error("Missing required environment variable: "+key);
    process.exit(1);
  }
}

const SUPABASE_URL=process.env.SUPABASE_URL.replace(/\/$/,"");
const SUPABASE_SECRET_KEY=process.env.SUPABASE_SECRET_KEY;
const AUTH_USER_ID=process.env.GROWTH_AUTH_USER_ID;

const OPENCLI_BIN=process.env.OPENCLI_BIN||"opencli";
const BROWSER_SESSION=process.env.GROWTH_OPENCLI_BROWSER_SESSION||"growthbrain";
const CONVERSATION_URL=(process.env.GROWTH_CHATGPT_CONVERSATION_URL||"").trim();
const CONVERSATION_TITLE=(process.env.GROWTH_CHATGPT_CONVERSATION_TITLE||"Growth Brain Worker").trim();

const WORKER_ID=process.env.GROWTH_WORKER_ID||"mac-opencli-browser-growthbrain";
const PROVIDER_KEY=process.env.GROWTH_PROVIDER_KEY||"chatgpt_web_opencli";
const POLL_MS=Math.max(1000,Number(process.env.GROWTH_POLL_MS||4000));
const HEARTBEAT_MS=Math.max(5000,Number(process.env.GROWTH_HEARTBEAT_MS||15000));
const ASK_TIMEOUT_MS=Math.max(30000,Number(process.env.GROWTH_CHATGPT_TIMEOUT_MS||240000));
const RUN_ONCE=process.env.GROWTH_RUN_ONCE==="1";

let lastHeartbeatAt=0;
let opencliVersion=null;

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function supabaseHeaders(){
  const headers={
    apikey:SUPABASE_SECRET_KEY,
    "Content-Type":"application/json"
  };
  if(!SUPABASE_SECRET_KEY.startsWith("sb_secret_")){
    headers.Authorization="Bearer "+SUPABASE_SECRET_KEY;
  }
  return headers;
}

async function rpc(name,args){
  const res=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:supabaseHeaders(),
    body:JSON.stringify(args)
  });

  const raw=await res.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null;}catch{data=raw;}

  if(!res.ok){
    throw new Error("RPC "+name+" failed ("+res.status+"): "+String(raw).slice(0,500));
  }
  return data;
}

async function runOpenCli(args,timeoutMs=ASK_TIMEOUT_MS+30000){
  try{
    const out=await execFileAsync(OPENCLI_BIN,args,{
      timeout:timeoutMs,
      maxBuffer:24*1024*1024,
      env:{
        ...process.env,
        OPENCLI_WINDOW:"foreground"
      }
    });

    if(out.stderr?.trim()&&process.env.GROWTH_WORKER_VERBOSE==="1"){
      console.error("[opencli-stderr]",out.stderr.trim());
    }
    return out.stdout.trim();
  }catch(error){
    const detail=[
      error?.message,
      String(error?.stderr||"").trim(),
      String(error?.stdout||"").trim()
    ].filter(Boolean).join(" | ");
    throw new Error("OpenCLI failed: "+detail.slice(0,1600));
  }
}

function outputContains(text,needle){
  return String(text||"").toLowerCase().includes(String(needle||"").toLowerCase());
}

async function getBrowserTitle(){
  return runOpenCli(["browser",BROWSER_SESSION,"get","title"],60000);
}

async function getBrowserUrl(){
  return runOpenCli(["browser",BROWSER_SESSION,"get","url"],60000);
}

function findNamedLinkRef(axState,name){
  const target=String(name||"").trim();
  if(!target) return null;

  const refs=[];
  for(const line of String(axState||"").split(/\r?\n/)){
    if(!line.includes("<a")&&!line.includes("role=link")) continue;
    if(!line.includes("aria-label="+target)&&!line.includes(">"+target+"<")) continue;
    const match=line.match(/\[(\d+)\]/);
    if(match) refs.push(match[1]);
  }
  return refs.length?refs[refs.length-1]:null;
}

async function ensureConversation(){
  if(CONVERSATION_URL){
    await runOpenCli(["browser",BROWSER_SESSION,"open",CONVERSATION_URL],90000);
    await runOpenCli(["browser",BROWSER_SESSION,"wait","time","1"],30000);
  }

  let title=await getBrowserTitle().catch(()=> "");
  if(!outputContains(title,CONVERSATION_TITLE)){
    try{
      try{
        await runOpenCli([
          "browser",BROWSER_SESSION,"click",
          "--role","link",
          "--name",CONVERSATION_TITLE
        ],60000);
      }catch(semanticClickError){
        const ax=await runOpenCli([
          "browser",BROWSER_SESSION,"state",
          "--source","ax"
        ],90000);
        const ref=findNamedLinkRef(ax,CONVERSATION_TITLE);
        if(!ref) throw semanticClickError;
        await runOpenCli([
          "browser",BROWSER_SESSION,"click",ref
        ],60000);
      }

      await runOpenCli(["browser",BROWSER_SESSION,"wait","time","1"],30000);
      title=await getBrowserTitle();
    }catch(error){
      throw new Error(
        "Growth Brain Worker conversation is not active. Open the fixed ChatGPT chat once "+
        "or set GROWTH_CHATGPT_CONVERSATION_URL. Detail: "+
        (error instanceof Error?error.message:String(error))
      );
    }
  }

  if(!outputContains(title,CONVERSATION_TITLE)){
    const url=await getBrowserUrl().catch(()=> "");
    throw new Error(
      "Wrong ChatGPT conversation. expected title="+CONVERSATION_TITLE+
      " actual="+String(title).slice(0,180)+" url="+String(url).slice(0,240)
    );
  }

  const url=await getBrowserUrl();
  if(!outputContains(url,"chatgpt.com")){
    throw new Error("Browser session is not on ChatGPT: "+String(url).slice(0,240));
  }

  return {
    title:String(title).trim(),
    url:String(url).trim()
  };
}

function findTextboxRef(axState){
  const refs=[];
  for(const line of String(axState||"").split(/\r?\n/)){
    if(!line.includes("role=textbox")) continue;
    if(!line.includes("contenteditable=true")&&!line.includes("aria-label=問問 ChatGPT")) continue;
    const match=line.match(/\[(\d+)\]/);
    if(match) refs.push(match[1]);
  }
  return refs.length?refs[refs.length-1]:null;
}

async function fillPrompt(prompt){
  try{
    return await runOpenCli([
      "browser",BROWSER_SESSION,"fill",prompt,
      "--role","textbox",
      "--name","問問 ChatGPT",
      "--nth","0"
    ],60000);
  }catch(semanticError){
    const ax=await runOpenCli([
      "browser",BROWSER_SESSION,"state",
      "--source","ax"
    ],90000);

    const ref=findTextboxRef(ax);
    if(!ref){
      throw new Error(
        "Could not locate ChatGPT textbox by semantic selector or AX ref. "+
        (semanticError instanceof Error?semanticError.message:String(semanticError))
      );
    }

    return runOpenCli([
      "browser",BROWSER_SESSION,"fill",ref,prompt
    ],60000);
  }
}

function markerSet(jobId){
  const token=String(jobId||"").replace(/[^A-Za-z0-9]/g,"");
  return {
    token,
    begin:"GBJOB"+token+"BEGIN",
    end:"GBJOB"+token+"END"
  };
}

function buildPrompt(job,markers){
  const payload=job.task_payload||{};
  const parts=[];

  if(payload.instruction){
    parts.push("【任務指示】\n"+String(payload.instruction).trim());
  }

  const input=
    payload.input ??
    payload.prompt ??
    payload.text ??
    payload.raw_content ??
    JSON.stringify(payload);

  parts.push("【任務輸入】\n"+String(input).trim());

  parts.push(
    "【回覆格式控制】\n"+
    "第一行：把字串 GBJOB、"+markers.token+"、BEGIN 三段直接連在一起，中間不要空格。\n"+
    "最後一行：把字串 GBJOB、"+markers.token+"、END 三段直接連在一起，中間不要空格。\n"+
    "兩個標記中間才是任務正文。正文不要再次輸出這兩個完整標記。\n"+
    "若任務要求 JSON，正文只輸出可解析 JSON，不要加 Markdown code fence。"
  );

  parts.push(
    "【Growth Brain 執行規則】\n"+
    "- 只完成這一筆任務。\n"+
    "- 不要把 AI 推測當成使用者已學會。\n"+
    "- 不要把候選作品當成已完成作品。\n"+
    "- 未來階段只可列候選與條件，不可預先承諾。"
  );

  return parts.join("\n\n");
}

function extractMarkedResponse(text,markers){
  const body=String(text||"");
  const beginAt=body.lastIndexOf(markers.begin);
  if(beginAt<0){
    throw new Error("Assistant BEGIN marker not found");
  }

  const contentStart=beginAt+markers.begin.length;
  const endAt=body.indexOf(markers.end,contentStart);
  if(endAt<0){
    throw new Error("Assistant END marker not found after BEGIN marker");
  }

  const result=body.slice(contentStart,endAt).trim();
  if(!result){
    throw new Error("Marked assistant response is empty");
  }
  return result;
}

async function readMarkedResponse(markers){
  const attempts=[
    async()=>runOpenCli([
      "browser",BROWSER_SESSION,"get","text",
      "--selector","body"
    ],90000),
    async()=>runOpenCli([
      "browser",BROWSER_SESSION,"state",
      "--source","ax"
    ],90000)
  ];

  let lastError=null;
  for(const attempt of attempts){
    try{
      const raw=await attempt();
      return {
        text:extractMarkedResponse(raw,markers),
        raw_readback:raw
      };
    }catch(error){
      lastError=error;
    }
  }

  throw lastError||new Error("Could not read marked ChatGPT response");
}

async function askChatGPT(job){
  const conversation=await ensureConversation();
  const markers=markerSet(job.id);
  const prompt=buildPrompt(job,markers);

  await fillPrompt(prompt);
  await runOpenCli([
    "browser",BROWSER_SESSION,"keys","Enter"
  ],30000);

  await runOpenCli([
    "browser",BROWSER_SESSION,"wait","text",markers.end,
    "--timeout",String(ASK_TIMEOUT_MS)
  ],ASK_TIMEOUT_MS+30000);

  const readback=await readMarkedResponse(markers);
  const finalConversation=await ensureConversation();

  return {
    text:readback.text,
    conversation_url:finalConversation.url||conversation.url,
    conversation_title:finalConversation.title||conversation.title,
    marker_begin:markers.begin,
    marker_end:markers.end
  };
}

async function preflight(){
  opencliVersion=(await runOpenCli(["--version"],30000)).split(/\r?\n/)[0]?.trim()||"unknown";

  try{
    await runOpenCli(["doctor","--live"],90000);
  }catch(error){
    console.error(
      "[doctor-warning] current OpenCLI may not support doctor --live; "+
      "continuing with direct browser-session verification"
    );
  }

  return ensureConversation();
}

async function heartbeat(status="online",lastJobId=null,force=false){
  const now=Date.now();
  if(!force&&now-lastHeartbeatAt<HEARTBEAT_MS) return null;
  lastHeartbeatAt=now;

  try{
    return await rpc("growth_ai_worker_heartbeat_service_v1",{
      p_auth_user_id:AUTH_USER_ID,
      p_worker_id:WORKER_ID,
      p_provider_key:PROVIDER_KEY,
      p_status:status,
      p_last_job_id:lastJobId,
      p_metadata:{
        runtime:"opencli_browser_chatgpt_web",
        opencli_version:opencliVersion,
        browser_session:BROWSER_SESSION,
        conversation_title:CONVERSATION_TITLE,
        conversation_url:CONVERSATION_URL||null,
        poll_ms:POLL_MS,
        heartbeat_ms:HEARTBEAT_MS,
        run_once:RUN_ONCE
      }
    });
  }catch(error){
    console.error("[heartbeat-error]",error instanceof Error?error.message:error);
    return null;
  }
}

async function transition(jobId,nextStatus,expectedStatus,extra={}){
  return rpc("growth_ai_job_transition_service_v1",{
    p_auth_user_id:AUTH_USER_ID,
    p_job_id:jobId,
    p_next_status:nextStatus,
    p_expected_status:expectedStatus,
    p_worker_id:WORKER_ID,
    p_provider_key:PROVIDER_KEY,
    p_result:extra.result??null,
    p_result_evidence:extra.evidence??{},
    p_error:extra.error??null
  });
}

async function claimNext(){
  return rpc("growth_ai_job_claim_next_service_v1",{
    p_auth_user_id:AUTH_USER_ID,
    p_worker_id:WORKER_ID,
    p_provider_key:PROVIDER_KEY
  });
}

async function processJob(job){
  let expectedStatus="claimed";
  await heartbeat("busy",job.id,true);

  try{
    const processing=await transition(job.id,"processing",expectedStatus);
    if(!processing?.accepted){
      throw new Error("Could not start job: "+JSON.stringify(processing));
    }
    expectedStatus="processing";

    const startedAt=new Date().toISOString();
    const result=await askChatGPT(job);

    const completed=await transition(job.id,"completed",expectedStatus,{
      result:{
        text:result.text,
        provider_key:PROVIDER_KEY,
        conversation_url:result.conversation_url,
        conversation_title:result.conversation_title
      },
      evidence:{
        worker_id:WORKER_ID,
        provider_key:PROVIDER_KEY,
        execution_surface:"chatgpt_web",
        bridge_protocol:"opencli_browser_ax_markers",
        opencli_version:opencliVersion,
        browser_session:BROWSER_SESSION,
        conversation_title:result.conversation_title,
        conversation_url:result.conversation_url,
        source_ref:job.source_ref||null,
        response_readback:true,
        marker_protocol:true,
        started_at:startedAt,
        completed_at:new Date().toISOString()
      }
    });

    if(!completed?.accepted){
      throw new Error("Could not complete job: "+JSON.stringify(completed));
    }

    console.log("[completed] "+job.id+" "+job.task_type);
    await heartbeat("idle",job.id,true);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error("[failed] "+job.id+": "+message);
    await heartbeat("error",job.id,true);

    try{
      const failed=await transition(job.id,"failed",expectedStatus,{
        error:{
          code:"opencli_browser_worker_execution_failed",
          message,
          worker_id:WORKER_ID,
          provider_key:PROVIDER_KEY,
          conversation_title:CONVERSATION_TITLE,
          failed_at:new Date().toISOString()
        }
      });
      if(!failed?.accepted){
        console.error("[transition-failed]",failed);
      }
    }catch(transitionError){
      console.error("[failed-to-record-error]",transitionError);
    }
  }
}

async function main(){
  console.log("Growth Brain ChatGPT Web / OpenCLI Browser Worker");
  console.log("worker="+WORKER_ID);
  console.log("provider="+PROVIDER_KEY);
  console.log("browser_session="+BROWSER_SESSION);
  console.log("conversation_title="+CONVERSATION_TITLE);

  try{
    const conversation=await preflight();
    console.log("opencli="+opencliVersion);
    console.log("conversation="+conversation.url);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    console.error("[preflight-failed]",message);
    await heartbeat("error",null,true);
    process.exit(2);
  }

  await heartbeat("online",null,true);

  while(true){
    try{
      await heartbeat("online");

      const claim=await claimNext();
      if(!claim?.accepted){
        console.error("[claim-rejected]",claim);
        await sleep(POLL_MS);
        continue;
      }

      const job=claim.job;
      if(!job){
        await heartbeat("idle");
        if(RUN_ONCE){
          console.log("[idle] no pending job");
          await heartbeat("stopping",null,true);
          return;
        }
        await sleep(POLL_MS);
        continue;
      }

      console.log("[claimed] "+job.id+" "+job.task_type);
      await processJob(job);

      if(RUN_ONCE){
        await heartbeat("stopping",job.id,true);
        return;
      }
    }catch(error){
      console.error("[poll-error]",error instanceof Error?error.message:error);
      await heartbeat("error",null,true);
      await sleep(POLL_MS);
    }
  }
}

main().catch(error=>{
  console.error(error);
  process.exit(1);
});
