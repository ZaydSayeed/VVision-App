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
  recordedAt: z.string().optional(),
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
    const ops = parsed.data.readings.map((r) => {
      if (r.metric === "heart_rate") {
        const recordedAt = r.recordedAt ?? `${r.date}T00:00:00.000Z`;
        return {
          updateOne: {
            filter: { patientId, metric: "heart_rate", recordedAt },
            update: {
              $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now, date: r.date },
              $setOnInsert: { patientId, metric: "heart_rate", recordedAt },
            },
            upsert: true,
          },
        };
      }
      return {
        updateOne: {
          filter: { patientId, metric: r.metric, date: r.date },
          update: {
            $max: { value: r.value },
            $set: { unit: r.unit, source: "healthkit", syncedAt: now },
            $setOnInsert: { patientId, metric: r.metric, date: r.date },
          },
          upsert: true,
        },
      };
    });
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
    const [nonHrRows, hrRows] = await Promise.all([
      col.find({ patientId, metric: { $ne: "heart_rate" }, date: today }).toArray(),
      col.find({ patientId, metric: "heart_rate", date: today }).toArray(),
    ]);
    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of nonHrRows) byMetric[r.metric] = { value: r.value, unit: r.unit };
    if (hrRows.length > 0) {
      const avg = Math.round(hrRows.reduce((sum, r) => sum + r.value, 0) / hrRows.length);
      byMetric.heart_rate = { value: avg, unit: "bpm" };
    }
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
    const { metric, range } = parsed.data;
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);

    if (metric === "heart_rate" && range === "1d") {
      const todayIsoStr = todayIso();
      const rows = await col
        .find({ patientId, metric: "heart_rate", date: todayIsoStr })
        .sort({ recordedAt: 1 })
        .toArray();
      const byHour = new Map<number, number[]>();
      for (const r of rows) {
        const h = r.recordedAt ? new Date(r.recordedAt as string).getHours() : 0;
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(r.value as number);
      }
      const points = Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({
          date: `${String(h).padStart(2, "0")}:00`,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
    }

    if (metric === "heart_rate") {
      const rows = await col
        .find({ patientId, metric: "heart_rate", date: { $gte: sinceIso } })
        .sort({ date: 1, recordedAt: 1 })
        .toArray();
      const byDate = new Map<string, number[]>();
      for (const r of rows) {
        const d = r.date as string;
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(r.value as number);
      }
      const points = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
    }

    const rows = await col
      .find({ patientId, metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric,
      range,
      points: rows.map((r) => ({ date: r.date as string, value: r.value as number })),
    });
  } catch (err) {
    console.error("[health/trends]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
