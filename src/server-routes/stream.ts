import { Router } from "express";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// GET /stream/events (SSE)
router.get("/events", authMiddleware, resolvePatientId, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastCheck = "";
  const interval = setInterval(async () => {
    try {
      const db = getDb();
      const latest = await db
        .collection("people")
        .findOne(
          { patient_id: req.patientId!, last_seen: { $ne: null } },
          { projection: { last_seen: 1 }, sort: { last_seen: -1 } }
        );

      const current = latest?.last_seen || "";
      if (current !== lastCheck) {
        lastCheck = current;
        res.write(`data: ${JSON.stringify({ type: "update", ts: current })}\n\n`);
      }
    } catch {}
  }, 3000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

export default router;
