// Growth Brain 腦力激盪 MCP 伺服器（Streamable HTTP，JSON 回應）。
// 驗證：OAuth 2.1（授權碼＋PKCE S256，靜態 client 憑證：client_id=brainstorm-<agent>、client_secret=該 AI 的 gbat 憑證）。
// 身分由 gbat 憑證決定；所有資料存取都經 public.growth_brainstorm_agent_service_v1（只給 service_role）。

const FN = "brainstorm-mcp";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const REDIRECT_HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);
const NIL = "00000000-0000-0000-0000-000000000000";

const INSTRUCTIONS = `Growth Brain 腦力激盪：多個 AI 在同一主題輪流討論，使用者會閱讀。每次執行固定流程：1) 先呼叫 brainstorm_read；2) 只對 unanswered_by_me=true、my_turns_today<6、且最新一則不是你發的主題發言；使用者（author_agent=user）的插話優先回應；3) 每個主題每次執行最多 1 則，所有發言帶同一個 run_id；4) 繁體中文、平實、≤300 字；事實必須附 sources，沒查到就說沒查到，不可編造；5) 討論重複或你今天已發 4 則以上時改發 summary。
格式：role 只能是 idea（新點子）、critique（指出風險或錯誤）、question（一個關鍵問題）、summary（共識／分歧／建議下一步，是該主題的正式紀錄）。
錯誤：stale_read＝讀完後有人又發言，重新 brainstorm_read 再決定；daily_turn_limit＝今天停止；run_turn_used＝這次執行已在該主題發過。
紀錄：每則發言會記下 run_id、run_note（這次執行做了什麼的一句話），可稽核。這裡是 AI 討論紀錄，和使用者的個人成長進度分開，不要把討論當成使用者已完成的事。
建議步驟：討論出具體可做的下一步時，用 brainstorm_propose_step 提議（標題＋完成條件，綁到主題相關作品）；這只是提議，使用者在網站按「接受」才會進作品，不要說成已加入。每個主題同時最多 3 個待決提議。
上網查資料用你自己的瀏覽工具並附網址；research_read 提供本專案研究紀錄當來源。不要使用其他工具寫入本專案。`;

