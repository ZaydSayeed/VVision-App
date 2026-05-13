import { Router, Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

function deviceTokenAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.DVISION_PATIENT_TOKEN;
  const provided = req.headers.authorization?.replace("Bearer ", "");
  if (!expected || provided !== expected) {
    res.status(401).json({ detail: "Invalid device token" });
    return;
  }
  next();
}

const alertSchema = z.object({
  patient_id: z.string().min(1),
  type: z.string().min(1),
  message: z.string().min(1),
  priority: z.number().int().min(1).max(4),
});

export const deviceCodeSchema = z.object({
  device_code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9-]+$/, "device_code must be uppercase alphanumeric with optional dashes"),
});

const router = Router();

router.get("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    const link = await db.collection("device_links").findOne(
      { patient_id: req.params.patientId },
      { projection: { device_code: 1, linked_at: 1, _id: 0 } }
    );
    res.json(link ?? null);
  } catch (err) {
    console.error("device get-link error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.post("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  const parsed = deviceCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const now = new Date().toISOString();
    await db.collection("device_links").updateOne(
      { patient_id: req.params.patientId },
      { $set: { device_code: parsed.data.device_code, patient_id: req.params.patientId, linked_at: now } },
      { upsert: true }
    );
    res.json({ device_code: parsed.data.device_code, linked_at: now });
  } catch (err) {
    console.error("device link error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.delete("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    await db.collection("device_links").deleteOne({ patient_id: req.params.patientId });
    res.status(204).end();
  } catch (err) {
    console.error("device unlink error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:patientId/stage-observations/latest", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    const obs = await db
      .collection("stage_observations")
      .find({ patient_id: req.params.patientId })
      .sort({ observed_at: -1 })
      .limit(1)
      .toArray();
    res.json(obs[0] ? { ...obs[0], _id: String(obs[0]._id) } : null);
  } catch (err) {
    console.error("device stage-obs error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/device/alert — called by glasses hardware to push an alert to the caregiver
router.post("/alert", deviceTokenAuth, async (req: Request, res: Response) => {
  const parsed = alertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }

  const { patient_id, type, message, priority } = parsed.data;

  try {
    const db = getDb();
    const now = new Date().toISOString();

    await db.collection("caregiver_alerts").insertOne({
      patient_id,
      type,
      message,
      priority,
      timestamp: now,
      source: "glasses",
    });

    const tokenDoc = await db.collection("pushTokens").findOne({ patientId: patient_id });
    if (tokenDoc?.expoPushToken) {
      const title = priority >= 4 ? "🚨 Urgent Alert" : "⚠️ Alert";
      await fetch("https://exp.host/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: tokenDoc.expoPushToken,
          title,
          body: message,
          data: { type, patient_id, priority },
          priority: priority >= 3 ? "high" : "normal",
          sound: priority >= 4 ? "default" : undefined,
        }),
      });
    }

    res.status(202).json({ ok: true });
  } catch (err) {
    console.error("device alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
