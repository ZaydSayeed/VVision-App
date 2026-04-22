import { Router } from "express";
import { getDb } from "../server-core/database";
import { config } from "../server-core/config";

const router = Router();

router.post("/revenuecat", async (req, res) => {
  const auth = req.header("Authorization");
  if (!config.revenueCatWebhookSecret || auth !== `Bearer ${config.revenueCatWebhookSecret}`) {
    res.status(401).json({ detail: "Unauthorized" }); return;
  }
  try {
    const evt = req.body?.event;
    if (!evt) { res.status(400).json({ detail: "No event" }); return; }
    const appUserId: string = evt.app_user_id;
    const productId: string = evt.product_id ?? "";
    const type: string = evt.type;
    const tier = productId.includes("unlimited") ? "unlimited" : productId.includes("starter") ? "starter" : "free";
    const status = ["EXPIRATION", "CANCELLATION"].includes(type) ? "expired" : "active";

    const db = getDb();
    const user = await db.collection("users").findOne({ supabase_uid: appUserId });
    const patientId = user?.patient_id;
    if (!patientId) { res.json({ ok: true, note: "no patientId on user" }); return; }
    await db.collection("subscriptions").updateOne(
      { patientId },
      { $set: { patientId, tier, status, expiresAt: evt.expiration_at_ms, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("rc webhook error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
