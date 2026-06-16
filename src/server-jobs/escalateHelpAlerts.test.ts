import { describe, it, expect, beforeEach } from "vitest";
import { nextEscalationLevel, escalateHelpAlerts, DEFAULT_ESCALATION } from "./escalateHelpAlerts";

const T1 = DEFAULT_ESCALATION.steps[0].afterMs; // L2 threshold
const T2 = DEFAULT_ESCALATION.steps[1].afterMs; // L3 threshold

// Build an alert aged `ms` before the SAME `now` we evaluate against, so the
// computed age is exact (avoids clock drift between collection and run time).
function alertAged(now: Date, ms: number, extra: Record<string, unknown> = {}) {
  return { timestamp: new Date(now.getTime() - ms).toISOString(), ...extra };
}

describe("nextEscalationLevel", () => {
  it("does not escalate a fresh, just-tapped alert", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, 0), now)).toBeNull();
  });

  it("escalates to L2 once unanswered past the first threshold", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, T1 + 1000), now)).toBe(2);
  });

  it("jumps straight to L3 if the alert is already past the second threshold (missed ticks)", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000), now)).toBe(3);
  });

  it("does not re-fire a level it has already reached", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, T1 + 1000, { escalation_level: 2 }), now)).toBeNull();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000, { escalation_level: 3 }), now)).toBeNull();
  });

  it("never escalates an acknowledged, resolved, dismissed or cancelled alert", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000, { acknowledged: true }), now)).toBeNull();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000, { resolved: true }), now)).toBeNull();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000, { dismissed: true }), now)).toBeNull();
    expect(nextEscalationLevel(alertAged(now, T2 + 1000, { cancelled: true }), now)).toBeNull();
  });

  it("gives up once the alert is older than the give-up window", () => {
    const now = new Date();
    expect(nextEscalationLevel(alertAged(now, DEFAULT_ESCALATION.maxAgeMs + 60_000), now)).toBeNull();
  });
});

describe("escalateHelpAlerts (job)", () => {
  const db = () => globalThis.__TEST_DB__;

  beforeEach(async () => {
    await db().collection("help_alerts").deleteMany({});
    await db().collection("patients").deleteMany({});
  });

  it("re-pushes an open unanswered alert with the patient's name and records the level", async () => {
    const now = new Date();
    const p = await db().collection("patients").insertOne({ name: "Mary" });
    const pid = String(p.insertedId);
    await db().collection("help_alerts").insertOne(alertAged(now, T1 + 1000, { patient_id: pid, dismissed: false }));

    const calls: Array<{ patientId: string; name: string; level: number }> = [];
    const fakeNotify = async (_db: any, patientId: string, name: string, level: number) => {
      calls.push({ patientId, name, level });
      return 1;
    };

    const escalated = await escalateHelpAlerts(db(), now, fakeNotify);
    expect(escalated).toBe(1);
    expect(calls).toEqual([{ patientId: pid, name: "Mary", level: 2 }]);

    const alert = await db().collection("help_alerts").findOne({ patient_id: pid });
    expect(alert?.escalation_level).toBe(2);
    expect(typeof alert?.last_escalated_at).toBe("string");
  });

  it("does not re-fire the same level on the next tick", async () => {
    const now = new Date();
    const p = await db().collection("patients").insertOne({ name: "Mary" });
    const pid = String(p.insertedId);
    await db().collection("help_alerts").insertOne(alertAged(now, T1 + 1000, { patient_id: pid, dismissed: false }));

    let calls = 0;
    const notify = async () => { calls++; return 1; };
    await escalateHelpAlerts(db(), now, notify); // tick 1 → L2
    await escalateHelpAlerts(db(), now, notify); // tick 2 → nothing new
    expect(calls).toBe(1);
  });

  it("ignores alerts older than the give-up window (no mass back-page on deploy)", async () => {
    const now = new Date();
    const p = await db().collection("patients").insertOne({ name: "Mary" });
    const pid = String(p.insertedId);
    await db().collection("help_alerts").insertOne(
      alertAged(now, DEFAULT_ESCALATION.maxAgeMs + 60_000, { patient_id: pid, dismissed: false })
    );

    let calls = 0;
    const escalated = await escalateHelpAlerts(db(), now, async () => { calls++; return 1; });
    expect(escalated).toBe(0);
    expect(calls).toBe(0);
  });

  it("leaves acknowledged alerts alone (escalation stops once someone is responding)", async () => {
    const now = new Date();
    const p = await db().collection("patients").insertOne({ name: "Mary" });
    const pid = String(p.insertedId);
    await db().collection("help_alerts").insertOne(alertAged(now, T2 + 1000, { patient_id: pid, acknowledged: true, dismissed: false }));

    const calls: unknown[] = [];
    const escalated = await escalateHelpAlerts(db(), now, async () => { calls.push(1); return 1; });
    expect(escalated).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
