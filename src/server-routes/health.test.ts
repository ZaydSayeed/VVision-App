import { describe, it, expect } from "vitest";
import { syncSchema, trendsQuerySchema, fillDailyGaps, fillHourlyGaps, aggregateByWeek } from "./health";

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
  it("defaults range to 7d when omitted", () => {
    const r = trendsQuerySchema.safeParse({ metric: "steps" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.range).toBe("7d");
  });
  it("rejects unknown range", () => {
    expect(trendsQuerySchema.safeParse({ metric: "steps", range: "1y" }).success).toBe(false);
  });
});

describe("fillDailyGaps", () => {
  it("generates all dates between since and anchor inclusive", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-03", []);
    expect(result.map((p) => p.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });

  it("fills 0 for missing dates", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-03", [
      { date: "2026-05-02", value: 5000 },
    ]);
    expect(result).toEqual([
      { date: "2026-05-01", value: 0 },
      { date: "2026-05-02", value: 5000 },
      { date: "2026-05-03", value: 0 },
    ]);
  });

  it("returns single point when since equals anchor", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-01", [{ date: "2026-05-01", value: 3000 }]);
    expect(result).toEqual([{ date: "2026-05-01", value: 3000 }]);
  });
});

describe("fillHourlyGaps", () => {
  it("always returns exactly 24 points", () => {
    expect(fillHourlyGaps([]).length).toBe(24);
  });

  it("fills 0 for missing hours", () => {
    const result = fillHourlyGaps([{ date: "09:00", value: 72 }]);
    expect(result[0]).toEqual({ date: "00:00", value: 0 });
    expect(result[9]).toEqual({ date: "09:00", value: 72 });
    expect(result[23]).toEqual({ date: "23:00", value: 0 });
  });

  it("keys are zero-padded HH:00", () => {
    const result = fillHourlyGaps([]);
    expect(result[0].date).toBe("00:00");
    expect(result[9].date).toBe("09:00");
    expect(result[23].date).toBe("23:00");
  });
});

describe("aggregateByWeek", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateByWeek([])).toEqual([]);
  });

  it("groups days into the correct Monday bucket", () => {
    // 2026-05-06 is Wednesday, its Monday is 2026-05-04
    const result = aggregateByWeek([
      { date: "2026-05-04", value: 1000 },
      { date: "2026-05-06", value: 2000 },
      { date: "2026-05-08", value: 3000 },
    ]);
    expect(result).toEqual([{ date: "2026-05-04", value: 2000 }]);
  });

  it("handles Sunday correctly (maps to previous Monday)", () => {
    // 2026-05-10 is Sunday, its Monday is 2026-05-04
    const result = aggregateByWeek([{ date: "2026-05-10", value: 500 }]);
    expect(result[0].date).toBe("2026-05-04");
  });

  it("produces one point per week across multiple weeks", () => {
    const result = aggregateByWeek([
      { date: "2026-05-04", value: 1000 }, // week of May 4
      { date: "2026-05-11", value: 2000 }, // week of May 11
    ]);
    expect(result.length).toBe(2);
    expect(result[0].date).toBe("2026-05-04");
    expect(result[1].date).toBe("2026-05-11");
  });
});
