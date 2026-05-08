import { Router } from "express";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// POST /api/notifications/register-patient-token
// Called by patient app on login to store their Expo push token
router.post("/register-patient-token", authMiddleware, resolvePatientId, async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken || typeof expoPushToken !== "string") {
    res.status(400).json({ detail: "expoPushToken required" });
    return;
  }
  try {
    const db = getDb();
    await db.collection("patient_push_tokens").updateOne(
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

export default router;
