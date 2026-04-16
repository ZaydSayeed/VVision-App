import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const patternSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1),
  firstObserved: z.string(),
  lastObserved: z.string(),
  tags: z.array(z.string().max(60)).max(10),
});

const router = Router();

router.get("/:patientId/patterns", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.collection("patterns").find({ patientId: req.params.patientId })
      .sort({ confidence: -1, lastObserved: -1 }).limit(20).toArray();
    res.json({ patterns: rows });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

// Caregivers can dismiss a pattern
router.post("/:patientId/patterns/:patternId/dismiss", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    const db = getDb();
    await db.collection("patterns").updateOne(
      { _id: new ObjectId(req.params.patternId), patientId: req.params.patientId },
      { $set: { dismissedAt: new Date().toISOString(), dismissedBy: req.seat!.userId } }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
