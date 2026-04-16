import { describe, it, expect } from "vitest";
import { syncSchema } from "./health";

describe("syncSchema", () => {
  it("accepts a valid batch", () => {
    const r = syncSchema.safeParse({
      readings: [
        { metric: "steps", date: "2026-04-16", value: 4821, unit: "count" },
        { metric: "heart_rate", date: "2026-04-16", value: 72, unit: "bpm" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown metric", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "nope", date: "2026-04-16", value: 1, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects empty batch", () => {
    expect(syncSchema.safeParse({ readings: [] }).success).toBe(false);
  });
  it("rejects bad date format", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "steps", date: "04/16/2026", value: 1, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects negative value", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "steps", date: "2026-04-16", value: -5, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
});
