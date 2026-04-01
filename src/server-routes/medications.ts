import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

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
  try {
    const db = getDb();
    const doc = {
      name: req.body.name,
      dosage: req.body.dosage,
      time: req.body.time,
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
  try {
    const db = getDb();
    const { name, dosage, time, taken_date } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (dosage !== undefined) updates.dosage = dosage;
    if (time !== undefined) updates.time = time;
    if (taken_date !== undefined) updates.taken_date = taken_date;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    const result = await db.collection("medications").updateOne(
      { _id: new ObjectId(req.params.medId as string), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Medication not found" });
      return;
    }

    const doc = await db.collection("medications").findOne({ _id: new ObjectId(req.params.medId as string) });
    res.json(medOut(doc));
  } catch (err) {
    console.error("update medication error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/medications/:medId
router.delete("/:medId", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("medications").deleteOne({
      _id: new ObjectId(req.params.medId as string),
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
