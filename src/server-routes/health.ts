import { Router, Request, Response } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const METRICS = ["steps", "heart_rate", "active_minutes", "sleep"] as const;
export type Metric = typeof METRICS[number];

const readingSchema = z.object({
  metric: z.enum(METRICS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().min(0),
  unit: z.string().min(1).max(16),
});

export const syncSchema = z.object({
  readings: z.array(readingSchema).min(1).max(500),
});

const router = Router();

router.post("/:patientId/health/sync", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const now = new Date();
    const ops = parsed.data.readings.map((r) => ({
      updateOne: {
        filter: { patientId, metric: r.metric, date: r.date },
        update: {
          $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now },
          $setOnInsert: { patientId, metric: r.metric, date: r.date },
        },
        upsert: true,
      },
    }));
    const result = await col.bulkWrite(ops, { ordered: false });
    res.json({ written: result.upsertedCount + result.modifiedCount });
  } catch (err) {
    console.error("[health/sync]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get("/:patientId/health/summary", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const today = todayIso();
    const rows = await col.find({ patientId, date: today }).toArray();
    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of rows) byMetric[r.metric] = { value: r.value, unit: r.unit };
    res.json({
      date: today,
      steps: byMetric.steps ?? null,
      heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null,
      sleep: byMetric.sleep ?? null,
    });
  } catch (err) {
    console.error("[health/summary]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export const trendsQuerySchema = z.object({
  metric: z.enum(METRICS),
  range: z.enum(["1d", "7d", "30d", "90d"]).default("7d"),
});

router.get("/:patientId/health/trends", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = trendsQuerySchema.safeParse({
    metric: req.query.metric,
    range: req.query.range,
  });
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[parsed.data.range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);
    const rows = await col
      .find({ patientId, metric: parsed.data.metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric: parsed.data.metric,
      range: parsed.data.range,
      points: rows.map((r) => ({ date: r.date, value: r.value })),
    });
  } catch (err) {
    console.error("[health/trends]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
