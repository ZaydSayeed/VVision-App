import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { resolveSeatForRequest } from "./seatResolver";

describe("resolveSeatForRequest", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("seats").deleteMany({});
  });

  it("returns null when user has no seat on the patient", async () => {
    const db = globalThis.__TEST_DB__;
    const seat = await resolveSeatForRequest(db, "user-abc", "507f1f77bcf86cd799439011");
    expect(seat).toBeNull();
  });

  it("returns the seat with role when the user has one", async () => {
    const db = globalThis.__TEST_DB__;
    const patientId = new ObjectId();
    await db.collection("seats").insertOne({
      userId: "user-abc",
      patientId: patientId.toString(),
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });
    const seat = await resolveSeatForRequest(db, "user-abc", patientId.toString());
    expect(seat?.role).toBe("primary_caregiver");
  });
});
