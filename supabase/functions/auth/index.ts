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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/auth/, "");
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /auth/sync
  if (req.method === "POST" && path === "/sync") {
    let body: { name?: string; role?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const role = body.role;
    if (!name) return json({ detail: "Name required" }, 400);
    if (role !== "patient" && role !== "caregiver") return json({ detail: "Role must be patient or caregiver" }, 400);

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", auth.userId)
      .maybeSingle();

    if (existing) {
      if (existing.role === "patient" && !existing.patient_id) {
        const linkCode = await generateUniqueLinkCode(supabase);
        const { data: patient } = await supabase
          .from("patients")
          .insert({ name: existing.name, link_code: linkCode })
          .select()
          .single();
        await supabase.from("users").update({ patient_id: patient.id }).eq("id", existing.id);
        await supabase.from("seats").insert({ user_id: auth.userId, patient_id: patient.id, role: "primary_caregiver" });
        return json({ ...existing, patient_id: patient.id });
      }
      return json({
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        patient_id: existing.patient_id,
      });
    }

    let email = "";
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${auth.token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      });
      if (resp.ok) { const d = await resp.json(); email = d.email ?? ""; }
    } catch { /* non-fatal */ }

    let patientId: string | null = null;

    if (role === "patient") {
      const linkCode = await generateUniqueLinkCode(supabase);
      const { data: patient } = await supabase
        .from("patients")
        .insert({ name, link_code: linkCode })
        .select()
        .single();
      patientId = patient.id;
    }

    const { data: newUser } = await supabase
      .from("users")
      .insert({ supabase_uid: auth.userId, email, name, role, patient_id: patientId })
      .select()
      .single();

    if (role === "patient" && patientId) {
      await supabase.from("seats").insert({ user_id: auth.userId, patient_id: patientId, role: "primary_caregiver" });
    }

    return json({ id: newUser.id, email, name, role, patient_id: patientId }, 201);
  }

  // GET /auth/me
  if (req.method === "GET" && path === "/me") {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", auth.userId)
      .maybeSingle();
    if (!user) return json({ detail: "Profile not synced yet. Call /auth/sync first." }, 404);
    return json({ id: user.id, email: user.email, name: user.name, role: user.role, patient_id: user.patient_id });
  }

  return json({ detail: "Not found" }, 404);
});
