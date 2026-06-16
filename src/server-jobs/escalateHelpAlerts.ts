import { Db, ObjectId } from "mongodb";
import { notifyCaregiversOfHelp } from "../server-core/push";

/**
 * Escalation policy for an unanswered help/SOS alert (CG-8, SAFE-2).
 *
 * Each step says: once the alert is older than `afterMs` and no one has
 * acknowledged it, re-push the whole care team at this `level` (escalating copy).
 * `maxAgeMs` is a give-up window — past it, escalation stops (so a long-open
 * alert doesn't page forever, and a first deploy doesn't back-page history).
 * SMS/voice to an emergency contact is the deferred Twilio follow-up.
 */
export interface EscalationConfig {
  steps: { level: number; afterMs: number }[];
  maxAgeMs: number;
}

export const DEFAULT_ESCALATION: EscalationConfig = {
  steps: [
    { level: 2, afterMs: 2 * 60 * 1000 }, // still unanswered after 2 min
    { level: 3, afterMs: 5 * 60 * 1000 }, // urgent: respond or call after 5 min
  ],
  maxAgeMs: 60 * 60 * 1000, // give up after 1 hour
};

interface EscalatableAlert {
  timestamp?: string;
  escalation_level?: number;
  acknowledged?: boolean;
  resolved?: boolean;
  dismissed?: boolean;
  cancelled?: boolean;
}

/**
 * The next escalation level due for an alert, or null if none.
 * Returns the HIGHEST passed threshold above the alert's current level, so a
 * job that missed ticks (e.g. the server was asleep) catches up in one step.
 */
export function nextEscalationLevel(
  alert: EscalatableAlert,
  now: Date,
  config: EscalationConfig = DEFAULT_ESCALATION
): number | null {
  if (alert.acknowledged || alert.resolved || alert.dismissed || alert.cancelled) return null;
  if (!alert.timestamp) return null;

  const ageMs = now.getTime() - new Date(alert.timestamp).getTime();
  if (!(ageMs >= 0)) return null;
  if (ageMs > config.maxAgeMs) return null; // give up on stale alerts

  const current = alert.escalation_level ?? 1;
  let target = current;
  for (const step of config.steps) {
    if (ageMs >= step.afterMs && step.level > target) target = step.level;
  }
  return target > current ? target : null;
}

type NotifyFn = (db: Db, patientId: string, patientName: string, level: number) => Promise<number>;

/**
 * Re-push every open, unacknowledged help alert that has crossed a new
 * escalation threshold, recording the level so it is not re-fired.
 *
 * The level is claimed atomically (a conditional updateOne) BEFORE the push, so
 * neither a write failure nor an overlapping cron tick / second instance can
 * double-page or re-fire the same level every minute.
 *
 * NOTE: this runs on node-cron; on Render's free tier the process sleeps while
 * idle, so escalation will not fire until the next request wakes it. Moving to
 * an always-on trigger is the SAFE-5 follow-up.
 */
export async function escalateHelpAlerts(
  db: Db,
  now: Date = new Date(),
  notify: NotifyFn = notifyCaregiversOfHelp,
  config: EscalationConfig = DEFAULT_ESCALATION
): Promise<number> {
  const cutoff = new Date(now.getTime() - config.maxAgeMs).toISOString();
  const open = await db
    .collection("help_alerts")
    .find({
      dismissed: { $ne: true },
      resolved: { $ne: true },
      acknowledged: { $ne: true },
      cancelled: { $ne: true },
      timestamp: { $gte: cutoff }, // recency bound — never back-page old history
    })
    .toArray();

  let escalated = 0;
  for (const alert of open) {
    const level = nextEscalationLevel(alert as EscalatableAlert, now, config);
    if (level == null) continue;

    // Claim this level atomically: only the worker that actually advances the
    // level proceeds to push. Recording before the push prevents a re-fire flood.
    const claim = await db.collection("help_alerts").updateOne(
      { _id: alert._id, $or: [{ escalation_level: { $exists: false } }, { escalation_level: { $lt: level } }] },
      { $set: { escalation_level: level, last_escalated_at: now.toISOString() } }
    );
    if (claim.modifiedCount === 0) continue; // someone else already escalated to >= level

    const patientId = String(alert.patient_id);
    let name = "Your patient";
    if (ObjectId.isValid(patientId)) {
      const patient = await db.collection("patients").findOne({ _id: new ObjectId(patientId) });
      if (patient?.name) name = patient.name;
    }

    try {
      await notify(db, patientId, name, level);
      escalated++;
    } catch (err) {
      console.error("[escalateHelpAlerts] notify failed for alert", String(alert._id), err);
    }
  }
  return escalated;
}
