import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export const seatRoleEnum = z.enum([
  "primary_caregiver",
  "sibling",
  "paid_aide",
  "clinician",
]);

export const seatCreateSchema = z.object({
  email: z.string().email().max(200),
  role: seatRoleEnum,
});

const router = Router();

// POST /api/profiles/:patientId/seats — invite a new seat
router.post("/:patientId/seats", authMiddleware, requireSeat, async (req, res) => {
  if (req.seat?.role !== "primary_caregiver") {
    res.status(403).json({ detail: "Only primary_caregiver can invite" }); return;
  }
  const parsed = seatCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const tier = await (async () => {
      const sub = await db.collection("subscriptions").findOne({ patientId: req.params.patientId, status: "active" });
      if (!sub) return "free" as const;
      if (sub.tier === "unlimited" || sub.tier === "starter") return sub.tier;
      return "free" as const;
    })();
    const seatCount = await db.collection("seats").countDocuments({ patientId: req.params.patientId });
    const pendingCount = await db.collection("seat_invites").countDocuments({ patientId: req.params.patientId, status: "pending" });
    const projected = seatCount + pendingCount;
    if (tier === "free") { res.status(402).json({ detail: "Active subscription required to invite" }); return; }
    if (tier === "starter" && projected >= 2) {
      res.status(402).json({ detail: "Starter plan reached (2 seats). Upgrade to Unlimited for more siblings." });
      return;
    }
    const token = randomBytes(24).toString("hex");
    await db.collection("seat_invites").insertOne({
      email: parsed.data.email.toLowerCase(),
      patientId: req.params.patientId,
      role: parsed.data.role,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ token, status: "pending" });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ detail: "Invite already exists for this email" }); return;
    }
    console.error("invite error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/profiles/:patientId/seats — list seats on this profile
router.get("/:patientId/seats", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const seats = await db.collection("seats").find({ patientId: req.params.patientId }).toArray();
    const invites = await db.collection("seat_invites").find({
      patientId: req.params.patientId, status: "pending"
    }).toArray();
    res.json({
      seats: seats.map((s) => ({ userId: s.userId, role: s.role, createdAt: s.createdAt })),
      invites: invites.map((i) => ({ email: i.email, role: i.role, status: i.status })),
    });
  } catch (err) {
    console.error("list seats error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.post("/accept-invite", authMiddleware, async (req, res) => {
  const parsed = z.object({ token: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const invite = await db.collection("seat_invites").findOne({ token: parsed.data.token, status: "pending" });
    if (!invite) { res.status(404).json({ detail: "Invite not found or already used" }); return; }
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ detail: "Unauthorized" }); return; }

    const user = await db.collection("users").findOne({ supabase_uid: userId });
    const userEmail = (user?.email || "").toLowerCase();
    if (!userEmail || userEmail !== invite.email.toLowerCase()) {
      res.status(403).json({ detail: "This invite is for a different email address" });
      return;
    }

    await db.collection("seats").insertOne({
      userId,
      patientId: invite.patientId,
      role: invite.role,
      createdAt: new Date().toISOString(),
    });
    await db.collection("seat_invites").updateOne(
      { _id: invite._id },
      { $set: { status: "accepted", acceptedAt: new Date().toISOString() } }
    );
    res.json({ ok: true, patientId: invite.patientId, role: invite.role });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ detail: "You already have a seat on this profile" }); return;
    }
    console.error("accept invite error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
