// AI 腦力激盪代理端點：每個 AI 用自己的憑證（Bearer gbat_…），身分由憑證決定，不能自稱。
// 只能做：read / post / open_topic / research（唯讀研究紀錄）。其他資料一律碰不到。
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function adminKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) { try { const p = JSON.parse(raw); if (p?.default) return p.default as string; } catch {} }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

const ACTIONS = new Set(["read", "post", "open_topic", "research"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, reason: "post_only" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^gbat_[A-Za-z0-9_-]{32,}$/.test(token)) return json({ ok: false, reason: "invalid_token" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, reason: "bad_json" }, 400); }
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return json({ ok: false, reason: "unsupported_action" }, 400);
  const args = body?.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
  if (JSON.stringify(args).length > 20000) return json({ ok: false, reason: "too_large" }, 413);

  const url = Deno.env.get("SUPABASE_URL"); const key = adminKey();
  if (!url || !key) return json({ ok: false, reason: "server_config_missing" }, 500);
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) h.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/rpc/growth_brainstorm_agent_service_v1`, {
    method: "POST", headers: h, body: JSON.stringify({ p_token: token, p_action: action, p_args: args }),
  });
  const text = await res.text();
  if (!res.ok) return json({ ok: false, reason: "rpc_failed" }, 502);
  let data: any = null; try { data = JSON.parse(text); } catch {}
  if (data?.ok === false) {
    const status = data.reason === "invalid_token" ? 401 : data.reason === "scope_denied" ? 403
      : data.reason === "daily_turn_limit" ? 429 : data.reason === "stale_read" ? 409 : 400;
    return json(data, status);
  }
  return json(data ?? { ok: false, reason: "empty" });
});
