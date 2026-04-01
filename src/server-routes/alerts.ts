import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// GET /api/alerts
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("alerts")
      .find({ patient_id: req.patientId! })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    res.json(
      docs.map((d) => ({
        id: String(d._id),
        type: d.type || "unknown_face",
        timestamp: d.timestamp || "",
        patient_id: String(d.patient_id || req.patientId),
      }))
    );
  } catch (err) {
    console.error("list alerts error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/alerts/:alertId
router.delete("/:alertId", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("alerts").deleteOne({ _id: new ObjectId(req.params.alertId as string), patient_id: req.patientId! });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Alert not found" });
      return;
    }
    res.json({ status: "ok" });
  } catch (err) {
    console.error("dismiss alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
