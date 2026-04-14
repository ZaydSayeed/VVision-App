import { describe, it, expect } from "vitest";
import { eventBatchSchema } from "./events";

describe("eventBatchSchema", () => {
  it("accepts a batch of events", () => {
    const res = eventBatchSchema.safeParse({
      events: [
        { kind: "motion", capturedAt: new Date().toISOString(), data: { room: "kitchen" } },
        { kind: "gait", capturedAt: new Date().toISOString(), data: { cadence: 102 } },
      ],
    });
    expect(res.success).toBe(true);
  });
  it("rejects missing kind", () => {
    expect(eventBatchSchema.safeParse({ events: [{ capturedAt: "2026-01-01T00:00:00Z", data: {} }] }).success).toBe(false);
  });
  it("rejects >100 events per batch", () => {
    const ev = { kind: "motion", capturedAt: new Date().toISOString(), data: {} };
    expect(eventBatchSchema.safeParse({ events: Array(101).fill(ev) }).success).toBe(false);
  });
});
