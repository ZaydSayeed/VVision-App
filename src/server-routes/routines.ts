import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  label: z.string().min(1, "Label required").max(300).trim(),
  time: z.string().min(1, "Time required").max(50).trim(),
  notes: z.string().max(1000).trim().optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(300).trim().optional(),
  time: z.string().min(1).max(50).trim().optional(),
  completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).trim().nullable().optional(),
});

function routineOut(doc: any) {
  return {
    id: String(doc._id),
    label: doc.label,
    time: doc.time,
    completed_date: doc.completed_date ?? null,
    notes: doc.notes ?? null,
    patient_id: String(doc.patient_id),
  };
}

// GET /api/routines
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("routines")
      .find({ patient_id: req.patientId! })
      .limit(200)
      .toArray();
    res.json(docs.map(routineOut));
  } catch (err) {
    console.error("list routines error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/routines
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      label: parsed.data.label,
      time: parsed.data.time,
      completed_date: null,
      patient_id: req.patientId!,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("routines").insertOne(doc);
    res.status(201).json(routineOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create routine error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/routines/:routineId
router.patch("/:routineId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.routineId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const updates: any = {};
    const { label, time, completed_date, notes } = parsed.data;
    if (label !== undefined) updates.label = label;
    if (time !== undefined) updates.time = time;
    if (completed_date !== undefined) updates.completed_date = completed_date;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    const result = await db.collection("routines").updateOne(
      { _id: new ObjectId(String(req.params.routineId)), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Routine not found" });
      return;
    }

    const doc = await db.collection("routines").findOne({ _id: new ObjectId(String(req.params.routineId)) });
    if (!doc) {
      res.status(404).json({ detail: "Routine not found" });
      return;
    }
    res.json(routineOut(doc));
  } catch (err) {
    console.error("update routine error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/routines/:routineId
router.delete("/:routineId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.routineId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("routines").deleteOne({
      _id: new ObjectId(String(req.params.routineId)),
      patient_id: req.patientId!,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Routine not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("delete routine error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
