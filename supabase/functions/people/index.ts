import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // All routes are /:patientId/people[/:personId]
  const match = path.match(/^\/([^/]+)\/people(\/([^/]+))?$/);
  if (!match) return json({ detail: "Not found" }, 404);
  const [, patientId, , personId] = match;

  const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
  if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

  // GET /:patientId/people
  if (req.method === "GET" && !personId) {
    const { data } = await supabase.from("people").select("id,name,relation,last_seen,seen_count,notes,is_patient,embedding_version")
      .eq("patient_id", patientId);
    return json(data ?? []);
  }

  // POST /:patientId/people — enroll a face
  if (req.method === "POST" && !personId) {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) return json({ detail: "multipart/form-data required" }, 400);
    const formData = await req.formData();
    const name = String(formData.get("name") ?? "").trim().slice(0, 200);
    const relation = String(formData.get("relation") ?? "").trim().slice(0, 200);
    const photo = formData.get("photo") as File | null;
    if (!name) return json({ detail: "name required" }, 400);
    if (!photo) return json({ detail: "photo required" }, 400);
    if (photo.size > 5 * 1024 * 1024) return json({ detail: "Photo must be under 5MB" }, 400);
    const mimeAllowed = ["image/jpeg", "image/png", "image/webp"];
    if (!mimeAllowed.includes(photo.type)) return json({ detail: "Photo must be JPEG, PNG, or WebP" }, 400);

    // Upload photo to Supabase Storage
    const photoBytes = await photo.arrayBuffer();
    const storagePath = `${patientId}/${Date.now()}-${name.replace(/\s+/g, "_")}.jpg`;
    await supabase.storage.from("face-crops").upload(storagePath, photoBytes, { contentType: photo.type });

    const { data } = await supabase.from("people").insert({
      patient_id: patientId, name, relation, embedding_version: 2,
      is_patient: false, seen_count: 0, notes: "",
    }).select().single();
    return json(data, 201);
  }

  // DELETE /:patientId/people/:personId
  if (req.method === "DELETE" && personId) {
    const { count } = await supabase.from("people").delete({ count: "exact" })
      .eq("id", personId).eq("patient_id", patientId);
    if (count === 0) return json({ detail: "Person not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
