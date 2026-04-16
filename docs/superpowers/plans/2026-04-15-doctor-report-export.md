# Doctor Report Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On-demand PDF reports that caregivers generate, view, email to doctors, or share — with AI-summarized check-in logs, biomarker sparklines, and a date-range selector.

**Architecture:** Backend routes handle doctor CRUD, PDF generation (expanded pdfkit builder), email (nodemailer + existing Gmail SMTP), and short-lived download links. Frontend adds a Visit Reports screen reachable from the side drawer and patient detail card, with bottom sheets for the export flow and doctor picker.

**Tech Stack:** Express/TypeScript backend, pdfkit (PDF), nodemailer (email), Gemini 2.5 Flash (AI summary), React Native frontend with Expo, existing Zod/MongoDB/authMiddleware patterns.

**Spec:** `docs/superpowers/specs/2026-04-15-doctor-report-export-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/server-routes/doctors.ts` | CRUD endpoints for saved doctors per patient |
| `src/server-routes/reports.ts` | PDF generation, email, and link endpoints |
| `src/server-core/reportPdf.ts` | Expanded PDF builder (replaces visitPrepPdf.ts usage) |
| `src/server-core/reportEmail.ts` | Nodemailer helper for sending PDF attachment |
| `src/api/doctors.ts` | Frontend API client for doctors |
| `src/api/reports.ts` | Frontend API client for report generation/email/link |
| `src/screens/caregiver/VisitReportsScreen.tsx` | Main screen: visits list, doctors, generate/schedule |
| `src/components/ExportFlowSheet.tsx` | Bottom sheet: date range → delivery method |
| `src/components/DoctorPickerSheet.tsx` | Bottom sheet: select or add a doctor |

### Modified Files

| File | Change |
|------|--------|
| `src/server.ts` | Mount doctors + reports routes |
| `src/server-jobs/scheduler.ts` | Remove visitPrepJob cron |
| `src/components/SideDrawer.tsx` | Add "Visit Reports" menu item |
| `src/screens/caregiver/PatientDetailScreen.tsx` | Add "Doctor Reports" card |
| `src/navigation/RootNavigator.tsx` | Wire VisitReportsScreen, remove old screens |
| `package.json` | Add nodemailer dependency |

### Deleted Files

| File | Reason |
|------|--------|
| `src/server-jobs/visitPrepJob.ts` | Replaced by on-demand generation |
| `src/screens/caregiver/VisitsScreen.tsx` | Replaced by VisitReportsScreen |
| `src/screens/caregiver/ScheduleVisitScreen.tsx` | Schedule form absorbed into VisitReportsScreen |

---

## Task 1: Install nodemailer + types

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install nodemailer**

```bash
cd ~/projects/VVision-App && npm install nodemailer && npm install -D @types/nodemailer
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install nodemailer for report email delivery"
```

---

## Task 2: Doctors CRUD backend

**Files:**
- Create: `src/server-routes/doctors.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write doctors route file**

Create `src/server-routes/doctors.ts`:

```typescript
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { getDb } from "../server-core/database";

const doctorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
});

const router = Router();

