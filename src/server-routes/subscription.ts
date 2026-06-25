import { Router } from "express";
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
    const tier = await loadTier(req.params.patientId as string);
    const db = getDb();
    const seatCount = await db.collection("seats").countDocuments({ patientId: req.params.patientId as string });
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

// NOTE: there is intentionally NO client-writable subscription endpoint.
// Entitlement state (tier/status) is the source of truth for the paywall and the
// seat-invite gate, so it is written ONLY by the signature-verified RevenueCat
// webhook (src/server-routes/revenueCatWebhook.ts). A client-facing write here
// would let any seat holder self-grant "unlimited" and bypass billing.

export default router;
