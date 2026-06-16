import { Router } from "express";
import { getDb } from "../server-core/database";
import { config } from "../server-core/config";
import { escalateHelpAlerts } from "../server-jobs/escalateHelpAlerts";
import { fireRemindersForAll } from "../server-jobs/fireReminders";

const router = Router();

/** A cron tick is authorized only when a secret is configured AND it matches. */
export function isAuthorizedCronRequest(
  provided: string | undefined,
  configured: string
): boolean {
  return !!configured && provided === configured;
}

// POST /api/internal/cron/tick
// An external scheduler (e.g. cron-job.org) hits this every minute so the
// minute-cadence jobs run reliably even when Render's free-tier process has the
// in-process node-cron asleep (SAFE-5). The request itself also wakes Render.
// Mounted before the rate limiter; protected by the CRON_SECRET shared secret.
router.post("/cron/tick", async (req, res) => {
  if (!config.cronSecret) {
    res.status(503).json({ detail: "Cron trigger not configured" });
    return;
  }
  if (!isAuthorizedCronRequest(req.get("x-cron-secret") ?? undefined, config.cronSecret)) {
    res.status(401).json({ detail: "Unauthorized" });
    return;
  }

  try {
    const db = getDb();
    // The jobs are idempotent (escalation claims levels atomically; reminders
    // dedup by notified_date), so running alongside in-process cron is safe.
    // allSettled so one job's failure never discards the other's work.
    const [escalation, reminders] = await Promise.allSettled([
      escalateHelpAlerts(db),
      fireRemindersForAll(db),
    ]);
    for (const r of [escalation, reminders]) {
      if (r.status === "rejected") console.error("cron tick job failed:", r.reason);
    }
    res.json({
      ok: escalation.status === "fulfilled" && reminders.status === "fulfilled",
      escalated: escalation.status === "fulfilled" ? escalation.value : null,
    });
  } catch (err) {
    console.error("cron tick error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
