import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

const METRICS = ["steps", "heart_rate", "active_minutes", "sleep"] as const;

function todayIso() { return new Date().toISOString().slice(0, 10); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Path: /<patientId>/health/sync|summary|trends
  const match = url.pathname.match(/^\/([^/]+)\/health\/(\w+)/);
  if (!match) return json({ detail: "Not found" }, 404);
  const [, patientId, action] = match;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
  if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

  // POST /:patientId/health/sync
  if (req.method === "POST" && action === "sync") {
    let body: { readings?: unknown[] };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!Array.isArray(body.readings) || body.readings.length === 0) return json({ detail: "readings array required" }, 400);
    if (body.readings.length > 500) return json({ detail: "Max 500 readings per sync" }, 400);

    let written = 0;
    for (const r of body.readings as Record<string, unknown>[]) {
      const metric = r.metric as string;
      if (!METRICS.includes(metric as typeof METRICS[number])) continue;
      const value = Number(r.value);
      const date = String(r.date);
      const unit = String(r.unit ?? "");

      if (metric === "heart_rate") {
        const recordedAt = r.recordedAt ? String(r.recordedAt) : `${date}T00:00:00.000Z`;
        const { error } = await supabase.from("patient_health_readings").upsert(
          { patient_id: patientId, metric, date, value, unit, recorded_at: recordedAt, source: "healthkit", synced_at: new Date().toISOString() },
          { onConflict: "patient_id,metric,date,recorded_at", ignoreDuplicates: false }
        );
        if (!error) written++;
      } else {
        // $max equivalent: only update if new value is greater
        const { data: existing } = await supabase
          .from("patient_health_readings").select("id,value")
          .eq("patient_id", patientId).eq("metric", metric).eq("date", date)
          .is("recorded_at", null).maybeSingle();
        if (existing) {
          if (value > Number(existing.value)) {
            await supabase.from("patient_health_readings")
              .update({ value, unit, source: "healthkit", synced_at: new Date().toISOString() })
              .eq("id", existing.id);
            written++;
          }
        } else {
          const { error } = await supabase.from("patient_health_readings")
            .insert({ patient_id: patientId, metric, date, value, unit, source: "healthkit", synced_at: new Date().toISOString() });
          if (!error) written++;
        }
      }
    }
    return json({ written });
  }

  // GET /:patientId/health/summary
  if (req.method === "GET" && action === "summary") {
    const today = todayIso();
    const { data: nonHr } = await supabase
      .from("patient_health_readings").select("metric,value,unit")
      .eq("patient_id", patientId).eq("date", today).neq("metric", "heart_rate").is("recorded_at", null);
    const { data: hrRows } = await supabase
      .from("patient_health_readings").select("value")
      .eq("patient_id", patientId).eq("metric", "heart_rate").eq("date", today);

    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of nonHr ?? []) byMetric[r.metric] = { value: r.value, unit: r.unit };
    if (hrRows && hrRows.length > 0) {
      const avg = Math.round(hrRows.reduce((s, r) => s + r.value, 0) / hrRows.length);
      byMetric.heart_rate = { value: avg, unit: "bpm" };
    }
    return json({ date: today, steps: byMetric.steps ?? null, heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null, sleep: byMetric.sleep ?? null });
  }

  // GET /:patientId/health/trends?metric=steps&range=7d
  if (req.method === "GET" && action === "trends") {
    const metric = url.searchParams.get("metric");
    const range = url.searchParams.get("range") ?? "7d";
    if (!metric || !METRICS.includes(metric as typeof METRICS[number])) return json({ detail: "Valid metric required" }, 400);
    if (!["1d", "7d", "30d", "90d"].includes(range)) return json({ detail: "range must be 1d|7d|30d|90d" }, 400);

    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);

    if (metric === "heart_rate" && range === "1d") {
      const { data: rows } = await supabase.from("patient_health_readings").select("value,recorded_at")
        .eq("patient_id", patientId).eq("metric", "heart_rate").eq("date", todayIso())
        .not("recorded_at", "is", null).order("recorded_at", { ascending: true });
      const byHour = new Map<number, number[]>();
      for (const r of rows ?? []) {
        const h = new Date(r.recorded_at).getHours();
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(r.value);
      }
      const points = Array.from(byHour.entries()).sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({ date: `${String(h).padStart(2,"0")}:00`, value: Math.round(vals.reduce((s,v) => s+v,0)/vals.length) }));
      return json({ metric, range, points });
    }

    if (metric === "heart_rate") {
      const { data: rows } = await supabase.from("patient_health_readings").select("date,value")
        .eq("patient_id", patientId).eq("metric", "heart_rate").gte("date", sinceIso);
      const byDate = new Map<string, number[]>();
      for (const r of rows ?? []) {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date)!.push(r.value);
      }
      const points = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, value: Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) }));
      return json({ metric, range, points });
    }

    const { data: rows } = await supabase.from("patient_health_readings").select("date,value")
      .eq("patient_id", patientId).eq("metric", metric).gte("date", sinceIso).is("recorded_at", null)
      .order("date", { ascending: true });
    return json({ metric, range, points: (rows ?? []).map(r => ({ date: r.date, value: r.value })) });
  }

  return json({ detail: "Not found" }, 404);
});
