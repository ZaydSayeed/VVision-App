import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { config } from "../server-core/config";

export const liveSessionSchema = z.object({ patientId: z.string().min(1) });

const router = Router();

// POST /api/live/session/:patientId — returns WS URL + system instruction for the client
router.post("/session/:patientId", authMiddleware, requireSeat, async (req, res) => {
  try {
    const systemInstruction = `You are Vela, a caring voice companion helping a caregiver check in about their loved one with dementia. Keep responses warm, brief, and focused. The caregiver is speaking now.`;
    res.json({
      wsUrl: `${req.protocol}://${String(req.get("host"))}/api/live/ws?patientId=${encodeURIComponent(String(req.params.patientId))}`,
      model: config.geminiLiveModel,
      systemInstruction,
    });
  } catch (err: any) {
    console.error("live session error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

export default router;
