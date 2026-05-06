import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/reminders\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function reminderOut(r: Record<string, unknown>) {
    return { id: r.id, patient_id: r.patient_id, text: r.text, time: r.time ?? null,
      recurrence: r.recurrence ?? null, source: r.source, created_at: r.created_at, completed_date: r.completed_date ?? null };
  }

  // GET /reminders
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase
      .from("reminders").select("*").eq("patient_id", patientId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(reminderOut));
  }

  // POST /reminders
  if (req.method === "POST" && parts.length === 0) {
    let body: { text?: string; time?: string; recurrence?: string; source?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    if (!text) return json({ detail: "Text required" }, 400);
    const source = body.source === "glasses" ? "glasses" : "app";

    const { data, error } = await supabase
      .from("reminders")
      .insert({ patient_id: patientId, text, time: body.time ?? null,
        recurrence: body.recurrence ?? null, source, completed_date: null })
      .select().single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(reminderOut(data), 201);
  }

  // PATCH /reminders/:id
  if (req.method === "PATCH" && parts.length === 1) {
    let body: { completed_date?: string | null; last_triggered?: string | null };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const updates: Record<string, unknown> = {};
    if (body.completed_date !== undefined) updates.completed_date = body.completed_date;
    if (body.last_triggered !== undefined) updates.last_triggered = body.last_triggered;
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);
    const { data, error } = await supabase
      .from("reminders").update(updates)
      .eq("id", parts[0]).eq("patient_id", patientId)
      .select().single();
    if (error || !data) return json({ detail: "Reminder not found" }, 404);
    return json(reminderOut(data));
  }

  // DELETE /reminders/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("reminders").delete({ count: "exact" })
      .eq("id", parts[0]).eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Reminder not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