// GET /api/profiles/:patientId/doctors
router.get("/:patientId/doctors", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const doctors = await db.collection("doctors")
      .find({ patientId: req.params.patientId })
      .sort({ name: 1 })
      .toArray();
    res.json({ doctors: doctors.map(d => ({ id: String(d._id), name: d.name, email: d.email })) });
  } catch (err: any) {
    console.error("list doctors error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/profiles/:patientId/doctors
router.post("/:patientId/doctors", authMiddleware, requireSeat, async (req, res) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const result = await db.collection("doctors").insertOne({
      patientId: req.params.patientId,
      name: parsed.data.name,
      email: parsed.data.email,
      createdAt: new Date().toISOString(),
      createdBy: (req as any).auth!.userId,
    });
    res.status(201).json({ id: String(result.insertedId), name: parsed.data.name, email: parsed.data.email });
  } catch (err: any) {
    console.error("add doctor error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/profiles/:patientId/doctors/:doctorId
router.delete("/:patientId/doctors/:doctorId", authMiddleware, requireSeat, async (req, res) => {
  if (!ObjectId.isValid(req.params.doctorId)) { res.status(400).json({ detail: "Invalid id" }); return; }
  try {
    const db = getDb();
    await db.collection("doctors").deleteOne({
      _id: new ObjectId(req.params.doctorId),
      patientId: req.params.patientId,
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("delete doctor error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2: Mount doctors routes in server.ts**

In `src/server.ts`, add import near the other route imports:

```typescript
import doctorRoutes from "./server-routes/doctors";
```

Mount it alongside other `/api/profiles` routes (near the visitRoutes mount):

```typescript
app.use("/api/profiles", doctorRoutes);
```

- [ ] **Step 3: Verify server starts**

```bash
npx tsc --noEmit 2>&1 | grep -E "doctors|server\.ts" | head -10
```

Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/doctors.ts src/server.ts
git commit -m "feat: add doctors CRUD endpoints per patient"
```

---

## Task 3: Report PDF builder

**Files:**
- Create: `src/server-core/reportPdf.ts`

- [ ] **Step 1: Write the expanded PDF builder**

Create `src/server-core/reportPdf.ts`:

```typescript
import PDFDocument from "pdfkit";

export interface ReportDoctor {
  name: string;
  email: string;
}

export interface ReportMedication {
  name: string;
  dose: string;
  schedule: string;
}

export interface ReportPattern {
  title: string;
  description: string;
}

export interface ReportCheckInLog {
  content: string;
  source: "voice_check_in" | "text_check_in";
  capturedAt: string;
}

export interface ReportBiomarker {
  label: string;
  unit: string;
  avg: number;
  priorAvg: number | null;
  trend: "up" | "down" | "stable";
  dataPoints: Array<{ date: string; value: number }>;
}

export interface ReportInput {
  patientName: string;
  stage?: string | null;
  dateRange: { start: string; end: string };
  generatedAt: string;
  visit?: { providerName: string; scheduledFor: string } | null;
  medications: ReportMedication[];
  aiSummary: string;
  patterns: ReportPattern[];
  biomarkers: ReportBiomarker[];
  familyNotes: Array<{ text: string; createdAt: string }>;
  checkinLogs: ReportCheckInLog[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function drawSparkline(doc: InstanceType<typeof PDFDocument>, points: Array<{ value: number }>, x: number, y: number, w: number, h: number) {
  if (points.length < 2) return;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);

  doc.save();
  doc.strokeColor("#7B5CE7").lineWidth(1.5);

  for (let i = 0; i < points.length; i++) {
    const px = x + i * stepX;
    const py = y + h - ((vals[i] - min) / range) * h;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.stroke();
  doc.restore();
}

function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.moveDown();
  doc.fontSize(14).fillColor("#0f172a").text(title);
  doc.moveDown(0.3);
}

export function buildReportBuffer(input: ReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- Header ---
    doc.fontSize(20).fillColor("#0f172a").text(`Care Report — ${input.patientName}`);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#475569");
    doc.text(`Date range: ${formatDate(input.dateRange.start)} — ${formatDate(input.dateRange.end)}`);
    doc.text(`Generated: ${formatDateTime(input.generatedAt)}`);
    if (input.stage) doc.text(`Dementia stage: ${input.stage}`);
    if (input.visit) {
      doc.text(`Provider: ${input.visit.providerName}`);
      doc.text(`Appointment: ${formatDateTime(input.visit.scheduledFor)}`);
    }

    // --- Medications ---
    sectionHeader(doc, "Current Medications");
    doc.fontSize(11).fillColor("#0f172a");
    if (input.medications.length === 0) {
      doc.fillColor("#64748b").text("None recorded.").fillColor("#0f172a");
    } else {
      input.medications.forEach(m => doc.text(`• ${m.name} — ${m.dose} — ${m.schedule}`));
    }

    // --- AI Summary ---
    sectionHeader(doc, "Summary");
    doc.fontSize(11).fillColor("#0f172a").text(input.aiSummary);

    // --- Patterns ---
    sectionHeader(doc, "Patterns Detected");
    doc.fontSize(11);
    if (input.patterns.length === 0) {
      doc.fillColor("#64748b").text("No strong patterns detected yet.").fillColor("#0f172a");
    } else {
      input.patterns.forEach(p => {
        doc.font("Helvetica-Bold").fillColor("#0f172a").text(p.title);
        doc.font("Helvetica").text(p.description);
        doc.moveDown(0.3);
      });
    }

    // --- Biomarker Trends ---
    sectionHeader(doc, "Wellness Trends");
    doc.fontSize(9).fillColor("#94a3b8").text(
      "General wellness observations only — not intended as diagnostic measures.",
      { italics: true }
    );
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#0f172a");
    if (input.biomarkers.length === 0) {
      doc.fillColor("#64748b").text("Not enough biomarker data in this period.").fillColor("#0f172a");
    } else {
      input.biomarkers.forEach(b => {
        const arrow = b.trend === "up" ? "↑" : b.trend === "down" ? "↓" : "→";
        const priorStr = b.priorAvg != null ? ` (prior: ${b.priorAvg.toFixed(1)})` : "";
        doc.font("Helvetica-Bold").text(`${b.label}: ${b.avg.toFixed(1)} ${b.unit} ${arrow}${priorStr}`);
        doc.font("Helvetica");

        // Sparkline — 200px wide, 30px tall, right of current position
        const sparkY = doc.y;
        drawSparkline(doc, b.dataPoints, 350, sparkY - 14, 180, 28);
        doc.moveDown(0.6);
      });
    }

    // --- Family Notes ---
    sectionHeader(doc, "Caregiver Notes");
    doc.fontSize(11);
    if (input.familyNotes.length === 0) {
      doc.fillColor("#64748b").text("No notes in this period.").fillColor("#0f172a");
    } else {
      input.familyNotes.forEach(n => {
        doc.fillColor("#475569").text(formatDate(n.createdAt));
        doc.fillColor("#0f172a").text(n.text);
        doc.moveDown(0.3);
      });
    }

    // --- Appendix: Full Check-In Logs ---
    doc.addPage();
    doc.fontSize(16).fillColor("#0f172a").text("Appendix: Check-In Logs");
    doc.moveDown(0.3);
    doc.fontSize(11);

    if (input.checkinLogs.length === 0) {
      doc.fillColor("#64748b").text("No check-in logs in this period.").fillColor("#0f172a");
    } else {
      input.checkinLogs.forEach(log => {
        const badge = log.source === "voice_check_in" ? "Voice" : "Text";
        doc.fillColor("#7B5CE7").text(`${formatDateTime(log.capturedAt)} [${badge}]`);
        doc.fillColor("#0f172a").text(log.content);
        doc.moveDown(0.5);
        // Add page if we're running low on space
        if (doc.y > 680) doc.addPage();
      });
    }

    doc.end();
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep reportPdf | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server-core/reportPdf.ts
git commit -m "feat: add expanded report PDF builder with AI summary, biomarkers, sparklines, and log appendix"
```

---

## Task 4: Report email helper

**Files:**
- Create: `src/server-core/reportEmail.ts`

- [ ] **Step 1: Write the email helper**

Create `src/server-core/reportEmail.ts`:

```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface ReportEmailInput {
  toEmail: string;
  toName: string;
  patientName: string;
  dateRange: string;
  pdfBuffer: Buffer;
}

export async function sendReportEmail(input: ReportEmailInput): Promise<void> {
  await transporter.sendMail({
    from: `"Vela Vision" <${process.env.GMAIL_ADDRESS}>`,
    to: input.toEmail,
    subject: `Care Report for ${input.patientName}`,
    text: `Hi ${input.toName},\n\nPlease find attached the care report for ${input.patientName} covering ${input.dateRange}.\n\nGenerated by Vela Vision.`,
    attachments: [{
      filename: `${input.patientName.replace(/\s+/g, "_")}_Care_Report.pdf`,
      content: input.pdfBuffer,
      contentType: "application/pdf",
    }],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server-core/reportEmail.ts
git commit -m "feat: add nodemailer helper for emailing PDF reports"
```

---

## Task 5: Report generation endpoints

**Files:**
- Create: `src/server-routes/reports.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write report routes**

Create `src/server-routes/reports.ts`:

```typescript
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
      req.params.patientId, parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
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
      req.params.patientId, parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
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
      req.params.patientId, parsed.data.startDate, parsed.data.endDate, parsed.data.visitId
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

// ─── GET /api/reports/:fileId — serve a short-lived PDF ────────────────────

router.get("/download/:fileId", (req: Request, res: Response) => {
  const fileId = req.params.fileId.replace(/[^a-z0-9-]/gi, "");
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
```

- [ ] **Step 2: Mount report routes in server.ts**

In `src/server.ts`, add import:

```typescript
import reportRoutes from "./server-routes/reports";
```

Mount both profile-scoped and public download routes:

```typescript
app.use("/api/profiles", reportRoutes);
app.use("/api/reports", reportRoutes);
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "reports|reportPdf|reportEmail" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/reports.ts src/server.ts
git commit -m "feat: add report generation, email, and link endpoints"
```

---

## Task 6: Remove visit prep cron

**Files:**
- Modify: `src/server-jobs/scheduler.ts`
- Delete: `src/server-jobs/visitPrepJob.ts`

- [ ] **Step 1: Update scheduler.ts**

Replace the full file content of `src/server-jobs/scheduler.ts` with:

```typescript
import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });
  console.log("cron scheduled");
}
```

- [ ] **Step 2: Delete visitPrepJob.ts**

```bash
rm src/server-jobs/visitPrepJob.ts
```

- [ ] **Step 3: Verify server compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "visitPrep|scheduler" | head -5
```

Expected: no errors (visitPrepPdf.ts stays — it's still imported by nothing but kept for reference; the new builder is `reportPdf.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/server-jobs/scheduler.ts
git rm src/server-jobs/visitPrepJob.ts
git commit -m "chore: remove visit-prep cron — reports are now on-demand"
```

---

## Task 7: Frontend API client

**Files:**
- Create: `src/api/doctors.ts`
- Create: `src/api/reports.ts`

- [ ] **Step 1: Write doctors API client**

Create `src/api/doctors.ts`:

```typescript
import { authFetch } from "./authFetch";

export interface Doctor {
  id: string;
  name: string;
  email: string;
}

export async function fetchDoctors(patientId: string): Promise<Doctor[]> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors`);
  if (!res.ok) throw new Error(`Failed to load doctors: ${res.status}`);
  const data = await res.json();
  return data.doctors ?? [];
}

export async function addDoctor(patientId: string, name: string, email: string): Promise<Doctor> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors`, {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to add doctor (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function removeDoctor(patientId: string, doctorId: string): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors/${doctorId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to remove doctor: ${res.status}`);
}
```

- [ ] **Step 2: Write reports API client**

Create `src/api/reports.ts`:

```typescript
import { authFetch } from "./authFetch";

export async function generateReport(
  patientId: string, startDate: string, endDate: string, visitId?: string
): Promise<Blob> {
  const res = await authFetch(`/api/profiles/${patientId}/report`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Report generation failed (${res.status}). ${detail}`);
  }
  return res.blob();
}

export async function emailReport(
  patientId: string, startDate: string, endDate: string, doctorId: string, visitId?: string
): Promise<{ sentTo: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/report/email`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, doctorId, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email failed (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function generateReportLink(
  patientId: string, startDate: string, endDate: string, visitId?: string
): Promise<{ url: string; expiresAt: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/report/link`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Link generation failed (${res.status}). ${detail}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/doctors.ts src/api/reports.ts
git commit -m "feat: add frontend API clients for doctors and reports"
```

---

## Task 8: DoctorPickerSheet component

**Files:**
- Create: `src/components/DoctorPickerSheet.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/DoctorPickerSheet.tsx`:

```tsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Modal, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { Doctor, fetchDoctors, addDoctor } from "../api/doctors";

interface Props {
  visible: boolean;
  patientId: string;
  onSelect: (doctor: Doctor) => void;
  onClose: () => void;
}

export function DoctorPickerSheet({ visible, patientId, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setDoctors(await fetchDoctors(patientId)); }
    catch { setDoctors([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setAdding(true);
    try {
      const doc = await addDoctor(patientId, newName.trim(), newEmail.trim());
      setDoctors(prev => [...prev, doc]);
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      onSelect(doc);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setAdding(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
      maxHeight: "70%",
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    title: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.lg },
    row: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet50,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { fontSize: 16, color: colors.violet, ...fonts.medium },
    name: { fontSize: 15, color: colors.text, ...fonts.medium },
    email: { fontSize: 12, color: colors.muted, ...fonts.regular },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingVertical: spacing.lg, justifyContent: "center",
    },
    addBtnText: { fontSize: 15, color: colors.violet, ...fonts.medium },
    input: {
      height: 48, backgroundColor: colors.surface, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, fontSize: 15, color: colors.text, ...fonts.regular,
      marginBottom: spacing.sm,
    },
    saveBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm,
    },
    saveBtnText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
    cancelLink: { alignItems: "center", marginTop: spacing.md },
    cancelText: { fontSize: 14, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.title}>Send to Doctor</Text>

            {loading ? (
              <ActivityIndicator color={colors.violet} style={{ marginVertical: spacing.xl }} />
            ) : showAdd ? (
              <View>
                <TextInput style={styles.input} placeholder="Doctor's name" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} />
                <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.muted} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={adding} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>{adding ? "Saving…" : "Save & Send"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={() => setShowAdd(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {doctors.map(d => (
                  <TouchableOpacity key={d.id} style={styles.row} onPress={() => onSelect(d)} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{d.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{d.name}</Text>
                      <Text style={styles.email}>{d.email}</Text>
                    </View>
                    <Ionicons name="send-outline" size={18} color={colors.violet} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.violet} />
                  <Text style={styles.addBtnText}>Add a doctor</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DoctorPickerSheet.tsx
git commit -m "feat: add DoctorPickerSheet bottom sheet component"
```

---

## Task 9: ExportFlowSheet component

**Files:**
- Create: `src/components/ExportFlowSheet.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ExportFlowSheet.tsx`:

```tsx
import React, { useState, useMemo } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Clipboard from "expo-clipboard";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { generateReport, emailReport, generateReportLink } from "../api/reports";
import { Doctor } from "../api/doctors";
import { DoctorPickerSheet } from "./DoctorPickerSheet";

interface Props {
  visible: boolean;
  patientId: string;
  visitId?: string;
  onClose: () => void;
}

type Step = "range" | "deliver";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function ExportFlowSheet({ visible, patientId, visitId, onClose }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 30 * 86400000));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const pickPreset = (days: number) => {
    setStartDate(daysAgo(days));
    setEndDate(today);
    setStep("deliver");
  };

  const confirmCustom = () => {
    setStartDate(customStart.toISOString().slice(0, 10));
    setEndDate(customEnd.toISOString().slice(0, 10));
    setShowCustom(false);
    setStep("deliver");
  };

  const reset = () => {
    setStep("range");
    setStartDate("");
    setEndDate("");
    setShowCustom(false);
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // --- Share via native share sheet ---
  const handleShare = async () => {
    setLoading(true);
    try {
      const blob = await generateReport(patientId, startDate, endDate, visitId);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const fileUri = FileSystem.cacheDirectory + "care_report.pdf";
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
        handleClose();
      };
      reader.readAsDataURL(blob);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  // --- Email to doctor ---
  const handleEmailSelect = (doctor: Doctor) => {
    setDoctorPickerOpen(false);
    sendEmail(doctor);
  };

  const sendEmail = async (doctor: Doctor) => {
    setLoading(true);
    try {
      const result = await emailReport(patientId, startDate, endDate, doctor.id, visitId);
      Alert.alert("Sent", `Report emailed to ${result.sentTo}`);
      handleClose();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  // --- Copy link ---
  const handleCopyLink = async () => {
    setLoading(true);
    try {
      const result = await generateReportLink(patientId, startDate, endDate, visitId);
      await Clipboard.setStringAsync(result.url);
      Alert.alert("Link Copied", "The report link has been copied to your clipboard. It expires in 24 hours.");
      handleClose();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    title: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    subtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginBottom: spacing.xl },
    presetBtn: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    presetText: { fontSize: 15, color: colors.text, ...fonts.medium },
    deliverBtn: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md,
    },
    deliverIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center" },
    deliverText: { fontSize: 15, color: colors.text, ...fonts.medium },
    deliverSub: { fontSize: 12, color: colors.muted, ...fonts.regular },
    backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.lg },
    backText: { fontSize: 14, color: colors.violet, ...fonts.regular },
    customRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    customLabel: { fontSize: 12, color: colors.muted, ...fonts.medium, marginBottom: spacing.xs },
    confirmBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center",
    },
    confirmText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <>
      <Modal visible={visible && !doctorPickerOpen} transparent animationType="slide" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xxxxl }}>
                <ActivityIndicator size="large" color={colors.violet} />
                <Text style={{ ...fonts.regular, color: colors.muted, marginTop: spacing.lg, fontSize: 14 }}>
                  Generating report…
                </Text>
              </View>
            ) : step === "range" ? (
              <>
                <Text style={styles.title}>Generate Report</Text>
                <Text style={styles.subtitle}>Pick a time range for the report.</Text>

                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(7)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 7 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(30)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 30 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(90)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 90 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => setShowCustom(true)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Custom range</Text>
                  <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                </TouchableOpacity>

                {showCustom && (
                  <View style={{ marginTop: spacing.lg }}>
                    <View style={styles.customRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customLabel}>From</Text>
                        <DateTimePicker value={customStart} mode="date" display="default" maximumDate={customEnd} onChange={(_, d) => d && setCustomStart(d)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customLabel}>To</Text>
                        <DateTimePicker value={customEnd} mode="date" display="default" maximumDate={new Date()} minimumDate={customStart} onChange={(_, d) => d && setCustomEnd(d)} />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.confirmBtn} onPress={confirmCustom} activeOpacity={0.8}>
                      <Text style={styles.confirmText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep("range")} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={16} color={colors.violet} />
                  <Text style={styles.backText}>Change dates</Text>
                </TouchableOpacity>
                <Text style={styles.title}>How do you want to share?</Text>
                <Text style={styles.subtitle}>{startDate} — {endDate}</Text>

                <TouchableOpacity style={styles.deliverBtn} onPress={handleShare} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="share-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Share</Text>
                    <Text style={styles.deliverSub}>AirDrop, Mail, Messages, Files…</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deliverBtn} onPress={() => setDoctorPickerOpen(true)} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="mail-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Email to doctor</Text>
                    <Text style={styles.deliverSub}>Send directly from the app</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deliverBtn} onPress={handleCopyLink} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="link-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Copy link</Text>
                    <Text style={styles.deliverSub}>Shareable link, expires in 24h</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <DoctorPickerSheet
        visible={doctorPickerOpen}
        patientId={patientId}
        onSelect={handleEmailSelect}
        onClose={() => setDoctorPickerOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify dependencies**

Check that `expo-sharing`, `expo-file-system`, `expo-clipboard`, and `@react-native-community/datetimepicker` are installed:

```bash
grep -E "expo-sharing|expo-file-system|expo-clipboard|datetimepicker" package.json
```

If any are missing, install them:

```bash
npx expo install expo-sharing expo-file-system expo-clipboard @react-native-community/datetimepicker
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportFlowSheet.tsx
git commit -m "feat: add ExportFlowSheet bottom sheet — date range + delivery options"
```

---

## Task 10: VisitReportsScreen

**Files:**
- Create: `src/screens/caregiver/VisitReportsScreen.tsx`

- [ ] **Step 1: Write the screen**

Create `src/screens/caregiver/VisitReportsScreen.tsx`:

```tsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { listVisits, createVisit } from "../../api/visits";
import { fetchDoctors, Doctor, removeDoctor } from "../../api/doctors";
import { ExportFlowSheet } from "../../components/ExportFlowSheet";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

export default function VisitReportsScreen({ patientId, patientName, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // --- Visits state ---
  const [visits, setVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Doctors state ---
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // --- Schedule form ---
  const [showSchedule, setShowSchedule] = useState(false);
  const [formProvider, setFormProvider] = useState("");
  const [formDate, setFormDate] = useState(new Date());
  const [formNotes, setFormNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // --- Export flow ---
  const [exportOpen, setExportOpen] = useState(false);
  const [exportVisitId, setExportVisitId] = useState<string | undefined>(undefined);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingVisits(true);
    try {
      const [v, d] = await Promise.all([
        listVisits(patientId).catch(() => ({ visits: [] })),
        fetchDoctors(patientId).catch(() => []),
      ]);
      setVisits(v.visits ?? []);
      setDoctors(d);
    } finally {
      setLoadingVisits(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSchedule = async () => {
    if (!formProvider.trim()) { Alert.alert("Missing", "Enter a provider name."); return; }
    setScheduling(true);
    try {
      await createVisit(patientId, {
        provider: formProvider.trim(),
        scheduledFor: formDate.toISOString(),
        notes: formNotes.trim() || undefined,
      });
      setShowSchedule(false);
      setFormProvider("");
      setFormNotes("");
      loadAll(true);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setScheduling(false); }
  };

  const handleDeleteDoctor = (doc: Doctor) => {
    Alert.alert("Remove doctor?", `Remove ${doc.name}?`, [
      { text: "Cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await removeDoctor(patientId, doc.id); setDoctors(prev => prev.filter(d => d.id !== doc.id)); }
        catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const openExport = (visitId?: string) => {
    setExportVisitId(visitId);
    setExportOpen(true);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, color: colors.text, ...fonts.medium, flex: 1 },
    content: { padding: spacing.xl, paddingBottom: 100 },
    sectionLabel: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginBottom: spacing.sm, marginTop: spacing.xl,
    },
    card: {
      backgroundColor: colors.bg, borderRadius: radius.lg,
      padding: spacing.lg, marginBottom: spacing.sm,
      borderLeftWidth: 4, borderLeftColor: colors.violet,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
      flexDirection: "row", alignItems: "center", gap: spacing.md,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    cardSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    pill: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill,
      backgroundColor: colors.violet50,
    },
    pillText: { fontSize: 11, color: colors.violet, ...fonts.medium },
    actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
    actionBtn: {
      flex: 1, backgroundColor: colors.violet, borderRadius: radius.lg,
      paddingVertical: spacing.lg, alignItems: "center", flexDirection: "row",
      justifyContent: "center", gap: spacing.sm,
    },
    actionBtnAlt: {
      flex: 1, borderWidth: 1.5, borderColor: colors.violet, borderRadius: radius.lg,
      paddingVertical: spacing.lg, alignItems: "center", flexDirection: "row",
      justifyContent: "center", gap: spacing.sm,
    },
    actionText: { fontSize: 14, color: "#FFFFFF", ...fonts.medium },
    actionTextAlt: { fontSize: 14, color: colors.violet, ...fonts.medium },
    doctorRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    doctorAvatar: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.violet50,
      alignItems: "center", justifyContent: "center",
    },
    doctorInitial: { fontSize: 14, color: colors.violet, ...fonts.medium },
    doctorName: { fontSize: 14, color: colors.text, ...fonts.medium },
    doctorEmail: { fontSize: 11, color: colors.muted, ...fonts.regular },
    emptyText: { fontSize: 14, color: colors.muted, ...fonts.regular, textAlign: "center", paddingVertical: spacing.xl },
    // Schedule modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    modalTitle: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.lg },
    input: {
      height: 48, backgroundColor: colors.surface, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, fontSize: 15, color: colors.text, ...fonts.regular,
      marginBottom: spacing.sm,
    },
    submitBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md,
    },
    submitText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{patientName} — Reports</Text>
      </View>

      {loadingVisits ? (
        <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={colors.violet} />}
        >
          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openExport()} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnAlt} onPress={() => setShowSchedule(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color={colors.violet} />
              <Text style={styles.actionTextAlt}>Schedule Visit</Text>
            </TouchableOpacity>
          </View>

          {/* Visits */}
          <Text style={styles.sectionLabel}>Visits</Text>
          {visits.length === 0 ? (
            <Text style={styles.emptyText}>No visits scheduled yet.</Text>
          ) : (
            visits.map((v: any) => {
              const date = new Date(v.scheduledFor).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isPast = new Date(v.scheduledFor) < new Date();
              return (
                <TouchableOpacity key={v._id ?? v.id} style={styles.card} activeOpacity={0.75} onPress={() => openExport(v._id ?? v.id)}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{v.provider}</Text>
                    <Text style={styles.cardSub}>{date}</Text>
                    <View style={styles.pillRow}>
                      <View style={[styles.pill, isPast && { backgroundColor: colors.surface }]}>
                        <Text style={[styles.pillText, isPast && { color: colors.muted }]}>
                          {isPast ? "Completed" : "Upcoming"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="document-text-outline" size={20} color={colors.violet} />
                </TouchableOpacity>
              );
            })
          )}

          {/* Doctors */}
          <Text style={styles.sectionLabel}>Saved Doctors</Text>
          {doctors.length === 0 ? (
            <Text style={styles.emptyText}>No doctors saved yet. Add one during your first export.</Text>
          ) : (
            doctors.map(d => (
              <TouchableOpacity key={d.id} style={styles.doctorRow} onLongPress={() => handleDeleteDoctor(d)} activeOpacity={0.7}>
                <View style={styles.doctorAvatar}>
                  <Text style={styles.doctorInitial}>{d.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{d.name}</Text>
                  <Text style={styles.doctorEmail}>{d.email}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Schedule Visit Modal */}
      <Modal visible={showSchedule} transparent animationType="slide" onRequestClose={() => setShowSchedule(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSchedule(false)}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Schedule a Visit</Text>
              <TextInput style={styles.input} placeholder="Doctor / provider name" placeholderTextColor={colors.muted} value={formProvider} onChangeText={setFormProvider} />
              <View style={{ marginVertical: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.muted, ...fonts.medium, marginBottom: spacing.xs }}>Date & time</Text>
                <DateTimePicker value={formDate} mode="datetime" display="default" minimumDate={new Date()} onChange={(_, d) => d && setFormDate(d)} />
              </View>
              <TextInput style={[styles.input, { height: 72, textAlignVertical: "top" }]} placeholder="Notes (optional)" placeholderTextColor={colors.muted} value={formNotes} onChangeText={setFormNotes} multiline />
              <TouchableOpacity style={styles.submitBtn} onPress={handleSchedule} disabled={scheduling} activeOpacity={0.8}>
                <Text style={styles.submitText}>{scheduling ? "Saving…" : "Schedule"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Export Flow */}
      <ExportFlowSheet visible={exportOpen} patientId={patientId} visitId={exportVisitId} onClose={() => setExportOpen(false)} />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/caregiver/VisitReportsScreen.tsx
git commit -m "feat: add VisitReportsScreen — visits, doctors, and report generation"
```

---

## Task 11: Wire into navigation + side drawer + patient detail

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/components/SideDrawer.tsx`
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx`
- Delete: `src/screens/caregiver/VisitsScreen.tsx`
- Delete: `src/screens/caregiver/ScheduleVisitScreen.tsx`

- [ ] **Step 1: Update RootNavigator.tsx**

Replace the imports of the old screens:

```typescript
// Remove these imports:
import VisitsScreen from "../screens/caregiver/VisitsScreen";
import ScheduleVisitScreen from "../screens/caregiver/ScheduleVisitScreen";

// Add this import:
import VisitReportsScreen from "../screens/caregiver/VisitReportsScreen";
```

In the CaregiverStack.Screen definitions, replace the old `Visits` and `ScheduleVisit` screens with:

```tsx
<CaregiverStack.Screen name="VisitReports" component={VisitReportsScreen} options={{ headerShown: false }} />
```

Remove the old `<CaregiverStack.Screen name="Visits" ...>` and `<CaregiverStack.Screen name="ScheduleVisit" ...>` entries.

- [ ] **Step 2: Update SideDrawer.tsx**

In `src/components/SideDrawer.tsx`, add a "Visit Reports" menu item. Find the existing menu items section (near the sign-out button area) and add:

Import `usePatients` at the top:

```typescript
import { usePatients } from "../hooks/usePatients";
```

Inside the component, get patients and navigation:

```typescript
const { patients } = usePatients();
```

Add a state for patient picker:

```typescript
const [showPatientPicker, setShowPatientPicker] = useState(false);
```

Add the menu item JSX before the sign-out button (adapt to existing layout — find the menu items section in the drawer body):

```tsx
<TouchableOpacity
  style={[styles.menuItem]}
  onPress={() => {
    if (user?.role !== "caregiver") return;
    if (patients.length === 1 && patients[0]?.id) {
      onClose();
      navigation.navigate("VisitReports", { patientId: patients[0].id, patientName: patients[0].name, onBack: () => navigation.goBack() });
    } else if (patients.length > 1) {
      setShowPatientPicker(true);
    }
  }}
  activeOpacity={0.7}
>
  <Ionicons name="document-text-outline" size={22} color={colors.text} />
  <Text style={styles.menuItemText}>Visit Reports</Text>
</TouchableOpacity>
```

For the patient picker when `patients.length > 1`, add a simple modal at the bottom of the component (before the closing fragment):

```tsx
{showPatientPicker && (
  <Modal visible transparent animationType="fade" onRequestClose={() => setShowPatientPicker(false)}>
    <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setShowPatientPicker(false)}>
      <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 24, width: "80%" }}>
        <Text style={{ fontSize: 17, ...fonts.medium, color: colors.text, marginBottom: 16 }}>Which patient?</Text>
        {patients.map(p => (
          <TouchableOpacity
            key={p.id}
            style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
            onPress={() => {
              setShowPatientPicker(false);
              onClose();
              navigation.navigate("VisitReports", { patientId: p.id, patientName: p.name, onBack: () => navigation.goBack() });
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, ...fonts.regular, color: colors.text }}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  </Modal>
)}
```

Note: `SideDrawer` uses static styles from `theme.ts`. Add `menuItem` and `menuItemText` styles following the existing pattern in that file. If the drawer already has a similar row style, reuse it.

- [ ] **Step 3: Update PatientDetailScreen.tsx**

In `src/screens/caregiver/PatientDetailScreen.tsx`, add a "Doctor Reports" card.

Import `ExportFlowSheet`:

```typescript
import { ExportFlowSheet } from "../../components/ExportFlowSheet";
```

Add state:

```typescript
const [exportOpen, setExportOpen] = useState(false);
```

Add the card JSX after the existing stats/info cards (find the appropriate section in the ScrollView):

```tsx
{/* Doctor Reports */}
<View style={styles.reportsCard}>
  <Text style={styles.sectionLabel}>DOCTOR REPORTS</Text>
  <View style={{ flexDirection: "row", gap: spacing.sm }}>
    <TouchableOpacity
      style={styles.reportBtn}
      onPress={() => setExportOpen(true)}
      activeOpacity={0.8}
    >
      <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
      <Text style={styles.reportBtnText}>Generate Report</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.reportBtnAlt}
      onPress={() => navigation.navigate("VisitReports", { patientId, patientName, onBack: () => navigation.goBack() })}
      activeOpacity={0.8}
    >
      <Ionicons name="calendar-outline" size={16} color={colors.violet} />
      <Text style={styles.reportBtnAltText}>Schedule Visit</Text>
    </TouchableOpacity>
  </View>
</View>

<ExportFlowSheet visible={exportOpen} patientId={patientId} onClose={() => setExportOpen(false)} />
```

Add the styles inside the existing `useMemo` StyleSheet:

```typescript
reportsCard: {
  backgroundColor: colors.bg, borderRadius: radius.lg,
  padding: spacing.lg, marginTop: spacing.lg,
  shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
},
sectionLabel: {
  fontSize: 11, color: colors.muted, ...fonts.medium,
  letterSpacing: 1.2, textTransform: "uppercase",
  marginBottom: spacing.md,
},
reportBtn: {
  flex: 1, backgroundColor: colors.violet, borderRadius: radius.pill,
  paddingVertical: spacing.md, flexDirection: "row", alignItems: "center",
  justifyContent: "center", gap: spacing.xs,
},
reportBtnText: { fontSize: 13, color: "#FFFFFF", ...fonts.medium },
reportBtnAlt: {
  flex: 1, borderWidth: 1.5, borderColor: colors.violet, borderRadius: radius.pill,
  paddingVertical: spacing.md, flexDirection: "row", alignItems: "center",
  justifyContent: "center", gap: spacing.xs,
},
reportBtnAltText: { fontSize: 13, color: colors.violet, ...fonts.medium },
```

- [ ] **Step 4: Delete old screens**

```bash
rm src/screens/caregiver/VisitsScreen.tsx
rm src/screens/caregiver/ScheduleVisitScreen.tsx
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -iE "Visit|Report|Doctor|Drawer|PatientDetail" | head -20
```

Fix any import errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire visit reports into nav, side drawer, and patient detail card

Remove orphaned VisitsScreen and ScheduleVisitScreen. Add Visit Reports
entry in side drawer with patient picker for multi-patient caregivers.
Add Doctor Reports card to PatientDetailScreen."
```

---

## Task 12: Verify end-to-end + push

- [ ] **Step 1: Run the full build check**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Fix any remaining TypeScript errors.

- [ ] **Step 2: Start the app**

```bash
npx expo start --clear
```

Verify on device:
1. Side drawer shows "Visit Reports" item
2. Tapping it navigates to the new screen
3. "Generate Report" opens the export flow sheet
4. Date range presets work
5. Share / Email / Link options appear
6. "Schedule Visit" opens the schedule form
7. Patient detail screen has the "Doctor Reports" card

- [ ] **Step 3: Push**

```bash
git push origin main
```

Wait ~2 min for Render to redeploy the backend changes (doctors routes, report routes, cron removal).
