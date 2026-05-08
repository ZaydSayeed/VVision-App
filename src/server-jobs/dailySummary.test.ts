import { describe, it, expect, vi } from "vitest";
import { buildSummaryContext } from "./dailySummary";

describe("buildSummaryContext", () => {
  it("returns a context string with all fields when data is present", () => {
    const ctx = buildSummaryContext({
      patientName: "Margaret",
      sleepHours: 7.5,
      steps: 1200,
      medsDoneCount: 2,
      medsTotalCount: 3,
      helpAlertsCount: 0,
    });
    expect(ctx).toContain("Margaret");
    expect(ctx).toContain("7.5");
    expect(ctx).toContain("2/3");
    expect(ctx).toContain("0 help");
  });

  it("handles missing health data gracefully", () => {
    const ctx = buildSummaryContext({
      patientName: "Bob",
      sleepHours: null,
      steps: null,
      medsDoneCount: 0,
      medsTotalCount: 0,
      helpAlertsCount: 1,
    });
    expect(ctx).toContain("Bob");
    expect(ctx).toContain("no sleep data");
    expect(ctx).toContain("1 help");
  });
});
