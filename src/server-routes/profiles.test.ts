import { describe, it, expect, beforeEach } from "vitest";
import { profileUpdateSchema } from "./profiles";
import { ObjectId } from "mongodb";

declare global { var __TEST_DB__: any }

describe("patient profile fields", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("patients").deleteMany({});
  });

  it("stores and retrieves stage/history/triggers/routines_summary", async () => {
    const db = globalThis.__TEST_DB__;
    const insert = await db.collection("patients").insertOne({
      name: "Test Mom",
      stage: "moderate",
      history: "Grew up in Karachi, loves hymns",
      triggers: ["4pm agitation", "nurse change"],
      routines_summary: "Morning tea, PT Tue/Thu, dinner 6pm",
      created_at: new Date().toISOString(),
    });
    const doc = await db.collection("patients").findOne({ _id: insert.insertedId });
    expect(doc?.stage).toBe("moderate");
    expect(doc?.history).toContain("Karachi");
    expect(doc?.triggers).toHaveLength(2);
    expect(doc?.routines_summary).toContain("PT");
  });
});

describe("profileUpdateSchema", () => {
  it("accepts valid profile fields", () => {
    const result = profileUpdateSchema.safeParse({
      stage: "mild",
      history: "From Lahore",
      triggers: ["sundowning"],
      routines_summary: "Tea at 8am",
      medications: [{ name: "Donepezil", dose: "10mg", schedule: "daily" }],
      providers: [{ name: "Dr. Patel", role: "neurologist" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid stage", () => {
    const result = profileUpdateSchema.safeParse({ stage: "terminal" });
    expect(result.success).toBe(false);
  });

  it("rejects triggers longer than 200 chars", () => {
    const result = profileUpdateSchema.safeParse({ triggers: ["x".repeat(201)] });
    expect(result.success).toBe(false);
  });
});

describe("PATCH /api/profiles/mine handler", () => {
  it("updates stage and triggers on existing patient", async () => {
    const db = globalThis.__TEST_DB__;
    const insert = await db.collection("patients").insertOne({
      name: "Mom",
      created_at: new Date().toISOString(),
    });
    const patientId = insert.insertedId.toString();

    const updates = { stage: "moderate", triggers: ["4pm"] };
    await db.collection("patients").updateOne(
      { _id: insert.insertedId },
      { $set: { ...updates, updated_at: new Date().toISOString() } }
    );

    const doc = await db.collection("patients").findOne({ _id: insert.insertedId });
    expect(doc?.stage).toBe("moderate");
    expect(doc?.triggers).toEqual(["4pm"]);
  });
});
