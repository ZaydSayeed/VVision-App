import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export type Tier = "free" | "starter" | "unlimited";
const STARTER_SEAT_CAP = 2;

export function enforceSeatLimit(tier: Tier, existingSeats: number): boolean {
  if (tier === "unlimited") return true;
  if (tier === "starter") return existingSeats < STARTER_SEAT_CAP;
  return false;
}

async function loadTier(patientId: string): Promise<Tier> {
  const db = getDb();
  const sub = await db.collection("subscriptions").findOne({ patientId, status: "active" });
  if (!sub) return "free";
  if (sub.tier === "unlimited" || sub.tier === "starter") return sub.tier;
  return "free";
}

const router = Router();

router.get("/:patientId/subscription", authMiddleware, requireSeat, async (req, res) => {
  try {
    const tier = await loadTier(req.params.patientId);
    const db = getDb();
    const seatCount = await db.collection("seats").countDocuments({ patientId: req.params.patientId });
    res.json({
      tier,
      seatCount,
      seatLimit: tier === "unlimited" ? null : STARTER_SEAT_CAP,
      canAddSeat: enforceSeatLimit(tier, seatCount),
    });
  } catch (err) {
    console.error("sub status error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

const statusUpdateSchema = z.object({
  tier: z.enum(["free", "starter", "unlimited"]),
  status: z.enum(["active", "expired", "past_due", "canceled"]),
  expiresAt: z.string().optional(),
});

router.post("/:patientId/subscription", authMiddleware, requireSeat, async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    await db.collection("subscriptions").updateOne(
      { patientId: req.params.patientId },
      { $set: { ...parsed.data, patientId: req.params.patientId, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("sub update error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
