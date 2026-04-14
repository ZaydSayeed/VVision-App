import { Db, ObjectId } from "mongodb";
import { buildVisitPrepBuffer } from "./visitPrepPdf";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function processDueVisits(db: Db) {
  const in3d = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
  const now = new Date().toISOString();
  const due = await db.collection("visits").find({
    status: "scheduled",
    prepGeneratedAt: { $exists: false },
    scheduledFor: { $gte: now, $lte: in3d },
  }).toArray();

  for (const v of due) {
    try {
      const patient = await db.collection("patients").findOne({ _id: new ObjectId(v.patientId) });
      const events = await db.collection("profile_events").find({
        patientId: v.patientId,
        capturedAt: { $gte: new Date(Date.now() - 30 * 24 * 3600_000).toISOString() },
      }).toArray();
      const eventsSummary = summarizeEvents(events);
      const patterns = await db.collection("patterns").find({ patientId: v.patientId }).sort({ confidence: -1 }).limit(5).toArray();
      const buf = await buildVisitPrepBuffer({
        patientName: patient?.name ?? "Patient",
        providerName: v.providerName,
        scheduledFor: v.scheduledFor,
        stage: patient?.stage,
        medications: patient?.medications ?? [],
        eventsSummary,
        patterns: patterns.map((p: any) => ({ title: p.title, description: p.description })),
        siblingNotes: v.notes,
      });
      const dir = path.join(process.cwd(), "uploads", "visit-prep", String(v.patientId));
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${v._id}.pdf`);
      await writeFile(filePath, buf);
      await db.collection("visits").updateOne(
        { _id: v._id },
        { $set: { prepGeneratedAt: new Date().toISOString(), prepFilePath: filePath } }
      );
    } catch (e) { console.error("visit prep failed:", v._id, e); }
  }
}

function summarizeEvents(events: any[]): string {
  const counts: Record<string, number> = {};
  events.forEach(e => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
  const pairs = Object.entries(counts).map(([k, v]) => `${v} ${k}`);
  return pairs.length ? pairs.join(", ") : "No activity recorded.";
}
