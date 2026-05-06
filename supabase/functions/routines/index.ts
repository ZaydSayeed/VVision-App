import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/routines\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  // GET /routines
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .eq("patient_id", patientId)
      .limit(200);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(r => ({
      id: r.id, label: r.label, time: r.time, completed_date: r.completed_date ?? null,
      notes: r.notes ?? null, patient_id: r.patient_id,
    })));
  }

  // POST /routines
  if (req.method === "POST" && parts.length === 0) {
    let body: { label?: string; time?: string; notes?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 300) : "";
    const time = typeof body.time === "string" ? body.time.trim().slice(0, 50) : "";
    if (!label) return json({ detail: "Label required" }, 400);
    if (!time) return json({ detail: "Time required" }, 400);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    const { data, error } = await supabase
      .from("routines")
      .insert({ patient_id: patientId, label, time, notes, completed_date: null })
      .select()
      .single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json({ id: data.id, label: data.label, time: data.time, completed_date: null, notes: data.notes ?? null, patient_id: data.patient_id }, 201);
  }

  const routineId = parts[0];
  if (!routineId) return json({ detail: "Not found" }, 404);

  // PATCH /routines/:id
  if (req.method === "PATCH" && parts.length === 1) {
    let body: { label?: string; time?: string; completed_date?: string | null; notes?: string | null };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = String(body.label).trim().slice(0, 300);
    if (body.time !== undefined) updates.time = String(body.time).trim().slice(0, 50);
    if (body.completed_date !== undefined) updates.completed_date = body.completed_date;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);

    const { data, error } = await supabase
      .from("routines")
      .update(updates)
      .eq("id", routineId)
      .eq("patient_id", patientId)
      .select()
      .single();
    if (error || !data) return json({ detail: "Routine not found" }, 404);
    return json({ id: data.id, label: data.label, time: data.time, completed_date: data.completed_date ?? null, notes: data.notes ?? null, patient_id: data.patient_id });
  }

  // DELETE /routines/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("routines")
      .delete({ count: "exact" })
      .eq("id", routineId)
      .eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Routine not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
