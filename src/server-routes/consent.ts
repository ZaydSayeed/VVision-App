import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";
import { getConsent, saveConsent, applyConsentUpdate } from "../server-core/consent";

const router = Router();

const patchSchema = z
  .object({
    healthMetrics: z.boolean().optional(),
    activityPatterns: z.boolean().optional(),
    aiAssistant: z.boolean().optional(),
  })
  .refine(
    (d) => d.healthMetrics !== undefined || d.activityPatterns !== undefined || d.aiAssistant !== undefined,
    { message: "Provide at least one consent category" }
  );

// GET /api/profiles/:patientId/consent — patient or a caregiver with access.
router.get("/:patientId/consent", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const consent = await getConsent(getDb(), String(req.params.patientId));
    res.json(consent);
  } catch (err) {
    console.error("get consent error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/profiles/:patientId/consent — toggle a category; records who/when.
router.patch("/:patientId/consent", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const patientId = String(req.params.patientId);
    const requester = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    const isPatient = requester?.role === "patient" && String(requester?.patient_id) === patientId;

    // Changing consent is a regulated PHI data-sharing decision: these flags gate
    // HealthKit collection (health.ts), behavioral-biomarker storage (events.ts),
    // and third-party Mem0 sharing (memories.ts). Restrict the WRITE to the patient
    // or their PRIMARY caregiver — not sibling/paid_aide/clinician seats or stale
    // caregiver_ids links. (GET stays open to anyone with access.)
    const primarySeat = await db.collection("seats").findOne({
      userId: req.auth!.userId,
      patientId,
      role: "primary_caregiver",
    });
    if (!isPatient && !primarySeat) {
      res.status(403).json({ detail: "Only the patient or primary caregiver can change consent" });
      return;
    }

    const role = isPatient ? "patient" : "primary_caregiver";

    const current = await getConsent(db, patientId);
    const next = applyConsentUpdate(
      current,
      parsed.data,
      { userId: req.auth!.userId, role },
      new Date().toISOString()
    );
    await saveConsent(db, patientId, next);
    res.json(next);
  } catch (err) {
    console.error("update consent error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
