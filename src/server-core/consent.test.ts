import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultConsent,
  applyConsentUpdate,
  hasConsent,
  filterEventsByConsent,
  getConsent,
  saveConsent,
} from "./consent";

describe("consent model", () => {
  it("defaults every category to OFF (opt-in)", () => {
    const c = defaultConsent();
    expect(c.healthMetrics).toBe(false);
    expect(c.activityPatterns).toBe(false);
    expect(c.updatedAt).toBeNull();
  });

  it("applyConsentUpdate merges only valid categories and records who/when", () => {
    const next = applyConsentUpdate(
      defaultConsent(),
      { healthMetrics: true, bogus: true } as any,
      { userId: "u1", role: "patient" },
      "2026-06-16T00:00:00Z"
    );
    expect(next.healthMetrics).toBe(true);
    expect(next.activityPatterns).toBe(false);
    expect((next as any).bogus).toBeUndefined();
    expect(next.updatedBy).toBe("u1");
    expect(next.updatedByRole).toBe("patient");
    expect(next.updatedAt).toBe("2026-06-16T00:00:00Z");
  });

  it("hasConsent reflects the category and defaults to false", () => {
    expect(hasConsent(null, "healthMetrics")).toBe(false);
    expect(hasConsent(defaultConsent(), "healthMetrics")).toBe(false);
    expect(hasConsent({ ...defaultConsent(), healthMetrics: true }, "healthMetrics")).toBe(true);
  });

  it("filterEventsByConsent drops biomarker events unless activityPatterns is consented", () => {
    const events = [
      { kind: "gait" },
      { kind: "typing_cadence" },
      { kind: "voice_sample" },
      { kind: "motion" },
      { kind: "door" },
    ];
    const denied = filterEventsByConsent(events as any, defaultConsent());
    expect(denied.map((e) => e.kind)).toEqual(["motion", "door"]); // biomarkers dropped
    const allowed = filterEventsByConsent(events as any, { ...defaultConsent(), activityPatterns: true });
    expect(allowed).toHaveLength(5); // all kept once consented
  });
});

describe("consent store", () => {
  const db = () => globalThis.__TEST_DB__;
  beforeEach(async () => {
    await db().collection("consents").deleteMany({});
  });

  it("getConsent returns opt-in defaults when none is recorded", async () => {
    const c = await getConsent(db(), "p1");
    expect(c.healthMetrics).toBe(false);
    expect(c.activityPatterns).toBe(false);
  });

  it("saveConsent persists and getConsent reads it back with audit", async () => {
    const state = applyConsentUpdate(
      defaultConsent(),
      { healthMetrics: true },
      { userId: "u1", role: "patient" },
      "t"
    );
    await saveConsent(db(), "p1", state);
    const c = await getConsent(db(), "p1");
    expect(c.healthMetrics).toBe(true);
    expect(c.updatedBy).toBe("u1");
    expect(c.updatedByRole).toBe("patient");
  });
});
