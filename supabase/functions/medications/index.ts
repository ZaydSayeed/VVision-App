import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/medications\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function medOut(r: Record<string, unknown>) {
    return { id: r.id, name: r.name, dosage: r.dosage ?? null, time: r.time, taken_date: r.taken_date ?? null, patient_id: r.patient_id };
  }

  // GET /medications
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase.from("medications").select("*").eq("patient_id", patientId).limit(200);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(medOut));
  }

  // POST /medications
  if (req.method === "POST" && parts.length === 0) {
    let body: { name?: string; dosage?: string; time?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const dosage = typeof body.dosage === "string" ? body.dosage.trim().slice(0, 100) : "";
    const time = typeof body.time === "string" ? body.time.trim().slice(0, 50) : "";
    if (!name) return json({ detail: "Name required" }, 400);
    if (!dosage) return json({ detail: "Dosage required" }, 400);
    if (!time) return json({ detail: "Time required" }, 400);

    const { data, error } = await supabase
      .from("medications")
      .insert({ patient_id: patientId, name, dosage, time, taken_date: null })
      .select().single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(medOut(data), 201);
  }

  const medId = parts[0];
  if (!medId) return json({ detail: "Not found" }, 404);

  // PATCH /medications/:id
  if (req.method === "PATCH" && parts.length === 1) {
    let body: { name?: string; dosage?: string; time?: string; taken_date?: string | null };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim().slice(0, 200);
    if (body.dosage !== undefined) updates.dosage = String(body.dosage).trim().slice(0, 100);
    if (body.time !== undefined) updates.time = String(body.time).trim().slice(0, 50);
    if (body.taken_date !== undefined) updates.taken_date = body.taken_date;
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);

    const { data, error } = await supabase
      .from("medications").update(updates)
      .eq("id", medId).eq("patient_id", patientId)
      .select().single();
    if (error || !data) return json({ detail: "Medication not found" }, 404);
    return json(medOut(data));
  }

  // DELETE /medications/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("medications").delete({ count: "exact" })
      .eq("id", medId).eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Medication not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
