import { describe, it, expect } from "vitest";
import { expandOccurrences, buildDailyRule, buildWeeklyRule } from "./recurrence";

describe("expandOccurrences", () => {
  it("returns the single start time when there is no recurrence rule and it's in range", () => {
    const result = expandOccurrences(
      "2026-07-10T15:00:00.000Z", null,
      "2026-07-01T00:00:00.000Z", "2026-07-31T00:00:00.000Z"
    );
    expect(result).toEqual(["2026-07-10T15:00:00.000Z"]);
  });

  it("returns empty when non-recurring event is outside the range", () => {
    const result = expandOccurrences(
      "2026-08-10T15:00:00.000Z", null,
      "2026-07-01T00:00:00.000Z", "2026-07-31T00:00:00.000Z"
    );
    expect(result).toEqual([]);
  });

  it("expands a daily rule across the requested window", () => {
    const rule = buildDailyRule();
    const result = expandOccurrences(
      "2026-07-10T09:00:00.000Z", rule,
      "2026-07-10T00:00:00.000Z", "2026-07-13T00:00:00.000Z"
    );
    expect(result).toEqual([
      "2026-07-10T09:00:00.000Z",
      "2026-07-11T09:00:00.000Z",
      "2026-07-12T09:00:00.000Z",
    ]);
  });

  it("expands a weekly rule on specific days", () => {
    // 2026-07-10 is a Friday. Weekly on Mon/Wed starting that Friday should
    // first occur the following Monday (2026-07-13).
    const rule = buildWeeklyRule([1, 3]); // Mon, Wed
    const result = expandOccurrences(
      "2026-07-10T09:00:00.000Z", rule,
      "2026-07-10T00:00:00.000Z", "2026-07-16T00:00:00.000Z"
    );
    expect(result).toEqual([
      "2026-07-13T09:00:00.000Z",
      "2026-07-15T09:00:00.000Z",
    ]);
  });
});
