import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @deno-types="npm:@types/pdfkit"
import PDFDocument from "npm:pdfkit";
import nodemailer from "npm:nodemailer";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /:patientId/stage-observations
  const stageMatch = path.match(/^\/([^/]+)\/stage-observations$/);
  if (req.method === "POST" && stageMatch) {
    const patientId = stageMatch[1];
    // Device token auth — glasses write stage observations without a Supabase JWT
    const deviceToken = Deno.env.get("DVISION_PATIENT_TOKEN");
    const provided = req.headers.get("authorization")?.replace("Bearer ", "");
    const isDevice = deviceToken && provided === deviceToken;
    if (!isDevice) {
      const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
      if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    // Only insert if stage changed from last observation
    const { data: last } = await supabase.from("stage_observations").select("observed_stage")
      .eq("patient_id", patientId).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.observed_stage === body.observed_stage) return json({ ok: true, skipped: true });
    await supabase.from("stage_observations").insert({
      patient_id: patientId, device_code: body.device_code ?? null,
      observed_stage: body.observed_stage, signals: body.signals ?? {}, observed_at: new Date().toISOString(),
    });
    return json({ ok: true });
  }

  // POST /:patientId/reports/generate
  const reportGenMatch = path.match(/^\/([^/]+)\/reports\/generate$/);
  if (req.method === "POST" && reportGenMatch) {
    const patientId = reportGenMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    let body: { range?: string; startDate?: string; endDate?: string; deliveryMethod?: string; doctorEmail?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const endDate = new Date().toISOString().slice(0, 10);
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[body.range ?? "30d"] ?? 30;
    const startDate = body.startDate ?? (() => {
      const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10);
    })();

    // Fetch all data in parallel
    const [{ data: patient }, { data: checkins }, { data: patterns }, { data: notes }, { data: meds }] = await Promise.all([
      supabase.from("patients").select("name,diagnosis").eq("id", patientId).maybeSingle(),
      supabase.from("checkin_logs").select("*").eq("patient_id", patientId)
        .gte("created_at", startDate).order("created_at", { ascending: false }).limit(100),
      supabase.from("patterns").select("*").eq("patient_id", patientId).order("confidence", { ascending: false }).limit(10),
      supabase.from("caregiver_notes").select("*").eq("patient_id", patientId)
        .gte("timestamp", startDate).order("timestamp", { ascending: false }).limit(50),
      supabase.from("medications").select("name,dosage,time").eq("patient_id", patientId),
    ]);

    // Generate PDF using pdfkit
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));

    doc.fontSize(20).text("Vela Vision — Care Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Patient: ${patient?.name ?? "Unknown"}`);
    doc.text(`Period: ${startDate} – ${endDate}`);
    doc.moveDown();

    if (meds?.length) {
      doc.fontSize(14).text("Medications");
      meds.forEach(m => doc.fontSize(10).text(`• ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` — ${m.time}` : ""}`));
      doc.moveDown();
    }

    if (patterns?.length) {
      doc.fontSize(14).text("Observed Patterns");
      patterns.forEach(p => doc.fontSize(10).text(`• ${p.title} — confidence ${Math.round((p.confidence ?? 0) * 100)}%`));
      doc.fontSize(8).text("General wellness observations only — not intended as diagnostic measures.");
      doc.moveDown();
    }

    if (checkins?.length) {
      doc.fontSize(14).text("Check-in Log");
      checkins.slice(0, 20).forEach(c => {
        doc.fontSize(10).text(`[${c.created_at?.slice(0, 10)}] ${c.content ?? ""}`);
      });
      doc.moveDown();
    }

    doc.end();
    await new Promise(resolve => doc.on("end", resolve));
    const pdfBytes = Buffer.concat(chunks.map(c => Buffer.from(c)));

    // Upload to Supabase Storage
    const reportId = crypto.randomUUID();
    const storagePath = `${patientId}/${reportId}.pdf`;
    await supabase.storage.from("pdfs").upload(storagePath, pdfBytes, { contentType: "application/pdf" });

    // Generate 24h signed URL
    const { data: signedUrl } = await supabase.storage.from("pdfs")
      .createSignedUrl(storagePath, 86400);

    // Email delivery
    if (body.deliveryMethod === "email" && body.doctorEmail) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: Deno.env.get("GMAIL_USER"), pass: Deno.env.get("GMAIL_APP_PASSWORD") },
      });
      await transporter.sendMail({
        from: Deno.env.get("GMAIL_USER"),
        to: body.doctorEmail,
        subject: `Vela Vision Care Report — ${patient?.name ?? "Patient"}`,
        text: `Please find attached a care report for ${patient?.name ?? "your patient"} covering ${startDate} to ${endDate}.\n\nThis report contains general wellness observations only and is not intended as a diagnostic tool.`,
        attachments: [{ filename: "care-report.pdf", content: pdfBytes }],
      });
    }

    return json({ reportId, downloadUrl: signedUrl?.signedUrl ?? null, deliveredByEmail: body.deliveryMethod === "email" });
  }

  return json({ detail: "Not found" }, 404);
});
