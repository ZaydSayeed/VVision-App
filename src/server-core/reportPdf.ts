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
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#94a3b8").text(
      "General wellness observations only — not intended as diagnostic measures."
    );
    doc.font("Helvetica").moveDown(0.3);
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
