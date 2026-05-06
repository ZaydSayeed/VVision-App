import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

const DAILY_BASE = "https://api.daily.co/v1";

async function dailyRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get("DAILY_API_KEY")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Daily ${method} ${path}: ${t}`); }
  return method === "DELETE" ? null : res.json();
}

async function createDailyRoom(patientId: string) {
  const name = `vela-${patientId}-${Date.now()}`;
  const room = await dailyRequest("POST", "/rooms", { name, privacy: "private",
    properties: { exp: Math.floor(Date.now() / 1000) + 7200 } });
  return { room: room.name, url: room.url };
}

async function createDailyToken(roomName: string, isOwner: boolean): Promise<string> {
  const result = await dailyRequest("POST", "/meeting-tokens", {
    properties: { room_name: roomName, is_owner: isOwner, exp: Math.floor(Date.now() / 1000) + 3600 },
  });
  return result.token;
}

function isDeviceToken(req: Request): boolean {
  const expected = Deno.env.get("DVISION_PATIENT_TOKEN");
  const provided = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!expected && provided === expected;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/stream/, "");
  const supabase = makeSupabase();

  // Device token auth (glasses)
  let patientId: string | null = null;
  if (isDeviceToken(req)) {
    let body: { patientId?: string } = {};
    if (req.method !== "GET") { try { body = await req.json(); } catch { /**/ } }
    patientId = body.patientId ?? url.searchParams.get("patientId") ?? null;
    if (!patientId) return json({ detail: "patientId required" }, 400);
  } else {
    const auth = await verifyUser(req);
    if (!auth) return json({ detail: "Missing authorization header" }, 401);
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    patientId = resolved.patientId;
  }

  // POST /stream/request — caregiver requests stream
  if (req.method === "POST" && path === "/request") {
    const { room, url: roomUrl } = await createDailyRoom(patientId);
    const [caregiverToken, patientToken] = await Promise.all([
      createDailyToken(room, true),
      createDailyToken(room, false),
    ]);
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data: session } = await supabase.from("stream_sessions").insert({
      patient_id: patientId, status: "pending", room_url: roomUrl, room_name: room,
      caregiver_token: caregiverToken, patient_token: patientToken, expires_at: expires,
    }).select().single();
    return json({ sessionId: session.id, roomUrl, caregiverToken }, 201);
  }

  // GET /stream/status/:patientId — glasses polls this
  const statusMatch = path.match(/^\/status\/([^/]+)$/);
  if (req.method === "GET" && statusMatch) {
    const pid = statusMatch[1];
    const { data } = await supabase.from("stream_sessions").select("*")
      .eq("patient_id", pid).eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return json(data ?? { status: "none" });
  }

  // POST /stream/approve — glasses approves
  if (req.method === "POST" && path === "/approve") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("stream_sessions")
      .update({ status: "approved" }).eq("id", body.sessionId!).eq("patient_id", patientId)
      .select().single();
    if (!data) return json({ detail: "Session not found" }, 404);
    return json({ roomUrl: data.room_url, patientToken: data.patient_token });
  }

  // POST /stream/deny — glasses denies
  if (req.method === "POST" && path === "/deny") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    await supabase.from("stream_sessions")
      .update({ status: "denied" }).eq("id", body.sessionId!).eq("patient_id", patientId);
    return json({ ok: true });
  }

  // POST /stream/end
  if (req.method === "POST" && path === "/end") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    await supabase.from("stream_sessions")
      .update({ status: "ended" }).eq("id", body.sessionId!).eq("patient_id", patientId);
    return json({ ok: true });
  }

  // POST /stream/register-push-token
  if (req.method === "POST" && path === "/register-push-token") {
    let body: { token?: string; userId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.token || !body.userId) return json({ detail: "token and userId required" }, 400);
    await supabase.from("push_tokens").upsert(
      { user_id: body.userId, token: body.token, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return json({ ok: true });
  }

  return json({ detail: "Not found" }, 404);
});
