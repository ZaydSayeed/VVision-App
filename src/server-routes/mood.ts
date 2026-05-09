import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const VALID_MOODS = ["happy", "tired", "confused", "sad"] as const;
type Mood = typeof VALID_MOODS[number];

const createSchema = z.object({
  mood: z.enum(VALID_MOODS),
});

function moodOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    mood: doc.mood as Mood,
    date: doc.date,
    created_at: doc.created_at,
  };
}

// POST /api/mood — submit today's mood (once per day)
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.collection("mood_checkins").findOne({
      patient_id: req.patientId!,
      date: today,
    });
    if (existing) {
      res.status(409).json({ detail: "Mood already submitted today" });
      return;
    }
    const doc = {
      patient_id: req.patientId!,
      mood: parsed.data.mood,
      date: today,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("mood_checkins").insertOne(doc);
    res.status(201).json(moodOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create mood error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/mood — get last 7 days of mood entries
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const docs = await db
      .collection("mood_checkins")
      .find({ patient_id: req.patientId!, date: { $gte: sevenDaysAgoStr } })
      .sort({ date: -1 })
      .limit(7)
      .toArray();
    res.json(docs.map(moodOut));
  } catch (err) {
    console.error("get mood error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
