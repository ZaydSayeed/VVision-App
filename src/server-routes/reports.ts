import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { getDb } from "../server-core/database";
import { buildReportBuffer, ReportInput, ReportBiomarker, ReportCheckInLog } from "../server-core/reportPdf";
import { sendReportEmail } from "../server-core/reportEmail";
import { GoogleGenAI } from "@google/genai";
import { config } from "../server-core/config";

const reportSchema = z.object({
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  visitId: z.string().optional(),
});

const emailReportSchema = reportSchema.extend({
  doctorId: z.string(),
});

const router = Router();

// ─── Shared: gather all data and build PDF ─────────────────────────────────

async function gatherAndBuild(patientId: string, startDate: string, endDate: string, visitId?: string): Promise<{ buffer: Buffer; input: ReportInput }> {
  const db = getDb();

  // Fetch patient
  const patient = ObjectId.isValid(patientId)
    ? await db.collection("patients").findOne({ _id: new ObjectId(patientId) })
    : null;
  const patientName = patient?.name ?? "Unknown Patient";
  const stage = patient?.stage ?? null;

  // Fetch visit if provided
  let visit: ReportInput["visit"] = null;
  if (visitId && ObjectId.isValid(visitId)) {
    const v = await db.collection("visits").findOne({ _id: new ObjectId(visitId) });
    if (v) visit = { providerName: v.provider, scheduledFor: v.scheduledFor };
  }

  // Medications (full current list)
  const meds = await db.collection("medications").find({ patient_id: patientId }).toArray();
  const medications = meds.map((m: any) => ({
    name: m.name ?? "",
    dose: m.dose ?? "",
    schedule: m.schedule ?? "",
  }));

  // Check-in logs (date-scoped)
  const logs = await db.collection("checkin_logs")
    .find({ patientId, capturedAt: { $gte: startDate, $lte: endDate } })
    .sort({ capturedAt: 1 })
    .toArray();
  const checkinLogs: ReportCheckInLog[] = logs.map((l: any) => ({
    content: l.content,
    source: l.source,
    capturedAt: l.capturedAt,
  }));

  // AI Summary from Gemini
  let aiSummary = "No check-in data available for this period.";
  if (checkinLogs.length > 0 && config.geminiApiKey) {
    const logsText = checkinLogs.map(l => {
      const d = new Date(l.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `[${d}]: ${l.content}`;
    }).join("\n\n");

    const prompt = `You are a dementia care assistant. Summarize these caregiver check-in notes into a 150-200 word narrative for a doctor. Focus on mood, sleep, behavior changes, and notable incidents.\n\nCheck-in notes:\n${logsText}\n\nWrite a professional clinical summary paragraph.`;

    try {
      const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      aiSummary = response.candidates?.[0]?.content?.parts?.[0]?.text ?? aiSummary;
    } catch (e: any) {
      console.warn("AI summary failed:", e.message);
    }
  }

  // Patterns
  const patternsRaw = await db.collection("patterns")
    .find({ patientId, dismissed: { $ne: true } })
    .sort({ confidence: -1 })
    .limit(5)
    .toArray();
  const patterns = patternsRaw.map((p: any) => ({ title: p.title, description: p.description }));

  // Biomarkers (date-scoped)
  const biomarkers: ReportBiomarker[] = [];
  for (const kind of ["gait", "typing_cadence"] as const) {
    const events = await db.collection("profile_events")
      .find({ patientId, kind, capturedAt: { $gte: startDate, $lte: endDate } })
      .sort({ capturedAt: 1 })
      .toArray();

    if (events.length < 2) continue;

    const values = events.map((e: any) => {
      if (kind === "gait") return e.data?.cadenceStepsPerMin ?? e.data?.cadence ?? 0;
      return e.data?.avgInterval ?? e.data?.cadence ?? 0;
    });
    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;

    // Prior period for comparison
    const rangeDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
    const priorStart = new Date(new Date(startDate).getTime() - rangeDays * 86400000).toISOString();
    const priorEvents = await db.collection("profile_events")
      .find({ patientId, kind, capturedAt: { $gte: priorStart, $lt: startDate } })
      .toArray();
    let priorAvg: number | null = null;
    if (priorEvents.length > 0) {
      const priorVals = priorEvents.map((e: any) => {
        if (kind === "gait") return e.data?.cadenceStepsPerMin ?? e.data?.cadence ?? 0;
        return e.data?.avgInterval ?? e.data?.cadence ?? 0;
      });
      priorAvg = priorVals.reduce((a: number, b: number) => a + b, 0) / priorVals.length;
    }

    const trend = priorAvg == null ? "stable" as const
      : avg > priorAvg * 1.05 ? "up" as const
      : avg < priorAvg * 0.95 ? "down" as const
      : "stable" as const;

    biomarkers.push({
      label: kind === "gait" ? "Gait Cadence" : "Typing Cadence",
      unit: kind === "gait" ? "steps/min" : "ms/key",
      avg,
      priorAvg,
      trend,
      dataPoints: events.map((e: any) => ({
        date: e.capturedAt,
        value: kind === "gait" ? (e.data?.cadenceStepsPerMin ?? 0) : (e.data?.avgInterval ?? 0),
      })),
    });
  }

  // Family notes (date-scoped)
  const notes = await db.collection("caregiver_notes")
    .find({ patientId, timestamp: { $gte: startDate, $lte: endDate } })
    .sort({ timestamp: 1 })
    .toArray();
  const familyNotes = notes.map((n: any) => ({ text: n.text, createdAt: n.timestamp }));

  const input: ReportInput = {
    patientName,
    stage,
    dateRange: { start: startDate, end: endDate },
    generatedAt: new Date().toISOString(),
    visit,
    medications,
    aiSummary,
    patterns,
    biomarkers,
    familyNotes,
    checkinLogs,
  };

  const buffer = await buildReportBuffer(input);
  return { buffer, input };
}

// ─── POST /api/profiles/:patientId/report — generate + return PDF ──────────

router.post("/:patientId/report", authMiddleware, requireSeat, async (req: Request, res: Response) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const { buffer } = await gatherAndBuild(
      String(req.params.patientId), parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=care_report.pdf");
    res.send(buffer);
  } catch (err: any) {
    console.error("report generate error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// ─── POST /api/profiles/:patientId/report/email — generate + email ─────────

router.post("/:patientId/report/email", authMiddleware, requireSeat, async (req: Request, res: Response) => {
  const parsed = emailReportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  if (!ObjectId.isValid(parsed.data.doctorId)) { res.status(400).json({ detail: "Invalid doctor id" }); return; }
  try {
    const db = getDb();
    const doctor = await db.collection("doctors").findOne({ _id: new ObjectId(parsed.data.doctorId) });
    if (!doctor) { res.status(404).json({ detail: "Doctor not found" }); return; }

    const { buffer, input } = await gatherAndBuild(
      String(req.params.patientId), parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
    );

    const dateRange = `${new Date(parsed.data.startDate).toLocaleDateString()} — ${new Date(parsed.data.endDate).toLocaleDateString()}`;
    await sendReportEmail({
      toEmail: doctor.email,
      toName: doctor.name,
      patientName: input.patientName,
      dateRange,
      pdfBuffer: buffer,
    });

    res.json({ ok: true, sentTo: doctor.email });
  } catch (err: any) {
    console.error("report email error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// ─── POST /api/profiles/:patientId/report/link — generate + return URL ─────

const REPORTS_DIR = path.join(process.cwd(), "uploads", "reports");

router.post("/:patientId/report/link", authMiddleware, requireSeat, async (req: Request, res: Response) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const { buffer } = await gatherAndBuild(
      String(req.params.patientId), parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
    );

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const fileId = randomUUID();
    const filePath = path.join(REPORTS_DIR, `${fileId}.pdf`);
    fs.writeFileSync(filePath, buffer);

    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/api/reports/download/${fileId}`;
    const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();

    res.json({ url, expiresAt });
  } catch (err: any) {
    console.error("report link error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// ─── GET /api/reports/download/:fileId — serve a short-lived PDF ───────────

router.get("/download/:fileId", (req: Request, res: Response) => {
  const fileId = String(req.params.fileId).replace(/[^a-z0-9-]/gi, "");
  const filePath = path.join(REPORTS_DIR, `${fileId}.pdf`);

  if (!fs.existsSync(filePath)) { res.status(404).json({ detail: "Report not found or expired" }); return; }

  // Check 24h expiry
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  if (ageMs > 24 * 3600_000) {
    fs.unlinkSync(filePath);
    res.status(410).json({ detail: "Report expired" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  fs.createReadStream(filePath).pipe(res);
});

export default router;
