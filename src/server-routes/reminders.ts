import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  text: z.string().min(1, "Text required").max(500).trim(),
  time: z.string().max(50).trim().optional(),
  recurrence: z.string().max(100).trim().optional(),
  source: z.enum(["glasses", "app"]).default("app"),
});

function reminderOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    text: doc.text,
    time: doc.time ?? null,
    recurrence: doc.recurrence ?? null,
    source: doc.source,
    created_at: doc.created_at,
    completed_date: doc.completed_date ?? null,
  };
}

// GET /api/reminders
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("reminders")
      .find({ patient_id: req.patientId! })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    res.json(docs.map(reminderOut));
  } catch (err) {
    console.error("list reminders error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/reminders
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
      text: parsed.data.text,
      time: parsed.data.time ?? null,
      recurrence: parsed.data.recurrence ?? null,
      source: parsed.data.source,
      created_at: new Date().toISOString(),
      completed_date: null,
    };
    const result = await db.collection("reminders").insertOne(doc);
    res.status(201).json(reminderOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create reminder error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.id))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("reminders").deleteOne({
      _id: new ObjectId(String(req.params.id)),
      patient_id: req.patientId!,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Reminder not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("delete reminder error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
