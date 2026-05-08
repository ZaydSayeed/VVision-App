import { Router } from "express";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// POST /api/notifications/register-patient-token
// Called by patient app on login to store their Expo push token
router.post("/register-patient-token", authMiddleware, resolvePatientId, async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken || typeof expoPushToken !== "string" || !expoPushToken.startsWith("ExponentPushToken[")) {
    res.status(400).json({ detail: "expoPushToken required" });
    return;
  }
  try {
    const db = getDb();
    await db.collection("patientPushTokens").updateOne(
      { userId: req.auth!.userId },
      {
        $set: {
          userId: req.auth!.userId,
          patientId: req.patientId!,
          expoPushToken,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("register-patient-token error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/notifications/zone-exit — patient app signals zone departure
router.post("/zone-exit", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patientId = req.patientId!;

    // Rate-limit: only send once per hour per patient
    const lastAlert = await db.collection("geofences").findOne({ patientId });
    if (lastAlert?.lastZoneAlert) {
      const elapsed = Date.now() - new Date(lastAlert.lastZoneAlert).getTime();
      if (elapsed < 60 * 60 * 1000) {
        res.json({ sent: false, reason: "rate_limited" });
        return;
      }
    }

    // Get patient name
    const user = await db.collection("users").findOne({ patient_id: patientId });
    const patientName = user?.name ?? "Your patient";

    // Get caregiver push token
    const tokenDoc = await db.collection("pushTokens").findOne({ patientId });
    if (!tokenDoc?.expoPushToken) {
      res.json({ sent: false, reason: "no_caregiver_token" });
      return;
    }

    // Record last alert time BEFORE push (prevents retry storm if Expo is down)
    await db.collection("geofences").updateOne(
      { patientId },
      { $set: { lastZoneAlert: new Date() } },
      { upsert: true }
    );

    // Send push
    const pushRes = await fetch("https://exp.host/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: tokenDoc.expoPushToken,
        title: "Zone Alert",
        body: `${patientName} has left their safe zone.`,
        data: { patientId, type: "zone_exit" },
        priority: "high",
      }),
    });
    const pushJson = await pushRes.json();
    const ticket = pushJson?.data?.[0];
    if (ticket?.status === "error") {
      console.error("[zone-exit] push error:", ticket.details);
    }

    res.json({ sent: true });
  } catch (err) {
    console.error("zone-exit error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
