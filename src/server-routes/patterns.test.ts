import { describe, it, expect } from "vitest";
import { patternSchema } from "./patterns";

describe("patternSchema", () => {
  it("accepts a valid pattern", () => {
    expect(patternSchema.safeParse({
      title: "Tuesday afternoon agitation",
      description: "Mom has shown elevated anxiety 3 of the last 4 Tuesdays between 3-5pm",
      confidence: 0.7,
      evidenceCount: 4,
      firstObserved: "2026-03-01T00:00:00Z",
      lastObserved: "2026-04-11T00:00:00Z",
      tags: ["agitation", "weekly"],
    }).success).toBe(true);
  });
  it("rejects confidence >1", () => {
    expect(patternSchema.safeParse({ title: "X", description: "Y", confidence: 1.5, evidenceCount: 1, firstObserved: "x", lastObserved: "y", tags: [] }).success).toBe(false);
  });
});
