import { describe, it, expect } from "vitest";
import { computeCadence } from "./gait";

describe("computeCadence", () => {
  it("counts peaks per minute from accelerometer magnitudes", () => {
    // Synthetic: 30s at 50Hz = 1500 samples. 50 "steps" → 100 steps/min.
    const samples: number[] = [];
    for (let i = 0; i < 1500; i++) {
      // Peak every 30 samples (50Hz / 30 = ~1.67Hz ≈ 100 steps/min)
      samples.push(i % 30 === 0 ? 2.0 : 1.0);
    }
    const cadence = computeCadence(samples, 50);
    expect(cadence).toBeGreaterThan(95);
    expect(cadence).toBeLessThan(105);
  });
  it("returns 0 for no motion", () => {
    expect(computeCadence(new Array(500).fill(1.0), 50)).toBe(0);
  });
});
