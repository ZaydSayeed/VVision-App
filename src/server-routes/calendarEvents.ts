import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";
import { expandOccurrences } from "../server-core/recurrence";

export const calendarEventCategory = z.enum(["medical", "medication", "social", "personal"]);

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  category: calendarEventCategory,
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().max(1000).optional(),
  recurrenceRule: z.string().max(500).optional(),
});

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial();

const router = Router();

router.post("/:patientId/calendar-events", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = calendarEventCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const result = await db.collection("calendar_events").insertOne({
      ...parsed.data,
      patientId: req.params.patientId,
      recurrenceRule: parsed.data.recurrenceRule ?? null,
      notes: parsed.data.notes ?? null,
      createdBy: req.seat!.userId,
      completedDates: [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: result.insertedId.toString() });
  } catch (err) {
    console.error("calendar-events create error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:patientId/calendar-events", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const db = getDb();
    const from = String(req.query.from ?? new Date().toISOString());
    const to = String(req.query.to ?? new Date(Date.now() + 7 * 86_400_000).toISOString());

    if (Number.isNaN(new Date(from).getTime()) || Number.isNaN(new Date(to).getTime())) {
      res.status(400).json({ detail: "Invalid from/to date" });
      return;
    }

    const docs = await db.collection("calendar_events").find({ patientId: req.params.patientId }).toArray();

    const events = docs.flatMap((doc: any) => {
      const occurrences = expandOccurrences(doc.startAt, doc.recurrenceRule, from, to);
      const durationMs = new Date(doc.endAt).getTime() - new Date(doc.startAt).getTime();
      return occurrences.map((occurrenceAt) => {
        const dateKey = occurrenceAt.slice(0, 10);
        return {
          id: doc._id.toString(),
          title: doc.title,
          category: doc.category,
          occurrenceAt,
          endAt: new Date(new Date(occurrenceAt).getTime() + durationMs).toISOString(),
          notes: doc.notes ?? null,
          recurrenceRule: doc.recurrenceRule ?? null,
          createdBy: doc.createdBy,
          completed: (doc.completedDates ?? []).includes(dateKey),
        };
      });
    });

    events.sort((a, b) => a.occurrenceAt.localeCompare(b.occurrenceAt));
    res.json({ events });
  } catch (err) {
    console.error("calendar-events list error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.patch("/:patientId/calendar-events/:id", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = calendarEventUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  const id = req.params.id;
  if (typeof id !== "string" || !ObjectId.isValid(id)) { res.status(404).json({ detail: "Event not found" }); return; }
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(id),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }
    if (doc.createdBy !== req.seat!.userId) { res.status(403).json({ detail: "Only the creator can edit this event" }); return; }

    await db.collection("calendar_events").updateOne(
      { _id: doc._id },
      { $set: parsed.data }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events update error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.delete("/:patientId/calendar-events/:id", authMiddleware, requirePatientAccess, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || !ObjectId.isValid(id)) { res.status(404).json({ detail: "Event not found" }); return; }
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(id),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }
    if (doc.createdBy !== req.seat!.userId) { res.status(403).json({ detail: "Only the creator can delete this event" }); return; }

    await db.collection("calendar_events").deleteOne({ _id: doc._id });
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events delete error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

const completeSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

router.post("/:patientId/calendar-events/:id/complete", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  const id = req.params.id;
  if (typeof id !== "string" || !ObjectId.isValid(id)) { res.status(404).json({ detail: "Event not found" }); return; }
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(id),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }

    await db.collection("calendar_events").updateOne(
      { _id: doc._id },
      { $addToSet: { completedDates: parsed.data.date } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events complete error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
