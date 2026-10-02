#!/usr/bin/env node

const required = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "GROWTH_AUTH_USER_ID"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const AUTH_USER_ID = process.env.GROWTH_AUTH_USER_ID;
const WORKER_ID = process.env.GROWTH_WORKER_ID || `mac-worker-${process.pid}`;
const PROVIDER_KEY = process.env.GROWTH_PROVIDER_KEY || "chatgpt_web_bridge";
const BRIDGE_URL = (process.env.CHATGPT_BRIDGE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const BRIDGE_API_KEY = process.env.CHATGPT_BRIDGE_API_KEY || "";
const MODEL = process.env.CHATGPT_MODEL || "chatgpt";
const POLL_MS = Math.max(1000, Number(process.env.GROWTH_POLL_MS || 4000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseHeaders() {
  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    "Content-Type": "application/json"
  };
  if (!SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  }
  return headers;
}

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(args)
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    throw new Error(`RPC ${name} failed (${res.status}): ${String(raw).slice(0, 500)}`);
  }
  return data;
}

function bridgeHeaders() {
  const headers = {"Content-Type": "application/json"};
  if (BRIDGE_API_KEY) {
    headers.Authorization = `Bearer ${BRIDGE_API_KEY}`;
  }
  return headers;
}

function messagesFor(job) {
  const payload = job.task_payload || {};
  if (Array.isArray(payload.messages) && payload.messages.length) {
    return payload.messages;
  }

  const messages = [];
  if (payload.instruction) {
    messages.push({role: "system", content: String(payload.instruction)});
  }

  const input =
    payload.input ??
    payload.prompt ??
    payload.text ??
    payload.raw_content ??
    JSON.stringify(payload);

  messages.push({role: "user", content: String(input)});
  return messages;
}

async function callBridge(job) {
  const res = await fetch(`${BRIDGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: messagesFor(job)
    })
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Bridge returned non-JSON response: ${raw.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(`Bridge request failed (${res.status}): ${raw.slice(0, 500)}`);
  }

  const text =
    data?.choices?.[0]?.message?.content ??
    data?.output_text ??
    data?.response ??
    data?.text ??
    null;

  if (!text || !String(text).trim()) {
    throw new Error("Bridge response did not contain usable text");
  }

  return {
    text: String(text).trim(),
    model: data?.model || MODEL,
    raw_id: data?.id || null
  };
}

async function transition(jobId, nextStatus, expectedStatus, extra = {}) {
  return rpc("growth_ai_job_transition_service_v1", {
    p_auth_user_id: AUTH_USER_ID,
    p_job_id: jobId,
    p_next_status: nextStatus,
    p_expected_status: expectedStatus,
    p_worker_id: WORKER_ID,
    p_provider_key: PROVIDER_KEY,
    p_result: extra.result ?? null,
    p_result_evidence: extra.evidence ?? {},
    p_error: extra.error ?? null
  });
}

async function claimNext() {
  return rpc("growth_ai_job_claim_next_service_v1", {
    p_auth_user_id: AUTH_USER_ID,
    p_worker_id: WORKER_ID,
    p_provider_key: PROVIDER_KEY
  });
}

async function processJob(job) {
  let expectedStatus = "claimed";
  try {
    const processing = await transition(job.id, "processing", expectedStatus);
    if (!processing?.accepted) {
      throw new Error(`Could not start job: ${JSON.stringify(processing)}`);
    }
    expectedStatus = "processing";

    const bridgeResult = await callBridge(job);

    const completed = await transition(job.id, "completed", expectedStatus, {
      result: {
        text: bridgeResult.text,
        model: bridgeResult.model,
        provider_key: PROVIDER_KEY
      },
      evidence: {
        worker_id: WORKER_ID,
        provider_key: PROVIDER_KEY,
        bridge_protocol: "openai_compatible_local_http",
        bridge_scope: "localhost_only",
        source_ref: job.source_ref || null,
        response_id: bridgeResult.raw_id,
        completed_at: new Date().toISOString()
      }
    });

    if (!completed?.accepted) {
      throw new Error(`Could not complete job: ${JSON.stringify(completed)}`);
    }

    console.log(`[completed] ${job.id} ${job.task_type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[failed] ${job.id}: ${message}`);

    try {
      const failed = await transition(job.id, "failed", expectedStatus, {
        error: {
          code: "worker_execution_failed",
          message,
          worker_id: WORKER_ID,
          failed_at: new Date().toISOString()
        }
      });
      if (!failed?.accepted) {
        console.error("[transition-failed]", failed);
      }
    } catch (transitionError) {
      console.error("[failed-to-record-error]", transitionError);
    }
  }
}

async function main() {
  console.log("Growth Brain local AI worker");
  console.log(`worker=${WORKER_ID}`);
  console.log(`provider=${PROVIDER_KEY}`);
  console.log(`bridge=${BRIDGE_URL}`);
  console.log("ChatGPT browser session and all secrets stay on this Mac.");

  while (true) {
    try {
      const claim = await claimNext();
      if (!claim?.accepted) {
        console.error("[claim-rejected]", claim);
        await sleep(POLL_MS);
        continue;
      }

      const job = claim.job;
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }

      console.log(`[claimed] ${job.id} ${job.task_type}`);
      await processJob(job);
    } catch (error) {
      console.error("[poll-error]", error instanceof Error ? error.message : error);
      await sleep(POLL_MS);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
