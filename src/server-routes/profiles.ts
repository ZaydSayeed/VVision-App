import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const stageEnum = z.enum(["mild", "moderate", "severe"]);

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().max(100),
  schedule: z.string().max(200),
  prescriber: z.string().max(200).optional(),
});

const providerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100),
  phone: z.string().max(40).optional(),
});

export const profileUpdateSchema = z.object({
  stage: stageEnum.optional(),
  history: z.string().max(5000).optional(),
  triggers: z.array(z.string().max(200)).max(50).optional(),
  routines_summary: z.string().max(5000).optional(),
  medications: z.array(medicationSchema).max(50).optional(),
  providers: z.array(providerSchema).max(20).optional(),
});

function profileOut(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    age: doc.age ?? null,
    diagnosis: doc.diagnosis ?? null,
    stage: doc.stage ?? null,
    history: doc.history ?? "",
    triggers: doc.triggers ?? [],
    routines_summary: doc.routines_summary ?? "",
    medications: doc.medications ?? [],
    providers: doc.providers ?? [],
    notes: doc.notes ?? "",
    caregiver_ids: doc.caregiver_ids ?? [],
  };
}

const router = Router();

// GET /api/profiles/mine — full profile for current user's linked patient
router.get("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    if (!patient) { res.status(404).json({ detail: "Profile not found" }); return; }
    res.json(profileOut(patient));
  } catch (err) {
    console.error("get profile error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/profiles/mine — update profile fields
router.patch("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const updates: any = { ...parsed.data, updated_at: new Date().toISOString() };
    await db.collection("patients").updateOne(
      { _id: new ObjectId(req.patientId!) },
      { $set: updates }
    );
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    res.json(profileOut(patient));
  } catch (err) {
    console.error("update profile error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
