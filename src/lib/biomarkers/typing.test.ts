import { describe, it, expect } from "vitest";
import { computeTypingMetrics } from "./typing";

describe("computeTypingMetrics", () => {
  it("calculates words-per-minute and average inter-key interval", () => {
    // 20 keystrokes, each 200ms apart = 4s total for 20 chars = ~60 WPM
    const times: number[] = [];
    for (let i = 0; i < 20; i++) times.push(i * 200);
    const m = computeTypingMetrics(times);
    expect(m.avgIntervalMs).toBeCloseTo(200, 0);
    expect(m.wpm).toBeGreaterThan(55);
    expect(m.wpm).toBeLessThan(65);
  });
  it("returns zeros for <2 keystrokes", () => {
    expect(computeTypingMetrics([]).wpm).toBe(0);
    expect(computeTypingMetrics([100]).wpm).toBe(0);
  });
});
