import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { config } from "../server-core/config";
import { signLiveToken } from "../server-core/liveToken";
import { getDb } from "../server-core/database";
import { getConsent, hasConsent } from "../server-core/consent";

export const liveSessionSchema = z.object({ patientId: z.string().min(1) });

const router = Router();

// POST /api/live/session/:patientId — returns WS URL + system instruction for the client
router.post("/session/:patientId", authMiddleware, requireSeat, async (req, res) => {
  try {
    if (!config.liveWsSecret) {
      res.status(503).json({ detail: "Voice check-ins are not available right now." });
      return;
    }
    const patientId = String(req.params.patientId);

    // Voice audio is streamed to a third-party LLM (Gemini), so gate on the same
    // aiAssistant consent as the text assistant and the Mem0 memory paths (SEC-02).
    // Without this, a caregiver could run an AI voice check-in about a patient who
    // explicitly opted out of AI.
    const consent = await getConsent(getDb(), patientId);
    if (!hasConsent(consent, "aiAssistant")) {
      res.status(403).json({ detail: "AI help is turned off for this profile. You can turn it on under Privacy & Sharing." });
      return;
    }

    const token = signLiveToken({ patientId, userId: req.auth!.userId }, config.liveWsSecret);
    const systemInstruction = `You are Vela, a caring voice companion helping a caregiver check in about their loved one with dementia. Keep responses warm, brief, and focused. The caregiver is speaking now.`;
    res.json({
      wsUrl: `${req.protocol}://${String(req.get("host"))}/api/live/ws?patientId=${encodeURIComponent(patientId)}&token=${encodeURIComponent(token)}`,
      model: config.geminiLiveModel,
      systemInstruction,
    });
  } catch (err: any) {
    console.error("live session error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

export default router;
