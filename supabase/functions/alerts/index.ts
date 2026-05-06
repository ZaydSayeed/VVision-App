import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

const VALID_CAUSES = ["Confusion","Pain","Anxiety","Fell","Wandered","Sundowning","Other"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function alertOut(a: Record<string, unknown>) {
    return { id: a.id, patient_id: a.patient_id, timestamp: a.timestamp,
      dismissed: a.dismissed ?? false, cancelled: a.cancelled ?? false,
      resolved: a.resolved ?? false, note: a.note ?? null,
      cause: a.cause ?? null, resolved_at: a.resolved_at ?? null };
  }

  // GET /help-alerts
  if (req.method === "GET" && path.endsWith("/help-alerts")) {
    const { data } = await supabase.from("help_alerts").select("*")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(50);
    return json((data ?? []).map(alertOut));
  }

  // POST /help-alerts
  if (req.method === "POST" && path.endsWith("/help-alerts")) {
    const { data } = await supabase.from("help_alerts")
      .insert({ patient_id: patientId, dismissed: false })
      .select().single();
    return json(alertOut(data), 201);
  }

  // PATCH /help-alerts/:id/dismiss
  const dismissMatch = path.match(/\/help-alerts\/([^/]+)\/dismiss$/);
  if (req.method === "PATCH" && dismissMatch) {
    const { data } = await supabase.from("help_alerts")
      .update({ dismissed: true, cancelled: true })
      .eq("id", dismissMatch[1]).eq("patient_id", patientId)
      .select().single();
    if (!data) return json({ detail: "Help alert not found" }, 404);
    return json(alertOut(data));
  }

  // PATCH /help-alerts/:id/resolve
  const resolveMatch = path.match(/\/help-alerts\/([^/]+)\/resolve$/);
  if (req.method === "PATCH" && resolveMatch) {
    let body: { note?: string; cause?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.cause || !VALID_CAUSES.includes(body.cause as typeof VALID_CAUSES[number])) {
      return json({ detail: "cause must be one of: " + VALID_CAUSES.join(", ") }, 400);
    }
    const updates: Record<string, unknown> = {
      dismissed: true, resolved: true, cause: body.cause, resolved_at: new Date().toISOString(),
    };
    if (body.note) updates.note = String(body.note).slice(0, 500);
    const { data } = await supabase.from("help_alerts").update(updates)
      .eq("id", resolveMatch[1]).eq("patient_id", patientId).select().single();
    if (!data) return json({ detail: "Help alert not found" }, 404);
    return json(alertOut(data));
  }

  // GET /alerts (face recognition alerts)
  if (req.method === "GET" && path.endsWith("/alerts")) {
    const { data } = await supabase.from("alerts").select("id,type,confidence,timestamp,patient_id")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(20);
    return json(data ?? []);
  }

  // POST /alerts/push-token
  if (req.method === "POST" && path.endsWith("/alerts/push-token")) {
    let body: { token?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.token) return json({ detail: "token required" }, 400);
    await supabase.from("push_tokens").upsert(
      { user_id: auth.userId, token: body.token, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return json({ ok: true });
  }

  return json({ detail: "Not found" }, 404);
});
