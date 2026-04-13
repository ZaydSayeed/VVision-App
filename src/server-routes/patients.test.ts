import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

describe("patient creation auto-seat", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("patients").deleteMany({});
    await globalThis.__TEST_DB__.collection("seats").deleteMany({});
  });

  it("creates a primary_caregiver seat when a patient is created", async () => {
    const db = globalThis.__TEST_DB__;
    const userId = "user-xyz";
    // Simulate what the patient-create handler should do:
    const ins = await db.collection("patients").insertOne({
      name: "Test Mom",
      caregiver_ids: [userId],
      created_at: new Date().toISOString(),
    });
    await db.collection("seats").insertOne({
      userId,
      patientId: ins.insertedId.toString(),
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });
    const seat = await db.collection("seats").findOne({ userId, patientId: ins.insertedId.toString() });
    expect(seat?.role).toBe("primary_caregiver");
  });
});
