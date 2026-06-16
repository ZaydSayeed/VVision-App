import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { notifyCaregiversOfHelp } from "../server-core/push";

const router = Router();

export function alertOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    timestamp: doc.timestamp,
    dismissed: doc.dismissed ?? false,
    cancelled: doc.cancelled ?? false,
    resolved: doc.resolved ?? false,
    note: doc.note ?? null,
    cause: doc.cause ?? null,
    resolved_at: doc.resolved_at ?? null,
    acknowledged: doc.acknowledged ?? false,
    acknowledged_at: doc.acknowledged_at ?? null,
  };
}

// GET /api/help-alerts
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("help_alerts")
      .find({ patient_id: req.patientId! })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json(docs.map(alertOut));
  } catch (err) {
    console.error("list help alerts error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/help-alerts
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const doc = {
      patient_id: req.patientId!,
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    const result = await db.collection("help_alerts").insertOne(doc);
    res.status(201).json(alertOut({ ...doc, _id: result.insertedId }));

    // Fan out a high-priority push to every caregiver. Best-effort and
    // non-blocking: the alert is already persisted (the patient's ack), so a
    // slow/failed push must never delay or fail the response (SAFE-1, NOTIF-1).
    (async () => {
      try {
        const patient = ObjectId.isValid(req.patientId!)
          ? await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) })
          : null;
        const name = patient?.name ?? "Your patient";
        await notifyCaregiversOfHelp(db, req.patientId!, name);
      } catch (err) {
        console.error("help-alert caregiver push failed (non-fatal):", err);
      }
    })();
  } catch (err) {
    console.error("create help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/help-alerts/:alertId/dismiss
router.patch("/:alertId/dismiss", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.alertId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(String(req.params.alertId)), patient_id: req.patientId! },
      { $set: { dismissed: true, cancelled: true } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }

    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    if (!doc) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    res.json(alertOut(doc));
  } catch (err) {
    console.error("dismiss help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

const VALID_CAUSES = ["Confusion", "Pain", "Anxiety", "Fell", "Wandered", "Sundowning", "Other"] as const;

const resolveSchema = z.object({
  note: z.string().max(500).trim().optional(),
  cause: z.enum(VALID_CAUSES),
});

// PATCH /api/help-alerts/:alertId/resolve
router.patch("/:alertId/resolve", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.alertId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const updates: any = {
      dismissed: true,
      resolved: true,
      cause: parsed.data.cause,
      resolved_at: new Date().toISOString(),
    };
    if (parsed.data.note) updates.note = parsed.data.note;

    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(String(req.params.alertId)), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    if (!doc) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    res.json(alertOut(doc));
  } catch (err) {
    console.error("resolve help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/help-alerts/:alertId/acknowledge — a caregiver is responding now.
// Records who/when WITHOUT resolving, so the alert stays open for the audit trail
// and future escalation logic can stop re-paging once someone has responded (CG-8).
router.patch("/:alertId/acknowledge", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.alertId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(String(req.params.alertId)), patient_id: req.patientId! },
      { $set: { acknowledged: true, acknowledged_by: req.auth!.userId, acknowledged_at: new Date().toISOString() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    res.json(alertOut(doc));
  } catch (err) {
    console.error("acknowledge help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
