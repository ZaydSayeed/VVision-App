import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { resolveSeatForRequest } from "../server-core/seatResolver";

describe("Living Profile full flow (data layer)", () => {
  beforeEach(async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("patients").deleteMany({});
    await db.collection("seats").deleteMany({});
    await db.collection("seat_invites").deleteMany({});
  });

  it("primary caregiver creates patient, invites sibling, sibling accepts, both can read", async () => {
    const db = globalThis.__TEST_DB__;

    // 1. Primary creates patient + auto-seat
    const primaryUserId = "primary-user";
    const ins = await db.collection("patients").insertOne({
      name: "Mom",
      caregiver_ids: [primaryUserId],
      stage: "moderate",
      created_at: new Date().toISOString(),
    });
    const patientId = ins.insertedId.toString();
    await db.collection("seats").insertOne({
      userId: primaryUserId,
      patientId,
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });

    // 2. Primary invites sibling
    await db.collection("seat_invites").insertOne({
      email: "sibling@family.com",
      patientId,
      role: "sibling",
      token: "tok_flow",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // 3. Sibling signs up as `siblingUserId` and accepts
    const siblingUserId = "sibling-user";
    const invite = await db.collection("seat_invites").findOne({ token: "tok_flow" });
    expect(invite).not.toBeNull();
    await db.collection("seats").insertOne({
      userId: siblingUserId,
      patientId: invite!.patientId,
      role: invite!.role,
      createdAt: new Date().toISOString(),
    });
    await db.collection("seat_invites").updateOne(
      { _id: invite!._id },
      { $set: { status: "accepted" } }
    );

    // 4. Both users resolve a seat on the same profile
    const primarySeat = await resolveSeatForRequest(db, primaryUserId, patientId);
    const siblingSeat = await resolveSeatForRequest(db, siblingUserId, patientId);
    expect(primarySeat?.role).toBe("primary_caregiver");
    expect(siblingSeat?.role).toBe("sibling");

    // 5. Unknown user gets no seat
    const randoSeat = await resolveSeatForRequest(db, "rando", patientId);
    expect(randoSeat).toBeNull();
  });
});
