import PDFDocument from "pdfkit";

export interface VisitPrepInput {
  patientName: string;
  providerName: string;
  scheduledFor: string;
  stage?: string | null;
  medications?: Array<{ name: string; dose: string; schedule: string }>;
  eventsSummary: string;
  patterns?: Array<{ title: string; description: string }>;
  siblingNotes?: string;
}

export function buildVisitPrepBuffer(input: VisitPrepInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(`Visit Prep — ${input.patientName}`);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#475569").text(`For: ${input.providerName}`);
    doc.text(`Appointment: ${new Date(input.scheduledFor).toLocaleString()}`);
    if (input.stage) doc.text(`Current stage: ${input.stage}`);
    doc.moveDown();

    doc.fillColor("#0f172a").fontSize(14).text("Medications");
    doc.moveDown(0.3).fontSize(11);
    (input.medications ?? []).forEach((m) => doc.text(`• ${m.name} — ${m.dose} — ${m.schedule}`));
    if ((input.medications ?? []).length === 0) doc.fillColor("#64748b").text("None recorded").fillColor("#0f172a");
    doc.moveDown();

    doc.fontSize(14).text("Activity in the last 30 days");
    doc.moveDown(0.3).fontSize(11).text(input.eventsSummary);
    doc.moveDown();

    doc.fontSize(14).text("Patterns detected");
    doc.moveDown(0.3).fontSize(11);
    const pats = input.patterns ?? [];
    if (pats.length === 0) doc.fillColor("#64748b").text("No strong patterns detected yet.").fillColor("#0f172a");
    else pats.forEach((p) => { doc.font("Helvetica-Bold").text(p.title); doc.font("Helvetica").text(p.description); doc.moveDown(0.3); });

    if (input.siblingNotes) {
      doc.moveDown();
      doc.fontSize(14).text("From the family");
      doc.moveDown(0.3).fontSize(11).text(input.siblingNotes);
    }

    doc.end();
  });
}
