// src/server-routes/geofence.ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router({ mergeParams: true });

const geofenceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(50).max(50000).default(500),
  name: z.string().max(100).trim().default("Home"),
});

function geofenceOut(doc: any) {
  return {
    patientId: doc.patientId,
    lat: doc.lat,
    lng: doc.lng,
    radiusMeters: doc.radiusMeters,
    name: doc.name,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/profiles/:patientId/geofence
router.get("/", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("geofences").findOne({ patientId: req.params.patientId });
    if (!doc) {
      res.status(404).json({ detail: "No geofence set" });
      return;
    }
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("get geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PUT /api/profiles/:patientId/geofence
router.put("/", authMiddleware, requireSeat, async (req, res) => {
  const parsed = geofenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      patientId: req.params.patientId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusMeters: parsed.data.radiusMeters,
      name: parsed.data.name,
      updatedAt: new Date(),
    };
    await db.collection("geofences").replaceOne(
      { patientId: req.params.patientId },
      doc,
      { upsert: true }
    );
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("put geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;

// Patient self-route (no requireSeat — resolves their own patientId)
export const patientGeofenceRouter = Router();

patientGeofenceRouter.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("geofences").findOne({ patientId: (req as any).patientId! });
    if (!doc) {
      res.status(404).json({ detail: "No geofence set" });
      return;
    }
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("get patient geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
