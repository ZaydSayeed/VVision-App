import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

const STEPS = ["profile_basics", "profile_story", "siblings", "smart_home", "caller_setup", "paywall"] as const;
export const onboardingProgressSchema = z.object(
  Object.fromEntries(STEPS.map(s => [s, z.boolean().optional()])) as Record<typeof STEPS[number], z.ZodOptional<z.ZodBoolean>>
).strict();

const router = Router();

router.get("/:patientId/onboarding", authMiddleware, requireSeat, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patientId" }); return;
  }
  try {
    const db = getDb();
    const row = await db.collection("onboarding_progress").findOne({ patientId: req.params.patientId as string });
    res.json({ progress: row?.progress ?? {}, completedAt: row?.completedAt ?? null });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.patch("/:patientId/onboarding", authMiddleware, requireSeat, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.patientId))) {
    res.status(400).json({ detail: "Invalid patientId" }); return;
  }
  const parsed = onboardingProgressSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const existing = await db.collection("onboarding_progress").findOne({ patientId: req.params.patientId as string });
    const merged = { ...existing?.progress, ...parsed.data };
    const allDone = STEPS.every((s) => (merged as any)[s]);
    const completedAt = allDone ? new Date().toISOString() : null;
    await db.collection("onboarding_progress").updateOne(
      { patientId: req.params.patientId as string },
      { $set: { patientId: req.params.patientId as string, progress: merged, completedAt } },
      { upsert: true }
    );
    res.json({ progress: merged, completedAt });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
