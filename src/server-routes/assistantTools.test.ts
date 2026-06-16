import { describe, it, expect } from "vitest";
import { buildAssistantTools, normalizeMedicationArgs } from "./assistantTools";

describe("normalizeMedicationArgs", () => {
  it("keeps a fully-specified medication and reports nothing missing", () => {
    const r = normalizeMedicationArgs({ name: "Donepezil", dosage: "10mg", time: "8:00 AM" });
    expect(r).toEqual({ name: "Donepezil", dosage: "10mg", time: "8:00 AM", missing: [] });
  });

  it("NEVER fabricates a missing dosage — it reports it as missing", () => {
    const r = normalizeMedicationArgs({ name: "Donepezil", time: "8:00 AM" });
    expect(r.dosage).toBeNull();
    expect(r.missing).toContain("dosage");
  });

  it("NEVER fabricates a missing time — it reports it as missing", () => {
    const r = normalizeMedicationArgs({ name: "Donepezil", dosage: "10mg" });
    expect(r.time).toBeNull();
    expect(r.missing).toContain("time");
  });

  it("treats blank/whitespace dosage as missing (no silent 'as prescribed')", () => {
    const r = normalizeMedicationArgs({ name: "Donepezil", dosage: "   ", time: "8am" });
    expect(r.dosage).toBeNull();
    expect(r.missing).toContain("dosage");
  });
});

describe("buildAssistantTools", () => {
  it("gives a patient NO write tools — the assistant is read-only for patients", () => {
    const names = buildAssistantTools("patient").map((t) => t.function?.name);
    expect(names).not.toContain("create_medication");
    expect(names).not.toContain("create_task");
    expect(names).not.toContain("create_reminder");
  });

  it("gives a caregiver the create tools", () => {
    const names = buildAssistantTools("caregiver").map((t) => t.function?.name);
    expect(names).toContain("create_medication");
    expect(names).toContain("create_task");
    expect(names).toContain("create_reminder");
  });
});
