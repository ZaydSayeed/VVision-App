import { Router, Request, Response } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";
import { getConsent, hasConsent } from "../server-core/consent";

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

    // Don't store health data without recorded consent (opt-in, EMO-1/ASR-4).
    const consent = await getConsent(db, patientId);
    if (!hasConsent(consent, "healthMetrics")) {
      res.json({ written: 0, consent: false });
      return;
    }

    const now = new Date();
    const ops = parsed.data.readings.map((r) => {
      if (r.metric === "heart_rate") {
        if (!r.recordedAt) {
          console.warn(`[health/sync] skipping heart_rate reading without recordedAt for patient ${patientId}`);
          return null;
        }
        return {
          updateOne: {
            filter: { patientId, metric: "heart_rate", recordedAt: r.recordedAt },
            update: {
              $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now, date: r.date },
              $setOnInsert: { patientId, metric: "heart_rate", recordedAt: r.recordedAt },
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
    }).filter((op): op is NonNullable<typeof op> => op !== null);

    if (ops.length === 0) { res.json({ written: 0 }); return; }

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

export function fillDailyGaps(
  sinceIso: string,
  anchorDate: string,
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const result: { date: string; value: number }[] = [];
  const cursor = new Date(sinceIso + "T12:00:00Z");
  const end = new Date(anchorDate + "T12:00:00Z");
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push({ date: iso, value: byDate.get(iso) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function fillHourlyGaps(
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  const byHour = new Map(points.map((p) => [p.date, p.value]));
  return Array.from({ length: 24 }, (_, h) => {
    const key = `${String(h).padStart(2, "0")}:00`;
    return { date: key, value: byHour.get(key) ?? 0 };
  });
}

export function aggregateByWeek(
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  if (points.length === 0) return [];
  const byWeek = new Map<string, number[]>();
  for (const p of points) {
    const d = new Date(p.date + "T12:00:00Z");
    const dow = d.getUTCDay(); // 0=Sun
    d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // back to Monday
    const monday = d.toISOString().slice(0, 10);
    if (!byWeek.has(monday)) byWeek.set(monday, []);
    byWeek.get(monday)!.push(p.value);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));
}

router.get("/:patientId/health/summary", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    // Prefer client-supplied local date to avoid UTC day-boundary mismatch
    const dateParam = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayIso();
    const today = dateParam;
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

const trendsWithDateSchema = trendsQuerySchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get("/:patientId/health/trends", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = trendsWithDateSchema.safeParse({
    metric: req.query.metric,
    range: req.query.range,
    date: req.query.date,
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
    // Use client-supplied local date as anchor to avoid UTC day-boundary mismatch
    const anchorDate = parsed.data.date ?? todayIso();
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range];
    const anchor = new Date(anchorDate + "T12:00:00Z");
    anchor.setUTCDate(anchor.getUTCDate() - days + 1);
    const sinceIso = anchor.toISOString().slice(0, 10);

    if (metric === "heart_rate" && range === "1d") {
      const todayIsoStr = anchorDate;
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
      const rawPoints = Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({
          date: `${String(h).padStart(2, "0")}:00`,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points: rawPoints });
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
      const dailyPoints = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points: range === "90d" ? aggregateByWeek(dailyPoints) : dailyPoints });
      return;
    }

    const rows = await col
      .find({ patientId, metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    const dailyPoints = rows.map((r) => ({ date: r.date as string, value: r.value as number }));
    res.json({ metric, range, points: range === "90d" ? aggregateByWeek(dailyPoints) : dailyPoints });
  } catch (err) {
    console.error("[health/trends]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
