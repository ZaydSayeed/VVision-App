import { describe, it, expect, beforeEach } from "vitest";
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
