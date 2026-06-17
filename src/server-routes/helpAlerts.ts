import { Router } from "express";
import { ObjectId, Db } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { notifyCaregiversOfHelp, notifyPatientHelpAcknowledged } from "../server-core/push";

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
    acknowledged_by: doc.acknowledged_by ?? null,
    acknowledged_at: doc.acknowledged_at ?? null,
  };
}

export const createHelpAlertSchema = z.object({
  client_id: z.string().min(1).max(128).optional(),
});

/**
 * Insert a help alert idempotently. When the client supplies a stable client_id
 * (the durable-queue id), a retried POST — e.g. the first response was lost to a
 * cold-start timeout after the server already committed — resolves to the SAME
 * alert instead of inserting a duplicate SOS (SAFE-1). `isNew` tells the caller
 * whether this call actually created the alert, so the caregiver push only fans
 * out once. Relies on the unique partial index on {patient_id, client_id}.
 */
export async function insertHelpAlertIdempotent(
  db: Db,
  patient_id: string,
  clientId?: string
): Promise<{ doc: any; isNew: boolean }> {
  const timestamp = new Date().toISOString();
  if (!clientId) {
    const base = { patient_id, timestamp, dismissed: false };
    const result = await db.collection("help_alerts").insertOne(base);
    return { doc: { ...base, _id: result.insertedId }, isNew: true };
  }
  try {
    const r = await db.collection("help_alerts").updateOne(
      { patient_id, client_id: clientId },
      { $setOnInsert: { patient_id, client_id: clientId, timestamp, dismissed: false } },
      { upsert: true }
    );
    if (r.upsertedId) {
      return { doc: { _id: r.upsertedId, patient_id, client_id: clientId, timestamp, dismissed: false }, isNew: true };
    }
  } catch (err: any) {
    if (err?.code !== 11000) throw err; // not a duplicate-key race — surface it
  }
  // Matched an existing alert (sequential retry) or lost a concurrent insert race.
  const existing = await db.collection("help_alerts").findOne({ patient_id, client_id: clientId });
  return { doc: existing, isNew: false };
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
    const parsed = createHelpAlertSchema.safeParse(req.body ?? {});
    const clientId = parsed.success ? parsed.data.client_id : undefined;

    const { doc, isNew } = await insertHelpAlertIdempotent(db, req.patientId!, clientId);
    res.status(isNew ? 201 : 200).json(alertOut(doc));

    // A retried (idempotent) POST resolves to the existing alert — the care team
    // was already paged, so don't fan out a second push or double-page (SAFE-1).
    if (!isNew) return;

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
      {
        _id: new ObjectId(String(req.params.alertId)),
        patient_id: req.patientId!,
        // Don't move a closed alert back into a "responding" state (audit integrity).
        dismissed: { $ne: true },
        resolved: { $ne: true },
        cancelled: { $ne: true },
      },
      { $set: { acknowledged: true, acknowledged_by: req.auth!.userId, acknowledged_at: new Date().toISOString() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found or already closed" });
      return;
    }
    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    if (!doc) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    res.json(alertOut(doc));

    // Reassure the patient that help is on the way (best-effort, non-blocking).
    (async () => {
      try {
        const responder = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
        await notifyPatientHelpAcknowledged(db, req.patientId!, responder?.name);
      } catch (e) {
        console.error("help-ack patient reassurance push failed (non-fatal):", e);
      }
    })();
  } catch (err) {
    console.error("acknowledge help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
