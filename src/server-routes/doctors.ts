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
  if (!ObjectId.isValid(String(req.params.doctorId))) { res.status(400).json({ detail: "Invalid id" }); return; }
  try {
    const db = getDb();
    await db.collection("doctors").deleteOne({
      _id: new ObjectId(String(req.params.doctorId)),
      patientId: req.params.patientId,
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("delete doctor error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
