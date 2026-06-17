import { describe, it, expect, beforeEach } from "vitest";
import { alertOut, insertHelpAlertIdempotent } from "./helpAlerts";

describe("alertOut — acknowledgement fields", () => {
  it("defaults acknowledged state to false/null when absent", () => {
    const out = alertOut({ _id: "x", patient_id: "p1", timestamp: "t" });
    expect(out.acknowledged).toBe(false);
    expect(out.acknowledged_at).toBeNull();
  });

  it("passes through a recorded acknowledgement (who-is-responding state)", () => {
    const out = alertOut({
      _id: "x",
      patient_id: "p1",
      timestamp: "t",
      acknowledged: true,
      acknowledged_at: "2026-06-16T10:00:00Z",
    });
    expect(out.acknowledged).toBe(true);
    expect(out.acknowledged_at).toBe("2026-06-16T10:00:00Z");
  });
});

describe("insertHelpAlertIdempotent — SOS dedup (SAFE-1)", () => {
  const db = () => globalThis.__TEST_DB__;

  beforeEach(async () => {
    await db().collection("help_alerts").deleteMany({});
  });

  it("a retried POST with the same client_id resolves to the same alert (no duplicate SOS)", async () => {
    // Simulates the server committing, the response getting lost, and the durable
    // queue re-POSTing on the next flush.
    const first = await insertHelpAlertIdempotent(db(), "p1", "queue-id-abc");
    const second = await insertHelpAlertIdempotent(db(), "p1", "queue-id-abc");

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false); // retry → NOT a new alert, so no second page
    expect(String(second.doc._id)).toBe(String(first.doc._id));
    const count = await db().collection("help_alerts").countDocuments({ patient_id: "p1" });
    expect(count).toBe(1); // exactly one SOS document, not two
  });

  it("without a client_id, each call creates a distinct alert (legacy path unchanged)", async () => {
    const a = await insertHelpAlertIdempotent(db(), "p2");
    const b = await insertHelpAlertIdempotent(db(), "p2");

    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(true);
    expect(String(a.doc._id)).not.toBe(String(b.doc._id));
    const count = await db().collection("help_alerts").countDocuments({ patient_id: "p2" });
    expect(count).toBe(2);
  });
});
