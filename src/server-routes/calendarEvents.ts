import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const calendarEventCategory = z.enum(["medical", "medication", "social", "personal"]);

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  category: calendarEventCategory,
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().max(1000).optional(),
  recurrenceRule: z.string().max(500).optional(),
});

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

export default router;
