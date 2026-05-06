import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  // RevenueCat webhook — no auth required, validate secret instead
  if (req.method === "POST" && path.endsWith("/webhooks/revenuecat")) {
    const secret = req.headers.get("authorization");
    if (secret !== `Bearer ${Deno.env.get("REVENUECAT_WEBHOOK_SECRET")}`) {
      return json({ detail: "Unauthorized" }, 401);
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const event = body.event as Record<string, unknown>;
    const patientId = event?.app_user_id as string;
    const type = event?.type as string;
    if (patientId && type) {
      const tier = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"].includes(type)
        ? (String(event.product_id ?? "").includes("unlimited") ? "unlimited" : "starter")
        : "free";
      await supabase.from("subscriptions").upsert(
        { patient_id: patientId, tier, trial_active: type === "TRIAL_STARTED", updated_at: new Date().toISOString() },
        { onConflict: "patient_id" }
      );
    }
    return json({ ok: true });
  }

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // Device link routes: /:patientId/device-link
  const deviceMatch = path.match(/\/([^/]+)\/device-link$/);
  if (deviceMatch) {
    const patientId = deviceMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("device_links").select("device_code,linked_at")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? null);
    }

    if (req.method === "POST") {
      let body: { device_code?: string };
      try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
      const code = String(body.device_code ?? "").toUpperCase().trim();
      if (!code || !/^[A-Z0-9-]{4,12}$/.test(code)) return json({ detail: "Invalid device_code" }, 400);
      const now = new Date().toISOString();
      await supabase.from("device_links").upsert(
        { patient_id: patientId, device_code: code, linked_at: now },
        { onConflict: "patient_id" }
      );
      return json({ device_code: code, linked_at: now });
    }

    if (req.method === "DELETE") {
      await supabase.from("device_links").delete().eq("patient_id", patientId);
      return new Response(null, { status: 204, headers: corsHeaders });
    }
  }

  // GET /:patientId/stage-observations/latest
  const stageMatch = path.match(/\/([^/]+)\/stage-observations\/latest$/);
  if (req.method === "GET" && stageMatch) {
    const patientId = stageMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    const { data } = await supabase.from("stage_observations").select("*")
      .eq("patient_id", patientId).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    return json(data ?? null);
  }

  // Onboarding: GET/PATCH /:patientId/onboarding
  const onboardingMatch = path.match(/\/([^/]+)\/onboarding$/);
  if (onboardingMatch) {
    const patientId = onboardingMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("onboarding_progress").select("*")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? { patient_id: patientId, steps: {}, completed_at: null });
    }

    if (req.method === "PATCH") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
      const { data: existing } = await supabase.from("onboarding_progress").select("steps")
        .eq("patient_id", patientId).maybeSingle();
      const steps = { ...(existing?.steps ?? {}), ...(body.steps ?? {}) };
      const allDone = Object.values(steps).every(Boolean);
      const { data } = await supabase.from("onboarding_progress").upsert(
        { patient_id: patientId, steps, completed_at: allDone ? new Date().toISOString() : null },
        { onConflict: "patient_id" }
      ).select().single();
      return json(data);
    }
  }

  // Subscription: GET /:patientId/subscription
  const subMatch = path.match(/\/([^/]+)\/subscription$/);
  if (subMatch) {
    const patientId = subMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("subscriptions").select("*")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? { patient_id: patientId, tier: "free", trial_active: false });
    }
  }

  return json({ detail: "Not found" }, 404);
});
