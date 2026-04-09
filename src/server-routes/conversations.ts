import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000).trim(),
});

function convOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    role: doc.role,
    content: doc.content,
    created_at: doc.created_at,
  };
}

// GET /api/conversations — last 20 for the patient
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("conversations")
      .find({ patient_id: req.patientId! })
      .sort({ created_at: 1 })
      .limit(20)
      .toArray();
    res.json(docs.map(convOut));
  } catch (err) {
    console.error("list conversations error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/conversations — save a turn, prune to max 20
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      patient_id: req.patientId!,
      role: parsed.data.role,
      content: parsed.data.content,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("conversations").insertOne(doc);

    // Prune oldest if count exceeds 20
    const count = await db
      .collection("conversations")
      .countDocuments({ patient_id: req.patientId! });
    if (count > 20) {
      const oldest = await db
        .collection("conversations")
        .find({ patient_id: req.patientId! })
        .sort({ created_at: 1 })
        .limit(count - 20)
        .toArray();
      const ids = oldest.map((d) => d._id);
      await db.collection("conversations").deleteMany({ _id: { $in: ids } });
    }

    res.status(201).json(convOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create conversation error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
