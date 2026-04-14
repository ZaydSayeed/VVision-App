import { describe, it, expect } from "vitest";
import { liveSessionSchema } from "./live";

describe("liveSessionSchema", () => {
  it("accepts a patientId", () => {
    expect(liveSessionSchema.safeParse({ patientId: "p1" }).success).toBe(true);
  });
  it("rejects missing patientId", () => {
    expect(liveSessionSchema.safeParse({}).success).toBe(false);
  });
});
