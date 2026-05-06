import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const { data: currentUser } = await supabase.from("users").select("*")
    .eq("supabase_uid", auth.userId).maybeSingle();
  if (!currentUser) return json({ detail: "Profile not found" }, 404);

  // ── NOTES ─────────────────────────────────────────────────────────────────

  function noteOut(n: Record<string, unknown>) {
    return { id: n.id, patientId: n.patient_id, caregiverId: n.caregiver_supabase_uid,
      caregiverName: n.caregiver_name ?? "", text: n.text,
      pinned: n.pinned ?? false, timestamp: n.timestamp };
  }

  // GET /notes?patientId=<id>
  if (req.method === "GET" && path.endsWith("/notes")) {
    const patientId = url.searchParams.get("patientId");
    if (!patientId) return json({ detail: "Valid patientId required" }, 400);
    if (currentUser.patient_id !== patientId) return json({ detail: "Not authorized to view notes for this patient" }, 403);
    const { data } = await supabase.from("caregiver_notes").select("*")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(50);
    return json((data ?? []).map(noteOut));
  }

  // POST /notes
  if (req.method === "POST" && path.endsWith("/notes")) {
    let body: { patientId?: string; text?: string; pinned?: boolean };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.patientId) return json({ detail: "patientId required" }, 400);
    if (!body.text?.trim()) return json({ detail: "Text required" }, 400);
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can create notes" }, 403);

    if (body.pinned) {
      await supabase.from("caregiver_notes").update({ pinned: false }).eq("patient_id", body.patientId);
    }
    const { data } = await supabase.from("caregiver_notes").insert({
      patient_id: body.patientId, caregiver_supabase_uid: auth.userId,
      caregiver_name: currentUser.name ?? "", text: String(body.text).trim().slice(0, 500),
      pinned: body.pinned ?? false, timestamp: new Date().toISOString(),
    }).select().single();
    return json(noteOut(data), 201);
  }

  // PATCH /notes/:id/pin
  const pinMatch = path.match(/\/notes\/([^/]+)\/pin$/);
  if (req.method === "PATCH" && pinMatch) {
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can pin notes" }, 403);
    const { data: note } = await supabase.from("caregiver_notes").select("*").eq("id", pinMatch[1]).maybeSingle();
    if (!note) return json({ detail: "Note not found" }, 404);
    const newPinned = !note.pinned;
    if (newPinned) await supabase.from("caregiver_notes").update({ pinned: false }).eq("patient_id", note.patient_id);
    const { data: updated } = await supabase.from("caregiver_notes")
      .update({ pinned: newPinned }).eq("id", pinMatch[1]).eq("caregiver_supabase_uid", auth.userId).select().single();
    if (!updated) return json({ detail: "Not authorized to pin this note" }, 403);
    return json(noteOut(updated));
  }

  // DELETE /notes/:id
  const noteDeleteMatch = path.match(/\/notes\/([^/]+)$/);
  if (req.method === "DELETE" && noteDeleteMatch) {
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can delete notes" }, 403);
    const { count } = await supabase.from("caregiver_notes").delete({ count: "exact" })
      .eq("id", noteDeleteMatch[1]).eq("caregiver_supabase_uid", auth.userId);
    if (count === 0) return json({ detail: "Note not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── DOCTORS ───────────────────────────────────────────────────────────────

  if (!currentUser.patient_id) return json({ detail: "No patient linked" }, 404);
  const patientId = currentUser.patient_id;

  // GET /doctors
  if (req.method === "GET" && path.endsWith("/doctors")) {
    const { data } = await supabase.from("doctors").select("*").eq("patient_id", patientId);
    return json(data ?? []);
  }

  // POST /doctors
  if (req.method === "POST" && path.endsWith("/doctors")) {
    let body: { name?: string; email?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("doctors")
      .insert({ patient_id: patientId, name: body.name ?? null, email: body.email ?? null })
      .select().single();
    return json(data, 201);
  }

  // DELETE /doctors/:id
  const doctorDeleteMatch = path.match(/\/doctors\/([^/]+)$/);
  if (req.method === "DELETE" && doctorDeleteMatch) {
    await supabase.from("doctors").delete().eq("id", doctorDeleteMatch[1]).eq("patient_id", patientId);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── VISITS ────────────────────────────────────────────────────────────────

  // GET /visits
  if (req.method === "GET" && path.endsWith("/visits")) {
    const { data } = await supabase.from("visits").select("*")
      .eq("patient_id", patientId).order("scheduled_for", { ascending: true });
    return json(data ?? []);
  }

  // POST /visits
  if (req.method === "POST" && path.endsWith("/visits")) {
    let body: { scheduled_for?: string; notes?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("visits")
      .insert({ patient_id: patientId, scheduled_for: body.scheduled_for ?? null, notes: body.notes ?? null })
      .select().single();
    return json(data, 201);
  }

  return json({ detail: "Not found" }, 404);
});
