import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

function alertOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    timestamp: doc.timestamp,
    dismissed: doc.dismissed ?? false,
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
  } catch (err) {
    console.error("create help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/help-alerts/:alertId/dismiss
router.patch("/:alertId/dismiss", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(req.params.alertId as string), patient_id: req.patientId! },
      { $set: { dismissed: true } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }

    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(req.params.alertId as string) });
    res.json(alertOut(doc));
  } catch (err) {
    console.error("dismiss help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
