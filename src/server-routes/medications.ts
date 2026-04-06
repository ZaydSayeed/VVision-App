import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, "Name required").max(200).trim(),
  dosage: z.string().min(1, "Dosage required").max(100).trim(),
  time: z.string().min(1, "Time required").max(50).trim(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  dosage: z.string().min(1).max(100).trim().optional(),
  time: z.string().min(1).max(50).trim().optional(),
  taken_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

function medOut(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    dosage: doc.dosage,
    time: doc.time,
    taken_date: doc.taken_date ?? null,
    patient_id: String(doc.patient_id),
  };
}

// GET /api/medications
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("medications")
      .find({ patient_id: req.patientId! })
      .limit(200)
      .toArray();
    res.json(docs.map(medOut));
  } catch (err) {
    console.error("list medications error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/medications
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      name: parsed.data.name,
      dosage: parsed.data.dosage,
      time: parsed.data.time,
      taken_date: null,
      patient_id: req.patientId!,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("medications").insertOne(doc);
    res.status(201).json(medOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create medication error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/medications/:medId
router.patch("/:medId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.medId))) {
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
    const { name, dosage, time, taken_date } = parsed.data;
    if (name !== undefined) updates.name = name;
    if (dosage !== undefined) updates.dosage = dosage;
    if (time !== undefined) updates.time = time;
    if (taken_date !== undefined) updates.taken_date = taken_date;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    const result = await db.collection("medications").updateOne(
      { _id: new ObjectId(String(req.params.medId)), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Medication not found" });
      return;
    }

    const doc = await db.collection("medications").findOne({ _id: new ObjectId(String(req.params.medId)) });
    if (!doc) {
      res.status(404).json({ detail: "Medication not found" });
      return;
    }
    res.json(medOut(doc));
  } catch (err) {
    console.error("update medication error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/medications/:medId
router.delete("/:medId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.medId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("medications").deleteOne({
      _id: new ObjectId(String(req.params.medId)),
      patient_id: req.patientId!,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Medication not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("delete medication error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
