import { describe, it, expect } from "vitest";
import { buildVisitPrepBuffer } from "./visitPrepPdf";

describe("buildVisitPrepBuffer", () => {
  it("produces a non-empty PDF buffer for minimal input", async () => {
    const buf = await buildVisitPrepBuffer({
      patientName: "Mom",
      providerName: "Dr. Patel",
      scheduledFor: "2026-05-10T14:00:00Z",
      stage: "moderate",
      medications: [{ name: "Donepezil", dose: "10mg", schedule: "daily" }],
      eventsSummary: "12 motion events, 3 door events, 1 voice check-in",
      patterns: [{ title: "Tue 4pm agitation", description: "…" }],
      siblingNotes: "Pet therapy helped on Saturday.",
    });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});
