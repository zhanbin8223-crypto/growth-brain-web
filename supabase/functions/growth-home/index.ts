const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function envKey(name: string, fallback?: string) {
  const v = Deno.env.get(name);
  return v || fallback || "";
}

function getPublishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return parsed.default;
    } catch {}
  }
  return envKey("SUPABASE_ANON_KEY");
}

function getAdminKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return parsed.default;
    } catch {}
  }
  return envKey("SUPABASE_SERVICE_ROLE_KEY");
}

async function verifyUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, reason: "missing_user_jwt" };
  }

  const supabaseUrl = envKey("SUPABASE_URL");
  const publishable = getPublishableKey();
  if (!supabaseUrl || !publishable) {
    return { ok: false as const, status: 500, reason: "server_auth_config_missing" };
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: auth },
  });
  if (!res.ok) {
    return { ok: false as const, status: 401, reason: "invalid_or_expired_user_jwt" };
  }

  const user = await res.json();
  if (!user?.id) {
    return { ok: false as const, status: 401, reason: "user_not_resolved" };
  }
  return { ok: true as const, user };
}

async function adminRpc(name: string, args: Record<string, unknown>) {
  const supabaseUrl = envKey("SUPABASE_URL");
  const adminKey = getAdminKey();
  if (!supabaseUrl || !adminKey) throw new Error("server_admin_config_missing");

  const headers: Record<string, string> = {
    apikey: adminKey,
    "Content-Type": "application/json",
  };
  if (!adminKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${adminKey}`;
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    throw new Error(`rpc_${name}_failed:${res.status}:${text.slice(0, 300)}`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const verified = await verifyUser(req);
    if (!verified.ok) {
      return json({ ok: false, reason: verified.reason }, verified.status);
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const surface = url.searchParams.get("surface") || "personal_home";
      if (!["personal_home", "personal_outcome", "personal_artifacts", "system_cockpit", "inbox", "learning", "personal_synapse"].includes(surface)) {
        return json({ ok: false, reason: "unsupported_surface" }, 400);
      }

      const result = surface === "inbox"
        ? await adminRpc("growth_inbox_snapshot_service_v1", {
            p_auth_user_id: verified.user.id,
          })
        : surface === "learning"
        ? await adminRpc("growth_learning_live_snapshot_service_v1", {
            p_auth_user_id: verified.user.id,
          })
        : surface === "personal_synapse"
        ? await adminRpc("growth_personal_synapse_snapshot_service_v1", {
            p_auth_user_id: verified.user.id,
          })
        : surface === "personal_artifacts"
        ? await adminRpc("growth_personal_artifacts_snapshot_service_v1", {
            p_auth_user_id: verified.user.id,
          })
        : await adminRpc("growth_app_surface_for_service_v1", {
            p_auth_user_id: verified.user.id,
            p_surface: surface,
          });

      if (result?.authorized === false) {
        return json(
          { ok: false, reason: result.reason || "profile_not_mapped" },
          403,
        );
      }

      return json({
        ok: true,
        user: { id: verified.user.id, email: verified.user.email || null },
        data: result,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      if (body?.action === "create_learning_text") {
        const rawContent =
          typeof body?.raw_content === "string" ? body.raw_content.trim() : "";
        const clientRequestId =
          typeof body?.client_request_id === "string"
            ? body.client_request_id.trim()
            : "";

        if (rawContent.length < 6 || !clientRequestId) {
          return json(
            { ok: false, reason: "learning_text_and_client_request_id_required" },
            400,
          );
        }

        const result = await adminRpc("growth_learning_capture_text_service_v1", {
          p_auth_user_id: verified.user.id,
          p_raw_content: rawContent,
          p_title:
            typeof body?.title === "string" && body.title.trim()
              ? body.title.trim()
              : null,
          p_goal:
            typeof body?.goal === "string" && body.goal.trim()
              ? body.goal.trim()
              : null,
          p_source_language:
            typeof body?.source_language === "string" &&
            body.source_language.trim()
              ? body.source_language.trim()
              : "unknown",
          p_client_request_id: clientRequestId,
        });

        if (result?.accepted === false) {
          const reason = result.reason || "learning_input_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        return json({ ok: true, data: result }, 201);
      }

      if (body?.action === "enqueue_learning_ai") {
        if (!body?.session_id) {
          return json({ ok: false, reason: "session_id_required" }, 400);
        }

        const result = await adminRpc("growth_ai_job_enqueue_learning_service_v1", {
          p_auth_user_id: verified.user.id,
          p_session_id: body.session_id,
        });

        if (result?.accepted === false) {
          const reason = result.reason || "ai_job_enqueue_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        return json({ ok: true, data: result }, 200);
      }

      if (body?.action === "submit_attempt") {
        if (!body?.unit_id || typeof body?.response_text !== "string") {
          return json(
            { ok: false, reason: "unit_id_and_response_text_required" },
            400,
          );
        }

        const result = await adminRpc("growth_submit_learning_candidate_service_v1", {
          p_auth_user_id: verified.user.id,
          p_unit_id: body.unit_id,
          p_response_text: body.response_text,
        });

        if (result?.accepted === false) {
          const reason = result.reason || "submission_rejected";
          const status = reason.includes("mapping") ? 403 : 400;
          return json({ ok: false, reason }, status);
        }

        return json({ ok: true, data: result }, 201);
      }

      if (body?.action === "save_personal_outcome_candidate") {
        if (
          typeof body?.title !== "string" ||
          typeof body?.success_evidence !== "string"
        ) {
          return json(
            { ok: false, reason: "title_and_success_evidence_required" },
            400,
          );
        }

        const result = await adminRpc(
          "growth_personal_outcome_save_candidate_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_title: body.title,
            p_success_evidence: body.success_evidence,
            p_why_now: typeof body?.why_now === "string" ? body.why_now : null,
            p_direction_key:
              typeof body?.direction_key === "string" ? body.direction_key : null,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "candidate_save_rejected";
          return json(
            { ok: false, reason },
            reason.includes("verified") ? 403 : 400,
          );
        }

        const routeId = result?.snapshot?.candidate_route?.id || null;
        let pathPlan = null;
        if (routeId) {
          try {
            pathPlan = await adminRpc("growth_ai_job_enqueue_path_plan_service_v1", {
              p_auth_user_id: verified.user.id,
              p_route_id: routeId,
            });
          } catch (pathError) {
            pathPlan = {
              accepted: false,
              reason: "path_plan_enqueue_failed",
              detail: String(pathError?.message || pathError),
            };
          }
        }

        return json({ ok: true, data: { ...result, path_plan: pathPlan } }, 201);
      }

      if (body?.action === "decide_personal_outcome_candidate") {
        if (!body?.route_id || !["select", "reject"].includes(body?.decision)) {
          return json(
            { ok: false, reason: "route_id_and_supported_decision_required" },
            400,
          );
        }

        const result = await adminRpc(
          "growth_personal_outcome_decide_candidate_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_route_id: body.route_id,
            p_decision: body.decision,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "candidate_decision_rejected";
          return json(
            { ok: false, reason },
            reason.includes("verified") ? 403 : 400,
          );
        }

        let pathPlan = null;
        if (body.decision === "select") {
          try {
            pathPlan = await adminRpc("growth_ai_job_enqueue_path_plan_service_v1", {
              p_auth_user_id: verified.user.id,
              p_route_id: body.route_id,
            });
          } catch (pathError) {
            pathPlan = {
              accepted: false,
              reason: "path_plan_enqueue_failed",
              detail: String(pathError?.message || pathError),
            };
          }
        }

        return json({ ok: true, data: { ...result, path_plan: pathPlan } }, 200);
      }

      if (body?.action === "decide_personal_artifact") {
        if (!body?.artifact_id || !["start", "reject"].includes(body?.decision)) {
          return json(
            { ok: false, reason: "artifact_id_and_supported_decision_required" },
            400,
          );
        }

        const result = await adminRpc(
          "growth_personal_artifact_decide_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_artifact_id: body.artifact_id,
            p_decision: body.decision,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "artifact_decision_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        const snapshot = await adminRpc(
          "growth_personal_artifacts_snapshot_service_v1",
          { p_auth_user_id: verified.user.id },
        );

        return json({ ok: true, data: { decision: result, snapshot } }, 200);
      }

      if (body?.action === "request_artifact_stage_unblock") {
        const userNote =
          typeof body?.user_note === "string" ? body.user_note.trim() : "";

        if (!body?.artifact_id || userNote.length < 2) {
          return json(
            {
              ok: false,
              reason: "artifact_id_and_user_note_required",
            },
            400,
          );
        }

        const result = await adminRpc(
          "growth_artifact_stage_unblock_request_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_artifact_id: body.artifact_id,
            p_user_note: userNote,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "artifact_stage_unblock_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        const snapshot = await adminRpc(
          "growth_personal_artifacts_snapshot_service_v1",
          { p_auth_user_id: verified.user.id },
        );

        return json(
          { ok: true, data: { unblock: result, snapshot } },
          202,
        );
      }

      if (body?.action === "record_personal_artifact_evidence") {
        const evidenceText =
          typeof body?.evidence_text === "string" ? body.evidence_text.trim() : "";
        const criterionNo = Number(body?.criterion_no);
        const evidenceRefs = Array.isArray(body?.evidence_refs)
          ? body.evidence_refs
              .filter((item: unknown) => typeof item === "string")
              .map((item: string) => item.trim())
              .filter(Boolean)
          : [];
        const metadata =
          body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? body.metadata
            : {};

        if (
          !body?.artifact_id ||
          !Number.isInteger(criterionNo) ||
          criterionNo < 1 ||
          evidenceText.length < 3
        ) {
          return json(
            {
              ok: false,
              reason: "artifact_id_criterion_no_and_evidence_text_required",
            },
            400,
          );
        }

        const result = await adminRpc(
          "growth_personal_artifact_evidence_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_artifact_id: body.artifact_id,
            p_criterion_no: criterionNo,
            p_evidence_text: evidenceText,
            p_evidence_refs: evidenceRefs,
            p_metadata: metadata,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "artifact_evidence_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        const snapshot = await adminRpc(
          "growth_personal_artifacts_snapshot_service_v1",
          { p_auth_user_id: verified.user.id },
        );

        return json(
          { ok: true, data: { evidence: result, snapshot } },
          200,
        );
      }

      if (body?.action === "complete_personal_artifact") {
        const resultText =
          typeof body?.result_text === "string" ? body.result_text.trim() : "";
        const evidenceItems = Array.isArray(body?.evidence_items)
          ? body.evidence_items
              .filter((item: unknown) => typeof item === "string")
              .map((item: string) => item.trim())
              .filter(Boolean)
          : [];
        const demonstratedSkillKeys = Array.isArray(body?.demonstrated_skill_keys)
          ? body.demonstrated_skill_keys
              .filter((item: unknown) => typeof item === "string")
              .map((item: string) => item.trim())
              .filter(Boolean)
          : [];

        if (!body?.artifact_id || resultText.length < 3) {
          return json(
            {
              ok: false,
              reason: "artifact_id_and_result_required",
            },
            400,
          );
        }

        const result = await adminRpc(
          "growth_personal_artifact_complete_service_v1",
          {
            p_auth_user_id: verified.user.id,
            p_artifact_id: body.artifact_id,
            p_result_text: resultText,
            p_result_evidence: {
              items: evidenceItems,
              source: "growth_brain_web",
            },
            p_demonstrated_skill_keys: demonstratedSkillKeys,
          },
        );

        if (result?.accepted === false) {
          const reason = result.reason || "artifact_completion_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        const snapshot = await adminRpc(
          "growth_personal_artifacts_snapshot_service_v1",
          { p_auth_user_id: verified.user.id },
        );

        return json(
          { ok: true, data: { completion: result, snapshot } },
          200,
        );
      }

      if (body?.action === "capture_inbox") {
        const rawContent =
          typeof body?.raw_content === "string" ? body.raw_content.trim() : "";
        const sourceKind =
          typeof body?.source_kind === "string" ? body.source_kind : "text";

        if (!rawContent) {
          return json({ ok: false, reason: "raw_content_required" }, 400);
        }
        if (!["text", "link", "idea"].includes(sourceKind)) {
          return json({ ok: false, reason: "unsupported_source_kind" }, 400);
        }

        const result = await adminRpc("growth_inbox_capture_service_v1", {
          p_auth_user_id: verified.user.id,
          p_raw_content: rawContent,
          p_source_kind: sourceKind,
          p_source_url:
            typeof body?.source_url === "string" && body.source_url.trim()
              ? body.source_url.trim()
              : null,
          p_source_metadata:
            body?.source_metadata && typeof body.source_metadata === "object"
              ? body.source_metadata
              : { capture_surface: "growth_brain_web" },
        });

        if (result?.accepted === false) {
          const reason = result.reason || "inbox_capture_rejected";
          return json(
            { ok: false, reason },
            reason.includes("verified") ? 403 : 400,
          );
        }

        return json({ ok: true, data: result }, 201);
      }

      if (body?.action === "classify_inbox") {
        if (
          !body?.item_id ||
          !["knowledge", "learning", "project", "action"].includes(
            body?.classification,
          )
        ) {
          return json(
            { ok: false, reason: "item_id_and_supported_classification_required" },
            400,
          );
        }

        const result = await adminRpc("growth_inbox_classify_service_v1", {
          p_auth_user_id: verified.user.id,
          p_item_id: body.item_id,
          p_classification: body.classification,
        });

        if (result?.accepted === false) {
          const reason = result.reason || "inbox_classification_rejected";
          return json(
            { ok: false, reason },
            reason.includes("verified") ? 403 : 400,
          );
        }

        return json({ ok: true, data: result }, 200);
      }

      if (body?.action === "route_inbox") {
        if (!body?.item_id) {
          return json({ ok: false, reason: "item_id_required" }, 400);
        }

        const result = await adminRpc("growth_route_inbox_service_v1", {
          p_auth_user_id: verified.user.id,
          p_item_id: body.item_id,
          p_title:
            typeof body?.title === "string" && body.title.trim()
              ? body.title.trim()
              : null,
          p_success_evidence:
            typeof body?.success_evidence === "string" &&
            body.success_evidence.trim()
              ? body.success_evidence.trim()
              : null,
          p_why_now:
            typeof body?.why_now === "string" && body.why_now.trim()
              ? body.why_now.trim()
              : null,
          p_goal:
            typeof body?.goal === "string" && body.goal.trim()
              ? body.goal.trim()
              : null,
          p_source_language:
            typeof body?.source_language === "string" &&
            body.source_language.trim()
              ? body.source_language.trim()
              : "unknown",
        });

        if (result?.accepted === false) {
          const reason = result.reason || "inbox_routing_rejected";
          return json(
            { ok: false, reason, data: result },
            reason.includes("verified") ? 403 : 400,
          );
        }

        return json({ ok: true, data: result }, 200);
      }

      return json({ ok: false, reason: "unsupported_action" }, 400);
    }

    return json({ ok: false, reason: "method_not_allowed" }, 405);
  } catch (error) {
    return json(
      {
        ok: false,
        reason: "server_error",
        detail: String(error?.message || error),
      },
      500,
    );
  }
});