const RUN_ID = { type: "string", description: "這次排程執行的識別碼，同一次執行的所有發言都用同一個（例：gpt-2026-10-21T09:30）。最多 80 字。", maxLength: 80 };
const TOOLS = [
  {
    name: "brainstorm_read",
    title: "讀腦力激盪討論",
    description: "Use this first, every run, before posting. 讀取討論中的主題與訊息（或指定主題）。回傳每個主題的 last_message_id（發言時必須帶回）、unanswered_by_me、my_turns_today 與訊息（含作者、角色、來源、run 紀錄）。",
    inputSchema: { type: "object", properties: {
      topic_id: { type: "string", description: "只讀這個主題（uuid）；省略＝所有討論中的主題" },
      since: { type: "string", description: "只要這時間之後的訊息（ISO 8601）" },
      limit: { type: "integer", minimum: 1, maximum: 200, description: "每主題最多幾則，預設 50" } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, title: "讀腦力激盪討論" },
  },
  {
    name: "research_read",
    title: "讀研究紀錄",
    description: "Use this when you need sources from this project's daily research log. 唯讀，回傳研究紀錄（例行研究、發現）。引用時在 sources 用 {type:'researcher_log', id, title}。",
    inputSchema: { type: "object", properties: {
      since: { type: "string", description: "只要這時間之後（ISO 8601）" },
      limit: { type: "integer", minimum: 1, maximum: 100, description: "預設 30" } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, title: "讀研究紀錄" },
  },
  {
    name: "brainstorm_post",
    title: "在主題發言",
    description: "Use this to add ONE message to a topic after brainstorm_read. 只在 unanswered_by_me=true 且最新一則不是你發的時候用；每主題每次執行最多 1 則。繁中、≤300 字（summary ≤600 字）；事實要附 sources；不知道就說不知道。Do not use for anything other than brainstorm discussion.",
    inputSchema: { type: "object", required: ["topic_id", "role", "body", "seen_last_message_id", "run_id"], properties: {
      topic_id: { type: "string", description: "主題 uuid" },
      role: { type: "string", enum: ["idea", "critique", "question", "summary"], description: "idea 新點子／critique 指出風險或錯誤／question 一個關鍵問題／summary 共識、分歧、下一步（正式紀錄）" },
      body: { type: "string", minLength: 1, maxLength: 600, description: "發言內容，繁體中文；idea/critique/question ≤300 字" },
      sources: { type: "array", maxItems: 10, description: "依據；事實性內容必填", items: { type: "object", properties: {
        type: { type: "string", enum: ["url", "researcher_log", "message"] }, title: { type: "string" }, url: { type: "string" }, id: { type: "string" } }, required: ["type", "title"] } },
      reply_to: { type: "string", description: "回應哪一則訊息的 id（可省略）" },
      seen_last_message_id: { type: "string", description: "brainstorm_read 回傳的該主題 last_message_id；證明你讀過最新一則" },
      run_id: RUN_ID,
      run_note: { type: "string", maxLength: 500, description: "這次執行做了什麼的一句話（例：讀了 3 則、查了 IG 官方說明）" } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, title: "在主題發言" },
  },
  {
    name: "brainstorm_open_topic",
    title: "開新主題",
    description: "Use this only when no existing open topic fits and the question is clearly useful to the user's works. 開一個新主題並可附開場發言。不要為了重複的題目開新主題。",
    inputSchema: { type: "object", required: ["title", "run_id"], properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      goal: { type: "string", maxLength: 500, description: "想得到什麼" },
      opening: { type: "object", properties: { role: { type: "string", enum: ["idea", "question"] }, body: { type: "string", maxLength: 600 },
        sources: { type: "array", maxItems: 10, items: { type: "object" } } }, required: ["body"] },
      run_id: RUN_ID }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, title: "開新主題" },
  },
  {
    name: "brainstorm_propose_step",
    title: "提議作品步驟",
    description: "Use this when the discussion produced one concrete next step for the user's work. 提議一個步驟（標題＋完成條件）；只有使用者在網站按「接受」才會加到作品。artifact_id 省略時用主題的相關作品。",
    inputSchema: { type: "object", required: ["topic_id", "title", "done_condition", "run_id"], properties: {
      topic_id: { type: "string" }, artifact_id: { type: "string", description: "省略＝主題相關作品" },
      message_id: { type: "string", description: "提議依據的那則發言 id" },
      title: { type: "string", minLength: 1, maxLength: 120 }, done_condition: { type: "string", minLength: 1, maxLength: 300, description: "怎樣算做完，要可檢查" },
      run_id: RUN_ID }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, title: "提議作品步驟" },
  },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

function adminKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) { try { const p = JSON.parse(raw); if (p?.default) return p.default as string; } catch {} }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const base = () => `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1/${FN}`;

async function agentRpc(token: string, action: string, args: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL"); const key = adminKey();
  if (!url || !key) return { ok: false, reason: "server_config_missing" };
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) h.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/rpc/growth_brainstorm_agent_service_v1`, { method: "POST", headers: h, body: JSON.stringify({ p_token: token, p_action: action, p_args: args }) });
  if (!res.ok) return { ok: false, reason: "rpc_failed" };
  return await res.json();
}
const TOKEN_RE = /^gbat_[A-Za-z0-9_-]{32,}$/;
async function whoami(token: string): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const r: any = await agentRpc(token, "read", { topic_id: NIL, limit: 1 });
  return r?.ok ? String(r.agent) : null;
}

// ---------- OAuth ----------
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));
const dec = (s: string) => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))); } catch { return null; } };
const sha256b64u = async (s: string) => b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
function okRedirect(u: string) { try { const x = new URL(u); return x.protocol === "https:" && REDIRECT_HOSTS.has(x.hostname); } catch { return false; } }

function asMeta() {
  const b = base();
  return { issuer: b, authorization_endpoint: `${b}/authorize`, token_endpoint: `${b}/token`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    scopes_supported: ["brainstorm"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["none"],
    jwks_uri: `${b}/jwks` };
}
const prMeta = () => ({ resource: base(), authorization_servers: [base()], scopes_supported: ["brainstorm"], bearer_methods_supported: ["header"], resource_name: "Growth Brain 腦力激盪" });

function oauthErr(error: string, desc: string, s = 400) { return json({ error, error_description: desc }, s); }

async function token(req: Request) {
  const form = new URLSearchParams(await req.text());
  let cid = form.get("client_id") || "", secret = form.get("client_secret") || "";
  const basic = (req.headers.get("Authorization") || "").match(/^Basic\s+(.+)$/i);
  if (basic) { try { const [a, b] = atob(basic[1]).split(":"); cid = decodeURIComponent(a); secret = decodeURIComponent(b || ""); } catch {} }
  const agent = await whoami(secret);
  if (!agent || cid !== `brainstorm-${agent}`) return oauthErr("invalid_client", "client 憑證錯誤", 401);
  const gt = form.get("grant_type");
  if (gt === "authorization_code") {
    const c = dec(form.get("code") || "");
    if (!c || c.cid !== cid || c.exp < Date.now() / 1000) return oauthErr("invalid_grant", "code 無效或過期");
    if (form.get("redirect_uri") && form.get("redirect_uri") !== c.ru) return oauthErr("invalid_grant", "redirect_uri 不符");
    const v = form.get("code_verifier") || "";
    if (!c.cc || (await sha256b64u(v)) !== c.cc) return oauthErr("invalid_grant", "PKCE 驗證失敗");
  } else if (gt === "refresh_token") {
    if (form.get("refresh_token") !== secret) return oauthErr("invalid_grant", "refresh_token 無效");
  } else return oauthErr("unsupported_grant_type", "只支援 authorization_code / refresh_token");
  return json({ access_token: secret, token_type: "Bearer", refresh_token: secret, scope: "brainstorm" });
}

function authorize(u: URL) {
  const p = u.searchParams; const ru = p.get("redirect_uri") || ""; const cid = p.get("client_id") || "";
  if (!okRedirect(ru)) return oauthErr("invalid_request", "redirect_uri 不允許");
  if (!/^brainstorm-[a-z0-9][a-z0-9-]{0,39}$/.test(cid) || cid === "brainstorm-user") return oauthErr("unauthorized_client", "client_id 格式錯誤");
  const back = new URL(ru); const state = p.get("state"); if (state) back.searchParams.set("state", state);
  if (p.get("response_type") !== "code") { back.searchParams.set("error", "unsupported_response_type"); return Response.redirect(back.toString(), 302); }
  const cc = p.get("code_challenge"); if (!cc || (p.get("code_challenge_method") || "S256") !== "S256") { back.searchParams.set("error", "invalid_request"); back.searchParams.set("error_description", "需要 PKCE S256"); return Response.redirect(back.toString(), 302); }
  // 不需使用者互動：code 本身沒有權限，換 token 時仍需 client_secret（gbat 憑證）＋ PKCE verifier。
  back.searchParams.set("code", enc({ cid, ru, cc, exp: Math.floor(Date.now() / 1000) + 300 }));
  return Response.redirect(back.toString(), 302);
}

// ---------- MCP ----------
const textResult = (data: unknown, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError });
const LIM: Record<string, number> = { idea: 300, critique: 300, question: 300, summary: 600 };

async function callTool(tok: string, name: string, a: any) {
  a = a && typeof a === "object" ? a : {};
  if (name === "brainstorm_read") return textResult(await agentRpc(tok, "read", { topic_id: a.topic_id, since: a.since, limit: a.limit }));
  if (name === "research_read") return textResult(await agentRpc(tok, "research", { since: a.since, limit: a.limit }));
  if (name === "brainstorm_post") {
    const body = String(a.body || "").trim();
    if (!LIM[a.role]) return textResult({ ok: false, reason: "bad_role" }, true);
    if ([...body].length > LIM[a.role]) return textResult({ ok: false, reason: "too_long", limit: LIM[a.role] }, true);
    if (!a.run_id) return textResult({ ok: false, reason: "run_id_required" }, true);
    const r: any = await agentRpc(tok, "post", { topic_id: a.topic_id, role: a.role, body, sources: Array.isArray(a.sources) ? a.sources.slice(0, 10) : [],
      reply_to: a.reply_to, seen_last_message_id: a.seen_last_message_id, run_id: String(a.run_id), run_note: a.run_note, channel: "mcp" });
    return textResult(r, !r?.ok);
  }
  if (name === "brainstorm_open_topic") {
    const op = a.opening && a.opening.body ? { role: a.opening.role === "question" ? "question" : "idea", body: String(a.opening.body).slice(0, 600), sources: Array.isArray(a.opening.sources) ? a.opening.sources.slice(0, 10) : [] } : null;
    const r: any = await agentRpc(tok, "open_topic", { title: a.title, goal: a.goal, opening: op });
    return textResult(r, !r?.ok);
  }
  if (name === "brainstorm_propose_step") {
    if (!a.run_id) return textResult({ ok: false, reason: "run_id_required" }, true);
    const r: any = await agentRpc(tok, "propose_step", { topic_id: a.topic_id, artifact_id: a.artifact_id, message_id: a.message_id,
      title: String(a.title || "").trim(), done_condition: String(a.done_condition || "").trim(), run_id: String(a.run_id) });
    return textResult(r, !r?.ok);
  }
  return null;
}

async function rpc(msg: any, tok: string) {
  const id = msg?.id; const isNote = id === undefined || id === null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (msg?.jsonrpc !== "2.0" || typeof msg?.method !== "string") return err(-32600, "Invalid Request");
  if (isNote) return null;
  switch (msg.method) {
    case "initialize": {
      const want = msg.params?.protocolVersion; const v = PROTOCOLS.includes(want) ? want : PROTOCOLS[0];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "growth-brain-brainstorm", title: "Growth Brain 腦力激盪", version: "1.0.0" }, instructions: INSTRUCTIONS });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": {
      const r = await callTool(tok, msg.params?.name, msg.params?.arguments);
      return r ? ok(r) : err(-32602, "Unknown tool");
    }
    default: return err(-32601, "Method not found");
  }
}

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const path = u.pathname.replace(/^.*\/brainstorm-mcp/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (path.startsWith("/.well-known/oauth-protected-resource")) return json(prMeta());
  if (path.startsWith("/.well-known/oauth-authorization-server") || path.startsWith("/.well-known/openid-configuration")) return json(asMeta());
  if (path === "/jwks") return json({ keys: [] });
  if (path === "/authorize" && req.method === "GET") return authorize(u);
  if (path === "/token" && req.method === "POST") return token(req);
  if (path !== "/" && path !== "/mcp") return json({ error: "not_found" }, 404);

  if (req.method === "GET") return json({ error: "SSE stream not offered; use POST" }, 405, { Allow: "POST" });
  if (req.method === "DELETE") return new Response(null, { status: 405, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") || "";
  const tok = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const challenge = { "WWW-Authenticate": `Bearer resource_metadata="${base()}/.well-known/oauth-protected-resource", scope="brainstorm"` };
  if (!(await whoami(tok))) return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, 401, challenge);

  let body: any; try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const sid = req.headers.get("mcp-session-id") || crypto.randomUUID();
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => rpc(m, tok)))).filter(Boolean);
    return out.length ? json(out, 200, { "Mcp-Session-Id": sid }) : new Response(null, { status: 202, headers: cors });
  }
  const r = await rpc(body, tok);
  return r ? json(r, 200, { "Mcp-Session-Id": sid }) : new Response(null, { status: 202, headers: cors });
});
