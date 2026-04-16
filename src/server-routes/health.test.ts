import { describe, it, expect } from "vitest";
import { syncSchema, trendsQuerySchema } from "./health";

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

describe("trendsQuerySchema", () => {
  it("accepts valid metric + range", () => {
    expect(trendsQuerySchema.safeParse({ metric: "steps", range: "7d" }).success).toBe(true);
  });
  it("defaults range to 30d when omitted", () => {
    const r = trendsQuerySchema.safeParse({ metric: "steps" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.range).toBe("30d");
  });
  it("rejects unknown range", () => {
    expect(trendsQuerySchema.safeParse({ metric: "steps", range: "1y" }).success).toBe(false);
  });
});
