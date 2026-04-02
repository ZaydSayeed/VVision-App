import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

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
  try {
    const db = getDb();
    const { name, age, diagnosis, notes } = req.body;
    const updates: any = {};
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
      { $set: updates }
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

    const patient = await db.collection("patients").findOne({ _id: new ObjectId(String(user.patient_id)) });
    if (!patient) {
      res.status(404).json({ detail: "Patient not found" });
      return;
    }

    res.json({ link_code: patient.link_code || "" });
  } catch (err) {
    console.error("link-code error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/patients/link
router.post("/link", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    let user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });

    // Auto-create user doc if missing (e.g. signed up before backend sync was working)
    if (!user) {
      const result = await db.collection("users").insertOne({
        supabase_uid: req.auth!.userId,
        email: "",
        name: "",
        role: "caregiver",
        patient_id: null,
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

    const code = (req.body.link_code || "").trim().toUpperCase();
    const patient = await db.collection("patients").findOne({ link_code: code });
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

    const [routines, medications] = await Promise.all([
      db.collection("routines").find({ patient_id: patientId }).toArray(),
      db.collection("medications").find({ patient_id: patientId }).toArray(),
    ]);

    res.json([{
      id: patientId,
      name: patient.name ?? "Unknown",
      tasksTotal: routines.length,
      tasksDone: routines.filter((r: any) => r.completed_date === todayStr).length,
      medsTotal: medications.length,
      medsDone: medications.filter((m: any) => m.taken_date === todayStr).length,
    }]);
  } catch (err) {
    console.error("linked patients error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
