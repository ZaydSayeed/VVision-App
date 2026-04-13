import { describe, it, expect, beforeEach } from "vitest";
import { seatRoleEnum, seatCreateSchema } from "./seats";

describe("seatCreateSchema", () => {
  it("accepts a valid seat creation payload", () => {
    const res = seatCreateSchema.safeParse({
      email: "sister@example.com",
      role: "sibling",
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown role", () => {
    const res = seatCreateSchema.safeParse({
      email: "x@y.com",
      role: "stranger",
    });
    expect(res.success).toBe(false);
  });

  it("enumerates the four allowed roles", () => {
    expect(seatRoleEnum.options).toEqual([
      "primary_caregiver",
      "sibling",
      "paid_aide",
      "clinician",
    ]);
  });
});

describe("seat invitation flow (data layer)", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("seat_invites").deleteMany({});
  });

  it("creates an invite record with a unique token", async () => {
    const db = globalThis.__TEST_DB__;
    const patientId = "patient-1";
    await db.collection("seat_invites").insertOne({
      email: "sister@example.com",
      patientId,
      role: "sibling",
      token: "tok_abc123",
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    const invite = await db.collection("seat_invites").findOne({ token: "tok_abc123" });
    expect(invite?.email).toBe("sister@example.com");
    expect(invite?.status).toBe("pending");
  });
});

import { resolveSeatForRequest } from "../server-core/seatResolver";

describe("seat gate: no seat = 403", () => {
  it("returns null for a user with no seat (gate should 403)", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("seats").deleteMany({});
    const seat = await resolveSeatForRequest(db, "rando-user", "some-patient-id");
    expect(seat).toBeNull();
    // The middleware converts a null seat to HTTP 403. This unit check
    // proves the data layer signals "no access" correctly.
  });
});
