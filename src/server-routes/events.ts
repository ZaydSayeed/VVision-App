import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

const eventKind = z.enum([
  "motion", "door", "presence", "sleep",
  "gait", "typing_cadence", "voice_sample",
]);

const eventSchema = z.object({
  kind: eventKind,
  capturedAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

const router = Router();

router.post("/:patientId/events", authMiddleware, requireSeat, async (req, res) => {
  const parsed = eventBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const docs = parsed.data.events.map(e => ({
      patientId: req.params.patientId,
      kind: e.kind,
      capturedAt: e.capturedAt,
      data: e.data,
      authorUserId: req.seat!.userId,
      receivedAt: now,
    }));
    await db.collection("profile_events").insertMany(docs);
    res.status(201).json({ ok: true, inserted: docs.length });
  } catch (err: any) {
    console.error("events write error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:patientId/events", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const since = (req.query.since as string) || new Date(Date.now() - 24 * 3600_000).toISOString();
    const kind = req.query.kind as string | undefined;
    const filter: any = { patientId: req.params.patientId, capturedAt: { $gte: since } };
    if (kind) filter.kind = kind;
    const events = await db.collection("profile_events").find(filter).limit(500).sort({ capturedAt: -1 }).toArray();
    res.json({ events });
  } catch (err) {
    console.error("events read error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
