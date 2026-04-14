import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { createReadStream } from "fs";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export const visitCreateSchema = z.object({
  providerName: z.string().min(1).max(200),
  providerRole: z.string().max(100).optional(),
  scheduledFor: z.string(),
  notes: z.string().max(1000).optional(),
});

const router = Router();

router.post("/:patientId/visits", authMiddleware, requireSeat, async (req, res) => {
  const parsed = visitCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const result = await db.collection("visits").insertOne({
      ...parsed.data,
      patientId: req.params.patientId,
      status: "scheduled",
      createdBy: req.seat!.userId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: result.insertedId.toString() });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.get("/:patientId/visits", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const upcoming = await db.collection("visits").find({
      patientId: req.params.patientId, scheduledFor: { $gte: new Date().toISOString() }
    }).sort({ scheduledFor: 1 }).toArray();
    res.json({ visits: upcoming });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.delete("/:patientId/visits/:visitId", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    await db.collection("visits").deleteOne({ _id: new ObjectId(req.params.visitId), patientId: req.params.patientId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.get("/:patientId/visits/:visitId/prep.pdf", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const v = await db.collection("visits").findOne({ _id: new ObjectId(req.params.visitId), patientId: req.params.patientId });
    if (!v?.prepFilePath) { res.status(404).json({ detail: "Visit prep not generated yet" }); return; }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="visit-prep-${v._id}.pdf"`);
    createReadStream(v.prepFilePath).pipe(res);
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
