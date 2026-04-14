import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { generateUniqueLinkCode } from "../server-core/linkCode";

const router = Router();

const patientUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  diagnosis: z.string().max(500).trim().optional().nullable(),
  notes: z.string().max(5000).trim().optional(),
});

const linkSchema = z.object({
  link_code: z.string().min(1).max(20).trim().toUpperCase(),
});

function patientOut(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    age: doc.age ?? null,
    diagnosis: doc.diagnosis ?? null,
    notes: doc.notes ?? "",
    caregiver_id: doc.caregiver_id ?? "",
    caregiver_ids: doc.caregiver_ids ?? [],
    link_code: doc.link_code ?? "",
  };
}

// GET /api/patients/mine
router.get("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    if (!patient) {
      res.status(404).json({ detail: "Patient not found" });
      return;
    }
    res.json(patientOut(patient));
  } catch (err) {
    console.error("get patient error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/patients/mine
router.patch("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = patientUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }

  try {
    const db = getDb();
    const updates: any = {};
    const { name, age, diagnosis, notes } = parsed.data;
    if (name !== undefined) updates.name = name;
    if (age !== undefined) updates.age = age;
    if (diagnosis !== undefined) updates.diagnosis = diagnosis;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    await db.collection("patients").updateOne(
      { _id: new ObjectId(req.patientId!) },
      { $set: { ...updates, updated_at: new Date().toISOString() } }
    );
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    res.json(patientOut(patient));
  } catch (err) {
    console.error("update patient error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/patients/mine/link-code
router.get("/mine/link-code", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    if (!user || user.role !== "patient") {
      res.status(403).json({ detail: "Only patients have a link code" });
      return;
    }
    if (!user.patient_id) {
      res.status(404).json({ detail: "No patient profile found" });
      return;
    }

    let patient = await db.collection("patients").findOne({ _id: new ObjectId(String(user.patient_id)) });
    if (!patient) {
      res.status(404).json({ detail: "Patient not found" });
      return;
    }

    // Auto-heal: generate link code if missing
    if (!patient.link_code) {
      const linkCode = await generateUniqueLinkCode(db);
      await db.collection("patients").updateOne(
        { _id: patient._id },
        { $set: { link_code: linkCode } }
      );
      patient = { ...patient, link_code: linkCode };
    }

    res.json({ link_code: patient.link_code });
  } catch (err) {
    console.error("link-code error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/patients/link
router.post("/link", authMiddleware, async (req, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: "Invalid link code" });
    return;
  }

  try {
    const db = getDb();
    let user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });

    if (!user) {
      const result = await db.collection("users").insertOne({
        supabase_uid: req.auth!.userId,
        email: "",
        name: "",
        role: "caregiver",
        patient_id: null,
        created_at: new Date().toISOString(),
      });
      user = await db.collection("users").findOne({ _id: result.insertedId });
    }

    if (!user || user.role !== "caregiver") {
      res.status(403).json({ detail: "Only caregivers can link to a patient" });
      return;
    }
    if (user.patient_id) {
      res.status(409).json({ detail: "You are already linked to a patient" });
      return;
    }

    const patient = await db.collection("patients").findOne({ link_code: parsed.data.link_code });
    if (!patient) {
      res.status(404).json({ detail: "Invalid link code" });
      return;
    }

    const patientId = String(patient._id);
    const userId = String(user._id);

    await db.collection("patients").updateOne(
      { _id: patient._id },
      { $addToSet: { caregiver_ids: userId } }
    );
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { patient_id: patientId } }
    );

    const updated = await db.collection("patients").findOne({ _id: new ObjectId(patientId) });
    res.json(patientOut(updated));
  } catch (err) {
    console.error("link error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/patients/mine/unlink  — caregiver unlinks from their patient
router.delete("/mine/unlink", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    if (!user || user.role !== "caregiver") {
      res.status(403).json({ detail: "Only caregivers can unlink" });
      return;
    }
    if (!user.patient_id) {
      res.status(404).json({ detail: "Not linked to any patient" });
      return;
    }

    const userId = String(user._id);
    await db.collection("patients").updateOne(
      { _id: new ObjectId(String(user.patient_id)) },
      { $pull: { caregiver_ids: userId } as any }
    );
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { patient_id: null } }
    );

    res.status(204).send();
  } catch (err) {
    console.error("unlink error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/patients/mine/caregivers/:caregiverId  — patient removes a caregiver
router.delete("/mine/caregivers/:caregiverId", authMiddleware, resolvePatientId, async (req, res) => {
  const caregiverId = String(req.params.caregiverId);
  if (!ObjectId.isValid(caregiverId)) {
    res.status(400).json({ detail: "Invalid caregiver ID" });
    return;
  }

  try {
    const db = getDb();

    await db.collection("patients").updateOne(
      { _id: new ObjectId(req.patientId!) },
      { $pull: { caregiver_ids: caregiverId } as any }
    );
    await db.collection("users").updateOne(
      { _id: new ObjectId(caregiverId) },
      { $set: { patient_id: null } }
    );

    res.status(204).send();
  } catch (err) {
    console.error("remove caregiver error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/patients/linked — caregiver's linked patients with summaries
router.get("/linked", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    if (!user) {
      res.status(404).json({ detail: "Profile not found" });
      return;
    }
    if (!user.patient_id) {
      res.json([]);
      return;
    }

    const patient = await db.collection("patients").findOne({ _id: new ObjectId(String(user.patient_id)) });
    if (!patient) {
      res.json([]);
      return;
    }

    const patientId = String(patient._id);
    const todayStr = new Date().toISOString().slice(0, 10);

    const [routines, medications, pendingHelp] = await Promise.all([
      db.collection("routines").find({ patient_id: patientId }).toArray(),
      db.collection("medications").find({ patient_id: patientId }).toArray(),
      db.collection("help_alerts").countDocuments({ patient_id: patientId, dismissed: false }),
    ]);

    res.json([{
      id: patientId,
      name: patient.name ?? "Unknown",
      tasksTotal: routines.length,
      tasksDone: routines.filter((r: any) => r.completed_date === todayStr).length,
      medsTotal: medications.length,
      medsDone: medications.filter((m: any) => m.taken_date === todayStr).length,
      pendingHelp,
    }]);
  } catch (err) {
    console.error("linked patients error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
