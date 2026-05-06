import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, makeSupabase } from "../_shared/auth.ts";

async function generateUniqueLinkCode(supabase: ReturnType<typeof makeSupabase>): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data } = await supabase.from("patients").select("id").eq("link_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate unique link code");
}

function patientOut(p: Record<string, unknown>) {
  return { id: p.id, name: p.name, age: p.age ?? null, diagnosis: p.diagnosis ?? null,
    notes: p.notes ?? "", link_code: p.link_code ?? "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/patients/, "");
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const { data: currentUser } = await supabase.from("users").select("*").eq("supabase_uid", auth.userId).maybeSingle();

  // GET /patients/mine
  if (req.method === "GET" && path === "/mine") {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    const { data: patient } = await supabase.from("patients").select("*").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json({ detail: "Patient not found" }, 404);
    return json(patientOut(patient));
  }

  // PATCH /patients/mine
  if (req.method === "PATCH" && path === "/mine") {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim().slice(0, 200);
    if (body.age !== undefined) updates.age = body.age;
    if (body.diagnosis !== undefined) updates.diagnosis = body.diagnosis;
    if (body.notes !== undefined) updates.notes = String(body.notes).slice(0, 5000);
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);
    updates.updated_at = new Date().toISOString();
    const { data } = await supabase.from("patients").update(updates).eq("id", currentUser.patient_id).select().single();
    return json(patientOut(data));
  }

  // GET /patients/mine/link-code
  if (req.method === "GET" && path === "/mine/link-code") {
    if (!currentUser || currentUser.role !== "patient") return json({ detail: "Only patients have a link code" }, 403);
    if (!currentUser.patient_id) return json({ detail: "No patient profile found" }, 404);
    let { data: patient } = await supabase.from("patients").select("link_code").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json({ detail: "Patient not found" }, 404);
    if (!patient.link_code) {
      const linkCode = await generateUniqueLinkCode(supabase);
      await supabase.from("patients").update({ link_code: linkCode }).eq("id", currentUser.patient_id);
      patient = { link_code: linkCode };
    }
    return json({ link_code: patient.link_code });
  }

  // POST /patients/link
  if (req.method === "POST" && path === "/link") {
    let body: { link_code?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const linkCode = typeof body.link_code === "string" ? body.link_code.trim().toUpperCase() : "";
    if (!linkCode) return json({ detail: "Invalid link code" }, 400);

    let user = currentUser;
    if (!user) {
      const { data } = await supabase.from("users")
        .insert({ supabase_uid: auth.userId, email: "", name: "", role: "caregiver", patient_id: null })
        .select().single();
      user = data;
    }
    if (user.role !== "caregiver") return json({ detail: "Only caregivers can link to a patient" }, 403);
    if (user.patient_id) return json({ detail: "You are already linked to a patient" }, 409);

    const { data: patient } = await supabase.from("patients").select("*").eq("link_code", linkCode).maybeSingle();
    if (!patient) return json({ detail: "Invalid link code" }, 404);

    await supabase.from("users").update({ patient_id: patient.id }).eq("id", user.id);
    await supabase.from("seats").upsert({ user_id: auth.userId, patient_id: patient.id, role: "primary_caregiver" }, { onConflict: "user_id,patient_id" });

    return json(patientOut(patient));
  }

  // DELETE /patients/mine/unlink
  if (req.method === "DELETE" && path === "/mine/unlink") {
    if (!currentUser || currentUser.role !== "caregiver") return json({ detail: "Only caregivers can unlink" }, 403);
    if (!currentUser.patient_id) return json({ detail: "Not linked to any patient" }, 404);
    await supabase.from("users").update({ patient_id: null }).eq("id", currentUser.id);
    await supabase.from("seats").delete().eq("user_id", auth.userId).eq("patient_id", currentUser.patient_id);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // DELETE /patients/mine/caregivers/:caregiverId
  const caregiverMatch = path.match(/^\/mine\/caregivers\/([^/]+)$/);
  if (req.method === "DELETE" && caregiverMatch) {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    const caregiverUid = caregiverMatch[1];
    await supabase.from("seats").delete().eq("user_id", caregiverUid).eq("patient_id", currentUser.patient_id);
    await supabase.from("users").update({ patient_id: null }).eq("supabase_uid", caregiverUid);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET /patients/linked
  if (req.method === "GET" && path === "/linked") {
    if (!currentUser?.patient_id) return json([]);
    const { data: patient } = await supabase.from("patients").select("*").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json([]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const [{ data: routines }, { data: meds }, { count: pendingHelp }] = await Promise.all([
      supabase.from("routines").select("id,completed_date").eq("patient_id", patient.id),
      supabase.from("medications").select("id,taken_date").eq("patient_id", patient.id),
      supabase.from("help_alerts").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("dismissed", false),
    ]);
    return json([{
      id: patient.id, name: patient.name ?? "Unknown",
      tasksTotal: routines?.length ?? 0,
      tasksDone: routines?.filter(r => r.completed_date === todayStr).length ?? 0,
      medsTotal: meds?.length ?? 0,
      medsDone: meds?.filter(m => m.taken_date === todayStr).length ?? 0,
      pendingHelp: pendingHelp ?? 0,
    }]);
  }

  return json({ detail: "Not found" }, 404);
});
